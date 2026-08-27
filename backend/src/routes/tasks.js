import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireManager } from '../middleware/auth.js';
import { validate, safeText, optionalText, isoDate } from '../middleware/validate.js';
import { PRIORITIES, STATUSES, FILTER_STATUSES } from '../utils/constants.js';
import { list, getOne, assign, setStatus, update, remove } from '../controllers/tasks.js';

const router = Router();
router.use(requireAuth);

const listQuery = z.object({
  employeeId: z.coerce.number().int().positive().optional(),
  projectId: z.coerce.number().int().positive().optional(),
  status: z.enum(FILTER_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  department: z.string().trim().min(1).optional(),
  search: z.string().trim().max(200).optional(),
  assignedFrom: isoDate.optional(),
  assignedTo: isoDate.optional(),
  deadlineFrom: isoDate.optional(),
  deadlineTo: isoDate.optional(),
  sort: z.enum(['created_desc', 'created_asc', 'deadline_asc', 'deadline_desc', 'priority_desc']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

const assignSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  projectId: z.coerce.number().int().positive(),
  title: safeText(160, 'Task title'),
  description: safeText(4000, 'Task description'),
  notes: optionalText(2000),
  priority: z.enum(PRIORITIES),
  startDate: isoDate.optional().nullable(),
  deadline: isoDate.optional().nullable(),
}).refine(
  (v) => !v.startDate || !v.deadline || v.startDate <= v.deadline,
  { path: ['deadline'], message: 'The deadline cannot be earlier than the start date.' },
);

const statusSchema = z.object({ status: z.enum(STATUSES) });

const patchSchema = z.object({
  title: safeText(160, 'Task title').optional(),
  description: safeText(4000, 'Task description').optional(),
  notes: optionalText(2000),
  priority: z.enum(PRIORITIES).optional(),
  startDate: isoDate.optional().nullable(),
  deadline: isoDate.optional().nullable(),
});

router.get('/', validate(listQuery, 'query'), list);
router.get('/:id', getOne);
router.post('/', requireManager, validate(assignSchema), assign);
router.patch('/:id/status', validate(statusSchema), setStatus);
router.patch('/:id', requireManager, validate(patchSchema), update);
router.delete('/:id', requireManager, remove);

export default router;
