import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { deviceApi } from '@/api/endpoints';
import { readPushToken, writePushToken } from '@/auth/session';
import { usePrefs } from '@/lib/prefs';
import { isExpoGo, loadNotifications } from './notificationsModule';

export type PushOutcome = 'registered' | 'denied' | 'unsupported' | 'expo-go' | 'no-project' | 'failed';

/**
 * Asks for permission (only when `prompt` is true — a silent re-register on sign-in
 * never pops the system dialog), fetches the Expo push token and tells the API about
 * this phone. Tokens can rotate, so it is safe and cheap to call on every sign-in.
 */
export async function registerForPush({ prompt }: { prompt: boolean }): Promise<PushOutcome> {
  if (!Device.isDevice || Platform.OS === 'web') return 'unsupported';
  if (isExpoGo) return 'expo-go';
  const Notifications = loadNotifications();
  if (!Notifications) return 'unsupported';

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Taskr',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 200, 120, 200],
      lightColor: '#5B7FE8',
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    if (!prompt) return 'denied';
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') {
    usePrefs.getState().set({ pushPermission: 'denied' });
    return 'denied';
  }
  usePrefs.getState().set({ pushPermission: 'granted' });

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) {
    // Without an EAS project there is no Expo push token to be had.
    console.warn('[push] no EAS projectId in app config — run `npx eas-cli init` to enable push.');
    return 'no-project';
  }

  try {
    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
    await deviceApi.register({
      expoPushToken,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      appVersion: Constants.expoConfig?.version,
    });
    await writePushToken(expoPushToken);
    return 'registered';
  } catch (err) {
    console.warn('[push] registration failed:', (err as Error).message);
    return 'failed';
  }
}

/** Whether this phone has told the API about itself in this sign-in. */
export const hasRegisteredPush = async () => Boolean(await readPushToken());

/** What to tell the person when enabling push did not work. */
export function describePushOutcome(outcome: PushOutcome): { title: string; message?: string } | null {
  switch (outcome) {
    case 'registered': return { title: 'Notifications on', message: 'You will hear about new tasks and comments.' };
    case 'denied': return { title: 'Notifications are off', message: 'Enable them for Taskr in your phone settings.' };
    case 'expo-go': return { title: 'Push needs a build', message: 'Expo Go cannot receive pushes. Install the development build to get them.' };
    case 'no-project': return { title: 'Push needs a build', message: 'Run `eas init` and build the app to enable notifications.' };
    case 'unsupported': return { title: 'Not on this device', message: 'Push notifications need a real phone.' };
    case 'failed': return { title: 'Could not register', message: 'Try again in a moment.' };
    default: return null;
  }
}
