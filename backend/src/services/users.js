import bcrypt from 'bcryptjs';
import { getDb } from '../db/index.js';
import config from '../config/env.js';
import { nowIso, today } from '../utils/dates.js';
import { conflict, notFound } from '../utils/errors.js';
import { taskCountsByEmployee } from './tasks.js';

/** Columns that are safe to return to a client — never includes password_hash. */
const PUBLIC_COLUMNS = `id, name, email, role, department, job_title, phone, profile_image, is_active, created_at, updated_at`;

export const toPublicUser = (row) => {
  if (!row) return null;
  const { password_hash: _ignored, ...rest } = row;
  return { ...rest, is_active: Boolean(rest.is_active) };
};

export async function findByEmail(email) {
  const db = await getDb();
  return db.get('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email]);
}

/**
 * Always returned through `toPublicUser` so `is_active` is a real boolean rather than
 * the driver's 0/1, keeping every endpoint that returns a user consistent.
 */
export async function findById(id) {
  const db = await getDb();
  return toPublicUser(await db.get(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ?`, [id]));
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, config.auth.bcryptRounds);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export async function createUser({ name, email, password, role, department, jobTitle, phone, profileImage }) {
  const db = await getDb();
  if (await findByEmail(email)) throw conflict('An account with that email already exists.');
  const ts = nowIso();
  const id = await db.insert(
    `INSERT INTO users (name, email, password_hash, role, department, job_title, phone, profile_image, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [name, email.toLowerCase(), await hashPassword(password), role, department ?? null,
      jobTitle ?? null, phone ?? null, profileImage ?? null, ts, ts],
  );
  return findById(id);
}

export async function updateProfile(userId, patch) {
  const db = await getDb();
  const columns = {
    name: patch.name,
    department: patch.department,
    job_title: patch.jobTitle,
    phone: patch.phone,
    profile_image: patch.profileImage,
  };
  const sets = [];
  const params = [];
  for (const [col, val] of Object.entries(columns)) {
    if (val !== undefined) { sets.push(`${col} = ?`); params.push(val); }
  }
  if (!sets.length) return findById(userId);
  sets.push('updated_at = ?');
  params.push(nowIso(), userId);
  await db.run(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
  return findById(userId);
}

export async function changePassword(userId, newPassword) {
  const db = await getDb();
  const res = await db.run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [
    await hashPassword(newPassword), nowIso(), userId,
  ]);
  if (!res.changes) throw notFound('Account not found.');
  return true;
}

/**
 * Departments that actually contain team members. Managers' own departments are
 * excluded because this list only ever feeds filters over the employee roster, where
 * such an option could never match anything.
 */
export async function listDepartments() {
  const db = await getDb();
  const rows = await db.query(
    `SELECT DISTINCT department FROM users
      WHERE role = 'team_member' AND department IS NOT NULL AND department <> ''
      ORDER BY department`,
  );
  return rows.map((r) => r.department);
}

/**
 * The manager's Team Members list: every employee with their task counts and a
 * "current status" summarising what they are working on right now.
 */
export async function listTeamMembers({ search, department, status } = {}) {
  const db = await getDb();
  const where = ["role = 'team_member'"];
  const params = [];
  if (department) { where.push('department = ?'); params.push(department); }
  if (search) {
    where.push('(LOWER(name) LIKE ? OR LOWER(email) LIKE ? OR LOWER(COALESCE(department, \'\')) LIKE ?)');
    const like = `%${search.toLowerCase()}%`;
    params.push(like, like, like);
  }

  const rows = await db.query(
    `SELECT ${PUBLIC_COLUMNS} FROM users WHERE ${where.join(' AND ')} ORDER BY name ASC`,
    params,
  );
  const counts = await taskCountsByEmployee();
  const t = today();

  const reportRows = await db.query(
    `SELECT employee_id, MAX(report_date) AS last_report_date FROM daily_task_reports GROUP BY employee_id`,
  );
  const lastReport = new Map(reportRows.map((r) => [Number(r.employee_id), r.last_report_date]));

  return rows.map((row) => {
    const c = counts.get(Number(row.id)) || { total: 0, pending: 0, in_progress: 0, completed: 0, overdue: 0 };
    // Show the most pressing thing first: overdue beats active beats waiting.
    const currentStatus = c.overdue > 0 ? 'overdue'
      : c.in_progress > 0 ? 'in_progress'
        : c.pending > 0 ? 'pending'
          : c.total > 0 ? 'completed' : 'idle';
    return {
      ...toPublicUser(row),
      counts: c,
      current_status: currentStatus,
      last_report_date: lastReport.get(Number(row.id)) || null,
      submitted_today: lastReport.get(Number(row.id)) === t,
    };
  });
}

export async function getTeamMember(employeeId) {
  const db = await getDb();
  const row = await db.get(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ? AND role = 'team_member'`, [employeeId]);
  if (!row) throw notFound('That team member could not be found.');
  const counts = (await taskCountsByEmployee()).get(Number(employeeId))
    || { total: 0, pending: 0, in_progress: 0, completed: 0, overdue: 0 };
  const reportCount = await db.get('SELECT COUNT(*) AS c FROM daily_task_reports WHERE employee_id = ?', [employeeId]);
  return { ...toPublicUser(row), counts, report_count: Number(reportCount?.c || 0) };
}
