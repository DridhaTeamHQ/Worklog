import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import { unauthorized, forbidden, asyncHandler } from '../utils/errors.js';
import { findAuthUser } from '../models/user.js';
import { ROLES, MANAGER_ROLES } from '../utils/roles.js';

export function signToken(user) {
  return jwt.sign(
    { sub: String(user.id), role: user.role, email: user.email },
    config.auth.jwtSecret,
    { expiresIn: config.auth.accessTokenTtl, issuer: 'worklog-api' },
  );
}

function readToken(req) {
  const header = req.get('authorization');
  if (header && header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  if (req.cookies && req.cookies[config.auth.cookieName]) return req.cookies[config.auth.cookieName];
  return null;
}

/**
 * Verifies the token and re-loads the user from the database on every request, so a
 * deactivated account or a changed role takes effect immediately rather than at token
 * expiry. `req.user` is the trusted identity for the rest of the request.
 */
export const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = readToken(req);
  if (!token) throw unauthorized('You must be signed in to do that.');

  let payload;
  try {
    payload = jwt.verify(token, config.auth.jwtSecret, { issuer: 'worklog-api' });
  } catch (err) {
    throw unauthorized(err.name === 'TokenExpiredError' ? 'Your session has expired. Please sign in again.' : 'Invalid session.');
  }

  const user = await findAuthUser(Number(payload.sub));
  if (!user) throw unauthorized('This account is no longer active.');

  req.user = user;
  next();
});

/** Role gate. Applied on top of requireAuth for every protected route. */
export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  if (!roles.includes(req.user.role)) {
    return next(forbidden('This area is restricted to a different role.'));
  }
  return next();
};

/**
 * Manager-level access: admins and managers both. Admin is a strict superset of
 * manager, so every route a manager may reach, an admin may reach too.
 */
export const requireManager = requireRole(...MANAGER_ROLES);

/** Admin-only. Currently the gate on granting admin access to someone else. */
export const requireAdmin = requireRole(ROLES.ADMIN);

export const requireEmployee = requireRole(ROLES.TEAM_MEMBER);
