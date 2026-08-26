import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { notificationApi } from '../api/endpoints';
import { useAuth } from './AuthContext';
import type { AppNotification } from '../types';

interface NotificationState {
  items: AppNotification[];
  unread: number;
  loading: boolean;
  reload: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationState | null>(null);

/** How often the bell re-checks for new notifications. */
const POLL_MS = 20_000;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, meta } = await notificationApi.list({ limit: 50 });
      setItems(data);
      setUnread(Number(meta?.unread ?? 0));
    } catch {
      // A failed poll is not worth interrupting the user over; the next tick retries.
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * Polling stands in for websockets here: it keeps the bell current without adding a
   * second transport, and it pauses while the tab is hidden so a backgrounded tab is
   * not making requests all day.
   */
  useEffect(() => {
    if (!user) {
      setItems([]);
      setUnread(0);
      return;
    }
    void reload();

    const tick = async () => {
      if (document.hidden) return;
      try {
        const { data } = await notificationApi.unreadCount();
        setUnread((prev) => {
          // Only refetch the list when the count actually moved.
          if (data.unread !== prev) void reload();
          return data.unread;
        });
      } catch { /* ignore transient poll failures */ }
    };

    const id = window.setInterval(tick, POLL_MS);
    const onVisible = () => { if (!document.hidden) void tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user, reload]);

  const markRead = useCallback(async (id: number) => {
    // Optimistic: the bell should respond instantly, and a failed call is corrected
    // by the next poll.
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
    try {
      const { data } = await notificationApi.markRead(id);
      setUnread(data.unread);
    } catch {
      void reload();
    }
  }, [reload]);

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
    try { await notificationApi.markAllRead(); } catch { void reload(); }
  }, [reload]);

  const value = useMemo(
    () => ({ items, unread, loading, reload, markRead, markAllRead }),
    [items, unread, loading, reload, markRead, markAllRead],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside a NotificationProvider');
  return ctx;
}
