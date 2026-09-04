import type { AppNotification } from '@/types';

/**
 * Where a notification takes you when tapped — the phone's answer to the web's
 * `?highlight=` links. The server sends a ready-made `url` in the push payload;
 * in-app rows are resolved from their related ids the same way.
 */
export interface NotificationData {
  url?: string;
  type?: string;
  taskId?: number | string | null;
  ticketId?: number | string | null;
  userId?: number | string | null;
  notificationId?: number | string | null;
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** An in-app path such as `/tasks/12`, or null when there is nowhere to go. */
export function pathForData(data: NotificationData | null | undefined): string | null {
  if (!data) return null;
  if (typeof data.url === 'string' && data.url.startsWith('taskr://')) {
    const path = data.url.slice('taskr://'.length).replace(/^\/+/, '');
    return path ? `/${path}` : null;
  }
  const ticketId = num(data.ticketId);
  if (ticketId) return `/tickets/${ticketId}`;
  const taskId = num(data.taskId);
  if (taskId) return `/tasks/${taskId}`;
  const userId = num(data.userId);
  if (userId && data.type === 'report_submitted') return `/team/${userId}`;
  return '/notifications';
}

/** The same resolution for a row from GET /notifications. */
export function pathForNotification(n: AppNotification, isManager: boolean): string | null {
  if (n.related_ticket_id) return `/tickets/${n.related_ticket_id}`;
  if (n.related_task_id) return `/tasks/${n.related_task_id}`;
  if (n.related_user_id && isManager && n.type === 'report_submitted') return `/team/${n.related_user_id}`;
  if (n.type === 'report_missing') return '/(app)/(member)/report';
  if (n.type === 'team_overdue_digest') return '/(app)/(manager)/tasks?status=overdue';
  return null;
}
