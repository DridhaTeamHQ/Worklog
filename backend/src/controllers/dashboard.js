/**
 * Dashboard controller.
 *
 * One call per portal. The role decides which payload is built, so a team member
 * physically cannot receive company-wide figures from this endpoint.
 */
import { ok } from '../utils/http.js';
import { asyncHandler } from '../utils/errors.js';
import { isManagerLevel } from '../utils/roles.js';
import { departmentScope, isEmptyScope, scopedDepartment } from '../utils/scope.js';
import {
  managerOverview, employeeOverview, productivityByEmployee,
  dailyActivity, weeklyActivity, statusBreakdown,
} from '../models/analytics.js';
import { listTasks } from '../models/task.js';
import { listReports, getReportForDate } from '../models/report.js';
import { listTickets } from '../models/ticket.js';

export const overview = asyncHandler(async (req, res) => {
  // Defaults to today, which is what the dashboard showed before it could be asked
  // for anything else.
  const range = req.validatedQuery?.range || 'today';

  if (isManagerLevel(req.user.role)) {
    // Every figure on the manager dashboard is confined to their department, so the
    // headline counts describe their own team rather than the whole company.
    const scope = departmentScope(req.user);
    const department = scope.restricted ? scope.department : undefined;
    if (isEmptyScope(scope)) {
      return ok(res, {
        role: req.user.role,
        summary: await managerOverview('\u0000no-such-department', range),
        breakdown: { pending: 0, in_progress: 0, completed: 0, overdue: 0 },
        activity: await dailyActivity({ days: 14, department: '\u0000no-such-department' }),
        recent_tasks: [],
        recent_reports: [],
        open_tickets: [],
      });
    }

    const [summary, recentTasks, recentReports, breakdown, activity, openTickets] = await Promise.all([
      managerOverview(department, range, { today: req.today }),
      listTasks({ sort: 'created_desc', limit: 8, department }),
      listReports({ limit: 6, department }),
      statusBreakdown({ department }),
      dailyActivity({ days: 14, department }),
      listTickets({ status: 'unresolved', sort: 'severity_desc', limit: 5, department }),
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
    employeeOverview(req.user.id, { today: req.today }),
    // The schedule strip on the dashboard plots six weeks of start dates, deadlines
    // and completions, so it needs the employee's whole set rather than the handful a
    // preview list used to want — a task missing from the fetch is a day left blank.
    listTasks({ employeeId: req.user.id, sort: 'deadline_asc', limit: 100 }),
    listReports({ employeeId: req.user.id, limit: 5 }),
    getReportForDate(req.user.id, req.today),
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
  const scope = departmentScope(req.user);
  // A manager cannot widen this by sending another department; theirs always wins.
  const department = isEmptyScope(scope)
    ? '\u0000no-such-department'
    : scopedDepartment(scope, q.department);
  const filters = { employeeId: q.employeeId, department, from: q.from, to: q.to };

  const [summary, productivity, breakdown, daily, weekly] = await Promise.all([
    managerOverview(department),
    productivityByEmployee(filters),
    statusBreakdown(filters),
    dailyActivity({ days: q.days, employeeId: q.employeeId, department }),
    weeklyActivity({ weeks: q.weeks, employeeId: q.employeeId, department }),
  ]);

  return ok(res, { summary, productivity, breakdown, daily, weekly, filters });
});
