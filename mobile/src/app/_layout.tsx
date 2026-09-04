import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
// Per-weight imports so only the five faces the app uses are bundled, not the whole family.
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
import { ThemeProvider, initMotionPrefs, useTheme } from '@/theme';
import { ToastProvider } from '@/components/Toast';
import { queryClient, wireAppLifecycle } from '@/lib/queryClient';
import { useAuthStore } from '@/auth/store';
import { usePrefs } from '@/lib/prefs';
import { isExpoGo } from '@/push/notificationsModule';

SplashScreen.preventAutoHideAsync().catch(() => {});
// Expo Go cannot customise the splash; a real build fades it out.
if (!isExpoGo) SplashScreen.setOptions({ duration: 320, fade: true });

/**
 * The root. Providers, fonts, and the session boot all happen behind the splash
 * screen; the first frame the person sees is already the right one — signed-in home
 * or sign-in — never a flash of the wrong screen.
 */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold,
  });
  const status = useAuthStore((s) => s.status);
  const boot = useAuthStore((s) => s.boot);
  const prefsLoaded = usePrefs((p) => p.loaded);
  const loadPrefs = usePrefs((p) => p.load);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    void loadPrefs();
    boot().finally(() => setBooted(true));
    const unwireLifecycle = wireAppLifecycle();
    const unwireMotion = initMotionPrefs();
    return () => { unwireLifecycle(); unwireMotion(); };
  }, [boot, loadPrefs]);

  const ready = (fontsLoaded || !!fontError) && booted && prefsLoaded && status !== 'booting';
  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => {}); }, [ready]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <BottomSheetModalProvider>
              <ToastProvider>
                {ready ? <RootStack status={status} /> : <Blank />}
              </ToastProvider>
            </BottomSheetModalProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Blank() {
  const t = useTheme();
  return <View style={{ flex: 1, backgroundColor: t.colors.hero }} />;
}

function RootStack({ status }: { status: 'signedOut' | 'signedIn' | 'booting' }) {
  const t = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.colors.ground }, animation: 'fade' }}>
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedIn'}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}
