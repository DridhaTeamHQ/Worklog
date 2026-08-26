import { Router } from 'express';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import config from '../config/env.js';
import { getDb } from '../db/index.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { validate, safeText } from '../middleware/validate.js';
import { ok } from '../utils/http.js';
import { asyncHandler, unauthorized, badRequest } from '../utils/errors.js';
import { nowIso } from '../utils/dates.js';
import {
  findByEmail, findById, verifyPassword, toPublicUser, changePassword,
} from '../services/users.js';
import { sendPasswordResetEmail } from '../services/mail.js';

const router = Router();

/** Throttles credential stuffing without getting in a real user's way. */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isProd ? 10 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many sign-in attempts. Please try again in a few minutes.' } },
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.').max(200),
});

function setAuthCookie(res, token) {
  res.cookie(config.auth.cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.auth.cookieSecure,
    maxAge: 8 * 60 * 60 * 1000,
  });
}

router.post('/login', loginLimiter, validate(loginSchema), asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await findByEmail(email);

  // Same message and comparable timing for "no such user" and "wrong password" so the
  // endpoint cannot be used to discover which emails exist.
  const hash = user?.password_hash || '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi';
  const passwordOk = await verifyPassword(password, hash);
  if (!user || !passwordOk || !user.is_active) {
    throw unauthorized('Incorrect email or password.');
  }

  const token = signToken(user);
  setAuthCookie(res, token);
  return ok(res, { token, user: toPublicUser(user) });
}));

router.post('/logout', (req, res) => {
  res.clearCookie(config.auth.cookieName);
  return ok(res, { message: 'Signed out.' });
});

router.get('/me', requireAuth, asyncHandler(async (req, res) => ok(res, { user: await findById(req.user.id) })));

/**
 * Forgot password. Always answers 200 with the same body so the endpoint cannot be
 * used to enumerate accounts. The reset link goes out by email; if no SMTP server is
 * configured the token is written to the server log instead, and outside production it
 * is also returned in the response so the flow is completable during development.
 */
const forgotLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: config.isProd ? 5 : 50, standardHeaders: true, legacyHeaders: false });

router.post('/forgot-password', forgotLimiter,
  validate(z.object({ email: z.string().trim().toLowerCase().email('Enter a valid email address.') })),
  asyncHandler(async (req, res) => {
    const user = await findByEmail(req.body.email);
    const response = { message: 'If an account exists for that email, a reset link has been sent.' };

    if (user && user.is_active) {
      const db = await getDb();
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      await db.insert(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)`,
        [user.id, tokenHash, expiresAt, nowIso()],
      );
      const mail = await sendPasswordResetEmail({ name: user.name, email: user.email, token });
      if (!mail.delivered) {
        console.log(`[auth] password reset token for ${user.email}: ${token} (valid 30 minutes)`);
      }
      // Outside production the token comes back in the response as well, so the flow is
      // completable with no mail server configured.
      if (!config.isProd) response.devResetToken = token;
    }
    return ok(res, response);
  }));

const resetSchema = z.object({
  token: safeText(200, 'Reset token'),
  password: z.string().min(8, 'Use at least 8 characters.').max(200),
});

router.post('/reset-password', validate(resetSchema), asyncHandler(async (req, res) => {
  const db = await getDb();
  const tokenHash = crypto.createHash('sha256').update(req.body.token).digest('hex');
  const row = await db.get('SELECT * FROM password_reset_tokens WHERE token_hash = ?', [tokenHash]);

  if (!row || row.used_at || row.expires_at < nowIso()) {
    throw badRequest('That reset link is invalid or has expired. Please request a new one.');
  }
  await changePassword(row.user_id, req.body.password);
  await db.run('UPDATE password_reset_tokens SET used_at = ? WHERE id = ?', [nowIso(), row.id]);
  return ok(res, { message: 'Your password has been updated. You can sign in now.' });
}));

const changeSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  newPassword: z.string().min(8, 'Use at least 8 characters.').max(200),
});

router.post('/change-password', requireAuth, validate(changeSchema), asyncHandler(async (req, res) => {
  const user = await findByEmail(req.user.email);
  if (!(await verifyPassword(req.body.currentPassword, user.password_hash))) {
    throw badRequest('Your current password is not correct.');
  }
  await changePassword(user.id, req.body.newPassword);
  return ok(res, { message: 'Password updated.' });
}));

export default router;
