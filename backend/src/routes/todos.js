import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate, safeText, isoDate } from '../middleware/validate.js';
import { list, create, update, remove } from '../controllers/todos.js';

const router = Router();

/*
 * Authenticated, but with no role gate on purpose. A personal to-do list belongs to
 * whoever wrote it — a team member, a manager and an admin each have their own, and
 * none of them can see another's. The controller scopes every query to req.user.id,
 * so there is no id in these routes that could point at somebody else's list.
 */
router.use(requireAuth);

const listQuery = z.object({
  date: isoDate.optional(),
});

/*
 * `projectId` and `taskId` are optional context. Neither is trusted: the model checks
 * that the task is one of the caller's own and takes the project from the task, so a
 * mismatched pair cannot be stored and a stranger's task id cannot be attached.
 */
const createSchema = z.object({
  title: safeText(200, 'To-do'),
  date: isoDate.optional(),
  projectId: z.coerce.number().int().positive().nullable().optional(),
  taskId: z.coerce.number().int().positive().nullable().optional(),
});

const patchSchema = z.object({
  title: safeText(200, 'To-do').optional(),
  date: isoDate.optional(),
  isDone: z.boolean().optional(),
  projectId: z.coerce.number().int().positive().nullable().optional(),
  taskId: z.coerce.number().int().positive().nullable().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update.' });

router.get('/', validate(listQuery, 'query'), list);
router.post('/', validate(createSchema), create);
router.patch('/:id', validate(patchSchema), update);
router.delete('/:id', remove);

export default router;
