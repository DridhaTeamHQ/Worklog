import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireManager } from '../middleware/auth.js';
import { validate, safeText, optionalText, isoDate } from '../middleware/validate.js';
import {
  list, departments, create, getOne, memberReports, memberTasks,
} from '../controllers/team.js';

const router = Router();

// The whole section is manager-level; a team member hitting any of these gets a 403.
router.use(requireAuth, requireManager);

const listQuery = z.object({
  search: z.string().trim().max(200).optional(),
  department: z.string().trim().min(1).optional(),
});

const createSchema = z.object({
  name: safeText(120, 'Name'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(190),
  password: z.string().min(8, 'Use at least 8 characters.').max(200),
  department: optionalText(120),
  jobTitle: optionalText(120),
  phone: optionalText(40),
});

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
router.post('/', validate(createSchema), create);
router.get('/:id', getOne);
router.get('/:id/reports', validate(reportQuery, 'query'), memberReports);
router.get('/:id/tasks', memberTasks);

export default router;
