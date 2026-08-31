/**
 * Admin controller — granting and listing manager-level access.
 *
 * The privilege boundary lives here: `grantableRoles` decides what the caller may
 * hand out, so the requested role is checked rather than trusted.
 */
import { ok, created } from '../utils/http.js';
import { asyncHandler, forbidden, badRequest } from '../utils/errors.js';
import { ROLES, grantableRoles, roleLabel, isAdmin } from '../utils/roles.js';
import {
  listManagers, createUser, deleteManagerAccount, countAdmins, countActiveAdmins,
  setManagerAccess,
} from '../models/user.js';
import { sendInviteEmail } from '../services/mail.js';

export const list = asyncHandler(async (req, res) => {
  const managers = await listManagers(req.validatedQuery);
  return ok(res, managers, { total: managers.length });
});

/**
 * POST /api/admins — grant manager-level access to a new person.
 *
 * This is deliberately a separate endpoint from POST /api/team, which hard-codes
 * `team_member`. Keeping them apart means the everyday "add a colleague" path cannot
 * be turned into an escalation by adding a `role` field to the request, and every
 * grant of elevated access goes through this one route.
 *
 * The two tiers are not equivalent, so the request role is checked against what the
 * caller is actually allowed to hand out rather than trusted:
 *   - an admin may create an admin or a manager
 *   - a manager may create a manager, but never an admin
 * `grantableRoles` is the single source of that rule; without this check any manager
 * could POST role: 'admin' and promote themselves past their own tier.
 */
export const create = asyncHandler(async (req, res) => {
  const requested = req.body.role || ROLES.MANAGER;
  if (!grantableRoles(req.user.role).includes(requested)) {
    throw forbidden('Only an admin can grant admin access.');
  }

  const user = await createUser({ ...req.body, role: requested });
  const label = roleLabel(requested).toLowerCase();

  // Best-effort, exactly as for a team member: the account exists either way, and it
  // has no password until they claim the invite themselves.
  const mail = await sendInviteEmail({
    name: user.name,
    email: user.email,
    managerName: req.user.name,
    role: requested,
  });

  return created(res, {
    admin: user,
    email: { delivered: mail.delivered, mode: mail.mode, error: mail.error },
    message: mail.delivered
      ? `${user.name} now has ${label} access and has been emailed a link to set their password.`
      : `${user.name} now has ${label} access.`,
  });
});

/**
 * DELETE /api/admins/:id — close a manager-level account.
 *
 * Two refusals worth stating. An admin cannot delete themselves, because the confirm
 * dialog is not a good place to discover you have signed yourself out permanently. And
 * the last remaining admin cannot be deleted at all: nobody else can create one, so
 * that single delete would leave the company with no route back into account
 * administration.
 *
 * Anything the account had assigned moves to the admin doing the deleting rather than
 * being destroyed — see `deleteManagerAccount`.
 */
export const remove = asyncHandler(async (req, res) => {
  const targetId = Number(req.params.id);
  if (!Number.isInteger(targetId) || targetId <= 0) throw badRequest('Invalid account id.');

  if (targetId === req.user.id) {
    throw forbidden('You cannot delete your own account.');
  }

  const { name, role, transferred } = await (async () => {
    // Counted before the delete: afterwards the answer would always be "enough".
    const admins = await countAdmins();
    const target = (await listManagers()).find((m) => m.id === targetId);
    if (target && isAdmin(target.role) && admins <= 1) {
      throw forbidden('This is the only admin account. Grant admin access to someone else first.');
    }
    return deleteManagerAccount(targetId, req.user.id);
  })();

  return ok(res, {
    id: targetId,
    transferred,
    message: transferred
      ? `${name} was removed. Their ${transferred} assigned task${transferred === 1 ? '' : 's'} moved to you.`
      : `${name} was removed.`,
    role,
  });
});

/**
 * PATCH /api/admins/:id — block or restore a manager-level account's portal access.
 *
 * Blocking is the reversible half of DELETE: the account and its work stay exactly
 * where they are and only the sign-in stops, which is what you want for someone on
 * leave or between roles. It refuses the same two cases for the same reasons — you
 * cannot block yourself, and the last admin who can still sign in cannot be blocked,
 * because a blocked admin cannot lift their own block and nobody else could.
 */
export const setAccess = asyncHandler(async (req, res) => {
  const targetId = Number(req.params.id);
  if (!Number.isInteger(targetId) || targetId <= 0) throw badRequest('Invalid account id.');

  const { isActive } = req.body;

  if (targetId === req.user.id) {
    throw forbidden('You cannot block your own access.');
  }

  if (!isActive) {
    const target = (await listManagers()).find((m) => m.id === targetId);
    // Counted before the change, or the answer would always be "enough".
    if (target && isAdmin(target.role) && target.is_active && await countActiveAdmins() <= 1) {
      throw forbidden('This is the only admin who can sign in. Grant admin access to someone else first.');
    }
  }

  const account = await setManagerAccess(targetId, isActive);
  return ok(res, account, {
    message: isActive
      ? `${account.name} can sign in again.`
      : `${account.name}'s access has been blocked.`,
  });
});
