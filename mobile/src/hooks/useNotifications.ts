import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationApi } from '@/api/endpoints';
import { qk } from '@/api/keys';
import { usePrefs } from '@/lib/prefs';
import type { AppNotification } from '@/types';

export function useNotifications(unreadOnly: boolean) {
  return useQuery({
    queryKey: qk.notifications.list(unreadOnly),
    queryFn: async ({ signal }) => {
      const res = await notificationApi.list({ unreadOnly, limit: 100 }, signal);
      return { items: res.data, unread: Number(res.meta?.unread ?? 0) };
    },
    placeholderData: (prev) => prev,
  });
}

/**
 * The badge number. Polled gently as a fallback: with push granted the phone is told
 * about changes, so once a minute is plenty; without it the app keeps the web's
 * twenty-second rhythm. Only while the app is in front.
 */
export function useUnreadCount() {
  const granted = usePrefs((p) => p.pushPermission === 'granted');
  return useQuery({
    queryKey: qk.notifications.unread,
    queryFn: async ({ signal }) => (await notificationApi.unreadCount(signal)).data.unread,
    refetchInterval: granted ? 60_000 : 20_000,
    refetchIntervalInBackground: false,
    staleTime: 10_000,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => notificationApi.markRead(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: qk.notifications.all });
      const lists = qc.getQueriesData<{ items: AppNotification[]; unread: number }>({ queryKey: ['notifications', 'list'] });
      lists.forEach(([key, data]) => {
        if (!data) return;
        const wasUnread = data.items.some((n) => n.id === id && !n.is_read);
        qc.setQueryData(key, {
          items: data.items.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
          unread: Math.max(0, data.unread - (wasUnread ? 1 : 0)),
        });
      });
      const count = qc.getQueryData<number>(qk.notifications.unread);
      if (typeof count === 'number') qc.setQueryData(qk.notifications.unread, Math.max(0, count - 1));
      return { lists, count };
    },
    onError: (_e, _id, ctx) => {
      ctx?.lists.forEach(([key, data]) => qc.setQueryData(key, data));
      if (typeof ctx?.count === 'number') qc.setQueryData(qk.notifications.unread, ctx.count);
    },
    onSuccess: (res) => { qc.setQueryData(qk.notifications.unread, res.data.unread); },
    onSettled: () => { void qc.invalidateQueries({ queryKey: qk.notifications.all }); },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => {
      qc.setQueryData(qk.notifications.unread, 0);
      void qc.invalidateQueries({ queryKey: qk.notifications.all });
    },
  });
}
