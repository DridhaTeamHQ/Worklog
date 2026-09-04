/**
 * Puts a little realistic work into a LOCAL database so the apps have something to
 * show: a few labels, tasks for the test employees (one overdue, one due tomorrow,
 * one in progress with a checklist), a ticket and a comment.
 *
 *   node scripts/seed-demo.js        (after scripts/setup-test-accounts.js)
 *
 * Never run against production — it creates real rows.
 */
import 'dotenv/config';

const BASE = (process.argv[2] || process.env.API_URL || 'http://localhost:4000').replace(/\/$/, '');
const API = `${BASE}/api`;
const admin = { email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD };
const employeePassword = process.env.TEST_EMPLOYEE_PASSWORD || 'TestEmployee@2026';

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${payload?.error?.message || ''}`);
  return payload?.data;
}

const day = (offset) => {
  const d = new Date(); d.setDate(d.getDate() + offset);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const adminToken = (await api('/auth/login', { method: 'POST', body: admin })).token;
const team = await api('/team', { token: adminToken });
const projects = await api('/projects', { token: adminToken });
const employee = team.find((m) => m.email === 'test.employee@company.com') || team[0];
const other = team.find((m) => m.email === 'other.employee@company.com') || team[1] || employee;
const byKey = (k) => projects.find((p) => p.project_key === k) || projects[0];

const labels = await api('/labels', { token: adminToken });
const label = async (name, color) => labels.find((l) => l.name === name) || api('/labels', { method: 'POST', token: adminToken, body: { name, color } });
const backend = await label('backend', '#5B7FE8');
const customer = await label('customer-facing', '#EC4899');
const blocked = await label('blocked', '#E5484D');

const empToken = (await api('/auth/login', { method: 'POST', body: { email: employee.email, password: employeePassword } })).token;

const tasks = [
  { employeeId: employee.id, projectId: byKey('SHMOB').id, title: 'Fix checkout crash on double-tap', description: 'Tapping Pay twice creates two orders. Debounce the button and make the order endpoint idempotent.', priority: 'urgent', startDate: day(-6), deadline: day(-2), labelIds: [backend.id, customer.id], status: 'in_progress' },
  { employeeId: employee.id, projectId: byKey('SHMOB').id, title: 'Design the new order-history screen', description: 'Bento-style cards, one per order, with status chips.', priority: 'high', startDate: day(-3), deadline: day(1), labelIds: [customer.id], status: 'in_progress', checklist: ['Wireframe in Figma', 'Review with Priya', 'Build the list', 'Empty and error states'] },
  { employeeId: employee.id, projectId: byKey('PLAT').id, title: 'Rotate the staging database credentials', description: 'Quarterly rotation. Update the Vercel env and the two cron jobs.', priority: 'medium', startDate: day(0), deadline: day(7), labelIds: [backend.id], status: 'pending' },
  { employeeId: employee.id, projectId: byKey('WEB').id, title: 'Publish the September changelog', description: '', priority: 'low', startDate: day(-10), deadline: day(-4), labelIds: [], status: 'completed' },
  { employeeId: other.id, projectId: byKey('WEB').id, title: 'Compress the hero images', description: 'The landing page LCP is 4.1s on mobile.', priority: 'high', startDate: day(-2), deadline: day(3), labelIds: [customer.id, blocked.id], status: 'pending' },
];

for (const t of tasks) {
  const { status, checklist, ...body } = t;
  const { task } = await api('/tasks', { method: 'POST', token: adminToken, body });
  const owner = t.employeeId === employee.id ? empToken : adminToken;
  if (status !== 'pending') await api(`/tasks/${task.id}/status`, { method: 'PATCH', token: owner, body: { status } });
  for (const title of checklist || []) await api(`/tasks/${task.id}/checklist`, { method: 'POST', token: owner, body: { title } });
  if (checklist?.length) {
    const items = await api(`/tasks/${task.id}/checklist`, { token: owner });
    await api(`/tasks/${task.id}/checklist/${items[0].id}`, { method: 'PATCH', token: owner, body: { isDone: true } });
    await api(`/tasks/${task.id}/checklist/${items[1].id}`, { method: 'PATCH', token: owner, body: { isDone: true } });
  }
  if (t.priority === 'urgent') {
    await api(`/tasks/${task.id}/comments`, { method: 'POST', token: empToken, body: { body: 'Reproduced on iOS 18. The second POST lands 40ms after the first — idempotency key on the order should fix it.', mentions: [] } });
    await api(`/tasks/${task.id}/comments`, { method: 'POST', token: adminToken, body: { body: 'Agreed, go with the idempotency key. Ship behind a flag if it needs more testing.', mentions: [employee.id] } });
    await api('/tickets', { method: 'POST', token: empToken, body: { projectId: t.projectId, taskId: task.id, title: 'Duplicate orders on slow networks', description: 'Steps: throttle to 3G, tap Pay twice.\nExpected: one order.\nActual: two orders, two charges.', severity: 'critical' } });
  }
  console.log(`seeded ${task.task_key} ${task.title}`);
}
console.log('done');
