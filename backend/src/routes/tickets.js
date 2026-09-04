import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate, safeText, optionalText } from '../middleware/validate.js';
import { SEVERITIES, TICKET_STATUSES } from '../utils/constants.js';
import { list, getOne, create, setStatus, update, remove } from '../controllers/tickets.js';
import * as activity from '../controllers/activity.js';

const router = Router();
router.use(requireAuth);

const listQuery = z.object({
  reporterId: z.coerce.number().int().positive().optional(),
  projectId: z.coerce.number().int().positive().optional(),
  taskId: z.coerce.number().int().positive().optional(),
  status: z.enum([...TICKET_STATUSES, 'unresolved']).optional(),
  severity: z.enum(SEVERITIES).optional(),
  search: z.string().trim().max(200).optional(),
  sort: z.enum(['created_desc', 'created_asc', 'severity_desc', 'status_asc']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

const createSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  taskId: z.coerce.number().int().positive(),
  title: safeText(160, 'Ticket title'),
  description: safeText(6000, 'Bug description'),
  severity: z.enum(SEVERITIES).default('medium'),
});

const statusSchema = z.object({
  status: z.enum(TICKET_STATUSES),
  resolutionNote: optionalText(2000),
});

const patchSchema = z.object({
  title: safeText(160, 'Ticket title').optional(),
  description: safeText(6000, 'Bug description').optional(),
  severity: z.enum(SEVERITIES).optional(),
});

const commentSchema = z.object({
  body: safeText(4000, 'Comment'),
  mentions: z.array(z.coerce.number().int().positive()).max(10).default([]),
});

router.get('/', validate(listQuery, 'query'), list);
router.get('/:id', getOne);
router.post('/', validate(createSchema), create);
router.patch('/:id/status', validate(statusSchema), setStatus);
router.patch('/:id', validate(patchSchema), update);
router.delete('/:id', remove);

// The activity thread: system events plus comments.
router.get('/:id/activity', activity.listThread('ticket'));
router.post('/:id/comments', validate(commentSchema), activity.comment('ticket'));
router.patch('/:id/comments/:commentId', validate(commentSchema.pick({ body: true })), activity.edit('ticket'));
router.delete('/:id/comments/:commentId', activity.remove('ticket'));

export default router;
