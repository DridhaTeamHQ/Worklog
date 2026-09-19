import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import { chatApi } from '../api/endpoints';
import { useAuth } from './AuthContext';
import type { ChatUnread } from '../types';

/**
 * How much unread chat there is, for whoever needs to draw a badge.
 *
 * This exists because the count is needed in two places at once now that chat is a
 * page rather than a floating panel: the sidebar link shows it on every screen, and
 * the chat page itself shows the per-room breakdown. Polling it in both would mean
 * two timers asking the same question, so it is polled once here.
 *
 * The rate matches the notification bell, and it pauses while the tab is hidden, for
 * the same reason: a backgrounded tab should not spend the day making requests.
 */

const POLL_MS = 20_000;

const EMPTY: ChatUnread = { unread: 0, direct: 0, threads: [], team: { unread: 0, mentions: 0 }, groups: 0 };

interface ChatState {
  counts: ChatUnread;
  /** Re-read the counts now — called after opening a room clears one. */
  refresh: () => Promise<void>;
  /** Sets the total directly, from the meta a room's own response already carried. */
  setTotal: (unread: number) => void;
}

const ChatContext = createContext<ChatState | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [counts, setCounts] = useState<ChatUnread>(EMPTY);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await chatApi.unreadCount();
      setCounts(data);
    } catch {
      // A failed poll is not worth interrupting anyone over; the next tick retries.
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setCounts(EMPTY);
      return undefined;
    }
    void refresh();
    const id = window.setInterval(() => { if (!document.hidden) void refresh(); }, POLL_MS);
    const onVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user, refresh]);

  /*
   * Reading a room returns the new total in its own response, so the badge can drop
   * immediately rather than staying stale until the next poll. Only the total is set
   * here; the breakdown is corrected on the next tick.
   */
  const setTotal = useCallback((unread: number) => {
    setCounts((prev) => (prev.unread === unread ? prev : { ...prev, unread }));
  }, []);

  const value = useMemo(() => ({ counts, refresh, setTotal }), [counts, refresh, setTotal]);
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatUnread() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatUnread must be used inside a ChatProvider');
  return ctx;
}
