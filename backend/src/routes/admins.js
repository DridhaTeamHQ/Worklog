import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireManager } from '../middleware/auth.js';
import { validate, safeText, optionalText } from '../middleware/validate.js';
import { ROLES } from '../utils/roles.js';
import { list, create, remove, setAccess, invite } from '../controllers/admins.js';

const router = Router();

// Manager-level throughout. Managers administer the portal exactly as admins do; the
// one thing they cannot do — grant admin access — is refused in the controller.
router.use(requireAuth, requireManager);

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

const accessSchema = z.object({ isActive: z.boolean() });

router.get('/', validate(listQuery, 'query'), list);
router.post('/', validate(createSchema), create);
// Blocking is separate from DELETE on purpose: it is reversible and touches nothing
// but the sign-in, where delete closes the account and moves its work elsewhere.
router.patch('/:id', validate(accessSchema), setAccess);
router.delete('/:id', remove);
// Sends the invitation email. Separate from create so adding details never emails
// anyone by itself.
router.post('/:id/invite', invite);

export default router;
