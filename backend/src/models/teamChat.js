/**
 * The team channel — one company-wide room, plus @mentions.
 *
 * There is exactly one room and every active account is in it, so there is no
 * membership to store and nobody who can be left out of it by accident. That is the
 * whole reason this is a flat table rather than channels + participants: the only
 * question a reader ever asks is "what is new since I last looked", which a single
 * high-water mark answers.
 *
 * A mention is a stored row, not something re-derived from the text on every read.
 * The body is free text and somebody's name can appear in it without being a tag, so
 * the row is what makes a mention real: it is what the "@" badge counts and what the
 * notification was raised for. The server decides which rows exist — see
 * `resolveMentions`, which refuses a tag whose name is not actually written in the
 * message, so the endpoint cannot be used to notify people who were never addressed.
 */
import { getDb } from '../db/index.js';
import { nowIso } from '../utils/dates.js';
import { createNotification } from './notification.js';
import { escapeLike } from '../utils/http.js';

/** The sender fields every message carries, so the channel can show who is talking. */
const SENDER_COLUMNS = `u.name AS sender_name, u.role AS sender_role,
                        u.department AS sender_department, u.profile_image AS sender_profile_image`;

/** `?, ?, ?` for an IN clause. Values are still bound, never interpolated. */
const placeholders = (n) => Array.from({ length: n }, () => '?').join(', ');

/**
 * Turns the mention ids a client sent into the rows that should be stored.
 *
 * Two checks, both server-side. The id must belong to an active account, and that
 * person's name must actually appear in the message as `@Name`. The second is what
 * stops the field being used as a notification trigger on its own: tagging somebody
 * means writing their name, and a payload claiming a mention the text does not
 * contain is simply dropped rather than refused, so a stale picker never costs
 * somebody their message.
 */
