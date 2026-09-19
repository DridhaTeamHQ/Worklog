/**
 * Direct messages — one-to-one conversations between two people in the company.
 *
 * Every signed-in account has this, whatever its role. Admins, managers and team
 * members all appear in one another's directory and all reach the same endpoints, so
 * nothing here consults `departmentScope`: that confinement exists so a manager's
 * *reporting* views stay inside their department, and a message is addressed to a
 * person rather than filed against one.
 *
 * A conversation is identified by the pair of user ids, not by a stored thread id.
 * Two people have exactly one thread, so the pair already names it and a
 * `conversations` table would only restate the two columns that are on the row
 * anyway. Every read is a symmetric WHERE over that pair.
 *
 * Access is enforced in the WHERE clause rather than checked beforehand: a query for
 * a thread the caller is not part of matches no rows instead of returning someone
 * else's, which is the same shape the rest of the app uses for ownership.
 */
import { getDb } from '../db/index.js';
import { nowIso } from '../utils/dates.js';
import { badRequest, notFound } from '../utils/errors.js';

/** Fields of the other person that the chat UI shows. Never the password hash. */
const PARTNER_COLUMNS = 'u.id, u.name, u.email, u.role, u.department, u.job_title, u.profile_image';

const toMessage = (row) => (row ? { ...row, is_read: Boolean(row.read_at) } : null);

/**
 * The person a message is being sent to, if they can receive one.
 *
 * A deactivated account is treated exactly like one that does not exist: it cannot
 * sign in, so a thread with it would only ever be written to. Messaging yourself is
 * refused outright — the pair-as-conversation model has no meaning for it, and a
 * self-thread would show up in the directory as a contact called "you".
 */
async function findRecipient(db, senderId, recipientId) {
  if (Number(senderId) === Number(recipientId)) {
    throw badRequest('You cannot send a message to yourself.');
  }
  const row = await db.get(
    'SELECT id, name, is_active FROM users WHERE id = ?',
    [recipientId],
  );
  if (!row || !row.is_active) throw notFound('That person could not be found.');
  return row;
}

/**
 * Everyone the caller can talk to, most recently active thread first.
 *
 * The whole active directory is returned, not only people already spoken to — the
 * widget's contact list and its conversation list are the same list, so someone who
 * has never been messaged still has to be reachable. Threads that have seen traffic
 * sort above those that have not, which puts the live conversations at the top
 * without hiding anybody at the bottom.
 *
 * Three small queries rather than one with a correlated subquery per column: the
 * roster and the message tail are unrelated questions, and asking them separately
 * keeps each statement short enough to read and identical on both drivers. The
 * stitching is a pair of Maps over a roster that is measured in people, not rows.
 */
export async function listContacts(userId, { search } = {}) {
  const db = await getDb();

  const params = [userId];
  let where = 'u.id <> ? AND u.is_active = 1';
  if (search) {
    where += ' AND (LOWER(u.name) LIKE ? OR LOWER(u.email) LIKE ?)';
    const needle = `%${search.toLowerCase()}%`;
    params.push(needle, needle);
  }

  const people = await db.query(
    `SELECT ${PARTNER_COLUMNS} FROM users u WHERE ${where}`,
    params,
  );

  /*
   * The latest message of every thread the caller is in, one row per partner.
   *
   * `m.id = (SELECT MAX(...) over the same pair)` is what reduces each thread to its
   * tail; the CASE then names the other person, whichever side of the row they are
   * on. Only threads that exist appear here, so a partner with no history is simply
   * absent from the map rather than carrying an empty preview.
   */
  const latest = await db.query(
    `SELECT CASE WHEN m.sender_id = ? THEN m.recipient_id ELSE m.sender_id END AS partner_id,
            m.sender_id, m.body, m.created_at
       FROM chat_messages m
      WHERE (m.sender_id = ? OR m.recipient_id = ?)
        AND m.id = (SELECT MAX(m2.id) FROM chat_messages m2
                     WHERE (m2.sender_id = m.sender_id AND m2.recipient_id = m.recipient_id)
                        OR (m2.sender_id = m.recipient_id AND m2.recipient_id = m.sender_id))`,
    [userId, userId, userId],
  );
  const lastByPartner = new Map(latest.map((r) => [Number(r.partner_id), r]));

  const unreadRows = await unreadByPartner(userId);
  const unreadBySender = new Map(unreadRows.map((r) => [r.user_id, r.unread]));

  const contacts = people.map((u) => {
    const last = lastByPartner.get(Number(u.id)) ?? null;
    return {
      ...u,
      last_message: last ? last.body : null,
      last_message_at: last ? last.created_at : null,
      // Whose message the preview is, so the UI can prefix it with "You:" without
      // having to compare against a signed-in id it does not always hold.
      last_message_mine: last ? Number(last.sender_id) === Number(userId) : false,
      unread: unreadBySender.get(Number(u.id)) ?? 0,
    };
  });

  // Live threads first, newest at the top; everyone else alphabetically behind them.
  return contacts.sort((a, b) => {
    if (a.last_message_at && b.last_message_at) {
      return a.last_message_at < b.last_message_at ? 1 : -1;
    }
    if (a.last_message_at) return -1;
    if (b.last_message_at) return 1;
    return a.name.localeCompare(b.name);
  });
}

