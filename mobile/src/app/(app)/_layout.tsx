import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useReducedMotion, useTheme } from '@/theme';
import { useAuthStore } from '@/auth/store';
import { usePushNotifications } from '@/push/usePushNotifications';
import { isManagerLevel } from '@/types';

/**
 * The signed-in tree. Each portal's tabs are guarded by role; the shared stack
 * screens (task, ticket, notifications…) sit outside the groups so one deep link
 * such as taskr://tasks/12 resolves to exactly one file, and the screen itself
 * decides which actions the role gets.
 */
export default function AppLayout() {
  const t = useTheme();
  const reduced = useReducedMotion();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const pendingUrl = useAuthStore((s) => s.pendingUrl);
  const setPendingUrl = useAuthStore((s) => s.setPendingUrl);
  const manager = isManagerLevel(user?.role);

  usePushNotifications();

  // A link that arrived while signed out is replayed once the tree is up.
  useEffect(() => {
    if (!pendingUrl) return;
    const url = pendingUrl;
    setPendingUrl(null);
    const timer = setTimeout(() => router.push(url as never), 250);
    return () => clearTimeout(timer);
  }, [pendingUrl, router, setPendingUrl]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.colors.ground }, animation: reduced ? 'none' : 'slide_from_right' }}>
      <Stack.Protected guard={manager}>
        <Stack.Screen name="(manager)" options={{ animation: reduced ? 'none' : 'fade' }} />
      </Stack.Protected>
      <Stack.Protected guard={!manager}>
        <Stack.Screen name="(member)" options={{ animation: reduced ? 'none' : 'fade' }} />
      </Stack.Protected>
      <Stack.Screen name="tasks/assign" options={{ presentation: 'modal', animation: reduced ? 'none' : 'slide_from_bottom' }} />
      <Stack.Screen name="tasks/[id]/edit" options={{ presentation: 'modal', animation: reduced ? 'none' : 'slide_from_bottom' }} />
      <Stack.Screen name="tickets/new" options={{ presentation: 'modal', animation: reduced ? 'none' : 'slide_from_bottom' }} />
      <Stack.Screen name="tickets/[id]/edit" options={{ presentation: 'modal', animation: reduced ? 'none' : 'slide_from_bottom' }} />
      <Stack.Screen name="projects/new" options={{ presentation: 'modal', animation: reduced ? 'none' : 'slide_from_bottom' }} />
      <Stack.Screen name="projects/[id]" />
      <Stack.Screen name="projects/edit/[id]" options={{ presentation: 'modal', animation: reduced ? 'none' : 'slide_from_bottom' }} />
      <Stack.Screen name="profile/edit" options={{ presentation: 'modal', animation: reduced ? 'none' : 'slide_from_bottom' }} />
      <Stack.Screen name="profile/password" options={{ presentation: 'modal', animation: reduced ? 'none' : 'slide_from_bottom' }} />
    </Stack>
  );
}
