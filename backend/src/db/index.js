/**
 * Database access layer.
 *
 * Exposes one small async API (`query` / `get` / `insert` / `run` / `transaction`)
 * over two drivers:
 *   - postgres : the production target, used whenever DATABASE_URL is configured
 *   - sqlite   : Node's built-in `node:sqlite`, used for zero-setup local runs
 *
 * All SQL in the app is written once with `?` placeholders and portable types
 * (dates/timestamps are stored as ISO-8601 TEXT, booleans as 0/1 integers), so the
 * same statements execute unchanged on both drivers. Every value is bound as a
 * parameter — string interpolation into SQL never happens, which is what keeps the
 * app safe from SQL injection.
 */
import fs from 'node:fs';
import path from 'node:path';
import config from '../config/env.js';

/** Rewrite `?` placeholders to postgres `$1..$n`, ignoring `?` inside string literals. */
function toPgPlaceholders(sql) {
  let out = '';
  let index = 0;
  let inString = false;
  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    if (ch === "'") inString = !inString;
    if (ch === '?' && !inString) {
      index += 1;
      out += `$${index}`;
    } else {
      out += ch;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ sqlite */

function createSqliteDriver() {
  const { DatabaseSync } = require_sqlite();
  fs.mkdirSync(path.dirname(config.db.sqliteFile), { recursive: true });
  const handle = new DatabaseSync(config.db.sqliteFile);
  handle.exec('PRAGMA journal_mode = WAL;');
  handle.exec('PRAGMA foreign_keys = ON;');

  // node:sqlite rejects `undefined` and booleans; normalise to null / 0|1.
  const clean = (params = []) =>
    params.map((p) => {
      if (p === undefined) return null;
      if (typeof p === 'boolean') return p ? 1 : 0;
      return p;
    });

  const api = {
    dialect: 'sqlite',
    async query(sql, params = []) {
      return handle.prepare(sql).all(...clean(params)).map((r) => ({ ...r }));
    },
    async get(sql, params = []) {
      const row = handle.prepare(sql).get(...clean(params));
      return row ? { ...row } : null;
    },
    async run(sql, params = []) {
      const res = handle.prepare(sql).run(...clean(params));
      return { changes: Number(res.changes) };
    },
    async insert(sql, params = []) {
      const res = handle.prepare(sql).run(...clean(params));
      return Number(res.lastInsertRowid);
    },
    async exec(sql) {
      handle.exec(sql);
    },
    async transaction(fn) {
      handle.exec('BEGIN');
      try {
        const result = await fn(api);
        handle.exec('COMMIT');
        return result;
      } catch (err) {
        try { handle.exec('ROLLBACK'); } catch { /* already rolled back */ }
        throw err;
      }
    },
    async close() { handle.close(); },
  };
  return api;
}

/** node:sqlite is a builtin; load it lazily so the postgres path never touches it. */
function require_sqlite() {
  // eslint-disable-next-line global-require
  return globalThis.__sqliteModule;
}

/* ---------------------------------------------------------------- postgres */

async function createPostgresDriver() {
  const { default: pg } = await import('pg');
  // Return DATE/TIMESTAMP columns as plain strings so both drivers agree.
  pg.types.setTypeParser(1082, (v) => v);
  pg.types.setTypeParser(1114, (v) => v);
  pg.types.setTypeParser(1184, (v) => v);
  pg.types.setTypeParser(20, (v) => Number(v)); // bigint (counts) -> number

  const pool = new pg.Pool({
    connectionString: config.db.url,
    ssl: config.db.ssl ? { rejectUnauthorized: false } : undefined,
    max: 10,
  });

  const wrap = (executor) => ({
    dialect: 'postgres',
    async query(sql, params = []) {
      const res = await executor.query(toPgPlaceholders(sql), params);
      return res.rows;
    },
    async get(sql, params = []) {
      const res = await executor.query(toPgPlaceholders(sql), params);
      return res.rows[0] ?? null;
    },
    async run(sql, params = []) {
      const res = await executor.query(toPgPlaceholders(sql), params);
      return { changes: res.rowCount };
    },
    async insert(sql, params = []) {
      const withReturning = /returning/i.test(sql) ? sql : `${sql} RETURNING id`;
      const res = await executor.query(toPgPlaceholders(withReturning), params);
      return res.rows[0]?.id;
    },
    async exec(sql) {
      await executor.query(sql);
    },
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(wrap(client));
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
    async close() { await pool.end(); },
  });

  return wrap(pool);
}

/* ------------------------------------------------------------------ facade */

let instance = null;

export async function getDb() {
  if (instance) return instance;
  if (config.db.client === 'postgres') {
    instance = await createPostgresDriver();
  } else {
    globalThis.__sqliteModule = await import('node:sqlite');
    instance = createSqliteDriver();
  }
  return instance;
}

export async function closeDb() {
  if (instance) {
    await instance.close();
    instance = null;
  }
}

export default { getDb, closeDb };
