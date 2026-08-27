/**
 * Team controller — the manager-facing view of team members.
 *
 * The whole section is manager-level; the route applies `requireManager`, so nothing
 * here re-checks it.
 */
import { ok, created } from '../utils/http.js';
import { asyncHandler, badRequest } from '../utils/errors.js';
import { resolveRange } from '../utils/dates.js';
import { ROLES } from '../utils/roles.js';
import { listTeamMembers, getTeamMember, listDepartments, createUser } from '../models/user.js';
import { listTasks } from '../models/task.js';
import { listReports } from '../models/report.js';
import { sendWelcomeEmail } from '../services/mail.js';

const parseId = (raw) => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid employee id.');
  return id;
};

export const list = asyncHandler(async (req, res) => {
  const members = await listTeamMembers(req.validatedQuery);
  return ok(res, members, { total: members.length });
});

export const departments = asyncHandler(async (_req, res) => ok(res, await listDepartments()));

/**
 * POST /api/team — add a team member.
 *
 * The manager sets an initial password and passes it on; the new joiner can change it
 * from their profile, or reset it themselves via Forgot password. The role is fixed to
 * team_member here rather than taken from the request, so this endpoint can never be
 * used to mint a manager or an admin.
 */
export const create = asyncHandler(async (req, res) => {
  const user = await createUser({ ...req.body, role: ROLES.TEAM_MEMBER });

  // The welcome email is best-effort. The account already exists, so a mail failure
  // must not fail the request — it is reported instead, and the manager still has the
  // password on screen to pass on by hand.
  const mail = await sendWelcomeEmail({
    name: user.name,
    email: user.email,
    password: req.body.password,
    managerName: req.user.name,
  });

  return created(res, {
    employee: user,
    email: { delivered: mail.delivered, mode: mail.mode, error: mail.error },
    message: mail.delivered
      ? `${user.name} has been added and emailed their sign-in details.`
      : `${user.name} has been added to the team.`,
  });
});

/** The employee detail page: profile, counts, their tasks and their recent reports. */
export const getOne = asyncHandler(async (req, res) => {
  const employeeId = parseId(req.params.id);
  const employee = await getTeamMember(employeeId);
  const [tasks, reports] = await Promise.all([
    listTasks({ employeeId, sort: 'created_desc', limit: 100 }),
    listReports({ employeeId, limit: 30 }),
  ]);
  return ok(res, { employee, tasks: tasks.items, reports: reports.items });
});

export const memberReports = asyncHandler(async (req, res) => {
  const employeeId = parseId(req.params.id);
  const q = req.validatedQuery;
  const { from, to } = resolveRange(q.range, q.from, q.to);
  const { items, total } = await listReports({
    employeeId, from, to, search: q.search, limit: q.limit, offset: q.offset,
  });
  return ok(res, items, { total, from, to, limit: q.limit, offset: q.offset });
});

export const memberTasks = asyncHandler(async (req, res) => {
  const employeeId = parseId(req.params.id);
  const { items, total } = await listTasks({ employeeId, sort: 'created_desc', limit: 200 });
  return ok(res, items, { total });
});
