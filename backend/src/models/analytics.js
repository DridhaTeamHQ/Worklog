import { getDb } from '../db/index.js';
import { today, addDays, startOfWeek, resolveRange } from '../utils/dates.js';
import { ticketCounts } from './ticket.js';

/**
 * Builds the WHERE fragment shared by every analytics query so that the employee,
 * department and date-range filters apply consistently across all of them.
 */
function taskFilters({ employeeId, department, from, to }) {
  const where = [];
  const params = [];
  if (employeeId) { where.push('t.employee_id = ?'); params.push(employeeId); }
  if (department) { where.push('e.department = ?'); params.push(department); }
  if (from) { where.push('substr(t.created_at, 1, 10) >= ?'); params.push(from); }
  if (to) { where.push('substr(t.created_at, 1, 10) <= ?'); params.push(to); }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

/** Headline cards on the manager dashboard. */
/**
 * The company-wide figures behind the manager dashboard.
 *
 * `department` confines every count to one department, which is how a manager's
 * dashboard reports on their own team rather than the whole company. Left undefined —
 * an admin — nothing is narrowed.
 */
export async function managerOverview(department, range = 'today') {
  const db = await getDb();
  const t = today();

  /*
    The headline counts answer "how much in this period", so everything that is a
    happening rather than a standing state is bounded by it: work assigned, work
    completed, and the pending work left behind by what was assigned. A null `from`
    means all time, which is what the Overall option asks for.

    Headcount and overdue are deliberately outside it. Both describe how things stand
    right now — how many people there are, how much is late — and neither is a thing
    that occurred within a window, so narrowing them to one would only ever mislead.
  */
  const { from } = resolveRange(range);
  const since = from ? ' AND substr(a.created_at, 1, 10) >= ?' : '';
  const sinceParam = from ? [from] : [];

  // Applied to each count separately: the tables reach `users` by different columns,
  // so there is no single join to hang this off.
  const dept = department ? ' AND e.department = ?' : '';
  const deptParam = department ? [department] : [];

  const team = await db.get(
    `SELECT COUNT(*) AS c FROM users e WHERE e.role = 'team_member' AND e.is_active = 1${dept}`,
    deptParam,
  );
  /*
    Completion is dated by when it happened, not by when the task was raised, so a
    task assigned last month and finished today counts toward today. Assignment and
    the pending remainder are dated by when the task was raised. The two therefore
    need separate bounds, which is why `since` is not simply added to the WHERE.
  */
  const assignedIn = from ? 'substr(a.created_at, 1, 10) >= ?' : '1 = 1';
  const completedIn = from
    ? 'substr(COALESCE(a.completed_at, a.updated_at), 1, 10) >= ?'
    : '1 = 1';
  const tasks = await db.get(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN ${assignedIn} THEN 1 ELSE 0 END) AS assigned_in_range,
       SUM(CASE WHEN a.status = 'completed' AND ${completedIn} THEN 1 ELSE 0 END) AS completed_in_range,
       SUM(CASE WHEN a.status = 'pending' AND ${assignedIn} THEN 1 ELSE 0 END) AS pending,
       SUM(CASE WHEN a.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
       SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) AS completed,
       SUM(CASE WHEN a.status <> 'completed' AND a.deadline IS NOT NULL AND a.deadline < ? THEN 1 ELSE 0 END) AS overdue
     FROM assigned_tasks a
     JOIN users e ON e.id = a.employee_id
     WHERE 1 = 1${dept}`,
    [...sinceParam, ...sinceParam, ...sinceParam, t, ...deptParam],
  );
  const reports = await db.get(
    `SELECT COUNT(*) AS c FROM daily_task_reports d
       JOIN users e ON e.id = d.employee_id
      WHERE d.report_date = ?${dept}`,
    [t, ...deptParam],
  );

  const tickets = await ticketCounts({ department, from });

  const n = (v) => Number(v || 0);
  return {
    open_tickets: tickets.unresolved,
    critical_tickets: tickets.critical_open,
    total_team_members: n(team?.c),
    // Kept under their old names so nothing downstream has to change; what they
    // count is now the selected period rather than always today.
    tasks_assigned_today: n(tasks?.assigned_in_range),
    tasks_completed_today: n(tasks?.completed_in_range),
    pending_tasks: n(tasks?.pending),
    in_progress_tasks: n(tasks?.in_progress),
    completed_tasks: n(tasks?.completed),
    overdue_tasks: n(tasks?.overdue),
    total_tasks: n(tasks?.total),
    reports_submitted_today: n(reports?.c),
    reports_pending_today: Math.max(0, n(team?.c) - n(reports?.c)),
  };
}

/** Headline cards on the team member dashboard. */
export async function employeeOverview(employeeId) {
  const db = await getDb();
  const t = today();
  const tasks = await db.get(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
       SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
       SUM(CASE WHEN status <> 'completed' AND deadline IS NOT NULL AND deadline < ? THEN 1 ELSE 0 END) AS overdue,
       SUM(CASE WHEN status = 'completed' AND substr(COALESCE(completed_at, updated_at), 1, 10) = ? THEN 1 ELSE 0 END) AS completed_today
     FROM assigned_tasks WHERE employee_id = ?`,
    [t, t, employeeId],
  );
  const reportToday = await db.get(
    'SELECT id, updated_at FROM daily_task_reports WHERE employee_id = ? AND report_date = ?',
    [employeeId, t],
  );
  const reportCount = await db.get(
    'SELECT COUNT(*) AS c FROM daily_task_reports WHERE employee_id = ?', [employeeId],
  );
  const weekReports = await db.get(
    'SELECT COUNT(*) AS c FROM daily_task_reports WHERE employee_id = ? AND report_date >= ?',
    [employeeId, startOfWeek(t)],
  );

  const tickets = await ticketCounts({ reporterId: employeeId });

  const n = (v) => Number(v || 0);
  return {
    open_tickets: tickets.unresolved,
    total_tickets: tickets.total,
    total_tasks: n(tasks?.total),
    pending_tasks: n(tasks?.pending),
    in_progress_tasks: n(tasks?.in_progress),
    completed_tasks: n(tasks?.completed),
    overdue_tasks: n(tasks?.overdue),
    completed_today: n(tasks?.completed_today),
    total_reports: n(reportCount?.c),
    reports_this_week: n(weekReports?.c),
    submitted_today: Boolean(reportToday),
    today_report_updated_at: reportToday?.updated_at || null,
  };
}

