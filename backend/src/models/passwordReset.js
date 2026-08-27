/**
 * Password reset tokens.
 *
 * Only the SHA-256 hash of a token is stored, so a leaked database still does not
 * yield a usable reset link. Tokens are single-use and short-lived.
 */
import crypto from 'node:crypto';
import { getDb } from '../db/index.js';
import { nowIso } from '../utils/dates.js';

/** How long a reset link stays valid. */
const TTL_MS = 30 * 60 * 1000;

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/** Issues a fresh token, returning the plaintext to email exactly once. */
export async function createResetToken(userId) {
  const db = await getDb();
  const token = crypto.randomBytes(32).toString('hex');
  await db.insert(
    'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)',
    [userId, hashToken(token), new Date(Date.now() + TTL_MS).toISOString(), nowIso()],
  );
  return token;
}

/** The stored row for a plaintext token, or null. Does not validate it. */
export async function findResetToken(token) {
  const db = await getDb();
  return db.get('SELECT * FROM password_reset_tokens WHERE token_hash = ?', [hashToken(token)]);
}

/** True while the token is unused and unexpired. */
export const isResetTokenUsable = (row) => Boolean(row) && !row.used_at && row.expires_at >= nowIso();

/** Marks the token spent, so a reset link cannot be replayed. */
export async function consumeResetToken(id) {
  const db = await getDb();
  await db.run('UPDATE password_reset_tokens SET used_at = ? WHERE id = ?', [nowIso(), id]);
}
