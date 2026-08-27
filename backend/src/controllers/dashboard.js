/**
 * Dashboard controller.
 *
 * One call per portal. The role decides which payload is built, so a team member
 * physically cannot receive company-wide figures from this endpoint.
 */
import { ok } from '../utils/http.js';
import { asyncHandler } from '../utils/errors.js';
import { isManagerLevel } from '../utils/roles.js';
import { today } from '../utils/dates.js';
import {
  managerOverview, employeeOverview, productivityByEmployee,
  dailyActivity, weeklyActivity, statusBreakdown,
} from '../models/analytics.js';
import { listTasks } from '../models/task.js';
import { listReports, getReportForDate } from '../models/report.js';
import { listTickets } from '../models/ticket.js';

export const overview = asyncHandler(async (req, res) => {
  if (isManagerLevel(req.user.role)) {
    const [summary, recentTasks, recentReports, breakdown, activity, openTickets] = await Promise.all([
      managerOverview(),
      listTasks({ sort: 'created_desc', limit: 8 }),
      listReports({ limit: 6 }),
      statusBreakdown({}),
      dailyActivity({ days: 14 }),
      listTickets({ status: 'unresolved', sort: 'severity_desc', limit: 5 }),
    ]);
    return ok(res, {
      // The real role, so the client can tell an admin from a manager.
      role: req.user.role,
      summary,
      breakdown,
      activity,
      recent_tasks: recentTasks.items,
      recent_reports: recentReports.items,
      open_tickets: openTickets.items,
    });
  }

  const [summary, tasks, reports, todayReport, myTickets] = await Promise.all([
    employeeOverview(req.user.id),
    listTasks({ employeeId: req.user.id, sort: 'deadline_asc', limit: 6 }),
    listReports({ employeeId: req.user.id, limit: 5 }),
    getReportForDate(req.user.id, today()),
    listTickets({ reporterId: req.user.id, sort: 'created_desc', limit: 5 }),
  ]);
  return ok(res, {
    role: 'team_member',
    summary,
    upcoming_tasks: tasks.items,
    recent_reports: reports.items,
    today_report: todayReport,
    recent_tickets: myTickets.items,
  });
});

export const analytics = asyncHandler(async (req, res) => {
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
});
