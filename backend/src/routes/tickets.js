import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate, safeText, optionalText } from '../middleware/validate.js';
import { SEVERITIES, TICKET_STATUSES } from '../utils/constants.js';
import { list, getOne, create, setStatus, update, assign, remove } from '../controllers/tickets.js';

const router = Router();
router.use(requireAuth);

const listQuery = z.object({
  reporterId: z.coerce.number().int().positive().optional(),
  assigneeId: z.union([z.coerce.number().int().positive(), z.literal('unassigned')]).optional(),
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

const assignSchema = z.object({
  assigneeId: z.coerce.number().int().positive().nullable(),
});

const patchSchema = z.object({
  title: safeText(160, 'Ticket title').optional(),
  description: safeText(6000, 'Bug description').optional(),
  severity: z.enum(SEVERITIES).optional(),
  assigneeId: z.coerce.number().int().positive().nullable().optional(),
});

router.get('/', validate(listQuery, 'query'), list);
router.get('/:id', getOne);
router.post('/', validate(createSchema), create);
router.patch('/:id/status', validate(statusSchema), setStatus);
router.patch('/:id/assign', validate(assignSchema), assign);
router.patch('/:id', validate(patchSchema), update);
router.delete('/:id', remove);

export default router;
