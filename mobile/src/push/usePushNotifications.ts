import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/auth/store';
import { qk } from '@/api/keys';
import { useUnreadCount } from '@/hooks/useNotifications';
import { usePrefs } from '@/lib/prefs';
import { useToast } from '@/components/Toast';
import { pathForData, type NotificationData } from './notificationRoute';
import { registerForPush } from './registerForPush';
import { loadNotifications } from './notificationsModule';

/** Which cached data a push makes stale. */
function keysFor(data: NotificationData | undefined) {
  const keys: unknown[][] = [[...qk.notifications.all], ['dashboard']];
  const taskId = Number(data?.taskId);
  const ticketId = Number(data?.ticketId);
  if (taskId) { keys.push([...qk.tasks.all]); keys.push([...qk.activity('task', taskId)]); keys.push([...qk.checklist(taskId)]); }
  if (ticketId) { keys.push([...qk.tickets.all]); keys.push([...qk.activity('ticket', ticketId)]); }
  if (data?.type === 'report_submitted') keys.push([...qk.reports.all]);
  return keys;
}

/**
 * Mounted once inside the signed-in tree. Registers the phone (silently, if permission
 * was granted before), routes taps, refreshes what a push is about, and keeps the app
 * icon badge equal to the unread count. Does nothing where push is not available
 * (Expo Go, web) — the unread poll in `useUnreadCount` covers those.
 */
export function usePushNotifications() {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const status = useAuthStore((s) => s.status);
  const setPendingUrl = useAuthStore((s) => s.setPendingUrl);
  const pushPermission = usePrefs((p) => p.pushPermission);
  const unread = useUnreadCount();
  const handledResponse = useRef<string | null>(null);

  // Silent re-registration on every sign-in: tokens rotate, and a re-installed app
  // has a new one.
  useEffect(() => {
    if (status !== 'signedIn' || pushPermission !== 'granted') return;
    void registerForPush({ prompt: false });
  }, [status, pushPermission]);

  // Badge follows the unread count.
  useEffect(() => {
    const Notifications = loadNotifications();
    if (!Notifications || typeof unread.data !== 'number') return;
    Notifications.setBadgeCountAsync(unread.data).catch(() => { /* not supported everywhere */ });
  }, [unread.data]);

  useEffect(() => {
    const Notifications = loadNotifications();
    if (!Notifications) return undefined;

    // In the foreground the OS banner stays quiet and the app shows its own toast,
    // which can also refresh the list the push is about. In the background the OS
    // does its job.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: false,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: true,
      }),
    });

    const go = (data: NotificationData | undefined, identifier: string) => {
      if (handledResponse.current === identifier) return;
      handledResponse.current = identifier;
      const path = pathForData(data);
      if (!path) return;
      if (useAuthStore.getState().status === 'signedIn') router.push(path as never);
      else setPendingUrl(path);
    };

    const received = Notifications.addNotificationReceivedListener((event) => {
      const data = event.request.content.data as NotificationData | undefined;
      keysFor(data).forEach((key) => { void qc.invalidateQueries({ queryKey: key }); });
      toast.show({
        title: event.request.content.title || 'Taskr',
        message: event.request.content.body || '',
        tone: 'info',
        onPress: () => go(data, `${event.request.identifier}-tap`),
      });
    });

    const responded = Notifications.addNotificationResponseReceivedListener((response) => {
      go(response.notification.request.content.data as NotificationData | undefined, response.notification.request.identifier);
    });

    // Cold start from a tap: the response is available before listeners attach.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) go(response.notification.request.content.data as NotificationData | undefined, response.notification.request.identifier);
    }).catch(() => { /* none */ });

    // Coming back to the foreground: refetch the badge at once rather than on the timer.
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void qc.invalidateQueries({ queryKey: qk.notifications.unread });
    });

    return () => {
      received.remove();
      responded.remove();
      appState.remove();
    };
  }, [qc, router, setPendingUrl, toast]);
}
