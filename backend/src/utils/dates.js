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

export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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
 */
export function resolveRange(range, from, to) {
  const t = today();
  switch (range) {
    case 'today': return { from: t, to: t };
    case 'week': return { from: startOfWeek(t), to: t };
    case 'month': return { from: startOfMonth(t), to: t };
    case 'custom': return { from: from || null, to: to || null };
    default: return { from: from || null, to: to || null };
  }
}
