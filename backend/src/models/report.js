import { getDb } from '../db/index.js';
import { nowIso, today } from '../utils/dates.js';
import { notFound, badRequest } from '../utils/errors.js';
import { createNotification } from './notification.js';
import { recordActivity } from './activity.js';
import { MANAGER_ROLES } from '../utils/roles.js';

const SELECT_REPORT = `
  SELECT r.id, r.employee_id, r.report_date, r.task_description, r.created_at, r.updated_at,
         u.name AS employee_name, u.email AS employee_email, u.department AS employee_department
    FROM daily_task_reports r
    JOIN users u ON u.id = r.employee_id`;

/**
 * The lines of each report, keyed by report id. Linked tasks bring their key and title
 * so the reader sees "SHMOB-5 Fix login" rather than a bare number.
 */
async function itemsForReports(reportIds) {
  const ids = [...new Set(reportIds.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  const map = new Map();
  if (!ids.length) return map;
  const db = await getDb();
  const marks = ids.map(() => '?').join(', ');
  const rows = await db.query(
    `SELECT i.id, i.report_id, i.task_id, i.text, i.minutes, i.position,
            t.title AS task_title, t.status AS task_status,
            CASE WHEN p.project_key IS NULL OR t.task_number IS NULL
                 THEN NULL ELSE p.project_key || '-' || t.task_number END AS task_key
       FROM report_items i
       LEFT JOIN assigned_tasks t ON t.id = i.task_id
       LEFT JOIN projects p ON p.id = t.project_id
      WHERE i.report_id IN (${marks})
      ORDER BY i.report_id, i.position ASC, i.id ASC`,
    ids,
  );
  for (const r of rows) {
    const list = map.get(Number(r.report_id)) || [];
    list.push({
      id: r.id, task_id: r.task_id, text: r.text, minutes: r.minutes, position: r.position,
      task_key: r.task_key, task_title: r.task_title, task_status: r.task_status,
    });
    map.set(Number(r.report_id), list);
  }
  return map;
}

async function attachItems(reports) {
  const map = await itemsForReports(reports.map((r) => r.id));
  return reports.map((r) => {
    const items = map.get(Number(r.id)) || [];
    const minutes = items.reduce((sum, i) => sum + (Number(i.minutes) || 0), 0);
    return { ...r, items, total_minutes: minutes };
  });
}

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
    // The free text, the person, and any line of the report.
    where.push(`(LOWER(r.task_description) LIKE ? OR LOWER(u.name) LIKE ?
                 OR EXISTS (SELECT 1 FROM report_items i WHERE i.report_id = r.id AND LOWER(i.text) LIKE ?))`);
    const like = `%${search.toLowerCase()}%`;
    params.push(like, like, like);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = await db.query(
    `${SELECT_REPORT} ${whereSql} ORDER BY r.report_date DESC, r.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const countRow = await db.get(
    `SELECT COUNT(*) AS c FROM daily_task_reports r JOIN users u ON u.id = r.employee_id ${whereSql}`,
    params,
  );
  return { items: await attachItems(rows), total: Number(countRow?.c || 0) };
}

export async function getReportForDate(employeeId, reportDate) {
  const db = await getDb();
  const row = await db.get(`${SELECT_REPORT} WHERE r.employee_id = ? AND r.report_date = ?`, [employeeId, reportDate]);
  if (!row) return null;
  return (await attachItems([row]))[0];
}

/**
 * Who should hear that this person filed a report: the managers who currently have
 * work out with them, plus the managers of any task the report mentions. Failing
 * both, the manager-level people in their department (and every admin).
 */
async function reportRecipients(tx, employeeId, linkedTaskIds) {
  const ids = new Set();
  const open = await tx.query(
    `SELECT DISTINCT manager_id FROM assigned_tasks WHERE employee_id = ? AND status <> 'completed'`,
    [employeeId],
  );
  open.forEach((r) => ids.add(Number(r.manager_id)));
  if (linkedTaskIds.length) {
    const marks = linkedTaskIds.map(() => '?').join(', ');
    const linked = await tx.query(`SELECT DISTINCT manager_id FROM assigned_tasks WHERE id IN (${marks})`, linkedTaskIds);
    linked.forEach((r) => ids.add(Number(r.manager_id)));
  }
  if (!ids.size) {
    const roleList = MANAGER_ROLES.map((r) => `'${r}'`).join(', ');
    const dept = await tx.query(
      `SELECT m.id FROM users m
        WHERE m.role IN (${roleList}) AND m.is_active = 1
          AND (m.role = 'admin' OR m.department = (SELECT department FROM users WHERE id = ?))`,
      [employeeId],
    );
    dept.forEach((r) => ids.add(Number(r.id)));
  }
  ids.delete(Number(employeeId));
  return [...ids];
}

/**
 * One report per employee per day: saving again for the same date updates the existing
 * row (the UNIQUE(employee_id, report_date) constraint enforces this at the database
 * level too), which is exactly the "Save / Update" behaviour the portal offers.
 *
 * `items` are the structured lines; each may point at one of the employee's own tasks
 * and carry the minutes spent. They replace the previous set wholesale — the client
 * always sends the complete list — and are written in the same transaction as the
 * report so the two can never disagree.
 *
 * The first save of a day tells the managers; later edits are silent.
 */
export async function saveReport({ employeeId, reportDate, taskDescription = '', items = [] }) {
  const db = await getDb();
  const ts = nowIso();

  const linkedTaskIds = [...new Set(items.map((i) => i.taskId).filter(Boolean).map(Number))];
  if (linkedTaskIds.length) {
    const marks = linkedTaskIds.map(() => '?').join(', ');
    const owned = await db.query(
      `SELECT id FROM assigned_tasks WHERE employee_id = ? AND id IN (${marks})`,
      [employeeId, ...linkedTaskIds],
    );
    if (owned.length !== linkedTaskIds.length) {
      throw badRequest('A report line can only be linked to a task assigned to you.');
    }
  }

  const existing = await db.get(
    'SELECT id FROM daily_task_reports WHERE employee_id = ? AND report_date = ?',
    [employeeId, reportDate],
  );

  const reportId = await db.transaction(async (tx) => {
    let id = existing?.id;
    if (id) {
      await tx.run(
        'UPDATE daily_task_reports SET task_description = ?, updated_at = ? WHERE id = ?',
        [taskDescription, ts, id],
      );
      await tx.run('DELETE FROM report_items WHERE report_id = ?', [id]);
    } else {
      id = await tx.insert(
        `INSERT INTO daily_task_reports (employee_id, report_date, task_description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [employeeId, reportDate, taskDescription, ts, ts],
      );
    }

    let position = 0;
    for (const item of items) {
      position += 1;
      await tx.run(
        `INSERT INTO report_items (report_id, task_id, text, minutes, position, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, item.taskId ?? null, item.text, item.minutes ?? null, position, ts],
      );
    }
    for (const taskId of linkedTaskIds) {
      const minutes = items
        .filter((i) => Number(i.taskId) === taskId)
        .reduce((s, i) => s + (Number(i.minutes) || 0), 0);
      await recordActivity({
        taskId, actorId: employeeId, kind: 'report_linked',
        meta: { reportId: id, reportDate, minutes: minutes || null },
      }, tx);
    }

    if (!existing) {
      const employee = await tx.get('SELECT name FROM users WHERE id = ?', [employeeId]);
      const recipients = await reportRecipients(tx, employeeId, linkedTaskIds);
      for (const userId of recipients) {
        await createNotification({
          userId,
          title: 'Daily report submitted',
          message: `${employee?.name || 'A team member'} submitted their report for ${reportDate}.`,
          type: 'report_submitted',
          relatedUserId: employeeId,
        }, tx);
      }
    }
    return id;
  });

  return { report: await getReportForDate(employeeId, reportDate), createdNew: !existing, id: reportId };
}

/** Employees may delete only their own report; enforced by the employee_id predicate. */
export async function deleteReport({ employeeId, reportId }) {
  const db = await getDb();
  const res = await db.run('DELETE FROM daily_task_reports WHERE id = ? AND employee_id = ?', [reportId, employeeId]);
  if (!res.changes) throw notFound('That report could not be found.');
  return true;
}

export async function hasSubmittedToday(employeeId, date = today()) {
  const report = await getReportForDate(employeeId, date);
  return Boolean(report);
}

/**
 * Tasks worth offering as report lines for `date`: everything in progress, what was
 * completed that day, and anything pending whose deadline has arrived — minus what
 * is already on the report.
 */
export async function suggestReportItems(employeeId, date) {
  const db = await getDb();
  return db.query(
    `SELECT t.id, t.title, t.status, t.priority, t.deadline,
            CASE WHEN p.project_key IS NULL OR t.task_number IS NULL
                 THEN NULL ELSE p.project_key || '-' || t.task_number END AS task_key
       FROM assigned_tasks t
       LEFT JOIN projects p ON p.id = t.project_id
      WHERE t.employee_id = ?
        AND (t.status = 'in_progress'
             OR (t.status = 'completed' AND substr(COALESCE(t.completed_at, t.updated_at), 1, 10) = ?)
             OR (t.status = 'pending' AND t.deadline IS NOT NULL AND t.deadline <= ?))
        AND NOT EXISTS (
          SELECT 1 FROM report_items i
            JOIN daily_task_reports r ON r.id = i.report_id
           WHERE r.employee_id = ? AND r.report_date = ? AND i.task_id = t.id)
      ORDER BY CASE t.status WHEN 'in_progress' THEN 0 WHEN 'completed' THEN 1 ELSE 2 END,
               CASE WHEN t.deadline IS NULL THEN 1 ELSE 0 END, t.deadline ASC, t.id ASC
      LIMIT 30`,
    [employeeId, date, date, employeeId, date],
  );
}
