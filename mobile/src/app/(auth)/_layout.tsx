import { Stack } from 'expo-router';
import { useReducedMotion, useTheme } from '@/theme';

export default function AuthLayout() {
  const t = useTheme();
  const reduced = useReducedMotion();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.colors.ground }, animation: reduced ? 'none' : 'slide_from_right' }}>
      <Stack.Screen name="onboarding" options={{ animation: reduced ? 'none' : 'fade' }} />
      <Stack.Screen name="login" options={{ animation: reduced ? 'none' : 'fade' }} />
    </Stack>
  );
}
