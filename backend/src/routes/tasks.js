import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireManager } from '../middleware/auth.js';
import { validate, safeText, optionalText, isoDate } from '../middleware/validate.js';
import { ok, created } from '../utils/http.js';
import { asyncHandler, forbidden, notFound, badRequest } from '../utils/errors.js';
import {
  listTasks, getTaskById, assignTask, updateTaskStatus, updateTask, deleteTask,
  PRIORITIES, STATUSES, FILTER_STATUSES,
} from '../services/tasks.js';

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

/**
 * GET /api/tasks
 * Managers see every task and may filter by employee; team members are pinned to their
 * own id regardless of what they send, so the `employeeId` parameter cannot be abused.
 */
router.get('/', validate(listQuery, 'query'), asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const filters = req.user.role === 'manager'
    ? { ...q }
    : { ...q, employeeId: req.user.id, department: undefined };

  const { items, total } = await listTasks(filters);
  return ok(res, items, { total, limit: q.limit, offset: q.offset });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid task id.');

  const task = await getTaskById(id);
  if (!task) throw notFound('That task no longer exists.');
  if (req.user.role === 'team_member' && task.employee_id !== req.user.id) {
    throw forbidden('You can only view tasks assigned to you.');
  }
  return ok(res, task);
}));

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

/** POST /api/tasks — manager only. Creates the task and notifies the employee. */
router.post('/', requireManager, validate(assignSchema), asyncHandler(async (req, res) => {
  const task = await assignTask({ ...req.body, managerId: req.user.id });
  return created(res, {
    task,
    message: `Task successfully assigned to ${task.employee_name}.`,
  });
}));

const statusSchema = z.object({ status: z.enum(STATUSES) });

/** PATCH /api/tasks/:id/status — the employee's own status control. */
router.patch('/:id/status', validate(statusSchema), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid task id.');
  const task = await updateTaskStatus({ taskId: id, status: req.body.status, actor: req.user });
  return ok(res, task);
}));

const patchSchema = z.object({
  title: safeText(160, 'Task title').optional(),
  description: safeText(4000, 'Task description').optional(),
  notes: optionalText(2000),
  priority: z.enum(PRIORITIES).optional(),
  startDate: isoDate.optional().nullable(),
  deadline: isoDate.optional().nullable(),
});

router.patch('/:id', requireManager, validate(patchSchema), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid task id.');
  const task = await updateTask({ taskId: id, managerId: req.user.id, patch: req.body });
  return ok(res, task);
}));

router.delete('/:id', requireManager, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid task id.');
  await deleteTask({ taskId: id, managerId: req.user.id });
  return ok(res, { message: 'Task deleted.' });
}));

export default router;