/** One person's details, for the header of a thread opened by id. */
export async function findPartner(userId, partnerId) {
  const db = await getDb();
  if (Number(userId) === Number(partnerId)) return null;
  const row = await db.get(
    `SELECT ${PARTNER_COLUMNS} FROM users u WHERE u.id = ? AND u.is_active = 1`,
    [partnerId],
  );
  return row ?? null;
}

/**
 * One thread, oldest message last — the order a chat log is read in.
 *
 * `afterId` is how the widget polls: it asks only for what it has not already seen,
 * so a thread left open all day costs one near-empty response per tick rather than
 * the whole history each time. Without it the newest `limit` messages are returned,
 * which is what opening a thread wants.
 */
export async function listConversation(userId, partnerId, { limit = 100, afterId = 0 } = {}) {
  const db = await getDb();
  const pair = `((m.sender_id = ? AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = ?))`;
  const params = [userId, partnerId, partnerId, userId];

  if (afterId > 0) {
    const rows = await db.query(
      `SELECT m.id, m.sender_id, m.recipient_id, m.body, m.read_at, m.created_at
         FROM chat_messages m
        WHERE ${pair} AND m.id > ?
        ORDER BY m.id ASC
        LIMIT ?`,
      [...params, afterId, limit],
    );
    return rows.map(toMessage);
  }

  // Newest `limit`, then flipped: the tail of a long thread is what is wanted, but
  // it has to arrive in reading order.
  const rows = await db.query(
    `SELECT m.id, m.sender_id, m.recipient_id, m.body, m.read_at, m.created_at
       FROM chat_messages m
      WHERE ${pair}
      ORDER BY m.id DESC
      LIMIT ?`,
    [...params, limit],
  );
  return rows.reverse().map(toMessage);
}

export async function sendMessage(senderId, recipientId, body) {
  const db = await getDb();
  await findRecipient(db, senderId, recipientId);
  const ts = nowIso();
  const id = await db.insert(
    `INSERT INTO chat_messages (sender_id, recipient_id, body, read_at, created_at)
     VALUES (?, ?, ?, NULL, ?)`,
    [senderId, recipientId, body, ts],
  );
  const row = await db.get(
    'SELECT id, sender_id, recipient_id, body, read_at, created_at FROM chat_messages WHERE id = ?',
    [id],
  );
  return toMessage(row);
}

/**
 * Marks everything the partner sent to the caller as read.
 *
 * Scoped by `recipient_id = caller`, so this can only ever clear the caller's own
 * unread count — there is no id combination that would let it touch the other side's.
 */
export async function markConversationRead(userId, partnerId) {
  const db = await getDb();
  const res = await db.run(
    `UPDATE chat_messages SET read_at = ?
      WHERE recipient_id = ? AND sender_id = ? AND read_at IS NULL`,
    [nowIso(), userId, partnerId],
  );
  return res.changes;
}

/** Total unread across every thread — the number on the chat launcher. */
export async function unreadTotal(userId) {
  const db = await getDb();
  const row = await db.get(
    'SELECT COUNT(*) AS c FROM chat_messages WHERE recipient_id = ? AND read_at IS NULL',
    [userId],
  );
  return Number(row?.c || 0);
}

/**
 * Unread grouped by who it is from, so a single poll can refresh every badge in the
 * contact list without re-reading the list itself.
 */
export async function unreadByPartner(userId) {
  const db = await getDb();
  const rows = await db.query(
    `SELECT sender_id, COUNT(*) AS c
       FROM chat_messages
      WHERE recipient_id = ? AND read_at IS NULL
      GROUP BY sender_id`,
    [userId],
  );
  return rows.map((r) => ({ user_id: Number(r.sender_id), unread: Number(r.c) }));
}
