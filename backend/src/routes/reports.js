import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate, safeText, isoDate } from '../middleware/validate.js';
import { ok } from '../utils/http.js';
import { asyncHandler, badRequest, forbidden } from '../utils/errors.js';
import { today, resolveRange } from '../utils/dates.js';
import { listReports, getReportForDate, saveReport, deleteReport } from '../services/reports.js';

const router = Router();
router.use(requireAuth);

const listQuery = z.object({
  employeeId: z.coerce.number().int().positive().optional(),
  range: z.enum(['today', 'week', 'month', 'custom', 'all']).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  department: z.string().trim().min(1).optional(),
  search: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(60),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/reports
 * Managers may read any employee's reports; team members are pinned to their own id,
 * so a team member cannot read a colleague's work log by changing the query string.
 */
router.get('/', validate(listQuery, 'query'), asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const { from, to } = resolveRange(q.range, q.from, q.to);

  const filters = {
    from, to, search: q.search, limit: q.limit, offset: q.offset,
    employeeId: req.user.role === 'manager' ? q.employeeId : req.user.id,
    department: req.user.role === 'manager' ? q.department : undefined,
  };

  const { items, total } = await listReports(filters);
  return ok(res, items, { total, limit: q.limit, offset: q.offset, from, to });
}));

/** GET /api/reports/today — the employee's own report for today, if any. */
router.get('/today', asyncHandler(async (req, res) => {
  if (req.user.role !== 'team_member') throw forbidden('Only team members submit daily reports.');
  return ok(res, await getReportForDate(req.user.id, today()));
}));

const saveSchema = z.object({
  taskDescription: safeText(8000, 'Your task summary'),
  reportDate: isoDate.optional(),
});

/**
 * POST /api/reports — Save / Update for the current day.
 * Reports may only be written for today: back-dating would let someone quietly rewrite
 * history, and the manager relies on these being a same-day record.
 */
router.post('/', validate(saveSchema), asyncHandler(async (req, res) => {
  if (req.user.role !== 'team_member') throw forbidden('Only team members submit daily reports.');

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
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid report id.');
  if (req.user.role !== 'team_member') throw forbidden('Only team members manage their own reports.');
  await deleteReport({ employeeId: req.user.id, reportId: id });
  return ok(res, { message: 'Report deleted.' });
}));

export default router;
