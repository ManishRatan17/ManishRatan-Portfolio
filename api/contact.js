/**
 * Vercel serverless function: POST /api/contact
 * Same behaviour as server/server.js, for the Vercel deployment.
 *
 * Set these in Vercel → Project → Settings → Environment Variables:
 *   SMTP_USER   the Gmail address that sends (e.g. manishratancollege@gmail.com)
 *   SMTP_PASS   a 16-character Gmail App Password
 *   CONTACT_TO  where messages go (defaults to manishratancollege@gmail.com)
 */
import nodemailer from 'nodemailer';

const env = process.env;
const CONTACT_TO = env.CONTACT_TO || 'manishratancollege@gmail.com';
const smtpReady = Boolean(env.SMTP_USER && env.SMTP_PASS);
const smtpPort = Number(env.SMTP_PORT) || 465;
const transporter = smtpReady
  ? nodemailer.createTransport({
      host: env.SMTP_HOST || 'smtp.gmail.com',
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    })
  : null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = (v, keepNewlines = false) =>
  String(v ?? '')
    .replace(keepNewlines ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, '')
    .trim();
const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Best-effort rate limit. Serverless instances don't share memory, so this only
// slows down a burst hitting the same warm instance; the honeypot does most of the work.
const WINDOW_MS = 15 * 60 * 1000;
const MAX = Number(env.RATE_LIMIT_MAX) || 5;
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.start > WINDOW_MS) {
    hits.set(ip, { start: now, count: 1 });
    return false;
  }
  return ++h.count > MAX;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (limited(ip)) {
    return res.status(429).json({ ok: false, error: 'Too many messages. Please try again a little later.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || typeof body !== 'object' || JSON.stringify(body).length > 16 * 1024) {
    return res.status(400).json({ ok: false, error: 'Invalid request.' });
  }

  // Spam traps: hidden "website" field and a minimum fill time. Pretend success.
  if (clean(body.website) || (Number(body.elapsed) > 0 && Number(body.elapsed) < 2500)) {
    return res.status(200).json({ ok: true });
  }

  const name = clean(body.name);
  const email = clean(body.email).toLowerCase();
  const message = clean(body.message, true);
  const fields = {};
  if (name.length < 2 || name.length > 100) fields.name = 'Please enter your name (2–100 characters).';
  if (!EMAIL_RE.test(email) || email.length > 254) fields.email = 'Please enter a valid email address.';
  if (message.length < 10 || message.length > 5000) fields.message = 'Your message should be 10–5000 characters.';
  if (Object.keys(fields).length) {
    return res.status(400).json({ ok: false, error: 'Please check the highlighted fields.', fields });
  }

  if (!transporter) {
    console.error('[contact] SMTP_USER / SMTP_PASS are not set in the Vercel environment.');
    return res.status(503).json({ ok: false, error: 'The message service is temporarily unavailable.' });
  }

  const at = new Date().toISOString();
  try {
    await transporter.sendMail({
      from: { name: 'Portfolio Contact', address: env.SMTP_USER },
      to: CONTACT_TO,
      replyTo: { name, address: email },
      subject: `Portfolio message from ${name}`,
      text: `${message}\n\n— ${name} <${email}>\nSent ${at}`,
      html: `<div style="font-family:system-ui,sans-serif;line-height:1.6">
               <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
               <hr style="border:0;border-top:1px solid #ddd">
               <p style="color:#555">From <strong>${escapeHtml(name)}</strong>
                 &lt;<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>&gt;<br>
                 Sent ${escapeHtml(at)}</p>
             </div>`,
    });
    console.log(`[contact] emailed message from ${email}`);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[contact] send failed:', err.message);
    return res.status(502).json({ ok: false, error: 'Your message could not be sent right now. Please try again or email me directly.' });
  }
}
