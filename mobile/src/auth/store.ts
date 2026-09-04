import { create } from 'zustand';
import { tokenStore, onUnauthorized, deviceTimezone, ApiError } from '@/api/client';
import { authApi, deviceApi, profileApi } from '@/api/endpoints';
import type { User } from '@/types';
import { readToken, writeToken, readCachedUser, writeCachedUser, readPushToken, writePushToken } from './session';

export type AuthStatus = 'booting' | 'signedOut' | 'signedIn';

interface AuthState {
  status: AuthStatus;
  user: User | null;
  /** A deep link that arrived while signed out; replayed after sign-in. */
  pendingUrl: string | null;
  /** True when the cached user is being shown because the network could not confirm the session. */
  offline: boolean;

  boot: () => Promise<void>;
  setSession: (session: { token: string; user: User }) => Promise<void>;
  setUser: (user: User) => void;
  setPendingUrl: (url: string | null) => void;
  refresh: () => Promise<void>;
  signOut: (options?: { everywhere?: boolean }) => Promise<void>;
}

/**
 * The one piece of client state that is not server state: who is signed in.
 *
 * Boot verifies a stored token against `/auth/me` — the server is the authority on
 * identity, the token only a hint that there might be a session to restore. If the
 * network is down the cached user is trusted for now so an offline launch still lands
 * on the right home screen; the first request that reaches the server settles it.
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'booting',
  user: null,
  pendingUrl: null,
  offline: false,

  async boot() {
    const token = await readToken();
    if (!token) {
      set({ status: 'signedOut', user: null });
      return;
    }
    tokenStore.set(token);
    try {
      const { data } = await authApi.me();
      await writeCachedUser(data.user);
      set({ status: 'signedIn', user: data.user, offline: false });
      void syncTimezone(data.user);
    } catch (err) {
      if (err instanceof ApiError && err.isNetwork) {
        const cached = await readCachedUser();
        if (cached) { set({ status: 'signedIn', user: cached, offline: true }); return; }
      }
      tokenStore.clear();
      await writeToken(null);
      await writeCachedUser(null);
      set({ status: 'signedOut', user: null, offline: false });
    }
  },

  async setSession({ token, user }) {
    tokenStore.set(token);
    await writeToken(token);
    await writeCachedUser(user);
    set({ status: 'signedIn', user, offline: false });
    void syncTimezone(user);
  },

  setUser(user) {
    set({ user });
    void writeCachedUser(user);
  },

  setPendingUrl(url) { set({ pendingUrl: url }); },

  async refresh() {
    const { data } = await authApi.me();
    set({ user: data.user, offline: false });
    await writeCachedUser(data.user);
  },

  async signOut({ everywhere = false } = {}) {
    // Unregister the phone first, while the token is still good; then tell the
    // server; then forget everything locally. Each step is best-effort.
    const pushToken = await readPushToken();
    if (pushToken) {
      try { await deviceApi.unregister(pushToken); } catch { /* already gone, or offline */ }
      await writePushToken(null);
    }
    try { await (everywhere ? authApi.logoutAll() : authApi.logout()); } catch { /* local sign-out is what matters */ }
    tokenStore.clear();
    await writeToken(null);
    await writeCachedUser(null);
    set({ status: 'signedOut', user: null, offline: false, pendingUrl: null });
  },
}));

/** Records the device zone on the profile when it differs; "today" on the server follows it. */
async function syncTimezone(user: User) {
  const zone = deviceTimezone();
  if (!zone || user.timezone === zone) return;
  try {
    const { data } = await profileApi.update({ timezone: zone });
    useAuthStore.getState().setUser(data);
  } catch { /* the header on every request covers it anyway */ }
}

// Any 401 from any request means the session is gone — drop the user immediately.
onUnauthorized(() => {
  const { status } = useAuthStore.getState();
  if (status !== 'signedIn') return;
  void writeToken(null);
  void writeCachedUser(null);
  useAuthStore.setState({ status: 'signedOut', user: null, offline: false });
});

/** Convenience selectors. */
export const useAuth = () => useAuthStore((s) => ({ status: s.status, user: s.user, offline: s.offline }));
export const useUser = () => useAuthStore((s) => s.user);
