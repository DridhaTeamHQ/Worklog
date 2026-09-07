import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authApi, profileApi } from '../api/endpoints';
import { onUnauthorized, tokenStore } from '../api/client';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  /**
   * Adopts a session the server already issued, for a flow that authenticates without
   * a password being typed — claiming an invite is the only one today.
   */
  adoptSession: (token: string, user: User) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * On boot, a stored token is verified against the server before the app renders
   * anything role-specific. The server is the authority on identity — the token is
   * only a hint that there might be a session to restore.
   */
  useEffect(() => {
    let cancelled = false;
    // The body handles every outcome itself, so the promise is intentionally
    // not awaited.
    void (async () => {
      if (!tokenStore.get()) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await authApi.me();
        if (!cancelled) setUser(data.user);
      } catch {
        tokenStore.clear();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Any 401 from any request means the session is gone — drop the user immediately.
  useEffect(() => {
    const unsubscribe = onUnauthorized(() => setUser(null));
    return () => { unsubscribe(); };
  }, []);

  /**
   * Records the browser's timezone on the profile the first time it is missing. It is
   * what "today" means on the server for this person's daily report and to-dos; the
   * mobile app sends its own on every request, so this only matters for web-only users.
   */
  useEffect(() => {
    if (!user || user.timezone) return;
    let zone: string | undefined;
    try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { zone = undefined; }
    if (!zone) return;
    void profileApi.update({ timezone: zone })
      .then(({ data }) => setUser(data))
      .catch(() => { /* cosmetic — the next sign-in tries again */ });
  }, [user]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await authApi.login(email, password);
    tokenStore.set(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const adoptSession = useCallback((token: string, nextUser: User) => {
    tokenStore.set(token);
    setUser(nextUser);
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* signing out locally is what matters */ }
    tokenStore.clear();
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await authApi.me();
    setUser(data.user);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, adoptSession, logout, refresh, setUser }),
    [user, loading, login, adoptSession, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider');
  return ctx;
}
