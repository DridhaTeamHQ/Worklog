import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ok } from '../utils/http.js';
import { asyncHandler, badRequest, notFound } from '../utils/errors.js';
import { listNotifications, unreadCount, markRead, markAllRead } from '../services/notifications.js';

const router = Router();
router.use(requireAuth);

const listQuery = z.object({
  unreadOnly: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/** Every query below is scoped to req.user.id — notifications are never cross-readable. */
router.get('/', validate(listQuery, 'query'), asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const items = await listNotifications(req.user.id, {
    unreadOnly: q.unreadOnly === 'true',
    limit: q.limit,
    offset: q.offset,
  });
  return ok(res, items, { unread: await unreadCount(req.user.id) });
}));

/** Polled by the bell icon; deliberately tiny so it is cheap to call often. */
router.get('/unread-count', asyncHandler(async (req, res) => ok(res, { unread: await unreadCount(req.user.id) })));

router.patch('/:id/read', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid notification id.');
  if (!(await markRead(req.user.id, id))) throw notFound('That notification could not be found.');
  return ok(res, { id, is_read: true, unread: await unreadCount(req.user.id) });
}));

router.patch('/read-all', asyncHandler(async (req, res) => {
  const changed = await markAllRead(req.user.id);
  return ok(res, { marked: changed, unread: 0 });
}));

export default router;
