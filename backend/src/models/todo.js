/**
 * Personal to-dos — someone's private list of what they plan to do on a day.
 *
 * These are not tasks. Nothing here is assigned by a manager, appears in anyone
 * else's view, feeds a daily report, or counts towards an analytic. That separation
 * is the whole point of the feature, so every statement in this file is scoped by
 * `user_id` and there is no function that reads another person's list — not even for
 * an admin. Ownership is enforced in the WHERE clause rather than checked beforehand,
 * so a wrong id finds no row instead of touching someone else's.
 *
 * A note may point at a project and one of the owner's own tasks, purely as context.
 * The link is optional and one-way: the task knows nothing about it.
 */
import { getDb } from '../db/index.js';
import { nowIso } from '../utils/dates.js';
import { notFound, badRequest } from '../utils/errors.js';

/**
 * Every field the client sees, with the linked project and task resolved.
 *
 * `task_key` is composed the same way it is everywhere else — the task's own
 * project key plus its number — rather than the note's project, so a note filed
 * against the wrong project still shows the task's real key.
 */
const SELECT_ONE = `
  SELECT t.id, t.user_id, t.title, t.todo_date, t.is_done, t.done_at,
         t.project_id, t.task_id, t.created_at, t.updated_at,
         p.name AS project_name, p.project_key,
         a.title AS task_title,
         CASE WHEN a.id IS NULL THEN NULL
              ELSE ap.project_key || '-' || a.task_number END AS task_key
    FROM personal_todos t
    LEFT JOIN projects p ON p.id = t.project_id
    LEFT JOIN assigned_tasks a ON a.id = t.task_id
    LEFT JOIN projects ap ON ap.id = a.project_id`;

const toPublic = (row) => (row ? { ...row, is_done: Boolean(row.is_done) } : null);

/** One person's list for one day, oldest first. */
export async function listTodos(userId, todoDate) {
  const db = await getDb();
  const rows = await db.query(
    `${SELECT_ONE} WHERE t.user_id = ? AND t.todo_date = ? ORDER BY t.id ASC`,
    [userId, todoDate],
  );
  return rows.map(toPublic);
}

async function findById(db, id) {
  return toPublic(await db.get(`${SELECT_ONE} WHERE t.id = ?`, [id]));
}

/**
 * Validates the optional project/task link, and returns what should be stored.
 *
 * A note may only be filed against a task the owner is already part of — one assigned
 * to them, or one they assigned themselves. Anything else would turn the picker into
 * a way to confirm which task ids exist and who holds them. When a task is given, its
 * project is taken from the task rather than trusted from the request, so the two can
 * never disagree.
 */
async function resolveContext(db, userId, { projectId, taskId }) {
  if (taskId) {
    const task = await db.get(
      'SELECT id, employee_id, manager_id, project_id FROM assigned_tasks WHERE id = ?',
      [taskId],
    );
    // A team member's own work, or a manager's own assignment. Same answer for "no
    // such task" and "not yours": which ids exist is not something to confirm here.
    const mine = task
      && (Number(task.employee_id) === Number(userId) || Number(task.manager_id) === Number(userId));
    if (!mine) throw badRequest('Pick one of your own tasks.');
    return { project_id: task.project_id ?? null, task_id: task.id };
  }

  if (projectId) {
    const project = await db.get('SELECT id FROM projects WHERE id = ?', [projectId]);
    if (!project) throw badRequest('That project could not be found.');
    return { project_id: project.id, task_id: null };
  }

  return { project_id: null, task_id: null };
}

export async function createTodo(userId, { title, todoDate, projectId, taskId }) {
  const db = await getDb();
  const context = await resolveContext(db, userId, { projectId, taskId });
  const ts = nowIso();
  const id = await db.insert(
    `INSERT INTO personal_todos
       (user_id, title, todo_date, project_id, task_id, is_done, done_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?)`,
    [userId, title, todoDate, context.project_id, context.task_id, ts, ts],
  );
  return findById(db, id);
}

/**
 * Edits one of the caller's own to-dos.
 *
 * `done_at` is kept in step with `is_done` here rather than left to the caller, so a
 * to-do can never claim to be finished at a time it was not.
 */
export async function updateTodo(userId, id, patch) {
  const db = await getDb();
  const existing = await db.get(
    'SELECT id FROM personal_todos WHERE id = ? AND user_id = ?',
    [id, userId],
  );
  if (!existing) throw notFound('That to-do could not be found.');

  const ts = nowIso();
  const sets = [];
  const params = [];
  if (patch.title !== undefined) { sets.push('title = ?'); params.push(patch.title); }
  if (patch.todoDate !== undefined) { sets.push('todo_date = ?'); params.push(patch.todoDate); }
  if (patch.isDone !== undefined) {
    sets.push('is_done = ?', 'done_at = ?');
    params.push(patch.isDone ? 1 : 0, patch.isDone ? ts : null);
  }
  // The two travel together: re-pointing a note re-validates the pair as a whole.
  if (patch.projectId !== undefined || patch.taskId !== undefined) {
    const context = await resolveContext(db, userId, {
      projectId: patch.projectId,
      taskId: patch.taskId,
    });
    sets.push('project_id = ?', 'task_id = ?');
    params.push(context.project_id, context.task_id);
  }

  if (sets.length) {
    sets.push('updated_at = ?');
    params.push(ts, id, userId);
    await db.run(`UPDATE personal_todos SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, params);
  }

  return findById(db, id);
}

export async function deleteTodo(userId, id) {
  const db = await getDb();
  const res = await db.run(
    'DELETE FROM personal_todos WHERE id = ? AND user_id = ?',
    [id, userId],
  );
  if (!res.changes) throw notFound('That to-do could not be found.');
  return true;
}
