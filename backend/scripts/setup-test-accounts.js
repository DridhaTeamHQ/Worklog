/**
 * Creates the accounts `npm test` (scripts/test-flow.js) needs, against a local API,
 * and prints the environment variables to run it with.
 *
 *   node scripts/setup-test-accounts.js [baseUrl]
 *
 * Requires SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (the seeded admin) in backend/.env.
 * Idempotent: existing accounts are left alone. Never run it against production —
 * it creates real users.
 */
import 'dotenv/config';

const BASE = (process.argv[2] || process.env.API_URL || 'http://localhost:4000').replace(/\/$/, '');
const API = `${BASE}/api`;
const admin = { email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD };
const EMPLOYEE_PASSWORD = process.env.TEST_EMPLOYEE_PASSWORD || 'TestEmployee@2026';
const people = [
  { name: 'Test Employee', email: 'test.employee@company.com', department: 'Engineering', jobTitle: 'Developer' },
  { name: 'Other Employee', email: 'other.employee@company.com', department: 'Engineering', jobTitle: 'Developer' },
  { name: 'Third Employee', email: 'third.employee@company.com', department: 'Design', jobTitle: 'Designer' },
];
// The suite also expects a few projects to exist before it starts.
const projects = [
  { name: 'Shop Mobile', key: 'SHMOB', description: 'The mobile shopping app.' },
  { name: 'Platform', key: 'PLAT', description: 'Shared platform services.' },
  { name: 'Website', key: 'WEB', description: 'The public website.' },
];

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await res.json().catch(() => null);
  return { status: res.status, data: payload?.data, error: payload?.error };
}

if (!admin.email || !admin.password) {
  console.error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in backend/.env');
  process.exit(1);
}

const login = await api('/auth/login', { method: 'POST', body: admin });
if (login.status !== 200) {
  console.error('admin login failed:', login.status, login.error?.message);
  process.exit(1);
}
const token = login.data.token;

for (const person of people) {
  const created = await api('/team', { method: 'POST', token, body: person });
  if (created.status === 201) console.log(`created ${person.email}`);
  else if (created.status === 409) console.log(`exists  ${person.email}`);
  else { console.error(`failed  ${person.email}:`, created.status, created.error?.message); process.exit(1); }

  const claim = await api('/auth/accept-invite', { method: 'POST', body: { email: person.email, password: EMPLOYEE_PASSWORD } });
  if (claim.status === 200) console.log(`claimed ${person.email}`);
  else console.log(`already claimed ${person.email}`);
}

for (const project of projects) {
  const made = await api('/projects', { method: 'POST', token, body: project });
  if (made.status === 201) console.log(`created project ${project.key}`);
  else if (made.status === 409) console.log(`exists  project ${project.key}`);
  else { console.error(`failed  project ${project.key}:`, made.status, made.error?.message); process.exit(1); }
}

console.log('\nRun the suite with these environment variables:');
console.log(`  TEST_MANAGER_EMAIL=${admin.email}`);
console.log(`  TEST_MANAGER_PASSWORD=${admin.password}`);
console.log(`  TEST_EMPLOYEE_EMAIL=${people[0].email}`);
console.log(`  TEST_EMPLOYEE_PASSWORD=${EMPLOYEE_PASSWORD}`);
console.log(`  TEST_OTHER_EMPLOYEE_EMAIL=${people[1].email}`);
