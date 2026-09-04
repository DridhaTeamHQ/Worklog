import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate, safeText, optionalText } from '../middleware/validate.js';
import { isValidTimezone } from '../utils/dates.js';
import { getProfile, patchProfile } from '../controllers/profile.js';

const router = Router();
router.use(requireAuth);

/**
 * A user may edit their own display details only. Role, email and active flag are
 * deliberately absent from this schema — they are not self-service fields.
 *
 * `timezone` is an IANA zone name ("Asia/Kolkata"). It is what "today" means for this
 * person: the daily report they may write, the day their to-dos land on, and whether
 * the roster shows their report as submitted today. Clients send the device's zone
 * after sign-in; it can be cleared back to the deployment default with null.
 */
const patchSchema = z.object({
  name: safeText(120, 'Name').optional(),
  department: optionalText(120),
  jobTitle: optionalText(120),
  phone: optionalText(40),
  profileImage: z.string().trim().max(500).optional().nullable(),
  timezone: z.string().trim().max(64)
    .refine(isValidTimezone, 'Use an IANA timezone name, such as Asia/Kolkata.')
    .optional().nullable(),
});

router.get('/', getProfile);
router.patch('/', validate(patchSchema), patchProfile);

export default router;
