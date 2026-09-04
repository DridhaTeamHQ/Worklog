import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { listMine, register, remove } from '../controllers/devices.js';

const router = Router();
router.use(requireAuth);

/** The shape Expo issues: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]. */
export const expoPushToken = z.string().trim()
  .regex(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{8,}\]$/, 'Not an Expo push token.');

const registerSchema = z.object({
  expoPushToken,
  platform: z.enum(['ios', 'android', 'web']),
  appVersion: z.string().trim().max(40).optional(),
});

router.get('/', listMine);
router.post('/', validate(registerSchema), register);
router.delete('/:token', remove);

export default router;
