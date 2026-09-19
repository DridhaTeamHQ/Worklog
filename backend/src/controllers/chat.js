/**
 * Chat controller.
 *
 * Every handler works from `req.user.id` and the partner id in the path — there is no
 * body field or query parameter that names the sender, so a caller cannot write a
 * message as somebody else or read a thread they are not in.
 *
 * The routes are authenticated but carry no role gate. Chat is the one part of the
 * app that is deliberately flat: an admin, a manager and a team member reach the same
 * endpoints and see the same directory.
 */
import { ok, created } from '../utils/http.js';
import { asyncHandler, badRequest } from '../utils/errors.js';
import {
  listContacts, findPartner, listConversation, sendMessage,
  markConversationRead, unreadTotal, unreadByPartner,
} from '../models/chat.js';
import {
  listTeamMessages, postTeamMessage, teamUnread, markTeamRead,
} from '../models/teamChat.js';
import {
  listGroups, createGroup, renameGroup, listGroupMessages,
  postGroupMessage, markGroupRead, groupsUnreadTotal,
} from '../models/groupChat.js';

const parseId = (raw) => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid user id.');
  return id;
};

/** Who the caller can message, with each thread's preview and unread count. */
export const contacts = asyncHandler(async (req, res) => {
  const people = await listContacts(req.user.id, { search: req.validatedQuery.search });
  const unread = people.reduce((sum, p) => sum + p.unread, 0);
  return ok(res, people, { total: people.length, unread });
});

/**
 * Everything the launcher and the list need to draw their badges, in one call.
 *
 * `unread` is the number on the launcher and counts both kinds — direct messages and
 * unread team-channel posts — because that is what people expect a message badge to
 * mean. `team.mentions` is carried separately so the channel row can say *you were
 * tagged* rather than just *there is traffic*.
 */
export const unread = asyncHandler(async (req, res) => {
  const [direct, byPartner, team, groups] = await Promise.all([
    unreadTotal(req.user.id),
    unreadByPartner(req.user.id),
    teamUnread(req.user.id),
    groupsUnreadTotal(req.user.id),
  ]);
  return ok(res, {
    unread: direct + team.unread + groups,
    direct,
    threads: byPartner,
    team,
    groups,
  });
});

/* ----------------------------------------------------------- team channel */

/**
 * The team channel.
 *
 * Reading it marks it read, for the same reason opening a thread does: opening it is
 * what reading means. Polling passes `after` and marks read too — the room is on
 * screen when the message lands.
 */
export const teamMessages = asyncHandler(async (req, res) => {
  const { limit, after, markRead: shouldMark } = req.validatedQuery;
  const messages = await listTeamMessages({ limit, afterId: after });
  if (shouldMark !== false) await markTeamRead(req.user.id);
  return ok(res, messages, { unread: await unreadTotal(req.user.id) });
});

export const postToTeam = asyncHandler(async (req, res) => {
  const message = await postTeamMessage(req.user.id, req.body.body, req.body.mentions);
  // Posting is reading: the author has by definition seen everything above their own
  // message, so the channel should not come back with a badge for it.
  await markTeamRead(req.user.id);
  return created(res, message);
});

export const markTeamChannelRead = asyncHandler(async (req, res) => {
  const lastReadId = await markTeamRead(req.user.id);
  return ok(res, { lastReadId, unread: await unreadTotal(req.user.id) });
});

/**
 * One thread.
 *
 * Opening it marks what the partner sent as read, because opening it is what reading
 * it means — there is no second "mark read" the user has to remember. Polling passes
 * `after`, and that case marks read too: the thread is on screen when the new message
 * lands. A caller that wants the history without clearing the badge passes
 * `markRead=false`.
 */
export const conversation = asyncHandler(async (req, res) => {
  const partnerId = parseId(req.params.userId);
  const partner = await findPartner(req.user.id, partnerId);
  if (!partner) throw badRequest('That person could not be found.');

  const { limit, after, markRead } = req.validatedQuery;
  const messages = await listConversation(req.user.id, partnerId, { limit, afterId: after });
  if (markRead !== false) await markConversationRead(req.user.id, partnerId);

  return ok(res, messages, { partner, unread: await unreadTotal(req.user.id) });
});

export const send = asyncHandler(async (req, res) => {
  const partnerId = parseId(req.params.userId);
  const message = await sendMessage(req.user.id, partnerId, req.body.body);
  return created(res, message);
});

export const markRead = asyncHandler(async (req, res) => {
  const partnerId = parseId(req.params.userId);
  const marked = await markConversationRead(req.user.id, partnerId);
  return ok(res, { marked, unread: await unreadTotal(req.user.id) });
});

/* ----------------------------------------------------------- group chats */

/** The groups the caller is in. Not every group — membership is the filter. */
export const groups = asyncHandler(async (req, res) => {
  const rooms = await listGroups(req.user.id);
  return ok(res, rooms, { total: rooms.length });
});

/** Admin-only, gated by the route. The creator is always put in the group. */
export const createGroupRoom = asyncHandler(async (req, res) => {
  const group = await createGroup(req.user.id, {
    name: req.body.name,
    memberIds: req.body.memberIds,
  });
  return created(res, group);
});

/** Admin-only rename. Not gated on membership — see the note in the model. */
export const renameGroupRoom = asyncHandler(async (req, res) => {
  const group = await renameGroup(parseId(req.params.groupId), req.body.name);
  return ok(res, group);
});

/** One group. Opening it marks it read, as every other room here does. */
export const groupMessages = asyncHandler(async (req, res) => {
  const groupId = parseId(req.params.groupId);
  const { limit, after, markRead: shouldMark } = req.validatedQuery;
  const { group, messages } = await listGroupMessages(req.user.id, groupId, { limit, afterId: after });
  if (shouldMark !== false) await markGroupRead(req.user.id, groupId);
  return ok(res, messages, { group, unread: await unreadTotal(req.user.id) });
});

export const postToGroup = asyncHandler(async (req, res) => {
  const groupId = parseId(req.params.groupId);
  const message = await postGroupMessage(req.user.id, groupId, req.body.body);
  // Posting is reading: the author has seen everything above their own message.
  await markGroupRead(req.user.id, groupId);
  return created(res, message);
});

export const markGroupRoomRead = asyncHandler(async (req, res) => {
  const groupId = parseId(req.params.groupId);
  const lastReadId = await markGroupRead(req.user.id, groupId);
  return ok(res, { lastReadId, unread: await unreadTotal(req.user.id) });
});
