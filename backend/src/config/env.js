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
  appName: process.env.APP_NAME || 'Dridha Worklog',
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  db: {
    // "postgres" when DATABASE_URL is present, otherwise the embedded SQLite file.
    client: process.env.DB_CLIENT || (process.env.DATABASE_URL ? 'postgres' : 'sqlite'),
    url: process.env.DATABASE_URL || '',
    ssl: bool(process.env.DATABASE_SSL, false),
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
    from: process.env.MAIL_FROM || 'Dridha Worklog <no-reply@company.com>',
    replyTo: process.env.MAIL_REPLY_TO || '',
    // Where the emails tell people to sign in.
    appUrl: (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, ''),
  },

  seed: {
    managerEmail: process.env.SEED_MANAGER_EMAIL || 'manager@company.com',
    managerPassword: process.env.SEED_MANAGER_PASSWORD || 'Manager@123',
    employeePassword: process.env.SEED_EMPLOYEE_PASSWORD || 'Employee@123',
  },
};

export default config;
