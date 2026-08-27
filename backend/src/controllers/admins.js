/**
 * Admin controller — granting and listing manager-level access.
 *
 * The privilege boundary lives here: `grantableRoles` decides what the caller may
 * hand out, so the requested role is checked rather than trusted.
 */
import { ok, created } from '../utils/http.js';
import { asyncHandler, forbidden } from '../utils/errors.js';
import { ROLES, grantableRoles, roleLabel } from '../utils/roles.js';
import { listManagers, createUser } from '../models/user.js';
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
