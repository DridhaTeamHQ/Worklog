/**
 * Labels: a flat, company-wide set of coloured tags that cut across projects. A task
 * carries any number of them, and the task list can be filtered by one.
 */
import { getDb } from '../db/index.js';
import { nowIso } from '../utils/dates.js';
import { conflict, notFound, badRequest } from '../utils/errors.js';
import { recordActivity } from './activity.js';

const COLUMNS = 'id, name, color, created_at';

export async function listLabels() {
  const db = await getDb();
  const rows = await db.query(
    `SELECT l.id, l.name, l.color, l.created_at,
            (SELECT COUNT(*) FROM task_labels tl WHERE tl.label_id = l.id) AS task_count
       FROM labels l ORDER BY l.name ASC`,
  );
  return rows.map((r) => ({ ...r, task_count: Number(r.task_count || 0) }));
}

export async function createLabel({ name, color }) {
  const db = await getDb();
  const clash = await db.get('SELECT id FROM labels WHERE LOWER(name) = LOWER(?)', [name]);
  if (clash) throw conflict('A label with that name already exists.');
  const id = await db.insert(
    'INSERT INTO labels (name, color, created_at) VALUES (?, ?, ?)',
    [name, (color || '#64748b').toLowerCase(), nowIso()],
  );
  return db.get(`SELECT ${COLUMNS} FROM labels WHERE id = ?`, [id]);
}

export async function updateLabel(id, { name, color }) {
  const db = await getDb();
  const existing = await db.get(`SELECT ${COLUMNS} FROM labels WHERE id = ?`, [id]);
  if (!existing) throw notFound('That label could not be found.');
  if (name && name.toLowerCase() !== existing.name.toLowerCase()) {
    const clash = await db.get('SELECT id FROM labels WHERE LOWER(name) = LOWER(?) AND id <> ?', [name, id]);
    if (clash) throw conflict('A label with that name already exists.');
  }
  await db.run(
    'UPDATE labels SET name = ?, color = ? WHERE id = ?',
    [name ?? existing.name, (color ?? existing.color).toLowerCase(), id],
  );
  return db.get(`SELECT ${COLUMNS} FROM labels WHERE id = ?`, [id]);
}

export async function deleteLabel(id) {
  const db = await getDb();
  const res = await db.run('DELETE FROM labels WHERE id = ?', [id]);
  if (!res.changes) throw notFound('That label could not be found.');
  return true;
}

/** Labels for a set of tasks, keyed by task id. One query, no per-row round trips. */
export async function labelsForTasks(taskIds) {
  const ids = [...new Set(taskIds.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  const map = new Map();
  if (!ids.length) return map;
  const db = await getDb();
  const marks = ids.map(() => '?').join(', ');
  const rows = await db.query(
    `SELECT tl.task_id, l.id, l.name, l.color
       FROM task_labels tl JOIN labels l ON l.id = tl.label_id
      WHERE tl.task_id IN (${marks})
      ORDER BY l.name ASC`,
    ids,
  );
  for (const r of rows) {
    const list = map.get(Number(r.task_id)) || [];
    list.push({ id: r.id, name: r.name, color: r.color });
    map.set(Number(r.task_id), list);
  }
  return map;
}

/** Replace the whole set of labels on a task. Unknown ids are refused rather than skipped. */
export async function setTaskLabels({ taskId, labelIds, actor }, conn) {
  const db = conn || (await getDb());
  const wanted = [...new Set(labelIds.map(Number))];
  if (wanted.length) {
    const marks = wanted.map(() => '?').join(', ');
    const found = await db.query(`SELECT id FROM labels WHERE id IN (${marks})`, wanted);
    if (found.length !== wanted.length) throw badRequest('One of those labels does not exist.');
  }
  const before = (await labelsForTasks([taskId])).get(taskId) || [];

  const apply = async (tx) => {
    await tx.run('DELETE FROM task_labels WHERE task_id = ?', [taskId]);
    for (const labelId of wanted) {
      await tx.run('INSERT INTO task_labels (task_id, label_id) VALUES (?, ?)', [taskId, labelId]);
    }
    const beforeIds = before.map((l) => l.id).sort().join(',');
    const afterIds = [...wanted].sort().join(',');
    if (beforeIds !== afterIds) {
      await recordActivity({
        taskId, actorId: actor.id, kind: 'labels_changed',
        meta: { from: before.map((l) => l.name), toIds: wanted },
      }, tx);
    }
  };
  // Joins the caller's transaction when given one (assigning a task with labels),
  // otherwise opens its own.
  if (conn) await apply(conn); else await db.transaction(apply);
  return (await labelsForTasks([taskId])).get(taskId) || [];
}
