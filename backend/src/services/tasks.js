import { getDb } from '../db/index.js';
import { nowIso, today } from '../utils/dates.js';
import { createNotification } from './notifications.js';
import { nextTaskNumber } from './projects.js';
import { notFound, forbidden, badRequest } from '../utils/errors.js';

export const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
export const STATUSES = ['pending', 'in_progress', 'completed'];
/** 'overdue' is derived, never stored — see effectiveStatusSql. */
export const FILTER_STATUSES = [...STATUSES, 'overdue'];

/**
 * Overdue is computed at read time from the deadline rather than written by a
 * scheduled job, so a task is never stale: the moment its deadline passes it reads
 * as overdue everywhere, and completing it clears the flag with no extra bookkeeping.
 */
const effectiveStatusSql = `
  CASE WHEN t.status <> 'completed' AND t.deadline IS NOT NULL AND t.deadline < ?
       THEN 'overdue' ELSE t.status END`;

const SELECT_TASK = `
  SELECT t.id, t.employee_id, t.manager_id, t.title, t.description, t.notes,
         t.priority, t.start_date, t.deadline, t.status, t.completed_at,
         t.created_at, t.updated_at,
         ${effectiveStatusSql} AS effective_status,
         e.name AS employee_name, e.email AS employee_email, e.department AS employee_department,
         e.profile_image AS employee_profile_image,
         m.name AS manager_name, m.profile_image AS manager_profile_image,
         t.project_id, t.task_number,
         p.name AS project_name, p.project_key,
         CASE WHEN p.project_key IS NULL OR t.task_number IS NULL
              THEN NULL ELSE p.project_key || '-' || t.task_number END AS task_key
    FROM assigned_tasks t
    JOIN users e ON e.id = t.employee_id
    JOIN users m ON m.id = t.manager_id
    LEFT JOIN projects p ON p.id = t.project_id`;

/**
 * List tasks with filters. `employeeId` is forced by the route for team members and
 * is what guarantees an employee can only ever read their own tasks.
 */
export async function listTasks({
  employeeId, managerId, projectId, status, priority, search, department,
  assignedFrom, assignedTo, deadlineFrom, deadlineTo,
  sort = 'created_desc', limit = 100, offset = 0,
} = {}) {
  const db = await getDb();
  const t = today();
  const where = [];
  const filterParams = [];

  if (employeeId) { where.push('t.employee_id = ?'); filterParams.push(employeeId); }
  if (projectId) { where.push('t.project_id = ?'); filterParams.push(projectId); }
  if (managerId) { where.push('t.manager_id = ?'); filterParams.push(managerId); }
  if (priority) { where.push('t.priority = ?'); filterParams.push(priority); }
  if (department) { where.push('e.department = ?'); filterParams.push(department); }
  if (assignedFrom) { where.push('substr(t.created_at, 1, 10) >= ?'); filterParams.push(assignedFrom); }
  if (assignedTo) { where.push('substr(t.created_at, 1, 10) <= ?'); filterParams.push(assignedTo); }
  if (deadlineFrom) { where.push('t.deadline >= ?'); filterParams.push(deadlineFrom); }
  if (deadlineTo) { where.push('t.deadline <= ?'); filterParams.push(deadlineTo); }
  if (search) {
    // Match the summary, description, assignee, project name, and the task key itself
    // so pasting "SHMOB-5" into the search box jumps straight to that task.
    where.push(`(LOWER(t.title) LIKE ? OR LOWER(t.description) LIKE ? OR LOWER(e.name) LIKE ?
                 OR LOWER(p.name) LIKE ?
                 OR LOWER(p.project_key || '-' || t.task_number) LIKE ?)`);
    const like = `%${search.toLowerCase()}%`;
    filterParams.push(like, like, like, like, like);
  }
  if (status === 'overdue') {
    where.push("t.status <> 'completed' AND t.deadline IS NOT NULL AND t.deadline < ?");
    filterParams.push(t);
  } else if (status) {
    where.push('t.status = ?');
    filterParams.push(status);
  }

  const orderBy = {
    created_desc: 't.created_at DESC, t.id DESC',
    created_asc: 't.created_at ASC, t.id ASC',
    deadline_asc: 'CASE WHEN t.deadline IS NULL THEN 1 ELSE 0 END, t.deadline ASC',
    deadline_desc: 'CASE WHEN t.deadline IS NULL THEN 1 ELSE 0 END, t.deadline DESC',
    priority_desc: "CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, t.deadline ASC",
  }[sort] || 't.created_at DESC, t.id DESC';

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const items = await db.query(
    `${SELECT_TASK} ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    [t, ...filterParams, limit, offset],
  );

  const countRow = await db.get(
    `SELECT COUNT(*) AS c
       FROM assigned_tasks t
       JOIN users e ON e.id = t.employee_id
       LEFT JOIN projects p ON p.id = t.project_id
       ${whereSql}`,
    filterParams,
  );

  return { items, total: Number(countRow?.c || 0) };
}

export async function getTaskById(id) {
  const db = await getDb();
  return db.get(`${SELECT_TASK} WHERE t.id = ?`, [today(), id]);
}

/**
 * Creates the task, allocates its key within the project, and raises the employee's
 * notification — all in one transaction, so a task never exists without a key or
 * without the notification that tells someone about it.
 */
export async function assignTask({
  employeeId, managerId, projectId, title, description, notes, priority, startDate, deadline,
}) {
  const db = await getDb();
  const employee = await db.get('SELECT id, name, role, is_active FROM users WHERE id = ?', [employeeId]);
  if (!employee || employee.role !== 'team_member' || !employee.is_active) {
    throw notFound('That team member could not be found.');
  }

  const project = await db.get('SELECT id, project_key, is_archived FROM projects WHERE id = ?', [projectId]);
  if (!project) throw notFound('That project could not be found.');
  if (project.is_archived) throw badRequest('That project is archived, so new tasks cannot be added to it.');

  const ts = nowIso();
  const taskId = await db.transaction(async (tx) => {
    const taskNumber = await nextTaskNumber(tx, project.id);
    const id = await tx.insert(
      `INSERT INTO assigned_tasks
         (project_id, task_number, employee_id, manager_id, title, description, notes,
          priority, start_date, deadline, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [project.id, taskNumber, employeeId, managerId, title, description, notes ?? null,
        priority, startDate ?? null, deadline ?? null, ts, ts],
    );
    const manager = await tx.get('SELECT name FROM users WHERE id = ?', [managerId]);
    await createNotification({
      userId: employeeId,
      title: 'New task assigned',
      message: `New task assigned by ${manager?.name || 'Manager'}: ${project.project_key}-${taskNumber} ${title}`,
      type: 'task_assigned',
      relatedTaskId: id,
    }, tx);
    return id;
  });

  return getTaskById(taskId);
}

