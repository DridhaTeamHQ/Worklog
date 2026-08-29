/**
 * Bootstraps an empty database with the one account you cannot create through the UI:
 * the first admin. Everything else — people, projects, tasks, reports, tickets — is
 * entered through the app and lives only in the database.
 *
 * There is deliberately no sample content here. A seed script that invents employees
 * and tasks puts fictional rows into a real database, and they are tedious to tell
 * apart from genuine records later.
 *
 * Idempotent and safe to re-run: it does nothing once an admin exists.
 *
 * Configure with SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (see .env.example).
 * Usage: node src/db/seed.js
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../config/env.js';
import { getDb, closeDb } from './index.js';
import { migrate } from './migrate.js';
import { createUser, findByEmail, hashPassword } from '../models/user.js';
import { ROLES } from '../utils/roles.js';

export async function seed() {
  await migrate();
  const db = await getDb();

  const { email, password, name } = config.seed;

  if (email && password) {
    if (password.length < 8) {
      throw new Error('SEED_ADMIN_PASSWORD must be at least 8 characters.');
    }
    const existing = await findByEmail(email);
    if (!existing) {
      const admin = await createUser({ name: name || 'Admin', email, password, role: ROLES.ADMIN });
      return { created: true, email: admin.email };
    }
    const passwordHash = await hashPassword(password);
    await db.run(
      'UPDATE users SET role = ?, password_hash = ?, is_active = 1, updated_at = ? WHERE id = ?',
      [ROLES.ADMIN, passwordHash, new Date().toISOString(), existing.id],
    );
    return { created: false, promoted: true, email: existing.email };
  }

  const existingAdmin = await db.get(
    'SELECT email FROM users WHERE role = ? AND is_active = 1 LIMIT 1',
    [ROLES.ADMIN],
  );
  if (existingAdmin) {
    return { created: false, email: existingAdmin.email, reason: 'an admin already exists' };
  }

  throw new Error(
    'Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in backend/.env before seeding.\n'
    + '       There is no default account — the first admin is yours to choose.',
  );
}

const isEntry = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isEntry) {
  seed()
    .then(async (r) => {
      if (r.created) {
        console.log(`[seed] admin ${r.email} created — sign in and add your team from the app.`);
      } else if (r.promoted) {
        console.log(`[seed] ${r.email} already existed and now has admin access.`);
      } else {
        console.log(`[seed] nothing to do — ${r.reason} (${r.email}).`);
      }
      await closeDb();
    })
    .catch(async (err) => {
      console.error('[seed] failed:', err.message);
      await closeDb().catch(() => {});
      process.exit(1);
    });
}
