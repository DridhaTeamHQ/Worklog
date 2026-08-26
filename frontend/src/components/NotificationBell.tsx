import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, ClipboardList, RefreshCw, PartyPopper } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { relativeTime } from '../lib/format';
import { EmptyState, Spinner } from './ui';
import type { AppNotification } from '../types';

export function NotificationBell() {
  const { items, unread, loading, markRead, markAllRead, reload } = useNotifications();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on an outside click or Escape — standard dropdown behaviour.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  /** Clicking a notification marks it read and jumps straight to the task it is about. */
  const handleOpen = async (n: AppNotification) => {
    setOpen(false);
    if (!n.is_read) await markRead(n.id);

    const base = user?.role === 'manager' ? '/manager' : '/employee';
    if (n.related_ticket_id) {
      navigate(`${base}/tickets?highlight=${n.related_ticket_id}`);
      return;
    }
    if (n.related_task_id) {
      navigate(user?.role === 'manager'
        ? `/manager/tasks?highlight=${n.related_task_id}`
        : `/employee/tasks-assigned?highlight=${n.related_task_id}`);
      return;
    }
    navigate(`${base}/notifications`);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); if (!open) void reload(); }}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        className="relative rounded-lg p-2 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="animate-in-up absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-ink-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-ink-900">
              Notifications {unread > 0 && <span className="text-ink-500">({unread} unread)</span>}
            </h3>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void reload()}
                aria-label="Refresh notifications"
                className="rounded p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                </button>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="flex justify-center py-10 text-ink-400"><Spinner /></div>
            ) : items.length === 0 ? (
              <EmptyState
                icon={<PartyPopper className="h-6 w-6" />}
                title="You're all caught up!"
                description="New task assignments and updates will show up here."
              />
            ) : (
              <ul>
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => void handleOpen(n)}
                      className={`flex w-full items-start gap-3 border-b border-ink-100 px-4 py-3 text-left transition-colors hover:bg-ink-50 ${
                        n.is_read ? '' : 'bg-brand-50/60'
                      }`}
                    >
                      <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        n.is_read ? 'bg-ink-100 text-ink-500' : 'bg-brand-100 text-brand-700'
                      }`}
                      >
                        <ClipboardList className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className={`truncate text-sm ${n.is_read ? 'font-medium text-ink-700' : 'font-semibold text-ink-900'}`}>
                            {n.title}
                          </span>
                          {!n.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-hidden />}
                        </span>
                        <span className="mt-0.5 block text-sm text-ink-600 line-clamp-2">{n.message}</span>
                        <span className="mt-1 block text-xs text-ink-400">{relativeTime(n.created_at)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate(user?.role === 'manager' ? '/manager/notifications' : '/employee/notifications');
            }}
            className="block w-full bg-ink-50 px-4 py-3 text-center text-sm font-semibold text-brand-600 hover:bg-ink-100"
          >
            View all notifications
          </button>
        </div>
      )}
    </div>
  );
}