/** Per-employee productivity table + the bars behind it. */
export async function productivityByEmployee(filters = {}) {
  const db = await getDb();
  const t = today();
  const { employeeId, department, from, to } = filters;

  // Date filters belong in the LEFT JOIN's ON clause, not the WHERE: an employee with
  // no tasks in the window must still appear in the table with a row of zeros.
  const joinConds = ['t.employee_id = e.id'];
  const joinParams = [];
  if (from) { joinConds.push('substr(t.created_at, 1, 10) >= ?'); joinParams.push(from); }
  if (to) { joinConds.push('substr(t.created_at, 1, 10) <= ?'); joinParams.push(to); }

  const whereConds = ["e.role = 'team_member'"];
  const whereParams = [];
  if (employeeId) { whereConds.push('e.id = ?'); whereParams.push(employeeId); }
  if (department) { whereConds.push('e.department = ?'); whereParams.push(department); }

  const rows = await db.query(
    `SELECT e.id AS employee_id, e.name AS employee_name, e.department,
            COUNT(t.id) AS assigned,
            SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
            SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed,
            SUM(CASE WHEN t.status <> 'completed' AND t.deadline IS NOT NULL AND t.deadline < ? THEN 1 ELSE 0 END) AS overdue
       FROM users e
       LEFT JOIN assigned_tasks t ON ${joinConds.join(' AND ')}
      WHERE ${whereConds.join(' AND ')}
      GROUP BY e.id, e.name, e.department
      ORDER BY completed DESC, e.name ASC`,
    [t, ...joinParams, ...whereParams],
  );

  return rows.map((r) => ({
    employee_id: Number(r.employee_id),
    employee_name: r.employee_name,
    department: r.department,
    assigned: Number(r.assigned || 0),
    pending: Number(r.pending || 0),
    in_progress: Number(r.in_progress || 0),
    completed: Number(r.completed || 0),
    overdue: Number(r.overdue || 0),
    completion_rate: Number(r.assigned) ? Math.round((Number(r.completed) / Number(r.assigned)) * 100) : 0,
  }));
}

