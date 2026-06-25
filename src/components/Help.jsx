import { Icon } from './Icon.jsx'

// In-app user guide.
const card = { maxWidth: 720, marginBottom: 16 }
const li = { fontSize: 13.5, color: 'var(--text-2)', margin: '6px 0', lineHeight: 1.55 }
const P = ({ children }) => <p style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.6, marginTop: 6 }}>{children}</p>

export default function Help() {
  return (
    <div>
      <div className="topbar"><div><h2><Icon name="help" size={23} /> How to use</h2>
        <div className="sub">A quick guide to every part of Voyager</div></div></div>

      <div className="card" style={card}>
        <h3><Icon name="unlock" /> Getting in</h3>
        <P><b>First time:</b> create a passphrase — it encrypts everything. You'll be shown a one‑time <b>recovery code</b>; save it somewhere safe, it's the only way back in if you forget your passphrase.</P>
        <P><b>Every time after:</b> enter your passphrase (or use Face ID / passkey if enabled).</P>
        <P><b>Forgot it?</b> Tap “Forgot passphrase?” on the lock screen, enter your recovery code, and set a new one — your documents stay intact.</P>
        <P>Each device/browser keeps its own copy. If it asks you to <i>create</i> a passphrase unexpectedly, you're on a new device — see “More than one device” below.</P>
      </div>

      <div className="card" style={card}>
        <h3><Icon name="home" /> Dashboard</h3>
        <ul>
          <li style={li}><b>Weather</b> for your next trip, plus a 5‑day forecast. Search any city in the box.</li>
          <li style={li}><b>Flights</b> — each flight leg of your next trip with live status when available.</li>
          <li style={li}><b>Needs your attention</b> — documents expiring within 6 months.</li>
        </ul>
      </div>

      <div className="card" style={card}>
        <h3><Icon name="map" /> Trips</h3>
        <P>One trip covers your whole journey. Add it two ways:</P>
        <ul>
          <li style={li}><b>＋ Add manually</b> — set a main destination (for weather) and your Leaving/Returning dates, then add <b>legs</b> (each hop, with transport mode ✈️🚆🚗⛴️🚌 and a flight/train number) and <b>stays</b> (hotels/Airbnb with check‑in/out and confirmation).</li>
          <li style={li}><b>📩 Import itinerary</b> — upload a booking PDF/email or paste the text; confirm the details.</li>
          <li style={li}>Remove a trip with the <b>🗑</b> (tap again to confirm).</li>
        </ul>
      </div>

      <div className="card" style={card}>
        <h3><Icon name="shield" /> Document Vault</h3>
        <ul>
          <li style={li}><b>＋ Add document</b> — pick owner, type, expiry, and a file (or phone camera). It's encrypted before saving.</li>
          <li style={li}><b>✨ Auto‑fill from passport scan</b> — for passports, reads the details from a clear photo.</li>
          <li style={li}><b>View</b> decrypts and opens a file; <b>🗑 Delete</b> (tap again) removes it. Filter by person with the chips.</li>
        </ul>
        <P>Everything is encrypted with your passphrase — only ciphertext ever leaves your device.</P>
        <P><b>Getting files from your computer:</b> the easiest way is to <b>AirDrop</b> the file from your Mac to your phone (Finder → right‑click → Share → AirDrop), then on the phone tap <b>＋ Add document → 📁 Choose file</b> and pick it. Email, iCloud Drive or Google Drive work the same way — get the file onto the phone first, then add it. Adding straight on the phone means it's encrypted on the phone with no extra setup.</P>
      </div>

      <div className="card" style={card}>
        <h3><Icon name="bag" /> Packing</h3>
        <P>A checklist per trip. Pick the trip, tick items as you pack, ＋ add your own (with a category), and ✕ remove any. The bar tracks your progress.</P>
      </div>

      <div className="card" style={card}>
        <h3><Icon name="lifebuoy" /> Emergency</h3>
        <ul>
          <li style={li}><b>Emergency numbers</b> for your destination country.</li>
          <li style={li}><b>Hospitals</b> — type a city, Look up, then open nearby hospitals in Maps.</li>
          <li style={li}><b>Your embassy</b> — set your home country once; “Find embassy →” locates the nearest one.</li>
          <li style={li}><b>Contacts &amp; medical notes</b> — add your own (blood type, allergies, medications).</li>
        </ul>
      </div>

      <div className="card" style={card}>
        <h3><Icon name="settings" /> Settings</h3>
        <ul>
          <li style={li}><b>Appearance</b> — Auto / Light / Dark theme.</li>
          <li style={li}><b>Your name</b> — personalises the greeting (per device).</li>
          <li style={li}><b>Family members</b> — add real family, remove demo names.</li>
          <li style={li}><b>Cloud sync</b> (optional) — sync encrypted documents across devices.</li>
          <li style={li}><b>Encrypted backup</b> — export/restore a <code>.voyager</code> file.</li>
          <li style={li}><b>Face ID / passkey</b> — quick biometric unlock on a device.</li>
        </ul>
      </div>

      <div className="card" style={card}>
        <h3><Icon name="phone" /> More than one device</h3>
        <ol>
          <li style={li}>Main device: <b>Settings → Export backup</b>, send yourself the file.</li>
          <li style={li}>New device: open the app, set any passphrase, then <b>Settings → Restore backup</b> and pick the file.</li>
          <li style={li}>It reloads — unlock with your main passphrase, and your documents are there.</li>
        </ol>
        <P>For ongoing sync, also turn on <b>Cloud sync</b> with the same settings on both. Same passphrase alone isn't enough to share documents — you must move the vault with the backup.</P>
        <P><b>Sharing with a partner:</b> trips, documents and family members all sync once both devices use the same Cloud sync details (and the vault has been restored once from your backup, so documents can be opened). Your partner should <b>not</b> add herself as a new family member — that creates a separate entry, and documents won't appear under her. Instead, let your family list sync across; everyone then lines up under the right names automatically.</P>
      </div>

      <div className="card" style={card}>
        <h3><Icon name="bulb" /> Good to know</h3>
        <ul>
          <li style={li}>The app updates itself automatically to the latest version.</li>
          <li style={li}>Keep your recovery code and an encrypted backup — your safety net.</li>
          <li style={li}>Works offline except for live weather, flights, hospital/embassy lookups, and sync.</li>
        </ul>
      </div>
    </div>
  )
}
