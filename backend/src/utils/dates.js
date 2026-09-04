/**
 * Date helpers. Calendar dates are 'YYYY-MM-DD' strings and timestamps are full
 * ISO-8601 UTC strings, both stored as TEXT so SQLite and PostgreSQL agree and
 * lexical ordering equals chronological ordering.
 */
export const nowIso = () => new Date().toISOString();

export const isIsoDate = (value) =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

/** Today in the server's local timezone (what "today" means to the people using it). */
export function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The zone "today" is computed in when nothing better is known: APP_TIMEZONE if the
 * deployment sets one, else whatever the server itself runs in. A user's own zone
 * (profile or X-Client-Timezone header) always takes precedence — see requireAuth.
 */
export const DEFAULT_TIMEZONE = (() => {
  const configured = (process.env.APP_TIMEZONE || '').trim();
  if (configured && isValidTimezone(configured)) return configured;
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
})();

/** True when `tz` is an IANA zone name the runtime knows (e.g. "Asia/Kolkata"). */
export function isValidTimezone(tz) {
  if (typeof tz !== 'string' || !tz.trim() || tz.length > 64) return false;
  try {
    // eslint-disable-next-line no-new
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The calendar date right now in `tz`, as 'YYYY-MM-DD'. */
export function todayIn(tz, at = new Date()) {
  const zone = isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
  // en-CA formats as YYYY-MM-DD, which is exactly the storage format.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(at);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** The hour (0-23) right now in `tz`; used by the reminder job to fire at local times. */
export function hourIn(tz, at = new Date()) {
  const zone = isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
  const value = new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', hour12: false })
    .formatToParts(at).find((p) => p.type === 'hour')?.value;
  return Number(value) % 24;
}

export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Whole days from `a` to `b` (positive when b is later). */
export function dayDiff(a, b) {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** Monday-based start of the week containing `dateStr`. */
export function startOfWeek(dateStr = today()) {
  const d = new Date(`${dateStr}T00:00:00`);
  const dow = (d.getDay() + 6) % 7;
  return addDays(dateStr, -dow);
}

export function startOfMonth(dateStr = today()) {
  return `${dateStr.slice(0, 7)}-01`;
}

/**
 * Resolve a named range into { from, to } inclusive calendar dates.
 * Supported: today | week | month | all | custom (uses from/to as given).
 * `base` is the date "today" means for the caller (their own timezone).
 */
export function resolveRange(range, from, to, base = today()) {
  const t = base;
  switch (range) {
    case 'today': return { from: t, to: t };
    case 'week': return { from: startOfWeek(t), to: t };
    case 'month': return { from: startOfMonth(t), to: t };
    case 'custom': return { from: from || null, to: to || null };
    default: return { from: from || null, to: to || null };
  }
}
