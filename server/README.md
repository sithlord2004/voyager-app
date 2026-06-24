# Voyager backend (Phase 1 + 2)

Two serverless functions plus a Postgres schema. Stays on free tiers for a family app.
The server only ever stores **encrypted** document blobs — it cannot read your documents.

## Pieces

- `schema.sql` — Postgres/Supabase tables (`documents`, `families`) with RLS locked down.
- `api/sync.js` — `POST /api/sync`: push dirty encrypted docs, pull remote changes (last-write-wins). *(Phase 2)*
- `api/expiry-alerts.js` — daily cron: emails each family their soon-to-expire documents, reading only clear expiry metadata. *(Phase 1)*
- `vercel.json` — schedules the alert job at 08:00 daily.
- `.env.example` — required secrets.

## Setup (≈15 min)

1. **Supabase:** create a free project → SQL editor → paste & run `schema.sql`.
   Add a row to `families`: `insert into families values ('maini-family','you@email.com');`
2. **Resend:** create a free account, verify a sending domain, grab an API key.
3. **Deploy:** push this `server/` folder to Vercel. Add the `.env` values as Environment Variables.
4. **Connect the app:** in Voyager → Settings, enable sync and set
   - Endpoint: `https://your-app.vercel.app/api`
   - Family ID: `maini-family`
   - Token: the `SYNC_TOKEN` you chose.
5. Hit **Sync now**. Encrypted docs upload; other family devices pull them on their next sync.

## Security notes

- The app encrypts (AES-256-GCM) before upload; `payload` is ciphertext. Losing the DB leaks nothing readable.
- `SUPABASE_SERVICE_KEY` is server-only — never ship it to the browser.
- The expiry-alert job reads only `expiry_date`/`doc_type`/`title`. If you want even that hidden, encrypt those too and move alerting on-device via Web Push.
- Add per-user auth (Supabase Auth) before exposing this beyond your family.
