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
  findInvitedByEmail, setInitialPassword,
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
  // endpoint cannot be used to discover which emails exist. An invited account that
  // has not been claimed has a NULL hash, so it lands on the same placeholder and is
  // refused here exactly like an unknown address — claiming it is the only way in.
  const hash = user?.password_hash || '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi';
  const passwordOk = await verifyPassword(password, hash);
  if (!user || !passwordOk || !user.is_active) {
    throw unauthorized('Incorrect email or password.');
  }

  const token = signToken(user);
  setAuthCookie(res, token);
  return ok(res, { token, user: toPublicUser(user) });
});

/**
 * POST /api/auth/invite-status — has this email been added by a manager but never
 * claimed?
 *
 * This is what puts the "Invited" button on the sign-in page. It answers truthfully
 * only for accounts in that one state; a claimed account, a deactivated one and an
 * address nobody has added all answer `invited: false` alike.
 *
 * NOTE: answering this at all tells an anonymous caller that a given address is a
 * pending invite, which is a deliberate departure from the enumeration-blocking the
 * rest of the auth surface keeps. It is rate limited to make sweeping a list of
 * addresses impractical, and the window is small — it closes the moment the person
 * sets their password. See the security note in the README.
 */
export const inviteStatus = asyncHandler(async (req, res) => {
  const invite = await findInvitedByEmail(req.body.email);
  // The first name only, so the button can greet them without publishing the roster.
  const name = invite ? String(invite.name || '').trim().split(/\s+/)[0] : undefined;
  return ok(res, { invited: Boolean(invite), name });
});

/**
 * POST /api/auth/accept-invite — claim an invited account by setting its password.
 *
 * Succeeds only while the account still has no password; `setInitialPassword` makes
 * that check part of the UPDATE, so a second attempt (or two racing requests) cannot
 * claim it twice. On success the caller is signed straight in, because they have just
 * proven nothing except that they chose the password — making them type it again
 * would add ceremony, not security.
 */
export const acceptInvite = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await setInitialPassword(email, password);
  if (!user) {
    throw badRequest('That invitation is no longer available. If you have already set a password, sign in — or use "Forgot password?".');
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
