import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate, safeText, optionalText } from '../middleware/validate.js';
import { ok } from '../utils/http.js';
import { asyncHandler } from '../utils/errors.js';
import { findById, updateProfile } from '../services/users.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => ok(res, await findById(req.user.id))));

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

router.patch('/', validate(patchSchema), asyncHandler(async (req, res) => {
  const user = await updateProfile(req.user.id, req.body);
  return ok(res, user);
}));

export default router;
