import bcrypt from 'bcryptjs';
import { getDb } from '../db/index.js';
import config from '../config/env.js';
import { nowIso, today } from '../utils/dates.js';
import { conflict, notFound } from '../utils/errors.js';
import { taskCountsByEmployee } from './task.js';
import { MANAGER_ROLES } from '../utils/roles.js';

/** Columns that are safe to return to a client — never includes password_hash. */
const PUBLIC_COLUMNS = `id, name, email, role, department, job_title, phone, profile_image, is_active, created_at, updated_at`;

/**
 * Whether the account is still waiting to be claimed, derived in SQL so the hash it
 * is derived from never leaves the database. Selected alongside PUBLIC_COLUMNS by the
 * roster queries, which is where a manager needs to see who has not signed in yet.
 */
const INVITED_COLUMN = `CASE WHEN password_hash IS NULL THEN 1 ELSE 0 END AS invited`;

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

/**
 * Creates an account.
 *
 * `password` is optional. Omitting it creates an *invited* account: password_hash is
 * NULL, which is the single source of truth for "this person has been added but has
 * not claimed the account yet". Such an account cannot sign in — login compares
 * against a hash, and there is none — until `setInitialPassword` fills it in.
 */
export async function createUser({ name, email, password, role, department, jobTitle, phone, profileImage }) {
  const db = await getDb();
  if (await findByEmail(email)) throw conflict('An account with that email already exists.');
  const ts = nowIso();
  const passwordHash = password ? await hashPassword(password) : null;
  const id = await db.insert(
    `INSERT INTO users (name, email, password_hash, role, department, job_title, phone, profile_image, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [name, email.toLowerCase(), passwordHash, role, department ?? null,
      jobTitle ?? null, phone ?? null, profileImage ?? null, ts, ts],
  );
  return findById(id);
}

/**
 * The invited account for an email, or null.
 *
 * "Invited" means all three of: the account exists, it is active, and it has no
 * password yet. Anything else — unknown email, deactivated account, or one whose
 * owner has already chosen a password — returns null, so a caller cannot tell those
 * cases apart.
 */
export async function findInvitedByEmail(email) {
  const db = await getDb();
  const row = await db.get(
    `SELECT id, name, email, role, is_active FROM users
      WHERE LOWER(email) = LOWER(?) AND password_hash IS NULL`,
    [email],
  );
  return row && row.is_active ? row : null;
}

/**
 * Sets the password on an invited account, claiming it.
 *
 * The `password_hash IS NULL` guard is in the UPDATE rather than checked beforehand,
 * so two requests racing to claim the same invite cannot both succeed — the second
 * one matches no rows. Returns the claimed user, or null if the invite was already
 * taken, the account does not exist, or it is deactivated.
 */
export async function setInitialPassword(email, password) {
  const db = await getDb();
  const res = await db.run(
    `UPDATE users SET password_hash = ?, updated_at = ?
      WHERE LOWER(email) = LOWER(?) AND password_hash IS NULL AND is_active = 1`,
    [await hashPassword(password), nowIso(), email],
  );
  if (!res.changes) return null;
  return findByEmail(email);
}

/**
 * The identity `requireAuth` attaches to each request.
 *
 * Deliberately raw (not run through `toPublicUser`) because the middleware compares
 * `is_active` directly, and returns null for a missing or deactivated account so the
 * caller has a single case to handle.
 */
export async function findAuthUser(id) {
  const db = await getDb();
  const user = await db.get(
    `SELECT id, name, email, role, department, job_title, phone, profile_image, is_active
       FROM users WHERE id = ?`,
    [id],
  );
  return user && user.is_active ? user : null;
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
    `SELECT ${PUBLIC_COLUMNS}, ${INVITED_COLUMN} FROM users WHERE ${where.join(' AND ')} ORDER BY name ASC`,
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
      invited: Boolean(row.invited),
      counts: c,
      current_status: currentStatus,
      last_report_date: lastReport.get(Number(row.id)) || null,
      submitted_today: lastReport.get(Number(row.id)) === t,
    };
  });
}

/**
 * Everyone with manager-level access — admins as well as managers, since an admin
 * holds every manager right plus account administration. This list is how the Admins
 * tab shows who currently holds that access, so it must not omit admins.
 */
export async function listManagers({ search } = {}) {
  const db = await getDb();
  const roleList = MANAGER_ROLES.map((r) => `'${r}'`).join(', ');
  // Admins first, then managers, alphabetical within each tier.
  const where = [`role IN (${roleList})`];
  const params = [];
  if (search) {
    where.push("(LOWER(name) LIKE ? OR LOWER(email) LIKE ? OR LOWER(COALESCE(department, '')) LIKE ?)");
    const like = `%${search.toLowerCase()}%`;
    params.push(like, like, like);
  }

  const rows = await db.query(
    `SELECT ${PUBLIC_COLUMNS}, ${INVITED_COLUMN} FROM users WHERE ${where.join(' AND ')}
      ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, name ASC`,
    params,
  );

  // How much each manager currently has out with the team, so the list is not just names.
  const assigned = await db.query(
    `SELECT manager_id,
            COUNT(*) AS total,
            SUM(CASE WHEN status <> 'completed' THEN 1 ELSE 0 END) AS open
       FROM assigned_tasks GROUP BY manager_id`,
  );
  const byManager = new Map(assigned.map((r) => [Number(r.manager_id), {
    assigned_tasks: Number(r.total),
    open_tasks: Number(r.open),
  }]));

  return rows.map((row) => ({
    ...toPublicUser(row),
    invited: Boolean(row.invited),
    ...(byManager.get(Number(row.id)) || { assigned_tasks: 0, open_tasks: 0 }),
  }));
}

/**
 * Permanently removes a team member.
 *
 * Restricted to `role = 'team_member'` in the WHERE clause, not merely checked
 * beforehand: `assigned_tasks.manager_id` also cascades, so deleting a manager-level
 * account through this path would take every task they had ever assigned to anyone
 * with it. Removing an employee only ever reaches their own rows.
 *
 * Returns what was destroyed, counted before the delete, so the caller can report it
 * honestly rather than saying "deleted" and leaving the scale of it unsaid.
 */
export async function deleteTeamMember(employeeId) {
  const db = await getDb();
  const row = await db.get(
    `SELECT id, name, email FROM users WHERE id = ? AND role = 'team_member'`,
    [employeeId],
  );
  if (!row) throw notFound('That team member could not be found.');

  const [reports, tasks, tickets] = await Promise.all([
    db.get('SELECT COUNT(*) AS c FROM daily_task_reports WHERE employee_id = ?', [employeeId]),
    db.get('SELECT COUNT(*) AS c FROM assigned_tasks WHERE employee_id = ?', [employeeId]),
    db.get('SELECT COUNT(*) AS c FROM tickets WHERE reporter_id = ?', [employeeId]),
  ]);

  // Every child table references users(id) ON DELETE CASCADE, so this one statement
  // takes their reports, tasks, tickets and notifications with it.
  await db.run(`DELETE FROM users WHERE id = ? AND role = 'team_member'`, [employeeId]);

  return {
    name: row.name,
    email: row.email,
    removed: {
      reports: Number(reports?.c || 0),
      tasks: Number(tasks?.c || 0),
      tickets: Number(tickets?.c || 0),
    },
  };
}

export async function getTeamMember(employeeId) {
  const db = await getDb();
  const row = await db.get(
    `SELECT ${PUBLIC_COLUMNS}, ${INVITED_COLUMN} FROM users WHERE id = ? AND role = 'team_member'`,
    [employeeId],
  );
  if (!row) throw notFound('That team member could not be found.');
  const counts = (await taskCountsByEmployee()).get(Number(employeeId))
    || { total: 0, pending: 0, in_progress: 0, completed: 0, overdue: 0 };
  const reportCount = await db.get('SELECT COUNT(*) AS c FROM daily_task_reports WHERE employee_id = ?', [employeeId]);
  return {
    ...toPublicUser(row), invited: Boolean(row.invited), counts, report_count: Number(reportCount?.c || 0),
  };
}
