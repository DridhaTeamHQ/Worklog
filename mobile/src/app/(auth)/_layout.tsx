import { Stack } from 'expo-router';
import { useTheme } from '@/theme';

export default function AuthLayout() {
  const t = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.colors.hero }, animation: 'slide_from_right' }}>
      <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
      <Stack.Screen name="login" options={{ animation: 'fade' }} />
    </Stack>
  );
}
