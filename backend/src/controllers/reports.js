/**
 * Daily work report controller.
 *
 * Managers and admins may read any employee's reports; team members are pinned to
 * their own id, so a team member cannot read a colleague's work log by changing the
 * query string. Writing a report is a team-member action only.
 *
 * "Today" throughout is `req.today`: the calendar date in the employee's own timezone
 * (from their profile or the X-Client-Timezone header, resolved by requireAuth). A
 * person in another zone from the server would otherwise be refused their own
 * same-day report for part of every day.
 */
import { ok } from '../utils/http.js';
import { asyncHandler, badRequest, forbidden } from '../utils/errors.js';
import { isManagerLevel, isTeamMember } from '../utils/roles.js';
import { departmentScope, isEmptyScope, scopedDepartment } from '../utils/scope.js';
import { today, resolveRange, dayDiff } from '../utils/dates.js';
import {
  listReports, getReportForDate, saveReport, deleteReport, suggestReportItems,
} from '../models/report.js';

export const list = asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const { from, to } = resolveRange(q.range, q.from, q.to, req.today);

  const scope = departmentScope(req.user);
  // A manager reads only their own department's reports; an employee only their own.
  if (isManagerLevel(req.user.role) && isEmptyScope(scope)) {
    return ok(res, [], { total: 0, limit: q.limit, offset: q.offset, from, to });
  }

  const filters = {
    from, to, search: q.search, limit: q.limit, offset: q.offset,
    employeeId: isManagerLevel(req.user.role) ? q.employeeId : req.user.id,
    department: isManagerLevel(req.user.role) ? scopedDepartment(scope, q.department) : undefined,
  };

  const { items, total } = await listReports(filters);
  return ok(res, items, { total, limit: q.limit, offset: q.offset, from, to });
});

/**
 * GET /api/reports/today — the employee's own report for today, if any.
 *
 * `meta.today` says which date the server considers today for this caller, so a client
 * renders the same day it will be allowed to save.
 */
export const getToday = asyncHandler(async (req, res) => {
  if (!isTeamMember(req.user.role)) throw forbidden('Only team members submit daily reports.');
  const report = await getReportForDate(req.user.id, req.today);
  return ok(res, report, { today: req.today, timezone: req.timezone });
});

/** GET /api/reports/suggestions — tasks worth adding as lines to today's report. */
export const suggestions = asyncHandler(async (req, res) => {
  if (!isTeamMember(req.user.role)) throw forbidden('Only team members submit daily reports.');
  const tasks = await suggestReportItems(req.user.id, req.today);
  return ok(res, tasks, { today: req.today, total: tasks.length });
});

/**
 * POST /api/reports — Save / Update for the current day.
 * Reports may only be written for today: back-dating would let someone quietly rewrite
 * history, and the manager relies on these being a same-day record. Today is the
 * employee's own — see the header comment.
 */
export const save = asyncHandler(async (req, res) => {
  if (!isTeamMember(req.user.role)) throw forbidden('Only team members submit daily reports.');

  const reportDate = req.body.reportDate || req.today;
  if (reportDate !== req.today) {
    throw badRequest('You can only save or edit your report for today.');
  }
  // A valid IANA zone can only ever be one calendar day either side of the server's
  // own. The check restates that invariant so a bad header can never widen the rule.
  if (Math.abs(dayDiff(today(), reportDate)) > 1) {
    throw badRequest('You can only save or edit your report for today.');
  }

  const { report, createdNew } = await saveReport({
    employeeId: req.user.id,
    reportDate,
    taskDescription: req.body.taskDescription,
    items: req.body.items,
  });

  return ok(res, {
    report,
    createdNew,
    message: createdNew ? 'Your task report has been submitted.' : 'Your task report has been updated.',
  });
});

export const remove = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid report id.');
  if (!isTeamMember(req.user.role)) throw forbidden('Only team members manage their own reports.');
  await deleteReport({ employeeId: req.user.id, reportId: id });
  return ok(res, { message: 'Report deleted.' });
});
