/**
 * Checklist items — the sub-steps of a task. The assignee and the manager who owns
 * the task tick them; the counts ride along on every task row so a card can show 2/5.
 */
import { getDb } from '../db/index.js';
import { nowIso } from '../utils/dates.js';
import { notFound } from '../utils/errors.js';
import { recordActivity } from './activity.js';

const COLUMNS = 'id, task_id, title, is_done, done_at, position, created_by, created_at, updated_at';
const shape = (r) => (r ? { ...r, is_done: Boolean(r.is_done) } : r);

export async function listChecklist(taskId) {
  const db = await getDb();
  const rows = await db.query(
    `SELECT ${COLUMNS} FROM task_checklist_items WHERE task_id = ? ORDER BY position ASC, id ASC`,
    [taskId],
  );
  return rows.map(shape);
}

export async function addChecklistItem({ taskId, title, actor }) {
  const db = await getDb();
  const ts = nowIso();
  const id = await db.transaction(async (tx) => {
    const last = await tx.get(
      'SELECT COALESCE(MAX(position), 0) AS p FROM task_checklist_items WHERE task_id = ?',
      [taskId],
    );
    const itemId = await tx.insert(
      `INSERT INTO task_checklist_items (task_id, title, is_done, position, created_by, created_at, updated_at)
       VALUES (?, ?, 0, ?, ?, ?, ?)`,
      [taskId, title, Number(last?.p || 0) + 1, actor.id, ts, ts],
    );
    await recordActivity({ taskId, actorId: actor.id, kind: 'checklist', meta: { action: 'added', itemId, title } }, tx);
    return itemId;
  });
  return shape(await db.get(`SELECT ${COLUMNS} FROM task_checklist_items WHERE id = ?`, [id]));
}

export async function updateChecklistItem({ taskId, itemId, patch, actor }) {
  const db = await getDb();
  const existing = await db.get(
    `SELECT ${COLUMNS} FROM task_checklist_items WHERE id = ? AND task_id = ?`,
    [itemId, taskId],
  );
  if (!existing) throw notFound('That checklist item could not be found.');

  const ts = nowIso();
  const sets = [];
  const params = [];
  if (patch.title !== undefined) { sets.push('title = ?'); params.push(patch.title); }
  if (patch.position !== undefined) { sets.push('position = ?'); params.push(patch.position); }
  const toggled = patch.isDone !== undefined && Boolean(patch.isDone) !== Boolean(existing.is_done);
  if (patch.isDone !== undefined) {
    sets.push('is_done = ?', 'done_at = ?');
    params.push(patch.isDone ? 1 : 0, patch.isDone ? ts : null);
  }
  if (!sets.length) return shape(existing);
  sets.push('updated_at = ?');
  params.push(ts, itemId);

  await db.transaction(async (tx) => {
    await tx.run(`UPDATE task_checklist_items SET ${sets.join(', ')} WHERE id = ?`, params);
    if (toggled) {
      await recordActivity({
        taskId, actorId: actor.id, kind: 'checklist',
        meta: { action: patch.isDone ? 'done' : 'reopened', itemId, title: patch.title ?? existing.title },
      }, tx);
    }
  });
  return shape(await db.get(`SELECT ${COLUMNS} FROM task_checklist_items WHERE id = ?`, [itemId]));
}

export async function deleteChecklistItem({ taskId, itemId, actor }) {
  const db = await getDb();
  const existing = await db.get(
    'SELECT id, title FROM task_checklist_items WHERE id = ? AND task_id = ?',
    [itemId, taskId],
  );
  if (!existing) throw notFound('That checklist item could not be found.');
  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM task_checklist_items WHERE id = ?', [itemId]);
    await recordActivity({
      taskId, actorId: actor.id, kind: 'checklist', meta: { action: 'removed', itemId, title: existing.title },
    }, tx);
  });
  return true;
}
