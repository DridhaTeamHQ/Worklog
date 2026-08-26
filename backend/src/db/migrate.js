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

  for (const statement of statements.filter((s) => !isCreateTable(s))) {
    await db.exec(statement);
  }

  const backfilled = await backfillProjects(db);

  return { driver: config.db.client, fresh, added, backfilled };
}

const isEntry = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isEntry) {
  const fresh = process.argv.includes('--fresh');
  migrate({ fresh })
    .then(async (r) => {
      console.log(`[migrate] schema ready (driver=${r.driver}${r.fresh ? ', fresh' : ''})`);
      if (r.added.length) console.log(`[migrate] added columns: ${r.added.join(', ')}`);
      if (r.backfilled) console.log(`[migrate] moved ${r.backfilled} existing task(s) into the ${DEFAULT_PROJECT.key} project`);
      if (config.db.client === 'sqlite') console.log(`[migrate] file: ${config.db.sqliteFile}`);
      await closeDb();
    })
    .catch((err) => {
      console.error('[migrate] failed:', err.message);
      process.exit(1);
    });
}
