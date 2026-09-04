/**
 * Push notifications to the mobile app, via Expo's push service.
 *
 * Two modes, chosen by configuration, mirroring services/mail.js:
 *   - expo : real delivery through expo-server-sdk
 *   - log  : the message is written to the server log instead of being sent
 *
 * Every send resolves rather than throwing, and is bounded by a short timeout: the
 * row that triggered it is already committed, and a slow or dead push service must
 * neither fail that request nor hold it open. On a serverless host the send is
 * awaited before the response goes out (see db/index.js afterCommit), because the
 * function is frozen the moment it responds.
 */
import config from '../config/env.js';
import { getDb } from '../db/index.js';
import { tokensForUsers, deleteTokens } from '../models/device.js';

let expo = null;
let mode = null;

async function getClient() {
  if (mode) return { expo, mode };
  if (config.push.enabled) {
    try {
      const { Expo } = await import('expo-server-sdk');
      expo = new Expo({
        accessToken: config.push.accessToken || undefined,
        useFcmV1: true,
      });
      mode = 'expo';
    } catch (err) {
      console.warn(`[push] expo-server-sdk unavailable (${err.message}) — falling back to log mode.`);
      mode = 'log';
    }
  } else {
    mode = 'log';
  }
  return { expo, mode };
}

/** Reset between tests or after a config change. */
export function resetPushClient() {
  expo = null;
  mode = null;
}

export const pushMode = async () => (await getClient()).mode;

/** Deep link the app opens when the notification is tapped. */
export function urlForNotification({ type, relatedTaskId, relatedTicketId, relatedUserId }) {
  if (relatedTicketId) return `taskr://tickets/${relatedTicketId}`;
  if (relatedTaskId) return `taskr://tasks/${relatedTaskId}`;
  if (type === 'report_submitted' && relatedUserId) return `taskr://team/${relatedUserId}`;
  return 'taskr://notifications';
}

const withTimeout = (promise, ms, label) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms).unref?.()),
]);

// Computed here rather than imported from models/notification.js, which imports this
// module — a circular import would leave one of them half-initialised.
async function unreadBadge(userId) {
  const db = await getDb();
  const row = await db.get('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0', [userId]);
  return Number(row?.c || 0);
}

/**
 * Push one stored notification to every device its recipient has registered.
 * Resolves `{ sent, failed, mode }`; never throws.
 */
export async function sendForNotification({
  notificationId, userId, title, message, type, relatedTaskId, relatedTicketId, relatedUserId,
}) {
  try {
    const devices = await tokensForUsers([userId]);
    if (!devices.length) return { sent: 0, failed: 0, mode: 'none' };

    const { expo: client, mode: m } = await getClient();
    const badge = await unreadBadge(userId);
    const data = {
      type,
      notificationId,
      taskId: relatedTaskId ?? null,
      ticketId: relatedTicketId ?? null,
      userId: relatedUserId ?? null,
      url: urlForNotification({ type, relatedTaskId, relatedTicketId, relatedUserId }),
    };
    const messages = devices.map((d) => ({
      to: d.expo_push_token,
      title,
      body: message,
      sound: 'default',
      priority: 'high',
      channelId: 'default',
      badge,
      data,
    }));

    if (m === 'log') {
      console.log(`[push] (log mode) ${messages.length} device(s) for user ${userId}: "${title}" → ${data.url}`);
      return { sent: messages.length, failed: 0, mode: m };
    }

    let sent = 0;
    let failed = 0;
    const dead = [];
    for (const chunk of client.chunkPushNotifications(messages)) {
      let tickets;
      try {
        tickets = await withTimeout(client.sendPushNotificationsAsync(chunk), config.push.timeoutMs, 'push send');
      } catch (err) {
        failed += chunk.length;
        console.error(`[push] send failed for user ${userId}:`, err.message);
        continue;
      }
      tickets.forEach((ticket, i) => {
        if (ticket.status === 'ok') { sent += 1; return; }
        failed += 1;
        const reason = ticket.details?.error;
        if (reason === 'DeviceNotRegistered') dead.push(chunk[i].to);
        else console.error(`[push] ticket error (${reason || 'unknown'}): ${ticket.message}`);
      });
    }
    if (dead.length) {
      const removed = await deleteTokens(dead);
      console.log(`[push] removed ${removed} unregistered device token(s).`);
    }
    return { sent, failed, mode: m };
  } catch (err) {
    console.error('[push] unexpected failure:', err.message);
    return { sent: 0, failed: 1, mode: mode || 'unknown', error: err.message };
  }
}
