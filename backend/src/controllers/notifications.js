/**
 * Notification controller.
 *
 * Every query below is scoped to `req.user.id` — notifications are never
 * cross-readable, so the owning id comes from the verified session, never the request.
 */
import { ok } from '../utils/http.js';
import { asyncHandler, badRequest, notFound } from '../utils/errors.js';
import { listNotifications, unreadCount, markRead, markAllRead } from '../models/notification.js';

export const list = asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const items = await listNotifications(req.user.id, {
    unreadOnly: q.unreadOnly === 'true',
    limit: q.limit,
    offset: q.offset,
  });
  return ok(res, items, { unread: await unreadCount(req.user.id) });
});

/** Polled by the bell icon; deliberately tiny so it is cheap to call often. */
export const getUnreadCount = asyncHandler(async (req, res) =>
  ok(res, { unread: await unreadCount(req.user.id) }));

export const readOne = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid notification id.');
  if (!(await markRead(req.user.id, id))) throw notFound('That notification could not be found.');
  return ok(res, { id, is_read: true, unread: await unreadCount(req.user.id) });
});

export const readAll = asyncHandler(async (req, res) => {
  const changed = await markAllRead(req.user.id);
  return ok(res, { marked: changed, unread: 0 });
});
