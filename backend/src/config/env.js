import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..', '..');

const bool = (v, fallback = false) =>
  v === undefined ? fallback : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());

const isProd = process.env.NODE_ENV === 'production';

/**
 * JWT secret. Required in production; a stable dev secret is derived otherwise so
 * that restarting the dev server does not invalidate every open session.
 */
function resolveJwtSecret() {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && fromEnv.length >= 32) return fromEnv;
  if (isProd) {
    throw new Error('JWT_SECRET must be set to at least 32 characters in production.');
  }
  if (fromEnv) {
    console.warn('[config] JWT_SECRET is shorter than 32 chars — acceptable in development only.');
    return fromEnv;
  }
  console.warn('[config] JWT_SECRET not set — using a derived development secret. Set it in .env.');
  return crypto.createHash('sha256').update('worklog-dev-secret-do-not-use-in-production').digest('hex');
}

export const config = {
  isProd,
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  appName: process.env.APP_NAME || 'Taskr',
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  db: {
    // "postgres" when DATABASE_URL is present, otherwise the embedded SQLite file.
    client: process.env.DB_CLIENT || (process.env.DATABASE_URL ? 'postgres' : 'sqlite'),
    url: process.env.DATABASE_URL || '',
    ssl: bool(process.env.DATABASE_SSL, false),
    /*
     * How many connections one process may hold.
     *
     * A long-running server has exactly one pool, so ten is cheap. Serverless has one
     * pool per instance and many instances, so the same number multiplies into the
     * database's connection limit and starts refusing work under ordinary traffic.
     * Vercel sets VERCEL=1, which is how this tells the two apart.
     */
    poolMax: Number(process.env.DB_POOL_MAX) || (process.env.VERCEL ? 2 : 10),
    sqliteFile: process.env.SQLITE_FILE
      ? path.resolve(backendRoot, process.env.SQLITE_FILE)
      : path.join(backendRoot, 'data', 'worklog.db'),
  },

  auth: {
    jwtSecret: resolveJwtSecret(),
    accessTokenTtl: process.env.JWT_EXPIRES_IN || '8h',
    bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 10),
    cookieName: 'worklog_token',
    cookieSecure: bool(process.env.COOKIE_SECURE, isProd),
  },

  /**
   * Outbound email. When SMTP_HOST is absent the app falls back to writing messages to
   * the server log instead of sending them, so a local run never silently fails and
   * never needs a mail server.
   */
  mail: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    secure: bool(process.env.SMTP_SECURE, Number(process.env.SMTP_PORT) === 465),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'Taskr <no-reply@company.com>',
    replyTo: process.env.MAIL_REPLY_TO || '',
    // Where the emails tell people to sign in.
    appUrl: (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, ''),
  },

  /**
   * The first admin, created by `npm run seed` on an empty database.
   *
   * There are deliberately no default credentials: an unset value fails the seed with
   * an explanation rather than quietly creating a well-known account that would be
   * live on any deployment that forgot to configure this.
   */
  seed: {
    email: (process.env.SEED_ADMIN_EMAIL || '').trim().toLowerCase(),
    password: process.env.SEED_ADMIN_PASSWORD || '',
    name: (process.env.SEED_ADMIN_NAME || 'Admin').trim(),
  },
};

export default config;
