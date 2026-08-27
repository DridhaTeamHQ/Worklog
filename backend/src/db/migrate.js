/**
 * Creates the schema for whichever driver is configured, then applies any upgrade
 * steps an already-populated database still needs.
 *
 * Usage: node src/db/migrate.js [--fresh]
 *   --fresh  drop existing tables first (destructive; development convenience)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../config/env.js';
import { getDb, closeDb } from './index.js';
import { ALL_ROLES } from '../utils/roles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ordered child-first so foreign keys never block a --fresh rebuild.
const TABLES = [
  'password_reset_tokens',
  'notifications',
  'tickets',
  'assigned_tasks',
  'projects',
  'daily_task_reports',
  'users',
];

/** Default project that pre-existing tasks are moved into by the upgrade step. */
const DEFAULT_PROJECT = {
  name: 'General',
  key: 'GEN',
  description: 'Tasks created before projects existed.',
};

async function listColumns(db, table) {
  if (db.dialect === 'postgres') {
    const rows = await db.query(
      'SELECT column_name AS name FROM information_schema.columns WHERE table_name = ?',
      [table],
    );
    return rows.map((r) => r.name);
  }
  const rows = await db.query(`PRAGMA table_info(${table})`);
  return rows.map((r) => r.name);
}

/**
 * `CREATE TABLE IF NOT EXISTS` cannot add a column to a table that already exists,
 * so columns introduced after the first release are applied here instead.
 */
async function ensureColumn(db, table, column, definition) {
  const columns = await listColumns(db, table);
  if (columns.includes(column)) return false;
  await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  return true;
}

/**
 * Widens the `users.role` CHECK constraint so that 'admin' is accepted.
 *
 * `CREATE TABLE IF NOT EXISTS` does nothing on a database that already has the table,
 * so a database created before the admin role existed keeps the old two-value
 * constraint and rejects every admin INSERT. This brings it forward in place, without
 * touching the rows.
 *
 * Returns true when it actually changed something.
 */
async function ensureRoleConstraint(db) {
  const allowed = ALL_ROLES.map((r) => `'${r}'`).join(', ');

  if (db.dialect === 'postgres') {
    const row = await db.get(
      `SELECT conname, pg_get_constraintdef(oid) AS def
         FROM pg_constraint
        WHERE conrelid = 'users'::regclass AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%role%'`,
    );
    // No constraint at all, or one that already lists every role: nothing to do.
    if (!row) return false;
    if (ALL_ROLES.every((r) => row.def.includes(`'${r}'`))) return false;

    await db.exec(`ALTER TABLE users DROP CONSTRAINT ${row.conname}`);
    await db.exec(`ALTER TABLE users ADD CONSTRAINT ${row.conname} CHECK (role IN (${allowed}))`);
    return true;
  }

  // SQLite cannot alter a CHECK constraint, so the table is rebuilt. The rebuild only
  // runs when the constraint is genuinely out of date, which on a fresh database is
  // never.
  const table = await db.get(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'",
  );
  if (!table?.sql) return false;
  if (ALL_ROLES.every((r) => table.sql.includes(`'${r}'`))) return false;

  const rebuilt = table.sql.replace(
    /CHECK\s*\(\s*role\s+IN\s*\([^)]*\)\s*\)/i,
    `CHECK (role IN (${allowed}))`,
  );
  if (rebuilt === table.sql) return false;

  // Foreign keys are disabled for the swap: every child table references users(id)
  // ON DELETE CASCADE, and dropping the old table with them enabled would cascade the
  // entire database away.
  await db.exec('PRAGMA foreign_keys = OFF');
  try {
    await db.exec(rebuilt.replace(/CREATE TABLE\s+(IF NOT EXISTS\s+)?users/i, 'CREATE TABLE users_rolefix'));
    await db.exec('INSERT INTO users_rolefix SELECT * FROM users');
    await db.exec('DROP TABLE users');
    await db.exec('ALTER TABLE users_rolefix RENAME TO users');
  } finally {
    await db.exec('PRAGMA foreign_keys = ON');
  }
  return true;
}

/**
 * Drops the NOT NULL on `users.password_hash`.
 *
 * An invited account has no password until the person chooses one, and NULL is how
 * that is recorded. A database created before invites existed still refuses the
 * insert, so the constraint is relaxed in place without touching any row.
 *
 * Returns true when it actually changed something.
 */
async function ensurePasswordHashNullable(db) {
  if (db.dialect === 'postgres') {
    // Scoped to the current schema on purpose. A managed Postgres can hold several
    // tables called "users" that this role can see — Supabase ships `auth.users` —
    // and an unqualified lookup would read whichever one the planner returned first.
    const row = await db.get(
      `SELECT is_nullable FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'users' AND column_name = 'password_hash'`,
    );
    if (!row || row.is_nullable === 'YES') return false;
    await db.exec('ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL');
    return true;
  }

  // SQLite cannot relax a column constraint, so the table is rebuilt — the same
  // approach `ensureRoleConstraint` uses, and equally a no-op on a fresh database.
  const table = await db.get(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'",
  );
  if (!table?.sql) return false;

  const rebuilt = table.sql.replace(/(password_hash\s+TEXT)\s+NOT\s+NULL/i, '$1');
  if (rebuilt === table.sql) return false;

  // Foreign keys off for the swap: every child table references users(id) ON DELETE
  // CASCADE, and dropping the old table with them enabled would cascade the database
  // away. Columns are listed explicitly so the copy does not depend on column order.
  await db.exec('PRAGMA foreign_keys = OFF');
  try {
    await db.exec(rebuilt.replace(/CREATE TABLE\s+(IF NOT EXISTS\s+)?users/i, 'CREATE TABLE users_pwfix'));
    await db.exec(`INSERT INTO users_pwfix
      (id, name, email, password_hash, role, department, job_title, phone, profile_image, is_active, created_at, updated_at)
      SELECT id, name, email, password_hash, role, department, job_title, phone, profile_image, is_active, created_at, updated_at
      FROM users`);
    await db.exec('DROP TABLE users');
    await db.exec('ALTER TABLE users_pwfix RENAME TO users');
  } finally {
    await db.exec('PRAGMA foreign_keys = ON');
  }
  return true;
}

