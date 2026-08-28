/**
 * Vercel serverless entry for the API.
 *
 * The frontend and the API ship as one project: the built SPA is the static output
 * and this function serves everything under /api. That is what lets the client keep
 * calling a relative `/api` path — same origin, so no CORS and no cross-site cookie
 * problem to solve.
 *
 * `backend/src/server.js` is the long-running entry: it migrates, opens the database,
 * calls `app.listen` and installs signal handlers. None of that belongs in a function
 * started and stopped per request, so this uses `createApp()` — which builds the
 * Express app and nothing else — and lets the platform own the listening socket.
 *
 * The app is built once at module scope. Vercel reuses a warm instance across
 * invocations, so this keeps the routing table and the database pool alive between
 * requests instead of rebuilding both every time.
 */
import { createApp } from '../backend/src/app.js';

/*
 * Fail loudly rather than quietly wrong.
 *
 * With no DATABASE_URL the app falls back to its embedded SQLite file. That is right
 * for a laptop and disastrous here: a function's filesystem is ephemeral and not
 * shared between instances, so every deploy would start empty, two concurrent
 * requests could see different data, and nothing written would survive. Better to
 * refuse to boot with an explanation than to serve a database that silently forgets.
 */
if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. The serverless API needs PostgreSQL — its filesystem is '
    + 'ephemeral, so the SQLite fallback would lose data on every deploy. Set '
    + 'DATABASE_URL (and DATABASE_SSL=true) in the Vercel project settings.',
  );
}

const app = createApp();

/**
 * Rebuilds the path Express should see.
 *
 * Every route in this app is mounted under `/api`, but the rewrite that sends traffic
 * here targets this one file, so the incoming URL can arrive as `/api/index`. The
 * rewrite therefore carries the real path in `__path`, and this puts it back before
 * Express looks at it. Anything else in the query string is preserved untouched —
 * dropping it would silently break every filtered list in the app.
 *
 * Exported so the behaviour can be tested directly rather than only through a
 * deployment.
 */
export function restorePath(url) {
  const parsed = new URL(url || '/', 'http://localhost');
  const carried = parsed.searchParams.get('__path');
  if (carried === null) return url;

  parsed.searchParams.delete('__path');
  const query = parsed.searchParams.toString();
  const path = carried.replace(/^\/+/, '');
  return `/api${path ? `/${path}` : ''}${query ? `?${query}` : ''}`;
}

export default function handler(req, res) {
  req.url = restorePath(req.url);
  return app(req, res);
}
