/**
 * Thin fetch wrapper around the API — a port of frontend/src/api/client.ts.
 *
 * Everything goes through here so that the token header, the success/error envelope
 * and the "session expired" behaviour live in exactly one place. The differences from
 * the web client are exactly the ones a phone needs: an absolute base URL, the token
 * held in memory (backed by SecureStore via the auth store), no cookies, and two extra
 * headers — the device's timezone, which is what "today" means on the server, and the
 * client name, which is what earns the long-lived mobile session.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { API_BASE } from '@/lib/apiUrl';

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

  /** True when the server could not be reached at all (no response). */
  get isNetwork() { return this.status === 0; }
}

/* ---------------------------------------------------------------- token */

let currentToken: string | null = null;

/** The auth store owns persistence; the client only needs the current value. */
export const tokenStore = {
  get: () => currentToken,
  set: (token: string | null) => { currentToken = token; },
  clear: () => { currentToken = null; },
};

type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();

/** Lets the auth store react to a 401 from anywhere without prop-drilling. */
export function onUnauthorized(listener: Listener) {
  unauthorizedListeners.add(listener);
  return () => { unauthorizedListeners.delete(listener); };
}

/* ------------------------------------------------------------- headers */

export function deviceTimezone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}

const APP_VERSION = Constants.expoConfig?.version || '0.0.0';
const CLIENT_HEADER = `taskr-mobile/${APP_VERSION} (${Platform.OS})`;

/* ------------------------------------------------------------- request */

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  /** Set for the login call, where a 401 is an expected answer, not a dead session. */
  skipAuthRedirect?: boolean;
  timeoutMs?: number;
}

export interface ApiResult<T> {
  data: T;
  meta?: Record<string, unknown>;
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return `${API_BASE}${path}${qs ? `?${qs}` : ''}`;
}

/** One signal that aborts on either the caller's signal or the timeout. */
function withTimeout(signal: AbortSignal | undefined, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), ms);
  const onAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  return {
    signal: controller.signal,
    done: () => { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); },
  };
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const { method = 'GET', body, query, signal, skipAuthRedirect, timeoutMs = 20_000 } = options;
  const token = tokenStore.get();
  const guard = withTimeout(signal, timeoutMs);

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      signal: guard.signal,
      headers: {
        Accept: 'application/json',
        'X-Client': 'mobile',
        'X-Client-App': CLIENT_HEADER,
        'X-Client-Timezone': deviceTimezone(),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    guard.done();
    // A caller-initiated abort (TanStack cancelling a stale query) must surface as
    // such; only a genuine network failure becomes a user-facing error.
    if (signal?.aborted) throw err;
    if ((err as Error)?.message === 'timeout' || guard.signal.reason?.message === 'timeout') {
      throw new ApiError(0, 'The server is taking too long to respond. Try again in a moment.');
    }
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
  }
  guard.done();

  type Envelope = {
    success?: boolean; data?: T; meta?: Record<string, unknown>;
    error?: { message: string; details?: { field: string; message: string }[] };
  };
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
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

/** The message to show for any thrown value, ApiError or not. */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.') {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
