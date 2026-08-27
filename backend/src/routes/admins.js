import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireManager } from '../middleware/auth.js';
import { validate, safeText, optionalText } from '../middleware/validate.js';
import { ok, created } from '../utils/http.js';
import { asyncHandler } from '../utils/errors.js';
import { listManagers, createUser } from '../services/users.js';
import { sendWelcomeEmail } from '../services/mail.js';

const router = Router();

// Manager-only throughout: only someone who already has manager access can grant it.
router.use(requireAuth, requireManager);

const listQuery = z.object({
  search: z.string().trim().max(200).optional(),
});

router.get('/', validate(listQuery, 'query'), asyncHandler(async (req, res) => {
  const managers = await listManagers(req.validatedQuery);
  return ok(res, managers, { total: managers.length });
}));

const createSchema = z.object({
  name: safeText(120, 'Name'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(190),
  password: z.string().min(8, 'Use at least 8 characters.').max(200),
  department: optionalText(120),
  jobTitle: optionalText(120),
  phone: optionalText(40),
});

/**
 * POST /api/admins — grant manager access to a new person.
 *
 * This is deliberately a separate endpoint from POST /api/team, which hard-codes
 * `team_member`. Keeping them apart means the everyday "add a colleague" path cannot
 * be turned into an escalation by adding a `role` field to the request, and every
 * grant of manager access goes through this one route.
 *
 * Note that manager access is a single tier: anyone holding it can grant it to others.
 */
router.post('/', validate(createSchema), asyncHandler(async (req, res) => {
  const user = await createUser({ ...req.body, role: 'manager' });

  // Best-effort, exactly as for a team member: the account exists either way.
  const mail = await sendWelcomeEmail({
    name: user.name,
    email: user.email,
    password: req.body.password,
    managerName: req.user.name,
    role: 'manager',
  });

  return created(res, {
    admin: user,
    email: { delivered: mail.delivered, mode: mail.mode, error: mail.error },
    message: mail.delivered
      ? `${user.name} now has manager access and has been emailed their sign-in details.`
      : `${user.name} now has manager access.`,
  });
}));

export default router;
