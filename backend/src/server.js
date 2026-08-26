import config from './config/env.js';
import { createApp } from './app.js';
import { getDb, closeDb } from './db/index.js';
import { migrate } from './db/migrate.js';
import { mailMode } from './services/mail.js';

async function main() {
  // Make sure the schema exists before accepting traffic. Creating tables is
  // idempotent, so this is safe to run on every boot.
  await migrate();
  await getDb();

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`[server] ${config.appName} API listening on http://localhost:${config.port}`);
    console.log(`[server] environment=${config.env} database=${config.db.client}`);
    console.log(`[server] allowed origins: ${config.corsOrigins.join(', ')}`);

    // Mail silently not sending is a bad surprise to discover from a user, so say it
    // plainly at boot rather than only at the moment a send is attempted.
    if (mailMode() === 'smtp') {
      console.log(`[server] email: sending via ${config.mail.host}:${config.mail.port} as "${config.mail.from}"`);
    } else {
      console.warn('');
      console.warn('  ⚠  EMAIL IS NOT CONFIGURED — no messages will actually be sent.');
      console.warn('     Welcome and password-reset emails are written to this log instead.');
      console.warn('     To send real email, set SMTP_HOST (and usually SMTP_USER/SMTP_PASS)');
      console.warn('     in backend/.env, then restart. Check it with: npm run mail:test');
      console.warn('');
    }
  });

  const shutdown = (signal) => async () => {
    console.log(`[server] ${signal} received — shutting down.`);
    server.close(async () => {
      await closeDb();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 8000).unref();
  };
  process.on('SIGINT', shutdown('SIGINT'));
  process.on('SIGTERM', shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});
