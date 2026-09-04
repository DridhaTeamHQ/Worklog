/**
 * Runs the reminder job against a local API, the way Vercel Cron would in production.
 *
 *   npm run jobs:tick              -- whatever is due at this hour
 *   npm run jobs:tick -- --force   -- everything, regardless of the hour (not in production)
 *
 * Reads CRON_SECRET and API_URL from backend/.env.
 */
import 'dotenv/config';

const BASE = (process.env.API_URL || 'http://localhost:4000').replace(/\/$/, '');
const force = process.argv.includes('--force') ? '?force=all' : '';
const secret = process.env.CRON_SECRET;
if (!secret) {
  console.error('CRON_SECRET is not set in backend/.env');
  process.exit(1);
}
const res = await fetch(`${BASE}/api/jobs/tick${force}`, { headers: { Authorization: `Bearer ${secret}` } });
const body = await res.json().catch(() => null);
console.log(res.status, JSON.stringify(body, null, 2));
process.exit(res.ok ? 0 : 1);
