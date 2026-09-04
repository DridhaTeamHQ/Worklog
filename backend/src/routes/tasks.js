import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireManager } from '../middleware/auth.js';
import { validate, safeText, optionalText, isoDate } from '../middleware/validate.js';
import { PRIORITIES, STATUSES, FILTER_STATUSES } from '../utils/constants.js';
import { list, getOne, assign, setStatus, update, remove } from '../controllers/tasks.js';
import * as activity from '../controllers/activity.js';
import * as checklist from '../controllers/checklist.js';
import { setForTask as setLabels } from '../controllers/labels.js';

const router = Router();
router.use(requireAuth);

const listQuery = z.object({
  employeeId: z.coerce.number().int().positive().optional(),
  projectId: z.coerce.number().int().positive().optional(),
  labelId: z.coerce.number().int().positive().optional(),
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
  labelIds: z.array(z.coerce.number().int().positive()).max(20).optional(),
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

const commentSchema = z.object({
  body: safeText(4000, 'Comment'),
  mentions: z.array(z.coerce.number().int().positive()).max(10).default([]),
});

const checklistItemSchema = z.object({
  title: safeText(200, 'Checklist item'),
});

const checklistPatchSchema = z.object({
  title: safeText(200, 'Checklist item').optional(),
  isDone: z.boolean().optional(),
  position: z.coerce.number().int().min(0).optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'Nothing to change.' });

const labelsSchema = z.object({
  labelIds: z.array(z.coerce.number().int().positive()).max(20),
});

router.get('/', validate(listQuery, 'query'), list);
router.get('/:id', getOne);
router.post('/', requireManager, validate(assignSchema), assign);
router.patch('/:id/status', validate(statusSchema), setStatus);
router.patch('/:id', requireManager, validate(patchSchema), update);
router.delete('/:id', requireManager, remove);

// The activity thread: system events plus comments.
router.get('/:id/activity', activity.listThread('task'));
router.post('/:id/comments', validate(commentSchema), activity.comment('task'));
router.patch('/:id/comments/:commentId', validate(commentSchema.pick({ body: true })), activity.edit('task'));
router.delete('/:id/comments/:commentId', activity.remove('task'));

// Checklist.
router.get('/:id/checklist', checklist.list);
router.post('/:id/checklist', validate(checklistItemSchema), checklist.add);
router.patch('/:id/checklist/:itemId', validate(checklistPatchSchema), checklist.update);
router.delete('/:id/checklist/:itemId', checklist.remove);

// Labels on this task (the label set itself lives under /api/labels).
router.put('/:id/labels', requireManager, validate(labelsSchema), setLabels);

export default router;
