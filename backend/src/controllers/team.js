/**
 * Team controller — the manager-facing view of team members.
 *
 * The whole section is manager-level; the route applies `requireManager`, so nothing
 * here re-checks it.
 */
import { ok, created } from '../utils/http.js';
import { asyncHandler, badRequest, notFound } from '../utils/errors.js';
import { resolveRange } from '../utils/dates.js';
import { ROLES } from '../utils/roles.js';
import { departmentScope, isEmptyScope, scopedDepartment, withinScope } from '../utils/scope.js';
import {
  listTeamMembers, getTeamMember, listDepartments, createUser, deleteTeamMember, updateTeamMember,
} from '../models/user.js';
import { listTasks } from '../models/task.js';
import { listReports } from '../models/report.js';
import { sendInviteEmail } from '../services/mail.js';

const parseId = (raw) => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid employee id.');
  return id;
};

/**
 * The roster. A manager sees only their own department; an admin sees everyone.
 * The department is taken from the signed-in user rather than the query string, so
 * `?department=Design` cannot widen what a manager gets back.
 */
export const list = asyncHandler(async (req, res) => {
  const scope = departmentScope(req.user);
  if (isEmptyScope(scope)) return ok(res, [], { total: 0, scope: null });

  const q = req.validatedQuery;
  const department = scopedDepartment(scope, q.department);
  const members = await listTeamMembers({ ...q, department, viewerTimezone: req.timezone });
  return ok(res, members, {
    total: members.length,
    scope: scope.restricted ? scope.department : null,
  });
});

/**
 * Loads a team member and refuses one outside the caller's department.
 *
 * Every per-employee route goes through this rather than `getTeamMember` directly, so
 * there is one place where "is this person mine to look at?" is answered.
 */
async function getMemberInScope(req, employeeId) {
  const employee = await getTeamMember(employeeId);
  const scope = departmentScope(req.user);
  // Deliberately the same error as a missing employee: which ids exist in another
  // department is not something a manager should be able to probe for.
  if (!withinScope(scope, employee.department)) throw notFound('That team member could not be found.');
  return employee;
}

/**
 * Departments offered as filter options. A manager only ever has one, so the list
 * collapses to theirs and the filter disappears from their UI entirely.
 */
export const departments = asyncHandler(async (req, res) => {
  const scope = departmentScope(req.user);
  if (scope.restricted) return ok(res, scope.department ? [scope.department] : []);
  return ok(res, await listDepartments());
});

/**
 * POST /api/team — invite a team member.
 *
 * No password is set here, by anyone. The account is created without one and the new
 * joiner chooses their own by claiming the invite from the sign-in page, so a
 * password is never known to the manager, never emailed, and never in transit. The
 * role is fixed to team_member rather than taken from the request, so this endpoint
 * can never be used to mint a manager or an admin.
 */
export const create = asyncHandler(async (req, res) => {
  const user = await createUser({ ...req.body, role: ROLES.TEAM_MEMBER });

  // The invite email is best-effort. The account already exists, so a mail failure
  // must not fail the request — it is reported instead, and the manager is told to
  // pass the sign-in address on by hand.
  const mail = await sendInviteEmail({
    name: user.name,
    email: user.email,
    managerName: req.user.name,
  });

  return created(res, {
    employee: user,
    email: { delivered: mail.delivered, mode: mail.mode, error: mail.error },
    message: mail.delivered
      ? `${user.name} has been invited and emailed a link to set their password.`
      : `${user.name} has been added to the team.`,
  });
});

/**
 * PATCH /api/team/:id — edit a team member's details.
 *
 * Admin-only (the route applies `requireAdmin`), because this can move someone's email
 * address — the thing they sign in with — and switch their account off. It still goes
 * through `getMemberInScope` so the same "is this person mine to look at?" answer
 * governs editing as governs viewing.
 */
export const update = asyncHandler(async (req, res) => {
  const employeeId = parseId(req.params.id);
  await getMemberInScope(req, employeeId);
  const employee = await updateTeamMember(employeeId, req.body);
  return ok(res, employee, { message: `${employee.name}'s details have been updated.` });
});

/** The employee detail page: profile, counts, their tasks and their recent reports. */
export const getOne = asyncHandler(async (req, res) => {
  const employeeId = parseId(req.params.id);
  const employee = await getMemberInScope(req, employeeId);
  const [tasks, reports] = await Promise.all([
    listTasks({ employeeId, sort: 'created_desc', limit: 100 }),
    listReports({ employeeId, limit: 30 }),
  ]);
  return ok(res, { employee, tasks: tasks.items, reports: reports.items });
});

export const memberReports = asyncHandler(async (req, res) => {
  const employeeId = parseId(req.params.id);
  await getMemberInScope(req, employeeId);
  const q = req.validatedQuery;
  const { from, to } = resolveRange(q.range, q.from, q.to, req.today);
  const { items, total } = await listReports({
    employeeId, from, to, search: q.search, limit: q.limit, offset: q.offset,
  });
  return ok(res, items, { total, from, to, limit: q.limit, offset: q.offset });
});

/**
 * DELETE /api/team/:id — remove a team member and everything of theirs.
 *
 * The model refuses anything that is not a team member, so this cannot be turned on a
 * manager or an admin. A manager deleting their own account is refused here too: the
 * only accounts reachable are team members, and a manager is never one.
 */
export const remove = asyncHandler(async (req, res) => {
  const employeeId = parseId(req.params.id);
  await getMemberInScope(req, employeeId);
  const { name, removed } = await deleteTeamMember(employeeId);

  const also = [
    removed.tasks ? `${removed.tasks} task${removed.tasks === 1 ? '' : 's'}` : null,
    removed.reports ? `${removed.reports} report${removed.reports === 1 ? '' : 's'}` : null,
    removed.tickets ? `${removed.tickets} ticket${removed.tickets === 1 ? '' : 's'}` : null,
  ].filter(Boolean);

  return ok(res, {
    id: employeeId,
    removed,
    message: also.length
      ? `${name} was removed, along with their ${also.join(', ')}.`
      : `${name} was removed.`,
  });
});

export const memberTasks = asyncHandler(async (req, res) => {
  const employeeId = parseId(req.params.id);
  await getMemberInScope(req, employeeId);
  const { items, total } = await listTasks({ employeeId, sort: 'created_desc', limit: 200 });
  return ok(res, items, { total });
});
