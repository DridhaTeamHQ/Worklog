import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Where the API is.
 *
 * 1. `EXPO_PUBLIC_API_URL` when set (staging, production, a tunnel).
 * 2. In development, the host Metro is serving from — the same address the phone
 *    already reached to load the bundle, so a device on the LAN gets the laptop's IP
 *    and a simulator gets localhost — with the API's port swapped in.
 * 3. An Android emulator cannot see the host's `localhost`; `10.0.2.2` is its alias.
 *
 * A production build with nothing configured is a mistake, and says so loudly rather
 * than pointing every request at a laptop that no longer exists.
 */
export function resolveApiOrigin(): string {
  const configured = (process.env.EXPO_PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;

  if (!__DEV__) {
    throw new Error('EXPO_PUBLIC_API_URL is not set for this build. Set it in eas.json or .env.');
  }

  const port = process.env.EXPO_PUBLIC_API_PORT || '4000';
  const hostUri = Constants.expoConfig?.hostUri || '';
  let host = hostUri.split(':')[0] || 'localhost';
  if ((host === 'localhost' || host === '127.0.0.1') && Platform.OS === 'android') host = '10.0.2.2';
  return `http://${host}:${port}`;
}

export const API_ORIGIN = resolveApiOrigin();
export const API_BASE = `${API_ORIGIN}/api`;
