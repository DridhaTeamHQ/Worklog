import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * `expo-notifications`, loaded on demand.
 *
 * Since SDK 53 the module throws the moment it is imported inside Expo Go on Android
 * ("remote notifications were removed from Expo Go"), which would take down every
 * screen that transitively imports it. So nothing imports it statically: callers ask
 * for it here, and get `null` in Expo Go and on the web, where there is no push to
 * register for anyway. A development or production build gets the real module.
 */
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

type NotificationsModule = typeof import('expo-notifications');

let cached: NotificationsModule | null | undefined;

export function loadNotifications(): NotificationsModule | null {
  if (cached !== undefined) return cached;
  if (Platform.OS === 'web' || isExpoGo) {
    cached = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-notifications') as NotificationsModule;
  } catch (err) {
    console.warn('[push] expo-notifications unavailable:', (err as Error).message);
    cached = null;
  }
  return cached;
}

/** True when this binary can receive pushes at all (a dev/production build on a phone). */
export const pushSupported = () => loadNotifications() !== null;
