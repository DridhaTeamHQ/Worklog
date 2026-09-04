/**
 * The activity thread on a task or ticket: comments people write, and the changes the
 * system records alongside them (status moves, edits, checklist ticks, linked daily
 * reports). One table, one ordered list, so the screen that shows "what happened" is
 * a single query.
 *
 * System rows are written inside the transaction that made the change — a status move
 * and its activity row commit together or not at all. Comments are the only rows a
 * person writes directly.
 */
import { getDb } from '../db/index.js';
import { nowIso } from '../utils/dates.js';
import { notFound, forbidden, badRequest } from '../utils/errors.js';
import { isAdmin } from '../utils/roles.js';

export const ACTIVITY_KINDS = [
  'comment', 'status_changed', 'field_changed', 'assigned', 'checklist', 'attachment',
  'report_linked', 'labels_changed', 'ticket_raised',
];

const SELECT_ACTIVITY = `
  SELECT a.id, a.task_id, a.ticket_id, a.actor_id, a.kind, a.body, a.meta, a.edited_at, a.created_at,
         u.name AS actor_name, u.role AS actor_role, u.profile_image AS actor_profile_image
    FROM activity a
    LEFT JOIN users u ON u.id = a.actor_id`;

const parseMeta = (row) => {
  if (!row) return row;
  let meta = null;
  if (row.meta) {
    try { meta = JSON.parse(row.meta); } catch { meta = null; }
  }
  return { ...row, meta };
};

/**
 * Append a row. Exactly one of taskId / ticketId. `meta` is any small JSON-serialisable
 * object describing the change, e.g. { from: 'pending', to: 'in_progress' }.
 */
export async function recordActivity({ taskId = null, ticketId = null, actorId = null, kind, body = null, meta = null }, conn) {
  if (!ACTIVITY_KINDS.includes(kind)) throw badRequest(`Unknown activity kind: ${kind}`);
  if ((taskId == null) === (ticketId == null)) throw badRequest('Activity needs exactly one of task or ticket.');
  const db = conn || (await getDb());
  return db.insert(
    `INSERT INTO activity (task_id, ticket_id, actor_id, kind, body, meta, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [taskId, ticketId, actorId, kind, body, meta == null ? null : JSON.stringify(meta), nowIso()],
  );
}

/** Oldest first — a thread reads top to bottom. */
export async function listActivity({ taskId, ticketId, limit = 200, offset = 0 }) {
  const db = await getDb();
  const where = taskId ? 'a.task_id = ?' : 'a.ticket_id = ?';
  const rows = await db.query(
    `${SELECT_ACTIVITY} WHERE ${where} ORDER BY a.id ASC LIMIT ? OFFSET ?`,
    [taskId || ticketId, limit, offset],
  );
  const countRow = await db.get(`SELECT COUNT(*) AS c FROM activity a WHERE ${where}`, [taskId || ticketId]);
  return { items: rows.map(parseMeta), total: Number(countRow?.c || 0) };
}

export async function getActivityById(id) {
  const db = await getDb();
  return parseMeta(await db.get(`${SELECT_ACTIVITY} WHERE a.id = ?`, [id]));
}

/** A comment on the thread. Callers decide who to notify; this only writes the row. */
export async function addComment({ taskId = null, ticketId = null, actorId, body, mentions = [] }, conn) {
  return recordActivity({
    taskId, ticketId, actorId, kind: 'comment', body,
    meta: mentions.length ? { mentions } : null,
  }, conn);
}

/** Only the author may edit, and only a comment — system rows are the record. */
export async function editComment({ commentId, actor, body, taskId = null, ticketId = null }) {
  const db = await getDb();
  const row = await db.get('SELECT id, task_id, ticket_id, actor_id, kind FROM activity WHERE id = ?', [commentId]);
  if (!row || row.kind !== 'comment' || (taskId && row.task_id !== taskId) || (ticketId && row.ticket_id !== ticketId)) {
    throw notFound('That comment could not be found.');
  }
  if (row.actor_id !== actor.id) throw forbidden('You can only edit your own comments.');
  await db.run('UPDATE activity SET body = ?, edited_at = ? WHERE id = ?', [body, nowIso(), commentId]);
  return getActivityById(commentId);
}

/** The author or an admin may delete a comment. */
export async function deleteComment({ commentId, actor, taskId = null, ticketId = null }) {
  const db = await getDb();
  const row = await db.get('SELECT id, task_id, ticket_id, actor_id, kind FROM activity WHERE id = ?', [commentId]);
  if (!row || row.kind !== 'comment' || (taskId && row.task_id !== taskId) || (ticketId && row.ticket_id !== ticketId)) {
    throw notFound('That comment could not be found.');
  }
  if (row.actor_id !== actor.id && !isAdmin(actor.role)) throw forbidden('You can only delete your own comments.');
  await db.run('DELETE FROM activity WHERE id = ?', [commentId]);
  return true;
}
