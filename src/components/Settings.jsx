import { useEffect, useRef, useState } from 'react'
import { getSyncConfig, setSyncConfig, syncNow } from '../lib/sync.js'
import { exportBackup, importBackup } from '../lib/backup.js'
import { passkeySupported, isPasskeyEnabled, enablePasskey, disablePasskey } from '../lib/webauthn.js'
import { db, getSetting, setSetting, createPerson, deletePerson } from '../lib/db.js'
import { Icon } from './Icon.jsx'

const PALETTE = ['#3b82f6', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ec4899', '#ef4444']
const makeInitials = n => (n || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('') || '?'

// Settings: name, family members, cloud sync, backup, passkey.
export default function Settings({ vaultKey, people = [], reload }) {
  const [cfg, setCfg] = useState(null)
  const [msg, setMsg] = useState('')
  const [backupMsg, setBackupMsg] = useState('')
  const [pkEnabled, setPkEnabled] = useState(false)
  const [pkMsg, setPkMsg] = useState('')
  const [name, setName] = useState('')
  const [nameMsg, setNameMsg] = useState('')
  const [newPerson, setNewPerson] = useState('')
  const [confirmId, setConfirmId] = useState(null)
  const [theme, setTheme] = useState('auto')
  const fileRef = useRef(null)

  useEffect(() => { isPasskeyEnabled().then(setPkEnabled) }, [])
  useEffect(() => { getSetting('displayName').then(n => setName(n || '')) }, [])
  useEffect(() => { getSetting('theme').then(t => setTheme(t || 'auto')) }, [])
  async function applyTheme(t) {
    setTheme(t)
    document.documentElement.setAttribute('data-theme', t)
    await setSetting('theme', t)
  }

  async function addPerson() {
    const nm = newPerson.trim()
    if (!nm) return
    await createPerson({ name: nm, initials: makeInitials(nm), color: PALETTE[people.length % PALETTE.length] })
    setNewPerson('')
    try { if ((await getSyncConfig()).enabled) await syncNow() } catch { /* offline is fine */ }
    reload?.()
  }
  async function removePerson(id) {
    if (confirmId !== id) { setConfirmId(id); return }
    // Soft-delete that person's documents too, so they stop alerting and the removal syncs.
    const docs = await db.documents.where('personId').equals(id).toArray()
    for (const d of docs) await db.documents.update(d.id, { deleted: 1, dirty: 1, updatedAt: Date.now() })
    await deletePerson(id)
    setConfirmId(null)
    try { if ((await getSyncConfig()).enabled) await syncNow() } catch { /* offline is fine */ }
    reload?.()
  }
  async function saveName() {
    await setSetting('displayName', name.trim())
    setNameMsg('✅ Saved. Reopen the Dashboard to see the greeting.')
    setTimeout(() => setNameMsg(''), 2600)
  }
  async function togglePasskey() {
    setPkMsg('')
    try {
      if (pkEnabled) { await disablePasskey(); setPkEnabled(false); setPkMsg('Passkey unlock removed from this device.') }
      else { await enablePasskey(vaultKey); setPkEnabled(true); setPkMsg('✅ Face ID / passkey unlock enabled on this device.') }
    } catch (e) { setPkMsg('⚠️ ' + e.message) }
  }

  async function doExport() {
    try { await exportBackup(vaultKey); setBackupMsg('✅ Encrypted backup downloaded.') }
    catch (e) { setBackupMsg('⚠️ ' + e.message) }
  }
  async function doImport(file) {
    if (!file) return
    const pass = prompt('Enter the passphrase that protected this backup:')
    if (!pass) return
    setBackupMsg('Restoring…')
    try {
      const text = await file.text()
      await importBackup(text, pass)
      setBackupMsg('✅ Restored. Reloading…')
      setTimeout(() => location.reload(), 900)
    } catch (e) { setBackupMsg('⚠️ ' + e.message) }
  }

  useEffect(() => { getSyncConfig().then(setCfg) }, [])
  if (!cfg) return null

  const update = patch => setCfg({ ...cfg, ...patch })
  async function save() { await setSyncConfig(cfg); setMsg('Saved.'); setTimeout(() => setMsg(''), 1800) }
  async function test() {
    await setSyncConfig(cfg)
    setMsg('Syncing…')
    try { const r = await syncNow(); setMsg(`✅ Synced · pushed ${r.pushed}, pulled ${r.pulled}` + (r.failed ? `, ${r.failed} too large` : '')) }
    catch (e) { setMsg('⚠️ ' + e.message) }
  }

  return (
    <div>
      <div className="topbar"><div><h2><Icon name="settings" size={23} /> Settings</h2><div className="sub">Cloud sync is optional — your data stays on-device unless you turn it on.</div></div></div>

      <div className="card" style={{ maxWidth: 620, marginBottom: 16 }}>
        <h3><Icon name="theme" /> Appearance</h3>
        <p className="desc">Choose a theme. Auto follows your device's light/dark setting.</p>
        <div className="seg">
          {['auto', 'light', 'dark'].map(t => (
            <button key={t} className={theme === t ? 'active' : ''} onClick={() => applyTheme(t)}>
              {t === 'auto' ? '🌗 Auto' : t === 'light' ? '☀️ Light' : '🌙 Dark'}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ maxWidth: 620, marginBottom: 16 }}>
        <h3><Icon name="user" /> Your name</h3>
        <p className="desc">Used to greet you on the dashboard. This is per-device, so each person who installs the app sets their own.</p>
        <label>Display name
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Amit" />
        </label>
        <div className="modal-actions" style={{ justifyContent: 'flex-start', marginTop: 4 }}>
          <button className="btn" onClick={saveName}>Save name</button>
        </div>
        {nameMsg && <div className="desc" style={{ marginTop: 12 }}>{nameMsg}</div>}
      </div>

      <div className="card" style={{ maxWidth: 620, marginBottom: 16 }}>
        <h3><Icon name="users" /> Family members</h3>
        <p className="desc">Who documents can belong to. Add your real family and remove the demo names.</p>
        {(people || []).map(p => (
          <div key={p.id} className="alert" style={{ marginBottom: 8 }}>
            <div className="ai" style={{ background: p.color || '#3b82f6', color: '#fff', fontWeight: 700, fontSize: 13 }}>{p.initials || makeInitials(p.name)}</div>
            <div className="body"><b>{p.name}</b><small>{p.relationship || 'family'}</small></div>
            <button className="mini" style={{ color: '#f87171' }} onClick={() => removePerson(p.id)}>
              {confirmId === p.id ? 'Tap again' : '🗑 Remove'}
            </button>
          </div>
        ))}
        <div className="file-row" style={{ marginTop: 6 }}>
          <input value={newPerson} onChange={e => setNewPerson(e.target.value)} placeholder="Add a person's name"
            onKeyDown={e => e.key === 'Enter' && addPerson()} style={{ flex: 1, minWidth: 160 }} />
          <button className="btn" onClick={addPerson}>＋ Add</button>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 620 }}>
        <h3><Icon name="cloud" /> Encrypted cloud sync</h3>
        <p className="desc">When on, only the <b>already-encrypted</b> document blobs (plus expiry metadata for alerts) are uploaded. The server can never read your documents.</p>

        <label className="switch-row">
          <span>Enable sync</span>
          <input type="checkbox" checked={cfg.enabled} onChange={e => update({ enabled: e.target.checked })} />
        </label>

        <label>Sync endpoint
          <input value={cfg.endpoint} onChange={e => update({ endpoint: e.target.value })}
                 placeholder="https://your-app.vercel.app/api" />
        </label>
        <label>Family ID
          <input value={cfg.familyId} onChange={e => update({ familyId: e.target.value })}
                 placeholder="maini-family" />
        </label>
        <label>Access token
          <input type="password" value={cfg.token} onChange={e => update({ token: e.target.value })}
                 placeholder="shared secret from your backend" />
        </label>

        <div className="modal-actions" style={{ marginTop: 8 }}>
          <button className="btn ghost" onClick={save}>Save</button>
          <button className="btn" onClick={test} disabled={!cfg.enabled}>☁️ Sync now</button>
        </div>
        {msg && <div className="desc" style={{ marginTop: 12 }}>{msg}</div>}
        {cfg.lastSync ? <div className="desc">Last sync: {new Date(cfg.lastSync).toLocaleString()}</div> : null}
      </div>

      <div className="card" style={{ maxWidth: 620, marginTop: 16 }}>
        <h3><Icon name="download" /> Encrypted backup</h3>
        <p className="desc">Download an encrypted <code>.voyager</code> file with everything in your vault. Document blobs and metadata are encrypted — the file is useless without your passphrase or recovery code. Restore it on a new device or after a wipe.</p>
        <div className="modal-actions" style={{ justifyContent: 'flex-start', marginTop: 4 }}>
          <button className="btn" onClick={doExport}>⬇️ Export backup</button>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}>⬆️ Restore backup</button>
          <input ref={fileRef} type="file" accept=".voyager,application/json" hidden
                 onChange={e => doImport(e.target.files[0])} />
        </div>
        {backupMsg && <div className="desc" style={{ marginTop: 12 }}>{backupMsg}</div>}
      </div>

      <div className="card" style={{ maxWidth: 620, marginTop: 16 }}>
        <h3><Icon name="passkey" /> Face ID / passkey unlock</h3>
        <p className="desc">Add a device passkey (Face ID, Touch ID, Windows Hello) for quick unlock. Your passphrase stays the master key; this is an extra, device-bound shortcut. Needs a supporting browser.</p>
        <div className="modal-actions" style={{ justifyContent: 'flex-start', marginTop: 4 }}>
          <button className="btn" onClick={togglePasskey} disabled={!passkeySupported()}>
            {pkEnabled ? '🚫 Remove passkey' : '👤 Enable on this device'}
          </button>
          {!passkeySupported() && <span className="desc">Not available in this browser.</span>}
        </div>
        {pkMsg && <div className="desc" style={{ marginTop: 12 }}>{pkMsg}</div>}
      </div>

      <div className="card" style={{ maxWidth: 620, marginTop: 16 }}>
        <h3><Icon name="key" /> Passphrase &amp; recovery</h3>
        <p className="desc">Your vault is protected by your passphrase, with a one-time <b>recovery code</b> shown at setup as the backup way in. If you forget your passphrase, choose “Forgot passphrase?” on the lock screen and enter that code to set a new one. Keep the code somewhere safe — anyone who has it can open the vault.</p>
      </div>
    </div>
  )
}
