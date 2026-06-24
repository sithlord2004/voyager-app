# Voyager — PWA starter (Phase 0)

A real, runnable foundation for the Voyager travel app: an installable web app with a
passphrase-locked, **AES-256 encrypted** document vault, local-first storage, and live
weather. This is the "make it real" scaffold described in `../Voyager-Build-Spec.md`.

## Run it

```bash
cd voyager-app
npm install
npm run dev
```

Open the local URL Vite prints (e.g. http://localhost:5173).

On first launch you'll set a passphrase — this creates your encrypted vault. The app
then seeds demo people, trips, documents, and a packing list so it isn't empty.

## What actually works (not mocked)

- **Encryption** — `src/lib/crypto.js` uses the browser's Web Crypto API. Your passphrase
  derives a 256-bit key via PBKDF2; document files are AES-256-GCM encrypted *before*
  being written to storage. In the Vault, click **Scan** on a document, pick any file,
  and it's encrypted on the spot; **View** decrypts it back. Nothing is stored in plaintext.
- **Local storage** — `src/lib/db.js` (Dexie/IndexedDB) persists everything on-device.
  Lock and reload: data stays, but the key is gone until you re-enter the passphrase.
- **Live weather** — `src/lib/weather.js` calls Open-Meteo (no API key). The dashboard
  shows live current conditions + 5-day forecast for any city; the Trips view shows a
  live forecast for near trips and a **seasonal average** (historical archive) for far ones.
- **App lock** — the master key lives only in memory; "Lock vault" clears it.

## Phase 1 — document workflow (built)

- **Add document** modal in the Vault: pick owner, type, expiry date, and a file
  (file picker or **phone camera**). The file is AES-256 encrypted on save.
- **Encrypted thumbnails** — image documents get a downscaled preview that is itself
  encrypted; the card decrypts it on the fly when you view the vault.
- **Email expiry alerts** — `server/api/expiry-alerts.js`, a daily cron job that reads
  only the clear expiry metadata and emails a summary via Resend.

## Phase 2 — encrypted cloud sync (built, opt-in)

- **Settings → Cloud sync** lets you turn on sync and point it at your backend.
- `src/lib/sync.js` pushes dirty **encrypted** records and pulls remote changes with
  last-write-wins. The blob is ciphertext, so the server never sees a key.
- Backend in `server/` (Supabase Postgres + a `/api/sync` function). See `server/README.md`.

## Safety — recovery & backup (built)

- **Envelope encryption** (`src/lib/crypto.js`): a random 256-bit data key encrypts
  your documents and is itself wrapped by both your passphrase **and** a one-time
  **recovery code**. Forget the passphrase? Choose “Forgot passphrase?” on the lock
  screen, enter the recovery code, and set a new one — your documents are untouched.
- **Encrypted backup** (`src/lib/backup.js`): Settings → Export downloads a
  `.voyager` file where document blobs *and* metadata are encrypted; restore it on a
  new device with your passphrase.
- The crypto flow is covered by an end-to-end test (recovery, wrong-passphrase
  rejection, passphrase reset, backup roundtrip) — all passing.

## Phase 3 — smart features (built)

- **Live flight tracking** — `server/api/flight.js` proxies AeroDataBox (key stays
  server-side); `src/lib/flights.js` feeds the dashboard widget real status, gate, and
  revised times when a backend is configured, falling back to stored flight details.
- **Itinerary import** — Trips → *Import itinerary*: upload a booking PDF/email or paste
  the text. `src/lib/itinerary.js` extracts destination, dates, and flight number; you
  confirm an editable draft, and it creates the trip (which then lights up weather +
  flight automatically). Parser is covered by tests against several confirmation formats.

## Polish features (built)

- **Passport OCR auto-fill** — in Add document, choose a passport photo and
  *Auto-fill from passport scan*. `src/lib/ocr.js` reads the MRZ with tesseract.js,
  validates the ICAO check digits, and fills expiry + number + name. The MRZ parser
  has a unit-test suite (13 assertions, incl. the ICAO specimen). Runs fully in-browser.
- **LLM-assisted itinerary parsing** — for messy PDFs, `parseItinerarySmart` calls
  `server/api/parse-itinerary.js` (an LLM extraction endpoint) and falls back to the
  regex parser if no backend is set. The UI tags AI-assisted extractions.
- **Face ID / passkey unlock** — `src/lib/webauthn.js` uses WebAuthn's PRF extension to
  wrap the vault DEK with an authenticator-derived key, so you can unlock with
  biometrics while the passphrase stays the root of trust. Enable it in Settings; the
  wrap/unwrap crypto path is covered by tests. (Needs a PRF-capable browser/device.)

## What's still optional (nice-to-haves)

- Multi-year seasonal climate averaging (vs. single prior year) for far-out trips.
- Web Push notifications in addition to email alerts.
- Per-user auth (Supabase Auth) if you ever open it beyond family.

## Structure

```
src/
  lib/crypto.js     AES-256-GCM + PBKDF2 (the security core)
  lib/db.js         IndexedDB schema + demo seed
  lib/weather.js    Open-Meteo live + seasonal weather
  components/       LockScreen, Sidebar, Dashboard, Trips, Vault, Packing, Emergency
  App.jsx           lock gate + view routing
```

> Security note: this is a Phase-0 foundation. Before storing real passports, add
> recovery codes and have the crypto reviewed. The design is sound (zero-knowledge,
> on-device), but treat it as a starting point, not a finished security product.
# voyager-app
# voyager-app
