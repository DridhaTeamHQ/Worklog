import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { list, getUnreadCount, readOne, readAll } from '../controllers/notifications.js';

const router = Router();
router.use(requireAuth);

const listQuery = z.object({
  unreadOnly: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get('/', validate(listQuery, 'query'), list);
router.get('/unread-count', getUnreadCount);
// Static path first: '/read-all' must not be captured by '/:id/read'.
router.patch('/read-all', readAll);
router.patch('/:id/read', readOne);

export default router;
