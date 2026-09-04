import { Redirect } from 'expo-router';
import { useAuthStore } from '@/auth/store';
import { usePrefs } from '@/lib/prefs';
import { isManagerLevel } from '@/types';

/** The front door: onboarding once, then sign-in, then whichever portal the role gets. */
export default function Index() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const onboardingSeen = usePrefs((p) => p.onboardingSeen);

  if (status !== 'signedIn' || !user) {
    return <Redirect href={onboardingSeen ? '/(auth)/login' : '/(auth)/onboarding'} />;
  }
  return <Redirect href={isManagerLevel(user.role) ? '/(app)/(manager)' : '/(app)/(member)'} />;
}
