import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireManager } from '../middleware/auth.js';
import { validate, isoDate } from '../middleware/validate.js';
import { ok } from '../utils/http.js';
import { asyncHandler } from '../utils/errors.js';
import {
  managerOverview, employeeOverview, productivityByEmployee,
  dailyActivity, weeklyActivity, statusBreakdown,
} from '../services/analytics.js';
import { listTasks } from '../services/tasks.js';
import { listReports } from '../services/reports.js';
import { getReportForDate } from '../services/reports.js';
import { today } from '../utils/dates.js';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/dashboard
 * One call per portal. The role decides which payload is built, so a team member
 * physically cannot receive company-wide figures from this endpoint.
 */
router.get('/', asyncHandler(async (req, res) => {
  if (req.user.role === 'manager') {
    const [summary, recentTasks, recentReports, breakdown, activity] = await Promise.all([
      managerOverview(),
      listTasks({ sort: 'created_desc', limit: 8 }),
      listReports({ limit: 6 }),
      statusBreakdown({}),
      dailyActivity({ days: 14 }),
    ]);
    return ok(res, {
      role: 'manager',
      summary,
      breakdown,
      activity,
      recent_tasks: recentTasks.items,
      recent_reports: recentReports.items,
    });
  }

  const [summary, tasks, reports, todayReport] = await Promise.all([
    employeeOverview(req.user.id),
    listTasks({ employeeId: req.user.id, sort: 'deadline_asc', limit: 6 }),
    listReports({ employeeId: req.user.id, limit: 5 }),
    getReportForDate(req.user.id, today()),
  ]);
  return ok(res, {
    role: 'team_member',
    summary,
    upcoming_tasks: tasks.items,
    recent_reports: reports.items,
    today_report: todayReport,
  });
}));

/* ------------------------------------------------------- manager analytics */

const analyticsQuery = z.object({
  employeeId: z.coerce.number().int().positive().optional(),
  department: z.string().trim().min(1).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  days: z.coerce.number().int().min(7).max(120).default(14),
  weeks: z.coerce.number().int().min(2).max(26).default(8),
});

router.get('/analytics', requireManager, validate(analyticsQuery, 'query'), asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const filters = { employeeId: q.employeeId, department: q.department, from: q.from, to: q.to };

  const [summary, productivity, breakdown, daily, weekly] = await Promise.all([
    managerOverview(),
    productivityByEmployee(filters),
    statusBreakdown(filters),
    dailyActivity({ days: q.days, employeeId: q.employeeId, department: q.department }),
    weeklyActivity({ weeks: q.weeks, employeeId: q.employeeId, department: q.department }),
  ]);

  return ok(res, { summary, productivity, breakdown, daily, weekly, filters });
}));

export default router;
