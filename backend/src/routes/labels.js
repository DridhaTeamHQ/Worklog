import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireManager, requireAdmin } from '../middleware/auth.js';
import { validate, safeText } from '../middleware/validate.js';
import { list, create, update, remove } from '../controllers/labels.js';

const router = Router();
router.use(requireAuth);

export const labelSchema = z.object({
  name: safeText(40, 'Label name'),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #5b7fe8.').optional(),
});

router.get('/', list);
router.post('/', requireManager, validate(labelSchema), create);
router.patch('/:id', requireManager, validate(labelSchema.partial()), update);
router.delete('/:id', requireAdmin, remove);

export default router;