/** Day-by-day activity across a window, zero-filled so the chart has no gaps. */
export async function dailyActivity({ days = 14, employeeId, department } = {}) {
  const db = await getDb();
  const end = today();
  const start = addDays(end, -(days - 1));

  const scope = [];
  const scopeParams = [];
  if (employeeId) { scope.push('t.employee_id = ?'); scopeParams.push(employeeId); }
  if (department) { scope.push('e.department = ?'); scopeParams.push(department); }
  const scopeSql = scope.length ? `AND ${scope.join(' AND ')}` : '';

  const assigned = await db.query(
    `SELECT substr(t.created_at, 1, 10) AS day, COUNT(*) AS c
       FROM assigned_tasks t JOIN users e ON e.id = t.employee_id
      WHERE substr(t.created_at, 1, 10) BETWEEN ? AND ? ${scopeSql}
      GROUP BY day`,
    [start, end, ...scopeParams],
  );
  const completed = await db.query(
    `SELECT substr(COALESCE(t.completed_at, t.updated_at), 1, 10) AS day, COUNT(*) AS c
       FROM assigned_tasks t JOIN users e ON e.id = t.employee_id
      WHERE t.status = 'completed'
        AND substr(COALESCE(t.completed_at, t.updated_at), 1, 10) BETWEEN ? AND ? ${scopeSql}
      GROUP BY day`,
    [start, end, ...scopeParams],
  );

  const reportScope = [];
  const reportParams = [];
  if (employeeId) { reportScope.push('r.employee_id = ?'); reportParams.push(employeeId); }
  if (department) { reportScope.push('e.department = ?'); reportParams.push(department); }
  const reports = await db.query(
    `SELECT r.report_date AS day, COUNT(*) AS c
       FROM daily_task_reports r JOIN users e ON e.id = r.employee_id
      WHERE r.report_date BETWEEN ? AND ? ${reportScope.length ? `AND ${reportScope.join(' AND ')}` : ''}
      GROUP BY day`,
    [start, end, ...reportParams],
  );

  const toMap = (rows) => new Map(rows.map((r) => [r.day, Number(r.c)]));
  const a = toMap(assigned); const c = toMap(completed); const rp = toMap(reports);

  const series = [];
  for (let i = 0; i < days; i += 1) {
    const day = addDays(start, i);
    series.push({ day, assigned: a.get(day) || 0, completed: c.get(day) || 0, reports: rp.get(day) || 0 });
  }
  return series;
}

/** The same activity rolled up into ISO-ish weeks (Monday-based) for the weekly view. */
export async function weeklyActivity({ weeks = 8, employeeId, department } = {}) {
  const daily = await dailyActivity({ days: weeks * 7, employeeId, department });
  const buckets = new Map();
  for (const row of daily) {
    const key = startOfWeek(row.day);
    const bucket = buckets.get(key) || { week_start: key, assigned: 0, completed: 0, reports: 0 };
    bucket.assigned += row.assigned;
    bucket.completed += row.completed;
    bucket.reports += row.reports;
    buckets.set(key, bucket);
  }
  return [...buckets.values()].sort((x, y) => x.week_start.localeCompare(y.week_start));
}

export async function statusBreakdown(filters = {}) {
  const db = await getDb();
  const t = today();
  const { sql, params } = taskFilters(filters);
  const row = await db.get(
    `SELECT
       SUM(CASE WHEN t.status = 'pending' AND (t.deadline IS NULL OR t.deadline >= ?) THEN 1 ELSE 0 END) AS pending,
       SUM(CASE WHEN t.status = 'in_progress' AND (t.deadline IS NULL OR t.deadline >= ?) THEN 1 ELSE 0 END) AS in_progress,
       SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed,
       SUM(CASE WHEN t.status <> 'completed' AND t.deadline IS NOT NULL AND t.deadline < ? THEN 1 ELSE 0 END) AS overdue
     FROM assigned_tasks t JOIN users e ON e.id = t.employee_id ${sql}`,
    [t, t, t, ...params],
  );
  return {
    pending: Number(row?.pending || 0),
    in_progress: Number(row?.in_progress || 0),
    completed: Number(row?.completed || 0),
    overdue: Number(row?.overdue || 0),
  };
}
