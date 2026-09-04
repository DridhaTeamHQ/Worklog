import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate, safeText, optionalText, isoDate } from '../middleware/validate.js';
import { list, getToday, save, remove, suggestions } from '../controllers/reports.js';

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

/**
 * A report is free text, a list of lines, or both. Each line may point at one of the
 * writer's own tasks (checked in the model) and say how long it took.
 */
const itemSchema = z.object({
  taskId: z.coerce.number().int().positive().optional().nullable(),
  text: safeText(1000, 'Report line'),
  minutes: z.coerce.number().int().min(0).max(1440).optional().nullable(),
});

const saveSchema = z.object({
  taskDescription: optionalText(8000).transform((v) => v ?? ''),
  items: z.array(itemSchema).max(50).default([]),
  reportDate: isoDate.optional(),
}).refine(
  (v) => v.taskDescription.length > 0 || v.items.length > 0,
  { path: ['taskDescription'], message: 'Write what you did today, or add at least one line.' },
);

router.get('/', validate(listQuery, 'query'), list);
router.get('/today', getToday);
router.get('/suggestions', suggestions);
router.post('/', validate(saveSchema), save);
router.delete('/:id', remove);

export default router;
