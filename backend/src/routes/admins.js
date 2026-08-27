import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validate, safeText, optionalText } from '../middleware/validate.js';
import { ROLES } from '../utils/roles.js';
import { list, create } from '../controllers/admins.js';

const router = Router();

// Admin-only throughout. Who holds elevated access, and who is granted it, is
// administration rather than day-to-day management — a manager sees neither the list
// nor the endpoints that change it.
router.use(requireAuth, requireAdmin);

const listQuery = z.object({
  search: z.string().trim().max(200).optional(),
});

// Same invite flow as a team member: no password crosses this boundary either.
const createSchema = z.object({
  name: safeText(120, 'Name'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(190),
  department: optionalText(120),
  jobTitle: optionalText(120),
  phone: optionalText(40),
  // Which tier to grant. Defaults to manager so existing callers are unaffected.
  role: z.enum([ROLES.ADMIN, ROLES.MANAGER]).optional(),
});

router.get('/', validate(listQuery, 'query'), list);
router.post('/', validate(createSchema), create);

export default router;
