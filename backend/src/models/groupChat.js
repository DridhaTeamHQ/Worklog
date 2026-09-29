/**
 * Group chats — named rooms an admin creates for a chosen set of people.
 *
 * The difference from the team channel is membership. There, everybody is in and
 * there is nothing to store; here the whole point is that a group is *some* people
 * and not others, so membership is real data and every read and write is gated on a
 * row in `chat_group_members`.
 *
 * Two separate permissions, deliberately not conflated:
 *
 *   - **Creating and renaming** a group is an admin power, checked by the route.
 *   - **Reading and posting** is a membership question, checked here in SQL.
 *
 * So an admin who is not in a group cannot read it — being able to administer the
 * roster is not the same as being party to the conversation. The one place the two
 * meet is creation: whoever makes a group is put in it, because a room whose creator
 * cannot open it would be a bug rather than a policy.
 *
 * Access is enforced by the WHERE clause rather than checked beforehand, as it is
 * everywhere else in this app: a query for a group the caller is not in matches no
 * rows instead of returning somebody else's conversation.
 */
import { getDb } from '../db/index.js';
import { nowIso } from '../utils/dates.js';
import { createNotification } from './notification.js';
import { badRequest, forbidden, notFound } from '../utils/errors.js';
import { escapeLike } from '../utils/http.js';

const SENDER_COLUMNS = `u.name AS sender_name, u.role AS sender_role,
                        u.department AS sender_department, u.profile_image AS sender_profile_image`;

/** `?, ?, ?` for an IN clause. Values are still bound, never interpolated. */
const placeholders = (n) => Array.from({ length: n }, () => '?').join(', ');

/** True when this person is in this group. The gate on every read and every post. */
export async function isMember(db, groupId, userId) {
  const row = await db.get(
    'SELECT 1 AS ok FROM chat_group_members WHERE group_id = ? AND user_id = ?',
    [groupId, userId],
  );
  return !!row;
}

/**
 * Loads a group the caller is allowed to open, or refuses.
 *
 * "No such group" and "not your group" deliberately answer the same way — which group
 * ids exist is not something this endpoint should confirm to somebody outside it.
 */
async function requireMembership(db, groupId, userId) {
  const group = await db.get('SELECT id, name, created_by, created_at, updated_at FROM chat_groups WHERE id = ?', [groupId]);
  if (!group || !(await isMember(db, groupId, userId))) {
    throw notFound('That group could not be found.');
  }
  return group;
}

/**
 * Turns the mention ids a client sent into the rows that should be stored.
 *
 * The team channel's two checks, plus a third: the person must be a *member of this
 * group*. Tagging someone into a room they cannot open would notify them about a
 * conversation they are not allowed to read. Anything that fails a check is dropped
 * rather than refused, so a stale picker never costs somebody their message.
 */
