import { getDb } from '../db/index.js';
import { nowIso } from '../utils/dates.js';
import { sendForNotification } from '../services/push.js';

export const NOTIFICATION_TYPES = [
  'task_assigned', 'task_updated', 'status_changed', 'report_submitted',
  'ticket_raised', 'ticket_updated', 'general',
  // Comments and mentions on tasks and tickets.
  'task_commented', 'ticket_commented', 'mentioned',
  // Reminders sent by the scheduled job.
  'due_tomorrow', 'overdue', 'report_missing', 'team_overdue_digest',
];

/**
 * Persist a notification. Accepts an optional `conn` so it can join the same
 * transaction as the action that triggered it — a task assignment and its
 * notification are committed together or not at all.
 *
 * The push to the person's phone is queued on the transaction's `afterCommit` hook
 * when there is one, so it goes out only once the row is durable and never holds the
 * transaction open; without a transaction the insert is autocommitted, so the push
 * follows at once. Either way a push failure is logged and cannot fail the caller —
 * see services/push.js.
 */
export async function createNotification(
  { userId, title, message, type = 'general', relatedTaskId = null, relatedTicketId = null, relatedUserId = null },
  conn,
) {
  const db = conn || (await getDb());
  const id = await db.insert(
    `INSERT INTO notifications
       (user_id, title, message, type, related_task_id, related_ticket_id, related_user_id, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [userId, title, message, type, relatedTaskId, relatedTicketId, relatedUserId, nowIso()],
  );

  const fire = () => sendForNotification({
    notificationId: id, userId, title, message, type, relatedTaskId, relatedTicketId, relatedUserId,
  });
  if (conn && typeof conn.afterCommit === 'function') conn.afterCommit(fire);
  else await fire();

  return id;
}

export async function listNotifications(userId, { unreadOnly = false, limit = 50, offset = 0 } = {}) {
  const db = await getDb();
  const where = unreadOnly ? 'AND n.is_read = 0' : '';
  const rows = await db.query(
    `SELECT n.id, n.title, n.message, n.type, n.related_task_id, n.related_ticket_id, n.related_user_id,
            n.is_read, n.created_at,
            t.title AS task_title, t.employee_id AS task_employee_id
       FROM notifications n
       LEFT JOIN assigned_tasks t ON t.id = n.related_task_id
      WHERE n.user_id = ? ${where}
      ORDER BY n.id DESC
      LIMIT ? OFFSET ?`,
    [userId, limit, offset],
  );
  return rows.map((r) => ({ ...r, is_read: Boolean(r.is_read) }));
}

export async function unreadCount(userId) {
  const db = await getDb();
  const row = await db.get('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0', [userId]);
  return Number(row?.c || 0);
}

/** Scoped by user_id so one user can never mark another user's notification read. */
export async function markRead(userId, notificationId) {
  const db = await getDb();
  const res = await db.run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [notificationId, userId]);
  return res.changes > 0;
}

export async function markAllRead(userId) {
  const db = await getDb();
  const res = await db.run('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [userId]);
  return res.changes;
}
