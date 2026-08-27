/**
 * Daily work report controller.
 *
 * Managers and admins may read any employee's reports; team members are pinned to
 * their own id, so a team member cannot read a colleague's work log by changing the
 * query string. Writing a report is a team-member action only.
 */
import { ok } from '../utils/http.js';
import { asyncHandler, badRequest, forbidden } from '../utils/errors.js';
import { isManagerLevel, isTeamMember } from '../utils/roles.js';
import { today, resolveRange } from '../utils/dates.js';
import { listReports, getReportForDate, saveReport, deleteReport } from '../models/report.js';

export const list = asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const { from, to } = resolveRange(q.range, q.from, q.to);

  const filters = {
    from, to, search: q.search, limit: q.limit, offset: q.offset,
    employeeId: isManagerLevel(req.user.role) ? q.employeeId : req.user.id,
    department: isManagerLevel(req.user.role) ? q.department : undefined,
  };

  const { items, total } = await listReports(filters);
  return ok(res, items, { total, limit: q.limit, offset: q.offset, from, to });
});

/** GET /api/reports/today — the employee's own report for today, if any. */
export const getToday = asyncHandler(async (req, res) => {
  if (!isTeamMember(req.user.role)) throw forbidden('Only team members submit daily reports.');
  return ok(res, await getReportForDate(req.user.id, today()));
});

/**
 * POST /api/reports — Save / Update for the current day.
 * Reports may only be written for today: back-dating would let someone quietly rewrite
 * history, and the manager relies on these being a same-day record.
 */
export const save = asyncHandler(async (req, res) => {
  if (!isTeamMember(req.user.role)) throw forbidden('Only team members submit daily reports.');

  const reportDate = req.body.reportDate || today();
  if (reportDate !== today()) {
    throw badRequest('You can only save or edit your report for today.');
  }

  const { report, createdNew } = await saveReport({
    employeeId: req.user.id,
    reportDate,
    taskDescription: req.body.taskDescription,
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
