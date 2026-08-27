import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireManager } from '../middleware/auth.js';
import { validate, safeText, optionalText } from '../middleware/validate.js';
import { ROLES } from '../utils/roles.js';
import { list, create } from '../controllers/admins.js';

const router = Router();

// Manager-level throughout: only someone who already reaches this portal can see or
// grant access to it. Which tier they may grant is decided in the controller.
router.use(requireAuth, requireManager);

const listQuery = z.object({
  search: z.string().trim().max(200).optional(),
});

const createSchema = z.object({
  name: safeText(120, 'Name'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(190),
  password: z.string().min(8, 'Use at least 8 characters.').max(200),
  department: optionalText(120),
  jobTitle: optionalText(120),
  phone: optionalText(40),
  // Which tier to grant. Defaults to manager so existing callers are unaffected.
  role: z.enum([ROLES.ADMIN, ROLES.MANAGER]).optional(),
});

router.get('/', validate(listQuery, 'query'), list);
router.post('/', validate(createSchema), create);

export default router;
