/**
 * Checks the mail configuration and sends one test message.
 *
 *   npm run mail:test -- you@example.com
 *
 * Reports the real SMTP error when something is wrong, rather than the generic
 * "not delivered" the app surfaces, so misconfiguration is quick to diagnose.
 */
import nodemailer from 'nodemailer';
import config from '../src/config/env.js';
import { sendWelcomeEmail } from '../src/services/mail.js';

const recipient = process.argv[2];

/** Turns nodemailer's error codes into the thing that is actually wrong. */
function explain(err) {
  const code = err.code || '';
  const message = err.message || String(err);

  if (code === 'EAUTH' || /535|534|password not accepted|invalid login/i.test(message)) {
    return [
      'The mail server rejected the username or password.',
      '',
      '  - Gmail / Google Workspace requires an App Password, not your normal password.',
      '    Turn on 2-Step Verification, then create one at:',
      '    https://myaccount.google.com/apppasswords',
      '    Use the 16-character value as SMTP_PASS (spaces are fine to omit).',
      '  - Microsoft 365 may require SMTP AUTH to be enabled for the mailbox by an admin.',
      '  - Check SMTP_USER is the full email address.',
    ].join('\n');
  }
  // nodemailer reports a refused connection as ESOCKET and keeps the real cause in the
  // message, so match on both — otherwise this is mistaken for a timeout.
  if (code === 'ECONNREFUSED' || /ECONNREFUSED/i.test(message)) {
    return [
      `Nothing is listening on ${config.mail.host}:${config.mail.port}.`,
      '',
      '  - Check SMTP_HOST and SMTP_PORT are right for your provider.',
      '  - If you meant a local test server (Mailpit, MailHog), start it first.',
    ].join('\n');
  }
  if (/ENOTFOUND|EAI_AGAIN/i.test(`${code} ${message}`)) {
    return [
      `The host name "${config.mail.host}" could not be resolved.`,
      '',
      '  - Check SMTP_HOST for a typo.',
      '  - Common values: smtp.gmail.com, smtp.office365.com, smtp-mail.outlook.com.',
    ].join('\n');
  }
  if (/wrong version number|SSL routines|EPROTO/i.test(message)) {
    return [
      'TLS negotiation failed — the port and SMTP_SECURE setting do not match.',
      '',
      '  - Port 587 needs SMTP_SECURE=false (it upgrades with STARTTLS).',
      '  - Port 465 needs SMTP_SECURE=true.',
    ].join('\n');
  }
  if (code === 'ETIMEDOUT' || code === 'ESOCKET' || /timeout/i.test(message)) {
    return [
      `Could not reach ${config.mail.host}:${config.mail.port} before the timeout.`,
      '',
      '  - A firewall, ISP or cloud provider may be blocking outbound SMTP.',
      '    Port 587 is usually allowed; port 25 is very often blocked.',
      '  - If the provider needs implicit TLS, use port 465 and SMTP_SECURE=true.',
    ].join('\n');
  }
  if (code === 'EENVELOPE' || /recipient|sender|relay/i.test(message)) {
    return [
      'The server accepted the connection but rejected the addresses.',
      '',
      '  - MAIL_FROM usually has to be an address the account is allowed to send as.',
      '  - Some relays refuse to send to addresses outside their own domain.',
    ].join('\n');
  }
  return message;
}

async function main() {
  console.log('Mail configuration');
  console.log('='.repeat(60));
  console.log(`  SMTP_HOST    ${config.mail.host || '(not set)'}`);
  console.log(`  SMTP_PORT    ${config.mail.port}`);
  console.log(`  SMTP_SECURE  ${config.mail.secure}`);
  console.log(`  SMTP_USER    ${config.mail.user || '(not set)'}`);
  console.log(`  SMTP_PASS    ${config.mail.pass ? `set (${config.mail.pass.length} chars)` : '(not set)'}`);
  console.log(`  MAIL_FROM    ${config.mail.from}`);
  console.log(`  APP_URL      ${config.mail.appUrl}`);
  console.log('');

  if (!config.mail.host) {
    console.error('SMTP_HOST is not set, so the app is in log mode and will not send anything.');
    console.error('');
    console.error('Set these in backend/.env and run this again:');
    console.error('');
    console.error('  SMTP_HOST=smtp.gmail.com');
    console.error('  SMTP_PORT=587');
    console.error('  SMTP_USER=you@company.com');
    console.error('  SMTP_PASS=your-16-char-app-password');
    console.error('  MAIL_FROM=Your Name <you@company.com>');
    console.error('');
    process.exit(1);
  }

  const transport = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    logger: process.env.MAIL_DEBUG === 'true',
    debug: process.env.MAIL_DEBUG === 'true',
  });

  process.stdout.write('Connecting and authenticating... ');
  try {
    await transport.verify();
    console.log('OK');
  } catch (err) {
    console.log('FAILED');
    console.error('');
    console.error(explain(err));
    console.error('');
    console.error(`Raw error: ${err.code || ''} ${err.message}`);
    console.error('Re-run with MAIL_DEBUG=true for the full SMTP conversation.');
    process.exit(1);
  }

  if (!recipient) {
    console.log('');
    console.log('Configuration works. Pass an address to send a real test message:');
    console.log('  npm run mail:test -- you@example.com');
    return;
  }

  process.stdout.write(`Sending a test welcome email to ${recipient}... `);
  const result = await sendWelcomeEmail({
    name: 'Test Recipient',
    email: recipient,
    password: 'TempPass@123',
    managerName: 'Taskr Setup Check',
  });

  if (result.delivered) {
    console.log('sent');
    console.log('');
    console.log(`Message ID: ${result.messageId}`);
    console.log('If it does not arrive within a minute, check the spam folder and the');
    console.log('sending account\'s outbox or provider dashboard for a bounce.');
  } else {
    console.log('FAILED');
    console.error('');
    console.error(result.error || 'Unknown error.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('');
  console.error(explain(err));
  console.error('');
  console.error(`Raw error: ${err.code || ''} ${err.message}`);
  process.exit(1);
});
