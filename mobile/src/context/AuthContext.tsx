import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Role } from '../types';
import { authApi } from '../api/endpoints';
import { tokenStore, onUnauthorized, initServerUrl, setServerUrl, getServerUrl } from '../api/client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  serverUrl: string;
  login: (email: string, pass: string) => Promise<User>;
  acceptInvite: (email: string, pass: string) => Promise<User>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  updateServerUrl: (url: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [serverUrl, setServerUrlState] = useState('');

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    } finally {
      await tokenStore.clear();
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const token = await tokenStore.get();
      if (!token) {
        setUser(null);
        return;
      }
      const res = await authApi.me();
      setUser(res.data.user);
    } catch {
      await tokenStore.clear();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    async function init() {
      const url = await initServerUrl();
      setServerUrlState(url);
      await refreshUser();
      setLoading(false);
    }
    init();

    const unsubscribe = onUnauthorized(() => {
      setUser(null);
    });

    return () => {
      unsubscribe();
    };
  }, [refreshUser]);

  const login = async (email: string, pass: string): Promise<User> => {
    const res = await authApi.login(email, pass);
    await tokenStore.set(res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const acceptInvite = async (email: string, pass: string): Promise<User> => {
    const res = await authApi.acceptInvite(email, pass);
    await tokenStore.set(res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const updateUser = (updates: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null));
  };

  const updateServerUrl = async (url: string) => {
    await setServerUrl(url);
    setServerUrlState(getServerUrl());
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        serverUrl,
        login,
        acceptInvite,
        logout,
        updateUser,
        updateServerUrl,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
