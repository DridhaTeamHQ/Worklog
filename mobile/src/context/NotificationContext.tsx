import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { AppNotification } from '../types';
import { notificationApi } from '../api/endpoints';
import { useAuth } from './AuthContext';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hydratedRef = useRef(false);
  const seenIdsRef = useRef<Set<number>>(new Set());

  const enableNativeNotifications = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      const current = await Notifications.getPermissionsAsync();
      let status = current.status;
      if (status !== 'granted') {
        const requested = await Notifications.requestPermissionsAsync();
        status = requested.status;
      }
      if (status === 'granted' && Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('taskr', {
          name: 'Taskr notifications',
          importance: Notifications.AndroidImportance.DEFAULT,
          vibrationPattern: [0, 250, 150, 250],
          lightColor: '#0669ff',
        });
      }
    } catch {
      // Notifications are optional; the in-app notification center still works.
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    try {
      const [listRes, countRes] = await Promise.all([
        notificationApi.list({ limit: 40 }),
        notificationApi.unreadCount(),
      ]);
      const next = listRes.data || [];
      if (hydratedRef.current && Platform.OS !== 'web') {
        const fresh = next.filter((item) => !seenIdsRef.current.has(item.id));
        for (const item of fresh.slice(-3)) {
          void Notifications.scheduleNotificationAsync({
            content: {
              title: item.title,
              body: item.message,
              data: { notificationId: item.id, taskId: item.related_task_id },
              sound: 'default',
            },
            trigger: null,
          }).catch(() => {});
        }
      }
      seenIdsRef.current = new Set(next.map((item) => item.id));
      hydratedRef.current = true;
      setNotifications(next);
      setUnreadCount(countRes.data?.unread || 0);
    } catch {
      // ignore
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      hydratedRef.current = false;
      seenIdsRef.current.clear();
      return;
    }

    void enableNativeNotifications();
    setLoading(true);
    refresh().finally(() => setLoading(false));

    // Poll frequently so assignments become native notifications while the app is open.
    timerRef.current = setInterval(() => {
      refresh();
    }, 5000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [user, refresh, enableNativeNotifications]);

  const markAsRead = async (id: number) => {
    try {
      await notificationApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // ignore
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        refresh,
        markAsRead,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