/**
 * Moves any task that predates projects into a default project and numbers it, so
 * every task ends up with a stable key like GEN-1. Runs only when such tasks exist.
 */
async function backfillProjects(db) {
  const orphans = await db.query(
    'SELECT id FROM assigned_tasks WHERE project_id IS NULL ORDER BY created_at ASC, id ASC',
  );
  if (orphans.length === 0) return 0;

  const now = new Date().toISOString();
  let project = await db.get('SELECT id FROM projects WHERE project_key = ?', [DEFAULT_PROJECT.key]);
  if (!project) {
    const id = await db.insert(
      `INSERT INTO projects (name, project_key, description, lead_id, is_archived, created_at, updated_at)
       VALUES (?, ?, ?, NULL, 0, ?, ?)`,
      [DEFAULT_PROJECT.name, DEFAULT_PROJECT.key, DEFAULT_PROJECT.description, now, now],
    );
    project = { id };
  }

  const highest = await db.get(
    'SELECT COALESCE(MAX(task_number), 0) AS n FROM assigned_tasks WHERE project_id = ?',
    [project.id],
  );
  let next = Number(highest?.n || 0);

  for (const task of orphans) {
    next += 1;
    await db.run(
      'UPDATE assigned_tasks SET project_id = ?, task_number = ? WHERE id = ?',
      [project.id, next, task.id],
    );
  }
  return orphans.length;
}

export async function migrate({ fresh = false } = {}) {
  const db = await getDb();
  const file = config.db.client === 'postgres' ? 'schema.postgres.sql' : 'schema.sqlite.sql';
  const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');

  if (fresh) {
    for (const table of TABLES) {
      try {
        await db.exec(`DROP TABLE IF EXISTS ${table} CASCADE`);
      } catch {
        await db.exec(`DROP TABLE IF EXISTS ${table}`);
      }
    }
  }

  const statements = sql
    .split(';')
    // Strip comment lines first: a commented header must not hide the statement.
    .map((chunk) => chunk.replace(/^[ \t]*--.*$/gm, '').trim())
    .filter(Boolean);

  /*
   * Tables are created before anything else, then missing columns are added, and only
   * then the indexes. The order matters on an existing database: `CREATE TABLE IF NOT
   * EXISTS assigned_tasks` is a no-op there, so an index over `project_id` would fail
   * unless the column has already been added by the upgrade step below.
   */
  const isCreateTable = (s) => /^CREATE\s+TABLE/i.test(s);

  for (const statement of statements.filter(isCreateTable)) {
    await db.exec(statement);
  }

  // Upgrade steps for databases created before projects existed. Both are no-ops on
  // a fresh database, where the schema file already defines the columns.
  const added = [];
  if (await ensureColumn(db, 'assigned_tasks', 'project_id', 'INTEGER REFERENCES projects (id) ON DELETE CASCADE')) {
    added.push('assigned_tasks.project_id');
  }
  if (await ensureColumn(db, 'assigned_tasks', 'task_number', 'INTEGER')) {
    added.push('assigned_tasks.task_number');
  }
  if (await ensureColumn(db, 'notifications', 'related_ticket_id', 'INTEGER REFERENCES tickets (id) ON DELETE CASCADE')) {
    added.push('notifications.related_ticket_id');
  }

  // Databases created before the admin role existed still reject role = 'admin'.
  const roleConstraintUpgraded = await ensureRoleConstraint(db);

  // Databases created before invites existed still require a password_hash.
  const passwordHashRelaxed = await ensurePasswordHashNullable(db);

  for (const statement of statements.filter((s) => !isCreateTable(s))) {
    await db.exec(statement);
  }

  const backfilled = await backfillProjects(db);

  return { driver: config.db.client, fresh, added, backfilled, roleConstraintUpgraded, passwordHashRelaxed };
}

const isEntry = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isEntry) {
  const fresh = process.argv.includes('--fresh');
  migrate({ fresh })
    .then(async (r) => {
      console.log(`[migrate] schema ready (driver=${r.driver}${r.fresh ? ', fresh' : ''})`);
      if (r.added.length) console.log(`[migrate] added columns: ${r.added.join(', ')}`);
      if (r.backfilled) console.log(`[migrate] moved ${r.backfilled} existing task(s) into the ${DEFAULT_PROJECT.key} project`);
      if (r.roleConstraintUpgraded) console.log("[migrate] users.role now accepts 'admin'");
      if (r.passwordHashRelaxed) console.log('[migrate] users.password_hash is now nullable (invited accounts)');
      if (config.db.client === 'sqlite') console.log(`[migrate] file: ${config.db.sqliteFile}`);
      await closeDb();
    })
    .catch((err) => {
      console.error('[migrate] failed:', err.message);
      process.exit(1);
    });
}
