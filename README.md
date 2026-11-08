<<<<<<< HEAD
<<<<<<< HEAD
# Manish Ratan — Portfolio

A static portfolio (`index.html`, `styles.css`, `script.js`) plus a small Node.js backend
(`server/`) that serves the site and delivers the contact form to email.

```
Portfolio/
├── index.html · styles.css · script.js · favicon.svg   ← the website
├── resume.pdf                                           ← add this (Download Resume button)
└── server/
    ├── server.js        ← Express app: static site + POST /api/contact
    ├── package.json
    └── .env.example     ← copy to .env and fill in
```

## Run locally

Requires Node.js 22.9 or newer.

```bash
cd server
npm install
npm start            # → http://localhost:3000
```

With no email credentials the server runs in **dev mode**: contact messages are printed in the
terminal and saved to `server/data/messages.jsonl` instead of being emailed.

## Make the contact form email you

1. Turn on 2-Step Verification for the Gmail account that will send the mail.
2. Create an **App Password**: Google Account → Security → App passwords.
3. `cp server/.env.example server/.env` and set:
   ```
   SMTP_USER=manishratancollege@gmail.com
   SMTP_PASS=the-16-character-app-password
   CONTACT_TO=manishratancollege@gmail.com
   ```
4. Restart with `npm start`. The startup log confirms "Contact form → emails …".

Replies go straight to the visitor: each email's *Reply-To* is the address they entered.

## API

| Method | Path           | Body                                   | Responses                        |
|--------|----------------|----------------------------------------|----------------------------------|
| POST   | `/api/contact` | `{ name, email, message }` (JSON)      | 200 ok · 400 invalid fields · 429 rate limited · 502 send failed |
| GET    | `/api/health`  | —                                      | `{ ok, mail: "smtp" \| "dev-console" }` |

Protection built in: input validation and length limits, a hidden honeypot field and minimum
fill time against bots, per-IP rate limiting (5 messages / 15 min), a 16 KB body limit,
HTML-escaped email output, security headers with a Content-Security-Policy, and every message is
also appended to `server/data/messages.jsonl` as a backup.

## Deploy

**One service (simplest)** — deploy the whole folder to Render / Railway / Fly.io as a Node app:
- Root directory: `server` · Build: `npm install` · Start: `npm start`
- Environment: the values from `.env`, plus `NODE_ENV=production` and `TRUST_PROXY=1`

**Site and API separately** — host the static files on Netlify / Vercel / GitHub Pages and the
`server/` on Render, then:
- set `data-endpoint` on the `<form id="contactForm">` in `index.html` to
  `https://<your-api>.onrender.com/api/contact`
- set `ALLOWED_ORIGINS=https://<your-site-domain>` on the server
- add the API origin to `connect-src` in the CSP in `server/server.js` only if you also serve the
  site from that server

## Browser support

Tested with Playwright on Chromium, Google Chrome, Microsoft Edge, Brave, Firefox and
Safari/WebKit — desktop (1280–1920px), tablets, iPhone 13 / SE (320px), Pixel 7, Galaxy S9+,
light and dark themes, reduced motion, JavaScript disabled, and a failed `script.js` load.
=======
# ManishRatan-Portfolio
Personal portfolio showcasing my projects, technical skills, experience, and journey as a developer. Built using HTML, CSS, JavaScript, and Node.js with a responsive frontend and backend-powered contact form.
>>>>>>> d38b4f188a6e33d62b793d79d6d6c8c9cb762520
=======
# ManishRatan-Portfolio
Personal portfolio showcasing my projects, technical skills, experience, and journey as a developer. Built using HTML, CSS, JavaScript, and Node.js with a responsive frontend and backend-powered contact form.
>>>>>>> d38b4f188a6e33d62b793d79d6d6c8c9cb762520
