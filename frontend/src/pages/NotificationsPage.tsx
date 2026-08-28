import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, ClipboardList, PartyPopper, RefreshCw } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { EmptyState, LoadingBlock, PageHeader } from '../components/ui';
import { formatDateTime, relativeTime } from '../lib/format';
import type { AppNotification, NotificationType } from '../types';
import { isManagerLevel } from '../types';

const TYPE_LABEL: Record<NotificationType, string> = {
  task_assigned: 'Task assigned',
  task_updated: 'Task updated',
  status_changed: 'Status changed',
  report_submitted: 'Report submitted',
  ticket_raised: 'Ticket raised',
  ticket_updated: 'Ticket updated',
  general: 'General',
};

/** Shared by both portals — the payload is already scoped to the signed-in user. */
export function NotificationsPage() {
  const { items, unread, loading, reload, markRead, markAllRead } = useNotifications();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const visible = useMemo(
    () => (filter === 'unread' ? items.filter((n) => !n.is_read) : items),
    [items, filter],
  );

  const base = isManagerLevel(user?.role) ? '/manager' : '/employee';

  const open = async (n: AppNotification) => {
    if (!n.is_read) await markRead(n.id);
    if (n.related_ticket_id) {
      navigate(`${base}/tickets?highlight=${n.related_ticket_id}`);
      return;
    }
    if (!n.related_task_id) return;
    navigate(
      isManagerLevel(user?.role)
        ? `/manager/tasks?highlight=${n.related_task_id}`
        : `/employee/tasks-assigned?highlight=${n.related_task_id}`,
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : 'You have no unread notifications.'}
        actions={
          <>
            <button type="button" onClick={() => void reload()} className="btn-secondary">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            {unread > 0 && (
              <button type="button" onClick={() => void markAllRead()} className="btn-primary">
                <CheckCheck className="h-4 w-4" /> Mark all read
              </button>
            )}
          </>
        }
      />

      <div className="card">
        <div className="border-b border-ink-200 px-4 py-3">
          <div className="segmented inline-flex" role="tablist" aria-label="Filter notifications">
            {(['all', 'unread'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={filter === value}
                onClick={() => setFilter(value)}
                className={`segmented-item capitalize ${filter === value ? 'segmented-item-active' : ''}`}
              >
                {value}{value === 'unread' && unread > 0 ? ` (${unread})` : ''}
              </button>
            ))}
          </div>
        </div>

        {loading && items.length === 0 ? (
          <LoadingBlock label="Loading notifications" rows={4} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={filter === 'unread' ? <PartyPopper className="h-6 w-6" /> : <Bell className="h-6 w-6" />}
            title={filter === 'unread' ? "You're all caught up!" : 'No notifications yet'}
            description={
              filter === 'unread'
                ? 'Every notification has been read.'
                : 'Task assignments and status updates will show up here.'
            }
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {visible.map((n) => {
              const clickable = Boolean(n.related_task_id || n.related_ticket_id);
              const Tag = clickable ? 'button' : 'div';
              return (
                <li key={n.id}>
                  <Tag
                    {...(clickable ? { type: 'button' as const, onClick: () => void open(n) } : {})}
                    className={`flex w-full items-start gap-4 px-5 py-4 text-left transition-colors ${
                      clickable ? 'hover:bg-ink-50' : ''
                    } ${n.is_read ? '' : 'bg-brand-50/50'}`}
                  >
                    <span className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      n.is_read ? 'bg-ink-100 text-ink-500' : 'bg-brand-100 text-brand-700'
                    }`}
                    >
                      <ClipboardList className="h-5 w-5" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={`text-sm ${n.is_read ? 'font-medium text-ink-700' : 'font-semibold text-ink-900'}`}>
                          {n.title}
                        </span>
                        <span className="badge border-ink-200 bg-ink-50 text-ink-500">{TYPE_LABEL[n.type]}</span>
                        {!n.is_read && <span className="h-2 w-2 rounded-full bg-brand-600" aria-label="Unread" />}
                      </span>
                      <span className="mt-1 block text-sm text-ink-600">{n.message}</span>
                      <span className="mt-1.5 block text-xs text-ink-400">
                        {formatDateTime(n.created_at)} · {relativeTime(n.created_at)}
                      </span>
                    </span>

                    {!n.is_read && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); void markRead(n.id); }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); void markRead(n.id); }
                        }}
                        className="shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50"
                      >
                        Mark read
                      </span>
                    )}
                  </Tag>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
