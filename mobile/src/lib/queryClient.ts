import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { ApiError } from '@/api/client';

/**
 * Server state lives in TanStack Query. A screen never fetches by hand: it asks for
 * a query, and mutations invalidate the keys they touched so every screen showing the
 * same thing refreshes together.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (count, err) => count < 1 && !(err instanceof ApiError && err.status >= 400 && err.status < 500),
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
    },
    mutations: { retry: 0 },
  },
});

/** "Window focus" on a phone is the app coming to the foreground. */
export function wireAppLifecycle() {
  const onChange = (state: AppStateStatus) => {
    if (Platform.OS !== 'web') focusManager.setFocused(state === 'active');
  };
  const sub = AppState.addEventListener('change', onChange);

  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => setOnline(Boolean(state.isConnected))));

  return () => sub.remove();
}
