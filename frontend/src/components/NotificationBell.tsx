import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, ClipboardList, RefreshCw, PartyPopper } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { relativeTime } from '../lib/format';
import { EmptyState, Spinner } from './ui';
import type { AppNotification } from '../types';
import { isManagerLevel } from '../types';

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

    const base = isManagerLevel(user?.role) ? '/manager' : '/employee';
    if (n.related_ticket_id) {
      navigate(`${base}/tickets?highlight=${n.related_ticket_id}`);
      return;
    }
    if (n.related_task_id) {
      navigate(isManagerLevel(user?.role)
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
        className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="animate-in-up absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">
              Notifications {unread > 0 && <span className="text-muted-foreground">({unread} unread)</span>}
            </h3>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void reload()}
                aria-label="Refresh notifications"
                className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-primary-strong hover:bg-primary/10"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                </button>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="flex justify-center py-10 text-muted-foreground"><Spinner /></div>
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
                      className={`flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted ${
                        n.is_read ? '' : 'bg-primary/5'
                      }`}
                    >
                      <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        n.is_read ? 'bg-muted text-muted-foreground' : 'bg-primary/15 text-primary-strong'
                      }`}
                      >
                        <ClipboardList className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className={`truncate text-sm ${n.is_read ? 'font-medium text-foreground' : 'font-semibold text-foreground'}`}>
                            {n.title}
                          </span>
                          {!n.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />}
                        </span>
                        <span className="mt-0.5 block text-sm text-muted-foreground line-clamp-2">{n.message}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">{relativeTime(n.created_at)}</span>
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
              navigate(isManagerLevel(user?.role) ? '/manager/notifications' : '/employee/notifications');
            }}
            className="block w-full bg-muted px-4 py-3 text-center text-sm font-semibold text-primary-strong hover:bg-muted"
          >
            View all notifications
          </button>
        </div>
      )}
    </div>
  );
}
