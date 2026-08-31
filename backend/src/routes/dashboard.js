import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireManager } from '../middleware/auth.js';
import { validate, isoDate } from '../middleware/validate.js';
import { overview, analytics } from '../controllers/dashboard.js';

const router = Router();
router.use(requireAuth);

const analyticsQuery = z.object({
  employeeId: z.coerce.number().int().positive().optional(),
  department: z.string().trim().min(1).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  days: z.coerce.number().int().min(7).max(120).default(14),
  weeks: z.coerce.number().int().min(2).max(26).default(8),
});

const overviewQuery = z.object({
  range: z.enum(['today', 'week', 'month', 'all']).optional(),
});

router.get('/', validate(overviewQuery, 'query'), overview);
router.get('/analytics', requireManager, validate(analyticsQuery, 'query'), analytics);

export default router;
