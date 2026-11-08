export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ ok: true, mail: process.env.SMTP_USER && process.env.SMTP_PASS ? 'smtp' : 'not-configured' });
}
