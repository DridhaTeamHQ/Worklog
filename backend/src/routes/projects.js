import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireManager } from '../middleware/auth.js';
import { validate, safeText, optionalText } from '../middleware/validate.js';
import { list, getOne, create, update } from '../controllers/projects.js';

const router = Router();
router.use(requireAuth);

const listQuery = z.object({
  includeArchived: z.enum(['true', 'false']).optional(),
});

const createSchema = z.object({
  name: safeText(120, 'Project name'),
  key: safeText(10, 'Project key'),
  description: optionalText(1000),
  leadId: z.coerce.number().int().positive().optional().nullable(),
});

const patchSchema = z.object({
  name: safeText(120, 'Project name').optional(),
  // Editable so typos can be fixed; existing task keys re-render under the new key.
  key: safeText(10, 'Project key').optional(),
  description: optionalText(1000),
  leadId: z.coerce.number().int().positive().optional().nullable(),
  isArchived: z.boolean().optional(),
});

router.get('/', validate(listQuery, 'query'), list);
router.get('/:id', getOne);

/** Creating and changing projects is a manager responsibility. */
router.post('/', requireManager, validate(createSchema), create);
router.patch('/:id', requireManager, validate(patchSchema), update);

export default router;
