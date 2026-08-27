/**
 * The role hierarchy, in one place.
 *
 * There are three roles and exactly one rule worth remembering: `admin` is a strict
 * superset of `manager`. An admin sees every page a manager sees and may act on any
 * manager's work, and on top of that is the only role that can grant admin access.
 *
 * Everywhere else in the app, the question being asked is almost never "is this user
 * literally a manager?" but "does this user have manager-level access?" — so that
 * question gets a named helper rather than a `=== 'manager'` comparison that silently
 * excludes admins.
 */

export const ROLES = Object.freeze({
  ADMIN: 'admin',
  MANAGER: 'manager',
  TEAM_MEMBER: 'team_member',
});

/** Every role, for validation and CHECK-constraint upgrades. */
export const ALL_ROLES = Object.freeze([ROLES.ADMIN, ROLES.MANAGER, ROLES.TEAM_MEMBER]);

/** Roles that reach the manager portal and its APIs. */
export const MANAGER_ROLES = Object.freeze([ROLES.ADMIN, ROLES.MANAGER]);

/** True for admins and managers — the "can see the whole team's work" tier. */
export const isManagerLevel = (role) => MANAGER_ROLES.includes(role);

/** True only for admins — the "can administer accounts" tier. */
export const isAdmin = (role) => role === ROLES.ADMIN;

/** True only for team members, who own the daily-report and ticket-raising flows. */
export const isTeamMember = (role) => role === ROLES.TEAM_MEMBER;

/**
 * Which roles a given actor may create.
 *
 * Only an admin can mint another admin; managers keep the ability to add managers and
 * team members that they have always had.
 */
export function grantableRoles(actorRole) {
  if (isAdmin(actorRole)) return [ROLES.ADMIN, ROLES.MANAGER, ROLES.TEAM_MEMBER];
  if (actorRole === ROLES.MANAGER) return [ROLES.MANAGER, ROLES.TEAM_MEMBER];
  return [];
}

/** Human-readable label for a role, used in the UI and in outbound email. */
export function roleLabel(role) {
  if (role === ROLES.ADMIN) return 'Admin';
  if (role === ROLES.MANAGER) return 'Manager';
  return 'Team Member';
}

export default { ROLES, ALL_ROLES, MANAGER_ROLES, isManagerLevel, isAdmin, isTeamMember, grantableRoles, roleLabel };
