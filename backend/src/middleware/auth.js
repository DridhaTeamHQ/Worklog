import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import { unauthorized, forbidden, badRequest, asyncHandler } from '../utils/errors.js';
import { findAuthUser } from '../models/user.js';
import { ROLES, MANAGER_ROLES } from '../utils/roles.js';
import { DEFAULT_TIMEZONE, isValidTimezone, todayIn } from '../utils/dates.js';

/** True when the request announces itself as the mobile app (`X-Client: mobile`). */
export const isMobileClient = (req) =>
  String(req.get('x-client') || req.query?.client || '').toLowerCase() === 'mobile';

/**
 * Issues a session token.
 *
 * The web app gets the short default (8h) because a browser tab is easy to re-open
 * and the cookie carries it. The mobile app gets a long one (30d by default): a phone
 * asked to sign in every morning is a phone whose app is not used. The trade is safe
 * because `requireAuth` re-loads the account on every request — blocking, deleting or
 * changing the role of an account cuts it off at once regardless of the expiry — and
 * `ver` ties the token to `users.session_version`, which is bumped on password change
 * and by `POST /auth/logout-all`, so every outstanding token can be revoked at once.
 */
export function signToken(user, { client } = {}) {
  const mobile = client === 'mobile';
  return jwt.sign(
    {
      sub: String(user.id),
      role: user.role,
      email: user.email,
      ver: Number(user.session_version || 0),
      ...(mobile ? { client: 'mobile' } : {}),
    },
    config.auth.jwtSecret,
    { expiresIn: mobile ? config.auth.mobileTokenTtl : config.auth.accessTokenTtl, issuer: 'worklog-api' },
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
 *
 * Also settles what "today" means for this caller. The zone comes from the
 * `X-Client-Timezone` header when the client sends one (a phone always does), else
 * the zone saved on the profile, else the deployment default. `req.today` is the
 * calendar date in that zone and is what the report, to-do and dashboard handlers
 * use — never the server's own clock.
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

  // Tokens issued before the last "sign out everywhere" (or password change) are dead.
  if (Number(payload.ver || 0) !== Number(user.session_version || 0)) {
    throw unauthorized('Your session has expired. Please sign in again.');
  }

  const headerZone = (req.get('x-client-timezone') || '').trim();
  if (headerZone && !isValidTimezone(headerZone)) {
    throw badRequest('X-Client-Timezone must be an IANA zone name, such as Asia/Kolkata.');
  }

  req.user = user;
  req.timezone = headerZone || user.timezone || DEFAULT_TIMEZONE;
  req.today = todayIn(req.timezone);
  req.client = payload.client === 'mobile' || isMobileClient(req) ? 'mobile' : 'web';
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
