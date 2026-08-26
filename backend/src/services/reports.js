import { getDb } from '../db/index.js';
import { nowIso, today } from '../utils/dates.js';
import { notFound } from '../utils/errors.js';

const SELECT_REPORT = `
  SELECT r.id, r.employee_id, r.report_date, r.task_description, r.created_at, r.updated_at,
         u.name AS employee_name, u.email AS employee_email, u.department AS employee_department
    FROM daily_task_reports r
    JOIN users u ON u.id = r.employee_id`;

/**
 * List daily reports. `employeeId` is forced by the route for team members, which is
 * what stops one employee reading another's work log.
 */
export async function listReports({ employeeId, from, to, search, department, limit = 100, offset = 0 } = {}) {
  const db = await getDb();
  const where = [];
  const params = [];

  if (employeeId) { where.push('r.employee_id = ?'); params.push(employeeId); }
  if (from) { where.push('r.report_date >= ?'); params.push(from); }
  if (to) { where.push('r.report_date <= ?'); params.push(to); }
  if (department) { where.push('u.department = ?'); params.push(department); }
  if (search) {
    where.push('(LOWER(r.task_description) LIKE ? OR LOWER(u.name) LIKE ?)');
    const like = `%${search.toLowerCase()}%`;
    params.push(like, like);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const items = await db.query(
    `${SELECT_REPORT} ${whereSql} ORDER BY r.report_date DESC, r.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const countRow = await db.get(
    `SELECT COUNT(*) AS c FROM daily_task_reports r JOIN users u ON u.id = r.employee_id ${whereSql}`,
    params,
  );
  return { items, total: Number(countRow?.c || 0) };
}

export async function getReportForDate(employeeId, reportDate) {
  const db = await getDb();
  return db.get(`${SELECT_REPORT} WHERE r.employee_id = ? AND r.report_date = ?`, [employeeId, reportDate]);
}

/**
 * One report per employee per day: saving again for the same date updates the existing
 * row (the UNIQUE(employee_id, report_date) constraint enforces this at the database
 * level too), which is exactly the "Save / Update" behaviour the portal offers.
 */
export async function saveReport({ employeeId, reportDate, taskDescription }) {
  const db = await getDb();
  const ts = nowIso();
  const existing = await db.get(
    'SELECT id FROM daily_task_reports WHERE employee_id = ? AND report_date = ?',
    [employeeId, reportDate],
  );

  if (existing) {
    await db.run(
      'UPDATE daily_task_reports SET task_description = ?, updated_at = ? WHERE id = ?',
      [taskDescription, ts, existing.id],
    );
    return { report: await getReportForDate(employeeId, reportDate), createdNew: false };
  }

  await db.insert(
    `INSERT INTO daily_task_reports (employee_id, report_date, task_description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [employeeId, reportDate, taskDescription, ts, ts],
  );
  return { report: await getReportForDate(employeeId, reportDate), createdNew: true };
}

/** Employees may delete only their own report; enforced by the employee_id predicate. */
export async function deleteReport({ employeeId, reportId }) {
  const db = await getDb();
  const res = await db.run('DELETE FROM daily_task_reports WHERE id = ? AND employee_id = ?', [reportId, employeeId]);
  if (!res.changes) throw notFound('That report could not be found.');
  return true;
}

export async function hasSubmittedToday(employeeId) {
  const report = await getReportForDate(employeeId, today());
  return Boolean(report);
}