async function resolveMentions(db, groupId, body, mentionIds) {
  const ids = [...new Set((mentionIds || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (!ids.length) return [];

  const people = await db.query(
    `SELECT u.id, u.name
       FROM users u
       JOIN chat_group_members m ON m.user_id = u.id AND m.group_id = ?
      WHERE u.is_active = 1 AND u.id IN (${placeholders(ids.length)})`,
    [groupId, ...ids],
  );
  const lower = body.toLowerCase();
  return people.filter((p) => lower.includes(`@${p.name.toLowerCase()}`));
}

/** Attaches the mention list to each message in one extra query, not one per row. */
async function withMentions(db, rows) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const mentions = await db.query(
    `SELECT m.message_id, m.user_id, u.name
       FROM chat_group_message_mentions m
       JOIN users u ON u.id = m.user_id
      WHERE m.message_id IN (${placeholders(ids.length)})`,
    ids,
  );
  const byMessage = new Map();
  for (const m of mentions) {
    const list = byMessage.get(Number(m.message_id)) || [];
    list.push({ id: Number(m.user_id), name: m.name });
    byMessage.set(Number(m.message_id), list);
  }
  return rows.map((r) => ({ ...r, mentions: byMessage.get(Number(r.id)) || [] }));
}

/**
 * Stores the tags on one message and notifies everyone tagged except the author.
 *
 * Called inside the post or edit transaction, so a tag and its notification are
 * committed with the message or not at all.
 */
async function recordMentions(tx, { groupId, messageId, senderId, body, mentionIds }) {
  const mentions = await resolveMentions(tx, groupId, body, mentionIds);
  if (!mentions.length) return;

  const sender = await tx.get('SELECT name FROM users WHERE id = ?', [senderId]);
  const group = await tx.get('SELECT name FROM chat_groups WHERE id = ?', [groupId]);
  for (const person of mentions) {
    await tx.run(
      'INSERT INTO chat_group_message_mentions (message_id, user_id) VALUES (?, ?)',
      [messageId, person.id],
    );
    if (Number(person.id) === Number(senderId)) continue;
    await createNotification({
      userId: person.id,
      title: `${sender?.name || 'Someone'} mentioned you in ${group?.name || 'a group'}`,
      // Trimmed rather than sent whole: a notification is a pointer to the room.
      message: body.length > 140 ? `${body.slice(0, 137)}…` : body,
      type: 'group_mention',
      relatedGroupId: groupId,
    }, tx);
  }
}

/** The people in a group, for the header and the member list. */
async function membersOf(db, groupIds) {
  if (!groupIds.length) return new Map();
  const rows = await db.query(
    `SELECT m.group_id, u.id, u.name, u.role, u.department, u.profile_image
       FROM chat_group_members m
       JOIN users u ON u.id = m.user_id
      WHERE m.group_id IN (${placeholders(groupIds.length)})
      ORDER BY LOWER(u.name) ASC`,
    groupIds,
  );
  const byGroup = new Map();
  for (const r of rows) {
    const list = byGroup.get(Number(r.group_id)) || [];
    list.push({
      id: Number(r.id), name: r.name, role: r.role,
      department: r.department, profile_image: r.profile_image,
    });
    byGroup.set(Number(r.group_id), list);
  }
  return byGroup;
}

/**
 * Every group the caller is in, most recently active first.
 *
 * Built from a handful of small queries rather than one statement with a correlated
 * subquery per column — the same shape the contact list uses, and for the same
 * reason: each question stays short enough to read and identical on both drivers.
 */
export async function listGroups(userId) {
  const db = await getDb();

  const groups = await db.query(
    `SELECT g.id, g.name, g.created_by, g.created_at, g.updated_at
       FROM chat_groups g
       JOIN chat_group_members m ON m.group_id = g.id
      WHERE m.user_id = ?`,
    [userId],
  );
  if (!groups.length) return [];

  const ids = groups.map((g) => g.id);

  // The tail of each room: its highest-id message, with who wrote it.
  const latest = await db.query(
    `SELECT c.group_id, c.sender_id, c.body, c.created_at, u.name AS sender_name
       FROM chat_group_messages c
       JOIN users u ON u.id = c.sender_id
      WHERE c.group_id IN (${placeholders(ids.length)})
        AND c.id = (SELECT MAX(c2.id) FROM chat_group_messages c2 WHERE c2.group_id = c.group_id)`,
    ids,
  );
  const lastByGroup = new Map(latest.map((r) => [Number(r.group_id), r]));

  /*
   * Unread per group: everything above this member's mark that they did not write.
   * A LEFT JOIN onto the marks, so a group someone has never opened counts its whole
   * history rather than dropping out of the result.
   */
  const unreadRows = await db.query(
    `SELECT g.id AS group_id,
            (SELECT COUNT(*) FROM chat_group_messages c
              WHERE c.group_id = g.id
                AND c.sender_id <> ?
                AND c.id > COALESCE(r.last_read_id, 0)) AS unread
       FROM chat_groups g
       LEFT JOIN chat_group_reads r ON r.group_id = g.id AND r.user_id = ?
      WHERE g.id IN (${placeholders(ids.length)})`,
    [userId, userId, ...ids],
  );
  const unreadByGroup = new Map(unreadRows.map((r) => [Number(r.group_id), Number(r.unread || 0)]));

  // Of those unread, how many tagged this member — so the row can say "you were
  // tagged" rather than only "there is traffic", as the team channel's row does.
  const mentionRows = await db.query(
    `SELECT c.group_id, COUNT(*) AS mentions
       FROM chat_group_message_mentions mm
       JOIN chat_group_messages c ON c.id = mm.message_id
       LEFT JOIN chat_group_reads r ON r.group_id = c.group_id AND r.user_id = ?
      WHERE mm.user_id = ?
        AND c.sender_id <> ?
        AND c.id > COALESCE(r.last_read_id, 0)
        AND c.group_id IN (${placeholders(ids.length)})
      GROUP BY c.group_id`,
    [userId, userId, userId, ...ids],
  );
  const mentionsByGroup = new Map(mentionRows.map((r) => [Number(r.group_id), Number(r.mentions || 0)]));

  const membersByGroup = await membersOf(db, ids);

  const out = groups.map((g) => {
    const last = lastByGroup.get(Number(g.id)) ?? null;
    const members = membersByGroup.get(Number(g.id)) || [];
    return {
      ...g,
      members,
      member_count: members.length,
      last_message: last ? last.body : null,
      last_message_at: last ? last.created_at : null,
      last_sender_name: last ? last.sender_name : null,
      last_message_mine: last ? Number(last.sender_id) === Number(userId) : false,
      unread: unreadByGroup.get(Number(g.id)) ?? 0,
      mentions: mentionsByGroup.get(Number(g.id)) ?? 0,
    };
  });

  // Live rooms first, newest at the top; the rest alphabetically behind them.
  return out.sort((a, b) => {
    if (a.last_message_at && b.last_message_at) return a.last_message_at < b.last_message_at ? 1 : -1;
    if (a.last_message_at) return -1;
    if (b.last_message_at) return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Creates a group. Admin-only — the route enforces that, this enforces the rest.
 *
 * The creator is always a member, whether or not they picked themselves: a room its
 * own author cannot open is a bug, not a policy. Ids that do not belong to an active
 * account are dropped rather than refused, so a stale picker does not cost somebody
 * the whole group; what is left must still be at least one other person, because a
 * "group" of one is a note to self and this app already has those.
 */
export async function createGroup(creatorId, { name, memberIds }) {
  const db = await getDb();

  const wanted = [...new Set((memberIds || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))]
    .filter((id) => id !== Number(creatorId));

  let valid = [];
  if (wanted.length) {
    const rows = await db.query(
      `SELECT id FROM users WHERE is_active = 1 AND id IN (${placeholders(wanted.length)})`,
      wanted,
    );
    valid = rows.map((r) => Number(r.id));
  }
  if (!valid.length) throw badRequest('Pick at least one person to add to the group.');

  const ts = nowIso();
  return db.transaction(async (tx) => {
    const id = await tx.insert(
      'INSERT INTO chat_groups (name, created_by, created_at, updated_at) VALUES (?, ?, ?, ?)',
      [name, creatorId, ts, ts],
    );
    for (const memberId of [Number(creatorId), ...valid]) {
      // `run`, not `insert`: this table is keyed by the pair and has no id column,
      // which the postgres driver's RETURNING id would expect.
      await tx.run(
        'INSERT INTO chat_group_members (group_id, user_id, added_at) VALUES (?, ?, ?)',
        [id, memberId, ts],
      );
    }
    const group = await tx.get(
      'SELECT id, name, created_by, created_at, updated_at FROM chat_groups WHERE id = ?',
      [id],
    );
    const members = (await membersOf(tx, [id])).get(Number(id)) || [];
    return {
      ...group,
      members,
      member_count: members.length,
      last_message: null,
      last_message_at: null,
      last_sender_name: null,
      last_message_mine: false,
      unread: 0,
      mentions: 0,
    };
  });
}

/**
 * Renames a group.
 *
 * Admin-only, and deliberately not gated on membership: renaming is roster
 * administration rather than participation, so an admin can tidy up a room they were
 * never in — without that giving them any way to read it.
 */
export async function renameGroup(groupId, name) {
  const db = await getDb();
  const res = await db.run(
    'UPDATE chat_groups SET name = ?, updated_at = ? WHERE id = ?',
    [name, nowIso(), groupId],
  );
  if (!res.changes) throw notFound('That group could not be found.');
  return db.get('SELECT id, name, created_by, created_at, updated_at FROM chat_groups WHERE id = ?', [groupId]);
}

/** A group as the list and header draw it, with its current members. */
async function groupWithMembers(db, groupId) {
  const group = await db.get('SELECT id, name, created_by, created_at, updated_at FROM chat_groups WHERE id = ?', [groupId]);
  if (!group) throw notFound('That group could not be found.');
  const members = (await membersOf(db, [groupId])).get(Number(groupId)) || [];
  return { ...group, members, member_count: members.length };
}

/**
 * Adds people to an existing group. Manager-level, checked by the route.
 *
 * As at creation, ids that are not active accounts are dropped rather than refused,
 * and anyone already in the group is skipped, so adding the same person twice is a
 * no-op instead of an error. A newcomer sees the whole history — the group is one
 * conversation, not a feed that starts when you join.
 */
export async function addGroupMembers(groupId, memberIds) {
  const db = await getDb();
  const wanted = [...new Set((memberIds || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (!wanted.length) throw badRequest('Pick at least one person to add.');

  return db.transaction(async (tx) => {
    const group = await tx.get('SELECT id FROM chat_groups WHERE id = ?', [groupId]);
    if (!group) throw notFound('That group could not be found.');

    const rows = await tx.query(
      `SELECT u.id FROM users u
        WHERE u.is_active = 1 AND u.id IN (${placeholders(wanted.length)})
          AND NOT EXISTS (SELECT 1 FROM chat_group_members m WHERE m.group_id = ? AND m.user_id = u.id)`,
      [...wanted, groupId],
    );
    if (!rows.length) throw badRequest('Everyone picked is already in the group.');

    const ts = nowIso();
    for (const r of rows) {
      await tx.run(
        'INSERT INTO chat_group_members (group_id, user_id, added_at) VALUES (?, ?, ?)',
        [groupId, r.id, ts],
      );
    }
    await tx.run('UPDATE chat_groups SET updated_at = ? WHERE id = ?', [ts, groupId]);
    return groupWithMembers(tx, groupId);
  });
}

/**
 * Takes someone out of a group. Manager-level, checked by the route.
 *
 * Their past messages stay — the conversation should still read as it happened — but
 * their read mark and any mention notifications pointing at the group go, since they
 * can no longer open it. A group is never left with fewer than two people: at that
 * point it is not a group, and deleting it is the honest action.
 */
export async function removeGroupMember(groupId, userId) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const group = await tx.get('SELECT id FROM chat_groups WHERE id = ?', [groupId]);
    if (!group) throw notFound('That group could not be found.');
    if (!(await isMember(tx, groupId, userId))) throw notFound('That person is not in this group.');

    const count = await tx.get('SELECT COUNT(*) AS c FROM chat_group_members WHERE group_id = ?', [groupId]);
    if (Number(count?.c || 0) <= 2) {
      throw badRequest('A group needs at least two people. Delete the group instead.');
    }

    await tx.run('DELETE FROM chat_group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);
    await tx.run('DELETE FROM chat_group_reads WHERE group_id = ? AND user_id = ?', [groupId, userId]);
    await tx.run('DELETE FROM notifications WHERE related_group_id = ? AND user_id = ?', [groupId, userId]);
    await tx.run('UPDATE chat_groups SET updated_at = ? WHERE id = ?', [nowIso(), groupId]);
    return groupWithMembers(tx, groupId);
  });
}

/**
 * Deletes a group and everything in it — messages, tags, read marks, members, and the
 * mention notifications that point at it.
 *
 * Manager-level, and like renaming not gated on membership: it is roster
 * administration. Each child table is cleared explicitly rather than trusting ON
 * DELETE CASCADE, which SQLite only honours when foreign keys are switched on.
 */
export async function deleteGroup(groupId) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const group = await tx.get('SELECT id FROM chat_groups WHERE id = ?', [groupId]);
    if (!group) throw notFound('That group could not be found.');
    await tx.run(
      `DELETE FROM chat_group_message_mentions
        WHERE message_id IN (SELECT id FROM chat_group_messages WHERE group_id = ?)`,
      [groupId],
    );
    await tx.run('DELETE FROM chat_group_messages WHERE group_id = ?', [groupId]);
    await tx.run('DELETE FROM chat_group_reads WHERE group_id = ?', [groupId]);
    await tx.run('DELETE FROM chat_group_members WHERE group_id = ?', [groupId]);
    await tx.run('DELETE FROM notifications WHERE related_group_id = ?', [groupId]);
    await tx.run('DELETE FROM chat_groups WHERE id = ?', [groupId]);
    return true;
  });
}

/** One group's messages, oldest last. Membership is checked before anything is read. */
export async function listGroupMessages(userId, groupId, { limit = 100, afterId = 0, beforeId = 0 } = {}) {
  const db = await getDb();
  const group = await requireMembership(db, groupId, userId);

  // `beforeId` opens the room at a particular message — how a search result is
  // followed. Inclusive, so the message looked for is the last one on screen.
  const rows = beforeId > 0
    ? (await db.query(
      `SELECT c.id, c.group_id, c.sender_id, c.body, c.created_at, ${SENDER_COLUMNS}
         FROM chat_group_messages c
         JOIN users u ON u.id = c.sender_id
        WHERE c.group_id = ? AND c.id <= ?
        ORDER BY c.id DESC
        LIMIT ?`,
      [groupId, beforeId, limit],
    )).reverse()
    : afterId > 0
    ? await db.query(
      `SELECT c.id, c.group_id, c.sender_id, c.body, c.created_at, ${SENDER_COLUMNS}
         FROM chat_group_messages c
         JOIN users u ON u.id = c.sender_id
        WHERE c.group_id = ? AND c.id > ?
        ORDER BY c.id ASC
        LIMIT ?`,
      [groupId, afterId, limit],
    )
    : (await db.query(
      `SELECT c.id, c.group_id, c.sender_id, c.body, c.created_at, ${SENDER_COLUMNS}
         FROM chat_group_messages c
         JOIN users u ON u.id = c.sender_id
        WHERE c.group_id = ?
        ORDER BY c.id DESC
        LIMIT ?`,
      [groupId, limit],
    )).reverse();

  const members = (await membersOf(db, [groupId])).get(Number(groupId)) || [];
  return { group: { ...group, members, member_count: members.length }, messages: await withMentions(db, rows) };
}

/** Posts to a group and notifies the members it tags, all in one transaction. */
export async function postGroupMessage(userId, groupId, body, mentionIds) {
  const db = await getDb();
  if (!(await isMember(db, groupId, userId))) throw forbidden('You are not in that group.');

  return db.transaction(async (tx) => {
    const id = await tx.insert(
      'INSERT INTO chat_group_messages (group_id, sender_id, body, created_at) VALUES (?, ?, ?, ?)',
      [groupId, userId, body, nowIso()],
    );
    await recordMentions(tx, { groupId, messageId: id, senderId: userId, body, mentionIds });
    const rows = await tx.query(
      `SELECT c.id, c.group_id, c.sender_id, c.body, c.created_at, ${SENDER_COLUMNS}
         FROM chat_group_messages c
         JOIN users u ON u.id = c.sender_id
        WHERE c.id = ?`,
      [id],
    );
    const [message] = await withMentions(tx, rows);
    return message;
  });
}

/**
 * Moves this member's high-water mark in one group to its newest message.
 *
 * UPDATE first, INSERT only if it matched nothing — `ON CONFLICT` is spelled
 * differently on the two drivers, and every statement here is written once to run on
 * both. The guarded INSERT covers two tabs marking read at the same moment.
 */
export async function markGroupRead(userId, groupId) {
  const db = await getDb();
  if (!(await isMember(db, groupId, userId))) return 0;

  const newest = await db.get('SELECT COALESCE(MAX(id), 0) AS id FROM chat_group_messages WHERE group_id = ?', [groupId]);
  const target = Number(newest?.id || 0);
  const ts = nowIso();

  const res = await db.run(
    'UPDATE chat_group_reads SET last_read_id = ?, updated_at = ? WHERE group_id = ? AND user_id = ?',
    [target, ts, groupId, userId],
  );
  if (!res.changes) {
    try {
      await db.run(
        'INSERT INTO chat_group_reads (group_id, user_id, last_read_id, updated_at) VALUES (?, ?, ?, ?)',
        [groupId, userId, target, ts],
      );
    } catch {
      await db.run(
        'UPDATE chat_group_reads SET last_read_id = ?, updated_at = ? WHERE group_id = ? AND user_id = ?',
        [target, ts, groupId, userId],
      );
    }
  }
  return target;
}

/**
 * Matching posts in groups the caller is in.
 *
 * The JOIN onto `chat_group_members` is the scope: a group the caller is not in
 * contributes no rows, so search can never surface a room they cannot open.
 */
export async function searchGroups(userId, term, limit = 30) {
  const db = await getDb();
  const needle = `%${escapeLike(term.toLowerCase())}%`;
  const rows = await db.query(
    `SELECT c.id, c.group_id, c.body, c.created_at, c.sender_id,
            u.name AS sender_name, u.profile_image AS sender_profile_image,
            g.name AS room_name
       FROM chat_group_messages c
       JOIN chat_group_members m ON m.group_id = c.group_id AND m.user_id = ?
       JOIN chat_groups g ON g.id = c.group_id
       JOIN users u ON u.id = c.sender_id
      WHERE LOWER(c.body) LIKE ? ESCAPE '\\'
      ORDER BY c.id DESC
      LIMIT ?`,
    [userId, needle, limit],
  );
  return rows.map((r) => ({
    kind: 'group',
    message_id: Number(r.id),
    body: r.body,
    created_at: r.created_at,
    sender_id: Number(r.sender_id),
    sender_name: r.sender_name,
    sender_profile_image: r.sender_profile_image,
    group_id: Number(r.group_id),
    room_name: r.room_name,
  }));
}

/** Unread across every group the caller is in — one number for the launcher badge. */
export async function groupsUnreadTotal(userId) {
  const db = await getDb();
  const row = await db.get(
    `SELECT COUNT(*) AS c
       FROM chat_group_messages c
       JOIN chat_group_members m ON m.group_id = c.group_id AND m.user_id = ?
       LEFT JOIN chat_group_reads r ON r.group_id = c.group_id AND r.user_id = ?
      WHERE c.sender_id <> ? AND c.id > COALESCE(r.last_read_id, 0)`,
    [userId, userId, userId],
  );
  return Number(row?.c || 0);
}

/**
 * Edits one of the caller's own messages. When `mentionIds` is sent the tags are
 * rebuilt from the new text, so removing a name from the message removes the tag.
 */
export async function updateGroupMessage(userId, groupId, messageId, body, mentionIds) {
  const db = await getDb();
  if (!(await isMember(db, groupId, userId))) throw forbidden('You are not in that group.');
  const row = await db.get('SELECT * FROM chat_group_messages WHERE id = ? AND group_id = ?', [messageId, groupId]);
  if (!row) throw notFound('That message no longer exists.');
  if (Number(row.sender_id) !== Number(userId)) throw forbidden('You can only edit your own messages.');

  const trimmed = (row.body || '').trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed?.type && parsed.type !== 'text') {
        throw badRequest('Photos, videos, and documents cannot be edited.');
      }
    } catch (e) {
      if (e.status === 400) throw e;
    }
  }

  return db.transaction(async (tx) => {
    await tx.run('UPDATE chat_group_messages SET body = ? WHERE id = ?', [body, messageId]);
    if (mentionIds !== undefined) {
      await tx.run('DELETE FROM chat_group_message_mentions WHERE message_id = ?', [messageId]);
      await recordMentions(tx, { groupId, messageId, senderId: userId, body, mentionIds });
    }
    const rows = await tx.query(
      `SELECT c.id, c.group_id, c.sender_id, c.body, c.created_at, ${SENDER_COLUMNS}
         FROM chat_group_messages c
         JOIN users u ON u.id = c.sender_id
        WHERE c.id = ?`,
      [messageId],
    );
    const [message] = await withMentions(tx, rows);
    return message;
  });
}

export async function deleteGroupMessage(userId, groupId, messageId) {
  const db = await getDb();
  if (!(await isMember(db, groupId, userId))) throw forbidden('You are not in that group.');
  const row = await db.get('SELECT * FROM chat_group_messages WHERE id = ? AND group_id = ?', [messageId, groupId]);
  if (!row) throw notFound('That message no longer exists.');
  if (Number(row.sender_id) !== Number(userId)) throw forbidden('You can only delete your own messages.');

  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM chat_group_message_mentions WHERE message_id = ?', [messageId]);
    await tx.run('DELETE FROM chat_group_messages WHERE id = ?', [messageId]);
  });
  return true;
}
