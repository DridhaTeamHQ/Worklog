import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '@/types';

/**
 * Where the session lives on the device.
 *
 * The token goes in the secure store (Keychain / Keystore). It is a few hundred
 * bytes, well inside SecureStore's 2 KB limit. The user object is not a secret, so it
 * goes in ordinary storage — it is only a cache so the app can draw the right home
 * screen while the network is still deciding whether the session is alive.
 */
const TOKEN_KEY = 'taskr.token';
const USER_KEY = 'taskr.user';
const PUSH_TOKEN_KEY = 'taskr.pushToken';

// The web preview has no secure store; ordinary storage keeps a session across
// reloads there. Phones always use the Keychain / Keystore.
const secure = Platform.OS !== 'web';

export async function readToken(): Promise<string | null> {
  try { return secure ? await SecureStore.getItemAsync(TOKEN_KEY) : await AsyncStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export async function writeToken(token: string | null): Promise<void> {
  try {
    if (secure) {
      if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
      else await SecureStore.deleteItemAsync(TOKEN_KEY);
    } else if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
    else await AsyncStorage.removeItem(TOKEN_KEY);
  } catch { /* device without a secure store — the session lasts the process */ }
}

export async function readCachedUser(): Promise<User | null> {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch { return null; }
}

export async function writeCachedUser(user: User | null): Promise<void> {
  try {
    if (user) await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    else await AsyncStorage.removeItem(USER_KEY);
  } catch { /* cosmetic */ }
}

export async function readPushToken(): Promise<string | null> {
  try { return await AsyncStorage.getItem(PUSH_TOKEN_KEY); } catch { return null; }
}

export async function writePushToken(token: string | null): Promise<void> {
  try {
    if (token) await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    else await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
  } catch { /* cosmetic */ }
}
