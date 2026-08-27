/**
 * What a signed-in user is allowed to see, expressed once.
 *
 * An admin sees the whole company. A manager sees only their own department — every
 * list, count and chart in the manager portal is confined to it, not just the roster,
 * so there is no screen where work from another department leaks in.
 *
 * The confinement is applied on the server for every route. The React side hides the
 * controls that would produce out-of-scope requests, but that is convenience only:
 * a hand-written request with `?department=Design` is overridden here, not honoured.
 */
import { isAdmin, isManagerLevel } from './roles.js';

/**
 * The department restriction for a user.
 *
 * `restricted: false` means no confinement — admins, and team members, whose access is
 * narrowed by employee id elsewhere instead.
 *
 * `restricted: true` carries the department to confine to, which is `null` when the
 * manager has no department recorded. That case is deliberately not treated as
 * "everything": an account with nothing set would otherwise quietly become an admin.
 * Callers use `isEmptyScope` to answer it with an empty result.
 */
export function departmentScope(user) {
  if (!isManagerLevel(user?.role) || isAdmin(user?.role)) return { restricted: false };
  return { restricted: true, department: user.department || null };
}

/** True when the scope can never match anything — a manager with no department set. */
export const isEmptyScope = (scope) => scope.restricted && !scope.department;

/**
 * The department a query should actually run with.
 *
 * A manager's own department always wins over whatever arrived in the query string,
 * so narrowing the filter in the UI is possible but widening it is not.
 */
export const scopedDepartment = (scope, requested) =>
  (scope.restricted ? scope.department : requested);

/** True when `department` is inside the scope — the check behind every per-record lookup. */
export const withinScope = (scope, department) =>
  (!scope.restricted || (!!department && department === scope.department));

export default { departmentScope, isEmptyScope, scopedDepartment, withinScope };