/**
 * Status update. A team member may only touch their own tasks; a manager may update
 * tasks they assigned. Either way the other party gets a notification.
 */
export async function updateTaskStatus({ taskId, status, actor }) {
  const db = await getDb();
  const task = await db.get('SELECT * FROM assigned_tasks WHERE id = ?', [taskId]);
  if (!task) throw notFound('That task no longer exists.');

  if (actor.role === 'team_member' && task.employee_id !== actor.id) {
    throw forbidden('You can only update tasks assigned to you.');
  }
  if (actor.role === 'manager' && task.manager_id !== actor.id) {
    throw forbidden('You can only update tasks you assigned.');
  }

  const ts = nowIso();
  const completedAt = status === 'completed' ? (task.completed_at || ts) : null;
  const label = { pending: 'Pending', in_progress: 'In Progress', completed: 'Completed' }[status];

  await db.transaction(async (tx) => {
    await tx.run(
      'UPDATE assigned_tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?',
      [status, completedAt, ts, taskId],
    );
    if (task.status === status) return;

    if (actor.role === 'team_member') {
      await createNotification({
        userId: task.manager_id,
        title: 'Task status updated',
        message: `${actor.name} marked "${task.title}" as ${label}.`,
        type: 'status_changed',
        relatedTaskId: taskId,
      }, tx);
    } else {
      await createNotification({
        userId: task.employee_id,
        title: 'Task status changed',
        message: `${actor.name} set "${task.title}" to ${label}.`,
        type: 'status_changed',
        relatedTaskId: taskId,
      }, tx);
    }
  });

  return getTaskById(taskId);
}

export async function updateTask({ taskId, managerId, patch }) {
  const db = await getDb();
  const task = await db.get('SELECT * FROM assigned_tasks WHERE id = ?', [taskId]);
  if (!task) throw notFound('That task no longer exists.');
  if (task.manager_id !== managerId) throw forbidden('You can only edit tasks you assigned.');

  const columns = {
    title: patch.title,
    description: patch.description,
    notes: patch.notes,
    priority: patch.priority,
    start_date: patch.startDate,
    deadline: patch.deadline,
  };
  const sets = [];
  const params = [];
  for (const [col, val] of Object.entries(columns)) {
    if (val !== undefined) { sets.push(`${col} = ?`); params.push(val); }
  }
  if (!sets.length) return getTaskById(taskId);

  sets.push('updated_at = ?');
  params.push(nowIso(), taskId);
  await db.run(`UPDATE assigned_tasks SET ${sets.join(', ')} WHERE id = ?`, params);

  await createNotification({
    userId: task.employee_id,
    title: 'Task updated',
    message: `Your task "${patch.title || task.title}" was updated by your manager.`,
    type: 'task_updated',
    relatedTaskId: taskId,
  });
  return getTaskById(taskId);
}

export async function deleteTask({ taskId, managerId }) {
  const db = await getDb();
  const task = await db.get('SELECT id, manager_id FROM assigned_tasks WHERE id = ?', [taskId]);
  if (!task) throw notFound('That task no longer exists.');
  if (task.manager_id !== managerId) throw forbidden('You can only delete tasks you assigned.');
  await db.run('DELETE FROM assigned_tasks WHERE id = ?', [taskId]);
  return true;
}

/** Per-employee task counts, keyed by employee id — used by the team list and dashboards. */
export async function taskCountsByEmployee() {
  const db = await getDb();
  const rows = await db.query(
    `SELECT employee_id,
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
            SUM(CASE WHEN status <> 'completed' AND deadline IS NOT NULL AND deadline < ? THEN 1 ELSE 0 END) AS overdue
       FROM assigned_tasks
      GROUP BY employee_id`,
    [today()],
  );
  const map = new Map();
  for (const r of rows) {
    map.set(Number(r.employee_id), {
      total: Number(r.total),
      pending: Number(r.pending),
      in_progress: Number(r.in_progress),
      completed: Number(r.completed),
      overdue: Number(r.overdue),
    });
  }
  return map;
}
