import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireManager } from '../middleware/auth.js';
import { validate, optionalText, isoDate } from '../middleware/validate.js';
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

/*
 * Only the assignee and the project are required.
 *
 * Those two are structural rather than editorial: `assigned_tasks.employee_id` is NOT
 * NULL because a task without an owner is not a task, and the human-facing key
 * (SHMOB-12) is issued from the project, so a task without one cannot be referred to.
 * Everything else — title, description, notes, priority, dates — is something a
 * manager may not know yet at the moment they assign the work, so none of it is
 * demanded up front and all of it can be filled in later from the edit dialog.
 *
 * Title and description fall back to an empty string rather than NULL, because both
 * columns are NOT NULL; the UI shows the task key wherever an untitled task is listed.
 */
const assignSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  projectId: z.coerce.number().int().positive(),
  title: optionalText(160).transform((v) => v ?? ''),
  description: optionalText(4000).transform((v) => v ?? ''),
  notes: optionalText(2000),
  priority: z.enum(PRIORITIES).default('medium'),
  startDate: isoDate.optional().nullable(),
  deadline: isoDate.optional().nullable(),
}).refine(
  (v) => !v.startDate || !v.deadline || v.startDate <= v.deadline,
  { path: ['deadline'], message: 'The deadline cannot be earlier than the start date.' },
);

const statusSchema = z.object({ status: z.enum(STATUSES) });

const patchSchema = z.object({
  title: optionalText(160).transform((v) => v ?? ''),
  description: optionalText(4000).transform((v) => v ?? ''),
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
