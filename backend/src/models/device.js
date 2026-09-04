/**
 * Push-capable devices.
 *
 * One row per Expo push token. A token identifies an app install, not a person: when
 * somebody else signs in on the same phone the row is re-pointed at them, so a push
 * never lands on a device whose current user is not its recipient.
 */
import { getDb } from '../db/index.js';
import { nowIso } from '../utils/dates.js';

const COLUMNS = 'id, user_id, expo_push_token, platform, app_version, last_seen_at, created_at';

/** Register (or refresh) a device for the signed-in user. Upsert keyed on the token. */
export async function registerDevice({ userId, expoPushToken, platform, appVersion }) {
  const db = await getDb();
  const ts = nowIso();
  const existing = await db.get('SELECT id FROM device_tokens WHERE expo_push_token = ?', [expoPushToken]);
  if (existing) {
    await db.run(
      `UPDATE device_tokens SET user_id = ?, platform = ?, app_version = ?, last_seen_at = ? WHERE id = ?`,
      [userId, platform, appVersion ?? null, ts, existing.id],
    );
    return db.get(`SELECT ${COLUMNS} FROM device_tokens WHERE id = ?`, [existing.id]);
  }
  const id = await db.insert(
    `INSERT INTO device_tokens (user_id, expo_push_token, platform, app_version, last_seen_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, expoPushToken, platform, appVersion ?? null, ts, ts],
  );
  return db.get(`SELECT ${COLUMNS} FROM device_tokens WHERE id = ?`, [id]);
}

/** Forget a device. Scoped to the owner, so one user cannot unregister another's phone. */
export async function removeDevice({ userId, expoPushToken }) {
  const db = await getDb();
  const res = await db.run(
    'DELETE FROM device_tokens WHERE expo_push_token = ? AND user_id = ?',
    [expoPushToken, userId],
  );
  return res.changes > 0;
}

export async function listDevices(userId) {
  const db = await getDb();
  return db.query(`SELECT ${COLUMNS} FROM device_tokens WHERE user_id = ? ORDER BY last_seen_at DESC`, [userId]);
}

/** Every token registered by any of `userIds`, for a fan-out. */
export async function tokensForUsers(userIds) {
  const ids = [...new Set(userIds.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (!ids.length) return [];
  const db = await getDb();
  const marks = ids.map(() => '?').join(', ');
  return db.query(
    `SELECT user_id, expo_push_token FROM device_tokens WHERE user_id IN (${marks})`,
    ids,
  );
}

/** Drop tokens Expo has told us are dead (DeviceNotRegistered). */
export async function deleteTokens(tokens) {
  const list = [...new Set(tokens.filter(Boolean))];
  if (!list.length) return 0;
  const db = await getDb();
  const marks = list.map(() => '?').join(', ');
  const res = await db.run(`DELETE FROM device_tokens WHERE expo_push_token IN (${marks})`, list);
  return res.changes;
}
