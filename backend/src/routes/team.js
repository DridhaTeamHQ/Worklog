import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireManager } from '../middleware/auth.js';
import { validate, safeText, optionalText, isoDate } from '../middleware/validate.js';
import { ok, created } from '../utils/http.js';
import { asyncHandler, badRequest } from '../utils/errors.js';
import { resolveRange } from '../utils/dates.js';
import { listTeamMembers, getTeamMember, listDepartments, createUser } from '../services/users.js';
import { sendWelcomeEmail } from '../services/mail.js';
import { listTasks } from '../services/tasks.js';
import { listReports } from '../services/reports.js';

const router = Router();

// The whole section is manager-only; a team member hitting any of these gets a 403.
router.use(requireAuth, requireManager);

const listQuery = z.object({
  search: z.string().trim().max(200).optional(),
  department: z.string().trim().min(1).optional(),
});

router.get('/', validate(listQuery, 'query'), asyncHandler(async (req, res) => {
  const members = await listTeamMembers(req.validatedQuery);
  return ok(res, members, { total: members.length });
}));

router.get('/departments', asyncHandler(async (_req, res) => ok(res, await listDepartments())));

const createSchema = z.object({
  name: safeText(120, 'Name'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(190),
  password: z.string().min(8, 'Use at least 8 characters.').max(200),
  department: optionalText(120),
  jobTitle: optionalText(120),
  phone: optionalText(40),
});

/**
 * POST /api/team — add a team member.
 *
 * The manager sets an initial password and passes it on; the new joiner can change it
 * from their profile, or reset it themselves via Forgot password. The role is fixed to
 * team_member here rather than taken from the request, so this endpoint can never be
 * used to mint another manager.
 */
router.post('/', validate(createSchema), asyncHandler(async (req, res) => {
  const user = await createUser({ ...req.body, role: 'team_member' });

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
}));

const parseId = (raw) => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid employee id.');
  return id;
};

/** The employee detail page: profile, counts, their tasks and their recent reports. */
router.get('/:id', asyncHandler(async (req, res) => {
  const employeeId = parseId(req.params.id);
  const employee = await getTeamMember(employeeId);
  const [tasks, reports] = await Promise.all([
    listTasks({ employeeId, sort: 'created_desc', limit: 100 }),
    listReports({ employeeId, limit: 30 }),
  ]);
  return ok(res, { employee, tasks: tasks.items, reports: reports.items });
}));

const reportQuery = z.object({
  range: z.enum(['today', 'week', 'month', 'custom', 'all']).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  search: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(60),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get('/:id/reports', validate(reportQuery, 'query'), asyncHandler(async (req, res) => {
  const employeeId = parseId(req.params.id);
  const q = req.validatedQuery;
  const { from, to } = resolveRange(q.range, q.from, q.to);
  const { items, total } = await listReports({
    employeeId, from, to, search: q.search, limit: q.limit, offset: q.offset,
  });
  return ok(res, items, { total, from, to, limit: q.limit, offset: q.offset });
}));

router.get('/:id/tasks', asyncHandler(async (req, res) => {
  const employeeId = parseId(req.params.id);
  const { items, total } = await listTasks({ employeeId, sort: 'created_desc', limit: 200 });
  return ok(res, items, { total });
}));

export default router;
