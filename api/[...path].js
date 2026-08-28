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
 * The filename is a catch-all segment on purpose. Vercel maps `/api/**` to it while
 * leaving `req.url` as the path the browser actually asked for, so Express still sees
 * `/api/auth/login` and its existing `app.use('/api/...')` mounts match unchanged. A
 * plain `api/index.js` plus a rewrite would replace the path and match nothing.
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

export default app;
