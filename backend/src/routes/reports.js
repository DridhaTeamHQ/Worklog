import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate, safeText, isoDate } from '../middleware/validate.js';
import { list, getToday, save, remove } from '../controllers/reports.js';

const router = Router();
router.use(requireAuth);

const listQuery = z.object({
  employeeId: z.coerce.number().int().positive().optional(),
  range: z.enum(['today', 'week', 'month', 'custom', 'all']).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  department: z.string().trim().min(1).optional(),
  search: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(60),
  offset: z.coerce.number().int().min(0).default(0),
});

const saveSchema = z.object({
  taskDescription: safeText(8000, 'Your task summary'),
  reportDate: isoDate.optional(),
});

router.get('/', validate(listQuery, 'query'), list);
router.get('/today', getToday);
router.post('/', validate(saveSchema), save);
router.delete('/:id', remove);

export default router;
