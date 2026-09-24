const nodemailer = require('nodemailer');
const env = require('../config/env');
const { logger } = require('../utils/logger');

/**
 * Email delivery with a developer-friendly fallback.
 * If SMTP credentials are not configured the message is logged (and, for
 * password resets in development, the reset URL is returned so the flow can be
 * completed and demonstrated without an email provider).
 */

let transporter = null;

const getTransporter = () => {
  if (!env.isEmailConfigured) return null;
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: env.EMAIL_HOST,
    port: env.EMAIL_PORT,
    secure: env.EMAIL_SECURE,
    auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASSWORD },
  });
  return transporter;
};

const escapeHtml = (str) =>
  String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Shared, on-brand email shell. */
const shell = (title, bodyHtml, ctaText = null, ctaUrl = null) => `
<div style="background:#0B1020;padding:32px 16px;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#121933;border:1px solid #24304F;border-radius:18px;overflow:hidden">
    <div style="padding:22px 26px;background:linear-gradient(135deg,#6D5DFB,#22D3EE)">
      <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:.3px">Campus Coin</span>
      <span style="color:rgba(255,255,255,.85);font-size:12px;margin-left:8px">Smart Spending, Student Style</span>
    </div>
    <div style="padding:26px">
      <h1 style="margin:0 0 12px;font-size:20px;color:#F8FAFC">${escapeHtml(title)}</h1>
      <div style="color:#C7D0E1;font-size:14px;line-height:1.65">${bodyHtml}</div>
      ${ctaText && ctaUrl ? `<a href="${ctaUrl}" style="display:inline-block;margin-top:22px;background:#6D5DFB;color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:600;font-size:14px">${escapeHtml(ctaText)}</a>` : ''}
    </div>
    <div style="padding:16px 26px;border-top:1px solid #24304F;color:#7C8AA5;font-size:12px">
      You are receiving this because you created a Campus Coin account. Campus Coin never asks for your bank details.
    </div>
  </div>
</div>`;

/**
 * @returns {{delivered:boolean, previewUrl?:string, reason?:string}}
 */
async function send({ to, subject, html, text, previewUrl = null }) {
  const mailer = getTransporter();

  if (!mailer) {
    logger.info(`[email:dev] to=${to} subject="${subject}"${previewUrl ? ` link=${previewUrl}` : ''}`);
    return {
      delivered: false,
      reason: 'smtp_not_configured',
      previewUrl: env.isProd ? null : previewUrl,
      text,
    };
  }

  try {
    await mailer.sendMail({ from: env.EMAIL_FROM, to, subject, html, text });
    return { delivered: true };
  } catch (error) {
    logger.warn(`email send failed: ${error.message}`);
    return { delivered: false, reason: 'send_failed', previewUrl: env.isProd ? null : previewUrl };
  }
}

const sendPasswordReset = ({ to, name, resetUrl, expiresInMinutes }) =>
  send({
    to,
    subject: 'Reset your Campus Coin password',
    previewUrl: resetUrl,
    html: shell(
      `Password reset for ${name.split(' ')[0]}`,
      `<p>We received a request to reset your Campus Coin password.</p>
       <p>This link expires in <strong>${expiresInMinutes} minutes</strong> and can be used once.</p>
       <p style="color:#8FA0BD">If you did not request this, you can safely ignore this email — your password will stay the same.</p>`,
      'Choose a new password',
      resetUrl,
    ),
    text: `Reset your Campus Coin password: ${resetUrl} (expires in ${expiresInMinutes} minutes)`,
  });

const sendWelcome = ({ to, name }) =>
  send({
    to,
    subject: 'Welcome to Campus Coin 🎉',
    html: shell(
      `Welcome aboard, ${name.split(' ')[0]}!`,
      `<p>Your student budget is ready to go. Three quick wins to start with:</p>
       <ul style="padding-left:18px;margin:10px 0">
         <li>Log today's food and transport spend</li>
         <li>Set a monthly cap for your biggest category</li>
         <li>Create a savings goal (even a small one)</li>
       </ul>
       <p>Your dashboard turns those entries into charts, tips and alerts automatically.</p>`,
      'Open my dashboard',
      `${env.CLIENT_URL}/dashboard`,
    ),
    text: 'Welcome to Campus Coin! Open your dashboard to log your first transaction.',
  });

const sendMonthlyDigest = ({ to, name, monthLabel, totals, currency = '$' }) =>
  send({
    to,
    subject: `Your ${monthLabel} Campus Coin summary`,
    html: shell(
      `${monthLabel} in review`,
      `<p>Hi ${name.split(' ')[0]}, here is how ${monthLabel} went:</p>
       <table style="width:100%;border-collapse:collapse;font-size:14px;color:#E2E8F5">
         <tr><td style="padding:6px 0">Income</td><td style="text-align:right">${currency}${totals.income.toFixed(2)}</td></tr>
         <tr><td style="padding:6px 0">Expenses</td><td style="text-align:right">${currency}${totals.expense.toFixed(2)}</td></tr>
         <tr><td style="padding:6px 0;font-weight:700">Saved</td><td style="text-align:right;font-weight:700">${currency}${totals.net.toFixed(2)}</td></tr>
       </table>
       <p style="margin-top:14px">Open the insights page for the full plain-language breakdown and next month's suggested caps.</p>`,
      'Read my insight',
      `${env.CLIENT_URL}/insights`,
    ),
    text: `${monthLabel}: income ${currency}${totals.income}, expenses ${currency}${totals.expense}, saved ${currency}${totals.net}.`,
  });

const status = () => ({ configured: env.isEmailConfigured, from: env.EMAIL_FROM, host: env.EMAIL_HOST || null });

module.exports = { send, sendPasswordReset, sendWelcome, sendMonthlyDigest, status, shell };
