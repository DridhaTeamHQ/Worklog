/**
 * Authentication controller.
 *
 * Sign-in, sign-out, session lookup, and the password reset / change flows.
 */
import config from '../config/env.js';
import { signToken } from '../middleware/auth.js';
import { ok } from '../utils/http.js';
import { asyncHandler, unauthorized, badRequest } from '../utils/errors.js';
import {
  findByEmail, findById, verifyPassword, toPublicUser, changePassword,
} from '../models/user.js';
import {
  createResetToken, findResetToken, isResetTokenUsable, consumeResetToken,
} from '../models/passwordReset.js';
import { sendPasswordResetEmail } from '../services/mail.js';

function setAuthCookie(res, token) {
  res.cookie(config.auth.cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.auth.cookieSecure,
    maxAge: 8 * 60 * 60 * 1000,
  });
}

export const login = asyncHandler(async (req, res) => {
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
});

export const logout = (req, res) => {
  res.clearCookie(config.auth.cookieName);
  return ok(res, { message: 'Signed out.' });
};

export const me = asyncHandler(async (req, res) => ok(res, { user: await findById(req.user.id) }));

/**
 * Forgot password. Always answers 200 with the same body so the endpoint cannot be
 * used to enumerate accounts. The reset link goes out by email; if no SMTP server is
 * configured the token is written to the server log instead, and outside production it
 * is also returned in the response so the flow is completable during development.
 */
export const forgotPassword = asyncHandler(async (req, res) => {
  const user = await findByEmail(req.body.email);
  const response = { message: 'If an account exists for that email, a reset link has been sent.' };

  if (user && user.is_active) {
    const token = await createResetToken(user.id);
    const mail = await sendPasswordResetEmail({ name: user.name, email: user.email, token });
    if (!mail.delivered) {
      console.log(`[auth] password reset token for ${user.email}: ${token} (valid 30 minutes)`);
    }
    // Outside production the token comes back in the response as well, so the flow is
    // completable with no mail server configured.
    if (!config.isProd) response.devResetToken = token;
  }
  return ok(res, response);
});

export const resetPassword = asyncHandler(async (req, res) => {
  const row = await findResetToken(req.body.token);
  if (!isResetTokenUsable(row)) {
    throw badRequest('That reset link is invalid or has expired. Please request a new one.');
  }
  await changePassword(row.user_id, req.body.password);
  await consumeResetToken(row.id);
  return ok(res, { message: 'Your password has been updated. You can sign in now.' });
});

export const changeOwnPassword = asyncHandler(async (req, res) => {
  const user = await findByEmail(req.user.email);
  if (!(await verifyPassword(req.body.currentPassword, user.password_hash))) {
    throw badRequest('Your current password is not correct.');
  }
  await changePassword(user.id, req.body.newPassword);
  return ok(res, { message: 'Password updated.' });
});
