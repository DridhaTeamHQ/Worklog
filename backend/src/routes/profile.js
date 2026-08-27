import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate, safeText, optionalText } from '../middleware/validate.js';
import { getProfile, patchProfile } from '../controllers/profile.js';

const router = Router();
router.use(requireAuth);

/**
 * A user may edit their own display details only. Role, email and active flag are
 * deliberately absent from this schema — they are not self-service fields.
 */
const patchSchema = z.object({
  name: safeText(120, 'Name').optional(),
  department: optionalText(120),
  jobTitle: optionalText(120),
  phone: optionalText(40),
  profileImage: z.string().trim().max(500).optional().nullable(),
});

router.get('/', getProfile);
router.patch('/', validate(patchSchema), patchProfile);

export default router;
