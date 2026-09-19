import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validate, safeText } from '../middleware/validate.js';
import {
  contacts, unread, conversation, send, markRead,
  teamMessages, postToTeam, markTeamChannelRead,
  groups, createGroupRoom, renameGroupRoom, groupMessages, postToGroup, markGroupRoomRead,
  search,
} from '../controllers/chat.js';

const router = Router();

/*
 * Authenticated, with no role gate on purpose.
 *
 * This is the one section every role shares equally: a team member, a manager and an
 * admin all reach the same directory and the same threads. The department confinement
 * that narrows a manager's task and report views is not applied here — those views
 * are about a department's work, and a message is about a person.
 *
 * What still holds is ownership: the controller takes the sender from req.user and
 * the model scopes every read and write to the pair, so the only threads reachable
 * through these routes are the caller's own.
 */
router.use(requireAuth);

const contactsQuery = z.object({
  search: z.string().trim().max(200).optional(),
});

/*
 * `after` is the id the client already has, which is how the open thread polls for
 * new messages without re-downloading the history. `markRead=false` asks for the
 * messages without clearing the badge — used when a thread is refreshed in the
 * background rather than looked at.
 */
const conversationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
  after: z.coerce.number().int().min(0).default(0),
  // Opens the room at a particular message, which is how a search result is
  // followed. Inclusive, so the message looked for is on screen.
  before: z.coerce.number().int().min(0).default(0),
  markRead: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

/*
 * Search runs across direct messages, the team channel and the caller's groups. The
 * scope is applied per store in the models, so there is no parameter here that could
 * widen it.
 */
const searchQuery = z.object({
  q: z.string().trim().min(1, 'Type something to search for.').max(200),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

const sendSchema = z.object({
  body: safeText(4000, 'Message'),
});

/*
 * The team channel. One room, everybody in it, so there is no id in these paths —
 * `/team` is the whole address.
 *
 * `mentions` carries who the sender tagged. It is not trusted: the model keeps only
 * the ids that belong to an active account *and* whose name is actually written in
 * the message, so this field cannot be used to notify people who were never
 * addressed.
 */
const teamPostSchema = z.object({
  body: safeText(4000, 'Message'),
  mentions: z.array(z.coerce.number().int().positive()).max(50).optional(),
});

/*
 * Group chats.
 *
 * Two different permissions here, and they are not the same question:
 *
 *   - Creating and renaming a group is administration of who-talks-to-whom, so it is
 *     `requireAdmin`. A manager runs their department but does not decide the
 *     company's rooms, which is the same line drawn for creating accounts.
 *   - Reading and posting is participation, so it is gated on membership inside the
 *     model instead. An admin who is not in a group cannot read it.
 */
const createGroupSchema = z.object({
  name: safeText(80, 'Group name'),
  memberIds: z.array(z.coerce.number().int().positive()).min(1, 'Pick at least one person.').max(200),
});

const renameGroupSchema = z.object({
  name: safeText(80, 'Group name'),
});

router.get('/groups', groups);
router.post('/groups', requireAdmin, validate(createGroupSchema), createGroupRoom);
router.patch('/groups/:groupId', requireAdmin, validate(renameGroupSchema), renameGroupRoom);
router.get('/groups/:groupId/messages', validate(conversationQuery, 'query'), groupMessages);
router.post('/groups/:groupId/messages', validate(sendSchema), postToGroup);
router.patch('/groups/:groupId/read', markGroupRoomRead);

router.get('/search', validate(searchQuery, 'query'), search);
router.get('/contacts', validate(contactsQuery, 'query'), contacts);
router.get('/unread-count', unread);
router.get('/team/messages', validate(conversationQuery, 'query'), teamMessages);
router.post('/team/messages', validate(teamPostSchema), postToTeam);
router.patch('/team/read', markTeamChannelRead);
// Static paths first, or 'contacts', 'unread-count', 'team' and 'groups' would be
// read as user ids.
router.get('/:userId/messages', validate(conversationQuery, 'query'), conversation);
router.post('/:userId/messages', validate(sendSchema), send);
router.patch('/:userId/read', markRead);

export default router;
