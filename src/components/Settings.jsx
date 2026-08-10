import { useEffect, useRef, useState } from 'react'
import { getSyncConfig, setSyncConfig, syncNow } from '../lib/sync.js'
import { exportBackup, importBackup } from '../lib/backup.js'
import { passkeySupported, isPasskeyEnabled, enablePasskey, disablePasskey } from '../lib/webauthn.js'
import { db, getSetting, setSetting, createPerson, deletePerson } from '../lib/db.js'
import { makeInviteUrl } from '../lib/invite.js'
import QRCode from 'qrcode'
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
  const [meId, setMeId] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [invite, setInvite] = useState(null)   // { mode: 'mine' | 'new' } when the modal is open
  const [newFam, setNewFam] = useState('')
  const [inviteUrl, setInviteUrl] = useState('')
  const [inviteQr, setInviteQr] = useState('')
  const [copied, setCopied] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => { isPasskeyEnabled().then(setPkEnabled) }, [])
  useEffect(() => { getSetting('displayName').then(n => setName(n || '')) }, [])
  useEffect(() => { getSetting('theme').then(t => setTheme(t || 'auto')) }, [])
  useEffect(() => { getSetting('myPersonId').then(v => setMeId(v || '')) }, [])
  useEffect(() => { getSetting('showAllTrips').then(v => setShowAll(!!v)) }, [])

  async function chooseMe(id) {
    setMeId(id)
    await setSetting('myPersonId', id)
    reload?.()
  }
  async function toggleShowAll(v) {
    setShowAll(v)
    await setSetting('showAllTrips', v ? 1 : 0)
    reload?.()
  }
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
  // Build the QR + link for a given Family ID (reuses this device's endpoint + token).
  async function buildInvite(familyId) {
    const url = makeInviteUrl({ endpoint: cfg.endpoint, token: cfg.token, familyId })
    setInviteUrl(url)
    let qr = ''
    try { qr = await QRCode.toDataURL(url, { width: 240, margin: 1 }) } catch { /* ignore */ }
    setInviteQr(qr)
  }
  async function openInvite() {
    await setSyncConfig(cfg)   // make sure we share what's currently on screen
    setCopied(false); setNewFam(''); setInviteUrl(''); setInviteQr('')
    setInvite({ mode: 'mine' })
    await buildInvite(cfg.familyId)
  }
  function switchInviteMode(mode) {
    setCopied(false); setInviteUrl(''); setInviteQr('')
    setInvite({ mode })
    if (mode === 'mine') buildInvite(cfg.familyId)
  }
  async function genNewFamily() {
    const f = newFam.trim()
    if (!f) return
    setCopied(false)
    await buildInvite(f)
  }
  async function copyInvite() {
    try { await navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* ignore */ }
  }
  const canInvite = cfg.enabled && cfg.endpoint && cfg.token && cfg.familyId

  return (
    <div>
      <div className="topbar"><div><h2><Icon name="settings" size={23} /> Settings</h2><div className="sub">Cloud sync is optional — your data stays on-device unless you turn it on.</div></div></div>

      <div className="card" style={{ maxWidth: 620, marginBottom: 16 }}>
        <h3><Icon name="theme" /> Appearance</h3>
        <p className="desc">Choose a theme. Auto follows your device's light/dark setting.</p>
        <div className="seg">
          {['auto', 'light', 'dark'].map(t => (
            <button key={t} className={theme === t ? 'active' : ''} onClick={() => applyTheme(t)}>
              {t === 'auto' ? 'Auto' : t === 'light' ? 'Light' : 'Dark'}
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
          <button className="btn" onClick={addPerson}><Icon name="plus" size={15} /> Add</button>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 620, marginBottom: 16 }}>
        <h3><Icon name="user" /> Who are you on this device?</h3>
        <p className="desc">Pick which family member this phone belongs to. Trips will then only show if you’re one of the travellers — so a trip only some of the family is on won’t clutter everyone’s app.</p>
        <label>This device is
          <select value={meId} onChange={e => chooseMe(e.target.value)}>
            <option value="">Everyone (show all trips)</option>
            {(people || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="switch-row" style={{ marginTop: 10 }}>
          <span>Show all family trips (even ones I’m not on)</span>
          <input type="checkbox" checked={showAll} onChange={e => toggleShowAll(e.target.checked)} disabled={!meId} />
        </label>
        <p className="desc" style={{ marginTop: 4, fontSize: 11.5 }}>Trips with no travellers assigned always show for everyone.</p>
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

        <div className="modal-actions" style={{ marginTop: 8, flexWrap: 'wrap' }}>
          <button className="btn ghost" onClick={save}>Save</button>
          <button className="btn" onClick={test} disabled={!cfg.enabled}><Icon name="cloud" size={15} /> Sync now</button>
          {canInvite && <button className="btn ghost" onClick={openInvite}><Icon name="qr" size={15} /> Invite a device</button>}
        </div>
        {msg && <div className="desc" style={{ marginTop: 12 }}>{msg}</div>}
        {cfg.lastSync ? <div className="desc">Last sync: {new Date(cfg.lastSync).toLocaleString()}</div> : null}
        <p className="desc" style={{ marginTop: 10, fontSize: 11.5 }}>“Invite a device” makes a QR/link that sets up sync on another phone in one tap — share it only with people you want on this same family.</p>
      </div>

      {invite && (
        <div className="modal-backdrop" onClick={() => setInvite(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, textAlign: 'center' }}>
            <h3>Invite a device</h3>
            <div className="seg" style={{ marginBottom: 12 }}>
              <button className={invite.mode === 'mine' ? 'active' : ''} onClick={() => switchInviteMode('mine')}>👨‍👩‍👧 My family</button>
              <button className={invite.mode === 'new' ? 'active' : ''} onClick={() => switchInviteMode('new')}>✨ New group</button>
            </div>

            {invite.mode === 'mine' ? (
              <p className="desc">Add another phone to <b>your</b> family ({cfg.familyId}). Scan this code with the other phone's camera, or send the link. Both devices then share the same trips and documents.</p>
            ) : (
              <>
                <p className="desc">Set up a <b>separate</b> group (e.g. the parents) that syncs together but is completely walled off from your family. Give it a name, then send the same code/link to everyone in that group.</p>
                <div style={{ display: 'flex', gap: 8, margin: '4px 0 8px' }}>
                  <input value={newFam} onChange={e => setNewFam(e.target.value)} placeholder="Group name, e.g. smith-parents"
                    onKeyDown={e => e.key === 'Enter' && genNewFamily()} style={{ flex: 1 }} />
                  <button className="btn" onClick={genNewFamily} disabled={!newFam.trim()}>Make</button>
                </div>
              </>
            )}

            {inviteQr && <img src={inviteQr} alt="Invite QR code" style={{ width: 220, height: 220, borderRadius: 12, background: '#fff', padding: 8 }} />}

            <div className="modal-actions" style={{ justifyContent: 'center', marginTop: 10 }}>
              <button className="btn" onClick={copyInvite} disabled={!inviteUrl}>{copied ? 'Copied ✓' : 'Copy link'}</button>
              <button className="btn ghost" onClick={() => setInvite(null)}>Done</button>
            </div>
            <p className="desc" style={{ marginTop: 10, fontSize: 11 }}>This link contains your sync secret — treat it like a password and don't post it publicly. To open shared documents, the other device also needs that group's passphrase (or a restored backup).</p>
          </div>
        </div>
      )}

      <div className="card" style={{ maxWidth: 620, marginTop: 16 }}>
        <h3><Icon name="download" /> Encrypted backup</h3>
        <p className="desc">Download an encrypted <code>.voyager</code> file with everything in your vault. Document blobs and metadata are encrypted — the file is useless without your passphrase or recovery code. Restore it on a new device or after a wipe.</p>
        <div className="modal-actions" style={{ justifyContent: 'flex-start', marginTop: 4 }}>
          <button className="btn" onClick={doExport}><Icon name="download" size={15} /> Export backup</button>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}><Icon name="upload" size={15} /> Restore backup</button>
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
            {pkEnabled ? 'Remove passkey' : 'Enable on this device'}
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
