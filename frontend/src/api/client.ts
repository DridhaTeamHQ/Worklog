/**
 * Thin fetch wrapper around the API.
 *
 * Everything goes through here so that the token header, the success/error envelope
 * and the "session expired" behaviour live in exactly one place.
 */

const BASE = '/api';
const TOKEN_KEY = 'worklog.token';

export class ApiError extends Error {
  status: number;
  details?: { field: string; message: string }[];

  constructor(status: number, message: string, details?: { field: string; message: string }[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }

  /** Field-keyed messages, ready to drop straight into a form. */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const d of this.details ?? []) out[d.field] = d.message;
    return out;
  }
}

export const tokenStore = {
  get: () => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set: (token: string) => {
    try { localStorage.setItem(TOKEN_KEY, token); } catch { /* storage unavailable */ }
  },
  clear: () => {
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ }
  },
};

type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();

/** Lets the auth context react to a 401 from anywhere without prop-drilling. */
export function onUnauthorized(listener: Listener) {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  /** Set for the login call, where a 401 is an expected answer, not a dead session. */
  skipAuthRedirect?: boolean;
}

export interface ApiResult<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const { method = 'GET', body, query, signal, skipAuthRedirect } = options;

  const url = new URL(`${BASE}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }

  const token = tokenStore.get();
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method,
      credentials: 'include',
      signal,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
  }

  type Envelope = { success?: boolean; data?: T; meta?: Record<string, unknown>; error?: { message: string; details?: { field: string; message: string }[] } };
  // `res.json()` is typed `any`; the cast keeps that from silently spreading.
  let payload: Envelope | null;
  try { payload = await res.json() as Envelope; } catch { payload = null; }

  if (!res.ok) {
    if (res.status === 401 && !skipAuthRedirect) {
      tokenStore.clear();
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
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
