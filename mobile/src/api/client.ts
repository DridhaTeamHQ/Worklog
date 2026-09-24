import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const TOKEN_KEY = 'worklog.mobile.token';
const SERVER_URL_KEY = 'worklog.mobile.server_url';
const GET_CACHE = new Map<string, { at: number; result: ApiResult<unknown> }>();

// Default base URL depending on platform & environment variables
const getDefaultBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    const custom = process.env.EXPO_PUBLIC_API_URL.trim().replace(/\/$/, '');
    return custom.endsWith('/api') ? custom : `${custom}/api`;
  }
  if (!__DEV__) {
    return 'https://dridhatasker.vercel.app/api';
  }
  if (Platform.OS === 'web') {
    return 'http://localhost:4000/api';
  }
  // Expo Go exposes the LAN host used by its QR code. Deriving the API host
  // keeps physical devices working when the computer receives a new address.
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:4000/api` : 'https://dridhatasker.vercel.app/api';
};

let currentBaseUrl = getDefaultBaseUrl();

// Initialize custom server url if saved
export async function initServerUrl(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(SERVER_URL_KEY);
    if (saved) {
      currentBaseUrl = saved.endsWith('/api') ? saved : `${saved.replace(/\/$/, '')}/api`;
    }
  } catch {
    // ignore
  }
  return currentBaseUrl;
}

export async function setServerUrl(url: string): Promise<void> {
  let cleaned = url.trim().replace(/\/$/, '');
  if (!cleaned.endsWith('/api')) {
    cleaned = `${cleaned}/api`;
  }
  currentBaseUrl = cleaned;
  await AsyncStorage.setItem(SERVER_URL_KEY, cleaned);
}

export function getServerUrl(): string {
  return currentBaseUrl;
}

export class ApiError extends Error {
  status: number;
  details?: { field: string; message: string }[];

  constructor(status: number, message: string, details?: { field: string; message: string }[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }

  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const d of this.details ?? []) out[d.field] = d.message;
    return out;
  }
}

export const tokenStore = {
  get: async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: async (token: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    } catch {
      // storage unavailable
    }
  },
  clear: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(TOKEN_KEY);
    } catch {
      // storage unavailable
    }
  },
};

type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();

export function onUnauthorized(listener: Listener) {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  skipAuthRedirect?: boolean;
}

export interface ApiResult<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const { method = 'GET', body, query, signal, skipAuthRedirect } = options;

  let queryStr = '';
  if (query) {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
      }
    }
    if (parts.length > 0) {
      queryStr = `?${parts.join('&')}`;
    }
  }

  const endpointPath = path.startsWith('/') ? path : `/${path}`;
  const fullUrl = `${currentBaseUrl}${endpointPath}${queryStr}`;
  const token = await tokenStore.get();

  let res: Response;
  try {
    res = await fetch(fullUrl, {
      method,
      signal,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, `Cannot reach server at ${currentBaseUrl}. Check your connection or server IP.`);
  }

  type Envelope = {
    success?: boolean;
    data?: T;
    meta?: Record<string, unknown>;
    error?: { message: string; details?: { field: string; message: string }[] };
  };

  let payload: Envelope | null;
  try {
    payload = (await res.json()) as Envelope;
  } catch {
    payload = null;
  }

  if (!res.ok) {
    if (res.status === 401 && !skipAuthRedirect) {
      await tokenStore.clear();
      unauthorizedListeners.forEach((l) => l());
    }
    throw new ApiError(
      res.status,
      payload?.error?.message || 'Something went wrong. Please try again.',
      payload?.error?.details,
    );
  }

  return { data: payload?.data as T, meta: payload?.meta };
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query'], signal?: AbortSignal) =>
    request<T>(path, { query, signal }),
  getCached: <T>(path: string, query?: RequestOptions['query'], signal?: AbortSignal, ttl = 15000): Promise<ApiResult<T>> => {
    const key = `${path}|${JSON.stringify(query || {})}`;
    const hit = GET_CACHE.get(key);
    if (hit && Date.now() - hit.at < ttl) return Promise.resolve(hit.result as ApiResult<T>);
    return request<T>(path, { query, signal }).then((result) => {
      GET_CACHE.set(key, { at: Date.now(), result: result as ApiResult<unknown> });
      return result;
    });
  },
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
