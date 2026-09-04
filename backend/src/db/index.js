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

/**
 * Runs the hooks a transaction queued with `tx.afterCommit(fn)`, once its COMMIT has
 * succeeded. A hook is for work that must see the committed rows but must not be able
 * to roll them back — sending a push notification is the case that exists today.
 *
 * Hooks are awaited, not fired and forgotten: on a serverless host the function is
 * frozen the moment the response is sent, so anything still in flight would be lost.
 * Each hook is bounded by its own timeout (see services/push.js) and a rejection is
 * logged rather than thrown — the transaction already succeeded, and the caller must
 * hear that it did.
 */
async function runAfterCommit(hooks) {
  if (!hooks.length) return;
  const results = await Promise.allSettled(hooks.map((hook) => Promise.resolve().then(hook)));
  for (const r of results) {
    if (r.status === 'rejected') console.error('[db] afterCommit hook failed:', r.reason?.message || r.reason);
  }
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
      const hooks = [];
      // The same API plus `afterCommit`; the shared object is never mutated, so two
      // overlapping transactions cannot see each other's hooks.
      const tx = { ...api, afterCommit: (hook) => hooks.push(hook) };
      handle.exec('BEGIN');
      let result;
      try {
        result = await fn(tx);
        handle.exec('COMMIT');
      } catch (err) {
        try { handle.exec('ROLLBACK'); } catch { /* already rolled back */ }
        throw err;
      }
      await runAfterCommit(hooks);
      return result;
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
    max: config.db.poolMax,
    // Fail fast rather than holding a serverless invocation open for its whole
    // timeout while a connection that is never going to arrive is waited on.
    connectionTimeoutMillis: 10_000,
    // Retire connections before a managed pooler decides to. Supabase closes idle
    // connections on its own schedule, and a client the pool still believes is good
    // is exactly the one that fails on the next request.
    idleTimeoutMillis: 30_000,
    keepAlive: true,
  });

  /*
   * REQUIRED, not defensive. `pg.Pool` emits 'error' when a client sitting idle in the
   * pool dies — which a hosted Postgres does routinely, and every laptop does on sleep.
   * An 'error' event with no listener is fatal in Node, so without this the whole API
   * process is killed by a dropped background connection and every later request gets
   * connection refused.
   *
   * The pool discards the dead client by itself; the next query opens a fresh one. So
   * the right response is to record it and carry on, never to exit.
   */
  pool.on('error', (err) => {
    console.error('[db] idle postgres connection dropped:', err.message);
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
      const hooks = [];
      const tx = wrap(client);
      tx.afterCommit = (hook) => hooks.push(hook);
      let result;
      try {
        await client.query('BEGIN');
        result = await fn(tx);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
      await runAfterCommit(hooks);
      return result;
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