async function resolveMentions(db, body, mentionIds) {
  const ids = [...new Set((mentionIds || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (!ids.length) return [];

  const people = await db.query(
    `SELECT id, name FROM users WHERE is_active = 1 AND id IN (${placeholders(ids.length)})`,
    ids,
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
       FROM team_message_mentions m
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
 * The channel, oldest message last.
 *
 * `afterId` is how an open channel polls — it asks only for what it has not already
 * shown. Without it the newest `limit` are returned and then flipped, because the
 * tail is what opening the room wants but it has to arrive in reading order.
 */
export async function listTeamMessages({ limit = 100, afterId = 0, beforeId = 0 } = {}) {
  const db = await getDb();

  // Opening the channel at a particular message — how a search result is followed.
  // Inclusive, so the message looked for is the last one on screen.
  if (beforeId > 0) {
    const rows = await db.query(
      `SELECT t.id, t.sender_id, t.body, t.created_at, ${SENDER_COLUMNS}
         FROM team_messages t
         JOIN users u ON u.id = t.sender_id
        WHERE t.id <= ?
        ORDER BY t.id DESC
        LIMIT ?`,
      [beforeId, limit],
    );
    return withMentions(db, rows.reverse());
  }

  if (afterId > 0) {
    const rows = await db.query(
      `SELECT t.id, t.sender_id, t.body, t.created_at, ${SENDER_COLUMNS}
         FROM team_messages t
         JOIN users u ON u.id = t.sender_id
        WHERE t.id > ?
        ORDER BY t.id ASC
        LIMIT ?`,
      [afterId, limit],
    );
    return withMentions(db, rows);
  }

  const rows = await db.query(
    `SELECT t.id, t.sender_id, t.body, t.created_at, ${SENDER_COLUMNS}
       FROM team_messages t
       JOIN users u ON u.id = t.sender_id
      ORDER BY t.id DESC
      LIMIT ?`,
    [limit],
  );
  return withMentions(db, rows.reverse());
}

/**
 * Posts to the channel and notifies everyone tagged.
 *
 * The message, its mention rows and the notifications are one transaction: a tag that
 * is stored but never delivered, or a notification pointing at a message that was
 * rolled back, are both worse than the post failing outright.
 *
 * The sender is skipped when notifying. Tagging yourself is allowed — people do it
 * when quoting a thread — but being told about your own message is just noise.
 */
export async function postTeamMessage(senderId, body, mentionIds) {
  const db = await getDb();

  return db.transaction(async (tx) => {
    const mentions = await resolveMentions(tx, body, mentionIds);
    const ts = nowIso();

    const id = await tx.insert(
      'INSERT INTO team_messages (sender_id, body, created_at) VALUES (?, ?, ?)',
      [senderId, body, ts],
    );

    const sender = await tx.get('SELECT name FROM users WHERE id = ?', [senderId]);

    for (const person of mentions) {
      await tx.run(
        'INSERT INTO team_message_mentions (message_id, user_id) VALUES (?, ?)',
        [id, person.id],
      );
      if (Number(person.id) === Number(senderId)) continue;
      await createNotification({
        userId: person.id,
        title: `${sender?.name || 'Someone'} mentioned you in Team Chat`,
        // Trimmed rather than sent whole: a notification is a pointer to the room,
        // not a second copy of the conversation.
        message: body.length > 140 ? `${body.slice(0, 137)}…` : body,
        type: 'chat_mention',
      }, tx);
    }

    const rows = await tx.query(
      `SELECT t.id, t.sender_id, t.body, t.created_at, ${SENDER_COLUMNS}
         FROM team_messages t
         JOIN users u ON u.id = t.sender_id
        WHERE t.id = ?`,
      [id],
    );
    const [message] = await withMentions(tx, rows);
    return message;
  });
}

/** Matching posts in the channel. Everybody is in it, so there is nothing to scope. */
export async function searchTeam(term, limit = 30) {
  const db = await getDb();
  const needle = `%${escapeLike(term.toLowerCase())}%`;
  const rows = await db.query(
    `SELECT t.id, t.body, t.created_at, t.sender_id,
            u.name AS sender_name, u.profile_image AS sender_profile_image
       FROM team_messages t
       JOIN users u ON u.id = t.sender_id
      WHERE LOWER(t.body) LIKE ? ESCAPE '\\'
      ORDER BY t.id DESC
      LIMIT ?`,
    [needle, limit],
  );
  return rows.map((r) => ({
    kind: 'team',
    message_id: Number(r.id),
    body: r.body,
    created_at: r.created_at,
    sender_id: Number(r.sender_id),
    sender_name: r.sender_name,
    sender_profile_image: r.sender_profile_image,
    room_name: 'Team Chat',
  }));
}

/** How far this person has read. Absent means they have never opened the channel. */
async function lastReadId(db, userId) {
  const row = await db.get('SELECT last_read_id FROM team_channel_reads WHERE user_id = ?', [userId]);
  return Number(row?.last_read_id || 0);
}

/**
 * What is new for this person: messages they have not seen, and how many of those
 * tagged them.
 *
 * Their own messages are excluded from the unread count — posting is not a thing you
 * need to be told about.
 */
export async function teamUnread(userId) {
  const db = await getDb();
  const since = await lastReadId(db, userId);

  const unread = await db.get(
    'SELECT COUNT(*) AS c FROM team_messages WHERE id > ? AND sender_id <> ?',
    [since, userId],
  );
  const mentions = await db.get(
    `SELECT COUNT(*) AS c
       FROM team_message_mentions m
       JOIN team_messages t ON t.id = m.message_id
      WHERE m.user_id = ? AND m.message_id > ? AND t.sender_id <> ?`,
    [userId, since, userId],
  );
  return { unread: Number(unread?.c || 0), mentions: Number(mentions?.c || 0) };
}

/**
 * Moves this person's high-water mark to the newest message.
 *
 * UPDATE first and INSERT only if it matched nothing, rather than an upsert: `ON
 * CONFLICT` is spelled differently across the two drivers this app supports, and
 * every other statement here is written once and runs on both. The INSERT is guarded
 * because two tabs marking read at the same moment would otherwise collide on the
 * primary key — the loser simply re-runs the update it should have done.
 */
export async function markTeamRead(userId) {
  const db = await getDb();
  const newest = await db.get('SELECT COALESCE(MAX(id), 0) AS id FROM team_messages');
  const target = Number(newest?.id || 0);
  const ts = nowIso();

  const res = await db.run(
    'UPDATE team_channel_reads SET last_read_id = ?, updated_at = ? WHERE user_id = ?',
    [target, ts, userId],
  );
  if (!res.changes) {
    try {
      // `run`, not `insert`: the postgres driver appends RETURNING id to an insert,
      // and this table is keyed by user_id with no id column of its own.
      await db.run(
        'INSERT INTO team_channel_reads (user_id, last_read_id, updated_at) VALUES (?, ?, ?)',
        [userId, target, ts],
      );
    } catch {
      await db.run(
        'UPDATE team_channel_reads SET last_read_id = ?, updated_at = ? WHERE user_id = ?',
        [target, ts, userId],
      );
    }
  }
  return target;
}
