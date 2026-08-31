import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireManager, requireAdmin } from '../middleware/auth.js';
import { validate, safeText, optionalText, isoDate } from '../middleware/validate.js';
import {
  list, departments, create, getOne, update, memberReports, memberTasks, remove,
} from '../controllers/team.js';

const router = Router();

// The whole section is manager-level; a team member hitting any of these gets a 403.
router.use(requireAuth, requireManager);

const listQuery = z.object({
  search: z.string().trim().max(200).optional(),
  department: z.string().trim().min(1).optional(),
});

/*
 * No password field: the manager identifies the person, and the person chooses their
 * own password when they claim the invite. Anything sent as `password` is dropped by
 * the validator rather than honoured, so this endpoint cannot be used to set one.
 *
 * Department and job title are required here, unlike on the elevated tiers — an
 * employee's roster row is filtered and grouped by both, so a blank one leaves a hole
 * in every team view.
 */
const createSchema = z.object({
  name: safeText(120, 'Name'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(190),
  department: safeText(120, 'Department'),
  jobTitle: safeText(120, 'Job title'),
  phone: optionalText(40),
});

/*
 * Every field optional: the edit modal sends only what the admin actually changed, so
 * a save can never blank a field that was left alone. Department and job title stay
 * non-empty when present, for the same roster reasons they are required on create.
 */
const updateSchema = z.object({
  name: safeText(120, 'Name').optional(),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(190).optional(),
  department: safeText(120, 'Department').optional(),
  jobTitle: safeText(120, 'Job title').optional(),
  phone: optionalText(40),
  isActive: z.boolean().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update.' });

const reportQuery = z.object({
  range: z.enum(['today', 'week', 'month', 'custom', 'all']).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  search: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(60),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get('/', validate(listQuery, 'query'), list);
// Static path before '/:id', or 'departments' would be read as an id.
router.get('/departments', departments);
// Admin-only. A manager runs their department but does not decide who is in it.
router.post('/', requireAdmin, validate(createSchema), create);
router.get('/:id', getOne);
// Admin-only, like create and delete: a manager runs their department but does not
// edit the accounts in it.
router.patch('/:id', requireAdmin, validate(updateSchema), update);
router.get('/:id/reports', validate(reportQuery, 'query'), memberReports);
router.get('/:id/tasks', memberTasks);
router.delete('/:id', requireAdmin, remove);

export default router;
