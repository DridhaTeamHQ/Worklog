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
import { createUser, findByEmail } from '../models/user.js';
import { ROLES } from '../utils/roles.js';

export async function seed() {
  await migrate();
  const db = await getDb();

  // Checked before the config, so an already-bootstrapped install is a clean no-op
  // even when SEED_ADMIN_* was never set — there is genuinely nothing to do.
  const existingAdmin = await db.get(
    'SELECT email FROM users WHERE role = ? AND is_active = 1 LIMIT 1',
    [ROLES.ADMIN],
  );
  if (existingAdmin) {
    return { created: false, email: existingAdmin.email, reason: 'an admin already exists' };
  }

  const { email, password, name } = config.seed;

  if (!email || !password) {
    throw new Error(
      'Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in backend/.env before seeding.\n'
      + '       There is no default account — the first admin is yours to choose.',
    );
  }
  if (password.length < 8) {
    throw new Error('SEED_ADMIN_PASSWORD must be at least 8 characters.');
  }

  // The address may exist as a manager or team member from earlier use; promoting is
  // safer than a duplicate-email failure that leaves the install with no way in.
  const existing = await findByEmail(email);
  if (existing) {
    await db.run(
      'UPDATE users SET role = ?, is_active = 1, updated_at = ? WHERE id = ?',
      [ROLES.ADMIN, new Date().toISOString(), existing.id],
    );
    return { created: false, promoted: true, email: existing.email };
  }

  const admin = await createUser({ name, email, password, role: ROLES.ADMIN });
  return { created: true, email: admin.email };
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
