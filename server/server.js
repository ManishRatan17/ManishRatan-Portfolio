/**
 * Portfolio backend
 * -----------------
 * - Serves the static portfolio (index.html, styles.css, script.js, resume.pdf …)
 * - POST /api/contact  → validates the message, stores a backup copy, and emails it
 * - GET  /api/health   → simple health check for hosting platforms
 *
 * Configure with environment variables (see .env.example).
 */
import express from 'express';
import nodemailer from 'nodemailer';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const LOG_FILE = path.join(DATA_DIR, 'messages.jsonl');

const env = process.env;
const PORT = Number(env.PORT) || 3000;
const IS_PROD = env.NODE_ENV === 'production';
const CONTACT_TO = env.CONTACT_TO || 'manishratancollege@gmail.com';
const ALLOWED_ORIGINS = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);

/* ------------------------------------------------------------------ */
/* Mail transport                                                       */
/* ------------------------------------------------------------------ */
const smtpReady = Boolean(env.SMTP_USER && env.SMTP_PASS);
const smtpPort = Number(env.SMTP_PORT) || 465;
const transporter = smtpReady
  ? nodemailer.createTransport({
      host: env.SMTP_HOST || 'smtp.gmail.com',
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    })
  : // Dev fallback: no SMTP credentials → render the email as JSON and print it.
    nodemailer.createTransport({ jsonTransport: true });

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// strip control characters (keep \n and \t in the message body)
const clean = (v, keepNewlines = false) =>
  String(v ?? '')
    .replace(keepNewlines ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, '')
    .trim();
const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function validate(body) {
  const name = clean(body.name);
  const email = clean(body.email).toLowerCase();
  const message = clean(body.message, true);
  const errors = {};
  if (name.length < 2 || name.length > 100) errors.name = 'Please enter your name (2–100 characters).';
  if (!EMAIL_RE.test(email) || email.length > 254) errors.email = 'Please enter a valid email address.';
  if (message.length < 10 || message.length > 5000) errors.message = 'Your message should be 10–5000 characters.';
  return { name, email, message, errors };
}

// Tiny in-memory rate limiter: N requests per window per IP.
function rateLimiter({ windowMs, max }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [ip, h] of hits) if (now - h.start > windowMs) hits.delete(ip);
  }, windowMs).unref();
  return (req, res, next) => {
    const now = Date.now();
    const h = hits.get(req.ip);
    if (!h || now - h.start > windowMs) {
      hits.set(req.ip, { start: now, count: 1 });
      return next();
    }
    if (++h.count > max) {
      res.set('Retry-After', String(Math.ceil((h.start + windowMs - now) / 1000)));
      return res.status(429).json({ ok: false, error: 'Too many messages. Please try again a little later.' });
    }
    next();
  };
}

/* ------------------------------------------------------------------ */
/* App                                                                  */
/* ------------------------------------------------------------------ */
const app = express();
app.disable('x-powered-by');
if (env.TRUST_PROXY) app.set('trust proxy', Number(env.TRUST_PROXY) || 1); // behind Render/Railway/Nginx etc.

// Security headers
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  });
  next();
});

// CORS: same-origin always works; other origins only if listed in ALLOWED_ORIGINS
// (useful if the site is hosted separately, e.g. on GitHub Pages / Netlify).
app.use('/api', (req, res, next) => {
  const origin = req.get('origin');
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.set({
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin',
    });
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, mail: smtpReady ? 'smtp' : 'dev-console', uptime: Math.round(process.uptime()) });
});

app.post(
  '/api/contact',
  rateLimiter({ windowMs: 15 * 60 * 1000, max: Number(env.RATE_LIMIT_MAX) || 5 }),
  express.json({ limit: '16kb' }),
  async (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};

    // Spam traps: a hidden "website" field humans never fill, and a minimum fill time.
    if (clean(body.website) || (Number(body.elapsed) > 0 && Number(body.elapsed) < 2500)) {
      return res.json({ ok: true }); // pretend success so bots learn nothing
    }

    const { name, email, message, errors } = validate(body);
    if (Object.keys(errors).length) {
      return res.status(400).json({ ok: false, error: 'Please check the highlighted fields.', fields: errors });
    }

    if (IS_PROD && !smtpReady) {
      console.error('[contact] SMTP is not configured — set SMTP_USER and SMTP_PASS.');
      return res.status(503).json({ ok: false, error: 'The message service is temporarily unavailable.' });
    }

    const entry = { at: new Date().toISOString(), ip: req.ip, name, email, message };

    // Keep a backup copy so no message is ever lost, even if email delivery fails.
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.appendFile(LOG_FILE, JSON.stringify(entry) + '\n');
    } catch (err) {
      console.error('[contact] could not write backup:', err.message);
    }

    try {
      const info = await transporter.sendMail({
        from: { name: 'Portfolio Contact', address: env.SMTP_USER || 'no-reply@localhost' },
        to: CONTACT_TO,
        replyTo: { name, address: email },
        subject: `Portfolio message from ${name}`,
        text: `${message}\n\n— ${name} <${email}>\nSent ${entry.at}`,
        html: `<div style="font-family:system-ui,sans-serif;line-height:1.6">
                 <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
                 <hr style="border:0;border-top:1px solid #ddd">
                 <p style="color:#555">From <strong>${escapeHtml(name)}</strong>
                   &lt;<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>&gt;<br>
                   Sent ${escapeHtml(entry.at)}</p>
               </div>`,
      });
      if (!smtpReady) console.log('[contact] (dev mode — not emailed) message received:\n', JSON.parse(info.message));
      else console.log(`[contact] emailed message from ${email}`);
      res.json({ ok: true });
    } catch (err) {
      console.error('[contact] send failed:', err.message);
      res.status(502).json({ ok: false, error: 'Your message could not be sent right now. Please try again or email me directly.' });
    }
  }
);

// Unknown API routes / bad JSON
app.use('/api', (req, res) => res.status(404).json({ ok: false, error: 'Not found' }));
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
    return res.status(400).json({ ok: false, error: 'Invalid request.' });
  }
  next(err);
});

// Static site — never expose the server folder, node_modules or dotfiles.
app.use((req, res, next) => {
  if (/^\/(server|node_modules)(\/|$)/i.test(req.path)) return res.status(404).end();
  next();
});
app.use(express.static(SITE_ROOT, { dotfiles: 'ignore', index: 'index.html', maxAge: IS_PROD ? '1h' : 0 }));
app.use((req, res) => res.status(404).send('Not found'));

app.listen(PORT, () => {
  console.log(`Portfolio running at http://localhost:${PORT}`);
  console.log(smtpReady
    ? `Contact form → emails ${CONTACT_TO} via ${env.SMTP_HOST || 'smtp.gmail.com'}`
    : 'Contact form → DEV MODE (no SMTP credentials): messages are printed here and saved to server/data/messages.jsonl');
});
