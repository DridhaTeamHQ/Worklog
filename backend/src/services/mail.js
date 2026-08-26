/**
 * Outbound email.
 *
 * Two modes, chosen by whether SMTP_HOST is configured:
 *   - smtp : real delivery through nodemailer
 *   - log  : the message is written to the server log instead of being sent
 *
 * The log mode exists so a local or CI run needs no mail server and never fails
 * silently — you can still read exactly what would have gone out.
 *
 * Every send resolves rather than throwing. Callers decide what a failure means; for
 * onboarding it must not roll back the account that was just created.
 */
import nodemailer from 'nodemailer';
import config from '../config/env.js';

let transport = null;
let transportMode = null;

function getTransport() {
  if (transport) return { transport, mode: transportMode };

  if (config.mail.host) {
    transport = nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.secure,
      auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
      // Bounded so a dead mail server cannot hang the request that triggered the send.
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10_000,
    });
    transportMode = 'smtp';
  } else {
    transportMode = 'log';
    transport = {
      async sendMail(message) {
        console.log(
          ['', '─'.repeat(72),
            '[mail] SMTP is not configured — this message was NOT sent.',
            `[mail] To:      ${message.to}`,
            `[mail] From:    ${message.from}`,
            `[mail] Subject: ${message.subject}`,
            '─'.repeat(72),
            message.text,
            `${'─'.repeat(72)}\n`].join('\n'),
        );
        return { messageId: `log-${Date.now()}` };
      },
    };
  }

  return { transport, mode: transportMode };
}

/** Reset between tests or after a config change. */
export function resetTransport() {
  transport = null;
  transportMode = null;
}

export async function sendMail({ to, subject, text, html }) {
  const { transport: t, mode } = getTransport();
  try {
    const info = await t.sendMail({
      from: config.mail.from,
      replyTo: config.mail.replyTo || undefined,
      to,
      subject,
      text,
      html,
    });
    return { delivered: mode === 'smtp', mode, messageId: info?.messageId };
  } catch (err) {
    // A send failure is reported, never thrown: the caller's work already succeeded.
    console.error(`[mail] failed to send "${subject}" to ${to}:`, err.message);
    return { delivered: false, mode, error: err.message };
  }
}

/* ------------------------------------------------------------------ templates */

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

/** Shared shell. Table-based and inline-styled, which is what mail clients render reliably. */
function layout({ heading, bodyHtml, footerNote }) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:#0f172a;padding:20px 28px;">
                <span style="color:#ffffff;font-size:16px;font-weight:700;">Dridha</span>
                <span style="color:#94a3b8;font-size:16px;"> Worklog</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#0f172a;">${escapeHtml(heading)}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#64748b;">${footerNote}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

const button = (href, label) => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">
    <tr>
      <td style="border-radius:8px;background:#4f46e5;">
        <a href="${escapeHtml(href)}" style="display:inline-block;padding:11px 20px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;

/**
 * Welcome email for a newly added team member, carrying the temporary password the
 * manager set. Sent once, at account creation.
 */
export async function sendWelcomeEmail({ name, email, password, managerName }) {
  const loginUrl = `${config.mail.appUrl}/login`;
  const firstName = String(name || '').trim().split(/\s+/)[0] || 'there';
  const addedBy = managerName ? `${managerName} has added you` : 'You have been added';

  const subject = 'You have been added to Dridha Worklog';

  const text = [
    `Hi ${firstName},`,
    '',
    `${addedBy} to Dridha Worklog, the internal task and daily work reporting portal.`,
    '',
    'Sign in with these details:',
    `  Sign-in page:        ${loginUrl}`,
    `  Email:               ${email}`,
    `  Temporary password:  ${password}`,
    '',
    'Please change your password after signing in — you can do it from Profile,',
    'or use "Forgot password?" on the sign-in page at any time.',
    '',
    'Once you are in, you can:',
    '  - see the tasks assigned to you, with deadlines and priority',
    '  - update the status of your work as it progresses',
    '  - submit your daily task report',
    '',
    'If you were not expecting this email, please contact your manager.',
    '',
    '— Dridha Worklog',
  ].join('\n');

  const html = layout({
    heading: `Welcome to Worklog, ${escapeHtml(firstName)}`,
    bodyHtml: `
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#334155;">
        ${escapeHtml(addedBy)} to <strong>Dridha Worklog</strong>, the internal task and daily
        work reporting portal.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:0 0 4px;">
        <tr>
          <td style="font-size:13px;color:#64748b;padding-bottom:6px;">Email</td>
          <td style="font-size:13px;color:#0f172a;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;text-align:right;padding-bottom:6px;">${escapeHtml(email)}</td>
        </tr>
        <tr>
          <td style="font-size:13px;color:#64748b;">Temporary password</td>
          <td style="font-size:14px;color:#0f172a;font-weight:700;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;text-align:right;">${escapeHtml(password)}</td>
        </tr>
      </table>
      ${button(loginUrl, 'Sign in to Worklog')}
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#334155;">
        Please change this password once you are in — it is under <strong>Profile</strong>, and
        "Forgot password?" on the sign-in page works at any time.
      </p>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#334155;">
        From your dashboard you can see the tasks assigned to you, update their status as you
        go, and submit your daily task report.
      </p>`,
    footerNote: 'If you were not expecting this email, please contact your manager.',
  });

  return sendMail({ to: email, subject, text, html });
}

/** Password reset link. The token is single-use and expires in 30 minutes. */
export async function sendPasswordResetEmail({ name, email, token }) {
  const resetUrl = `${config.mail.appUrl}/forgot-password?token=${encodeURIComponent(token)}`;
  const firstName = String(name || '').trim().split(/\s+/)[0] || 'there';

  const subject = 'Reset your Worklog password';

  const text = [
    `Hi ${firstName},`,
    '',
    'We received a request to reset your Dridha Worklog password.',
    '',
    `Open this link to choose a new one: ${resetUrl}`,
    '',
    `If the link does not work, paste this code into the reset form: ${token}`,
    '',
    'The link is valid for 30 minutes and can only be used once.',
    'If you did not request this, you can ignore this email — your password will not change.',
    '',
    '— Dridha Worklog',
  ].join('\n');

  const html = layout({
    heading: 'Reset your password',
    bodyHtml: `
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#334155;">
        Hi ${escapeHtml(firstName)}, we received a request to reset your Worklog password.
      </p>
      ${button(resetUrl, 'Choose a new password')}
      <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#64748b;">
        If the button does not work, paste this code into the reset form:<br>
        <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:#0f172a;word-break:break-all;">${escapeHtml(token)}</span>
      </p>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#334155;">
        This link is valid for 30 minutes and can only be used once.
      </p>`,
    footerNote: 'If you did not request this, you can ignore this email — your password will not change.',
  });

  return sendMail({ to: email, subject, text, html });
}

export const mailMode = () => getTransport().mode;
