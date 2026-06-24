import { useEffect, useRef, useState } from 'react'
import { getSyncConfig, setSyncConfig, syncNow } from '../lib/sync.js'
import { exportBackup, importBackup } from '../lib/backup.js'
import { passkeySupported, isPasskeyEnabled, enablePasskey, disablePasskey } from '../lib/webauthn.js'
import { db, newId, getSetting, setSetting } from '../lib/db.js'

const PALETTE = ['#3b82f6', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ec4899', '#ef4444']
const makeInitials = n => (n || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('') || '?'

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
    await db.people.add({ id: newId(), name: nm, initials: makeInitials(nm), color: PALETTE[people.length % PALETTE.length], relationship: 'family' })
    setNewPerson('')
    reload?.()
  }
  async function removePerson(id) {
    if (confirmId !== id) { setConfirmId(id); return }
    await db.people.delete(id)
    setConfirmId(null)
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
    try { const r = await syncNow(); setMsg(`✅ Synced · pushed ${r.pushed}, pulled ${r.pulled}`) }
    catch (e) { setMsg('⚠️ ' + e.message) }
  }

  return (
    <div>
      <div className="topbar"><div><h2>Settings ⚙️</h2><div className="sub">Cloud sync is optional — your data stays on-device unless you turn it on.</div></div></div>

      <div className="card" style={{ maxWidth: 620, marginBottom: 16 }}>
        <h3><span className="ttl-ico">🎨</span> Appearance</h3>
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
        <h3><span className="ttl-ico">👋</span> Your name</h3>
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
        <h3><span className="ttl-ico">👨‍👩‍👧‍👦</span> Family members</h3>
        <p className="desc">Who documents can belong to. Add your real family and remove the demo names.</p>
        {people.map(p => (
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
            onKeyDown={e => e.key === 'Enter'
