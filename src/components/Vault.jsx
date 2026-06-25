import { useEffect, useState } from 'react'
import { encryptBytes, decryptBytes } from '../lib/crypto.js'
import { db, daysUntil, saveDocument } from '../lib/db.js'
import { getSyncConfig, syncNow } from '../lib/sync.js'
import { scanPassport } from '../lib/ocr.js'
import { Icon } from './Icon.jsx'

const TYPES =['Passport', 'Visa', 'Driving licence', 'Travel insurance', 'Vaccination record', 'Booking', 'Flight ticket', 'Other']
const ICONS = {
  'Passport': ['🛂', 'rgba(59,130,246,.15)'], 'Visa': ['📄', 'rgba(6,182,212,.15)'],
  'Driving licence': ['🪪', 'rgba(139,92,246,.15)'], 'Travel insurance': ['🛡️', 'rgba(34,197,94,.15)'],
  'Vaccination record': ['💉', 'rgba(239,68,68,.15)'], 'Booking': ['🏨', 'rgba(245,158,11,.15)'],
  'Flight ticket': ['🎫', 'rgba(59,130,246,.15)'], 'Other': ['📄', 'rgba(148,163,184,.15)']
}
function expState(d) {
  if (!d.expiryDate) return ['ok', 'Up to date']
  const days = daysUntil(d.expiryDate)
  if (days < 90) return ['bad', `${days} days`]
  if (days < 180) return ['warn', `${days} days`]
  return ['ok', 'Valid']
}

// Downscale an image file to a small JPEG for an encrypted preview thumbnail.
async function makeThumb(file) {
  if (!file.type.startsWith('image/')) return null
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, 240 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = bmp.width * scale; c.height = bmp.height * scale
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.7))
  return blob.arrayBuffer()
}

function DocCard({ doc, vaultKey, ownerName, onView, onDelete }) {
  const [thumb, setThumb] = useState(null)
  const [confirmDel, setConfirmDel] = useState(false)
  useEffect(() => {
    let url
    if (doc.thumb) {
      decryptBytes(vaultKey, doc.thumb)
        .then(b => { url = URL.createObjectURL(new Blob([b], { type: 'image/jpeg' })); setThumb(url) })
        .catch(() => {})
    }
    return () => url && URL.revokeObjectURL(url)
  }, [doc.id])

  const [icon, bg] = ICONS[doc.type] || ICONS['Other']
  const [state, label] = expState(doc)
  return (
    <div className="doc">
      <span className="lock">{doc.blob ? '🔒 Encrypted' : '➕ Empty'}</span>
      {thumb
        ? <div className="thumb" style={{ backgroundImage: `url(${thumb})` }} />
        : <div className="dtype" style={{ background: bg }}>{icon}</div>}
      <b>{doc.title}</b>
      <div className="owner">{ownerName(doc.personId)} · {doc.type}</div>
      <div className="exp"><span>Expiry</span><span className={'v exp-' + state}>{label}</span></div>
      <div className="doc-actions">
        {doc.blob
          ? <button className="mini" onClick={() => onView(doc)}>👁 View</button>
          : <span className="mini muted">No file attached</span>}
        <button className="mini" style={{ marginLeft: 8, color: '#f87171' }}
          onClick={() => confirmDel ? onDelete(doc) : setConfirmDel(true)}>
          {confirmDel ? 'Tap again to confirm' : '🗑 Delete'}
        </button>
      </div>
    </div>
  )
}

export default function Vault({ vaultKey, documents, people, reload }) {
  const [filter, setFilter] = useState('all')
  const [msg, setMsg] = useState('')
  const [adding, setAdding] = useState(false)
  const [syncOn, setSyncOn] = useState(false)
  const ownerName = id => people.find(p => p.id === id)?.name || ''

  useEffect(() => { getSyncConfig().then(c => setSyncOn(c.enabled)) }, [])

  async function onView(doc) {
    setMsg('Decrypting…')
    const bytes = await decryptBytes(vaultKey, doc.blob)
    const url = URL.createObjectURL(new Blob([bytes], { type: doc.mime || 'application/octet-stream' }))
    window.open(url, '_blank')
    setMsg('')
  }

  async function handleSync() {
    setMsg('Syncing…')
    try { const r = await syncNow(); flash(`✅ Synced · ↑${r.pushed} ↓${r.pulled}`) }
    catch (e) { flash('⚠️ ' + e.message) }
  }
  function flash(t) { setMsg(t); reload(); setTimeout(() => setMsg(''), 2600) }

  async function onDelete(doc) {
    await db.documents.update(doc.id, { deleted: 1, dirty: 1, updatedAt: Date.now() })
    if (syncOn) { try { await syncNow() } catch {} }
    flash('🗑 Deleted')
  }

  const list = documents.filter(d => !d.deleted && (filter === 'all' || d.personId === filter))

  return (
    <div>
      <div className="topbar">
        <div><h2><Icon name="shield" size={23} /> Document Vault</h2><div className="sub">End-to-end encrypted (AES-256) · stored on this device</div></div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          {syncOn && <button className="btn ghost" onClick={handleSync}>☁️ Sync now</button>}
          <button className="btn" onClick={() => setAdding(true)}>＋ Add document</button>
        </div>
      </div>

      <div className="alert ok banner">
        <div className="ai"><Icon name="shield" size={18} /></div>
        <div className="body"><b>Vault unlocked</b>
          <small>Files are AES-256 encrypted with your passphrase-derived key before being stored{syncOn ? ' or synced' : ''}.</small></div>
      </div>

      <div className="seg">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Everyone</button>
        {people.map(p => <button key={p.id} className={filter === p.id ? 'active' : ''} onClick={() => setFilter(p.id)}>{p.name}</button>)}
      </div>

      <div className="doc-grid">
        {list.map(d => <DocCard key={d.id} doc={d} vaultKey={vaultKey} ownerName={ownerName} onView={onView} onDelete={onDelete} />)}
      </div>

      {adding && <AddDocModal people={people} vaultKey={vaultKey}
        onClose={() => setAdding(false)}
        onSaved={() => { setAdding(false); flash('✅ Encrypted & stored on device') }} />}

      {msg && <div className="toast show">{msg}</div>}
    </div>
  )
}

function AddDocModal({ people, vaultKey, onClose, onSaved }) {
  const [personId, setPersonId] = useState(people[0]?.id || '')
  const [type, setType] = useState('Passport')
  const [title, setTitle] = useState('')
  const [expiry, setExpiry] = useState('')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [number, setNumber] = useState('')
  const [ocrMsg, setOcrMsg] = useState('')

  async function autoFill() {
    if (!file) return
    setOcrMsg('Reading passport… (first run downloads the OCR model)')
    try {
      const m = await scanPassport(file)
      if (!m) { setOcrMsg('Couldn’t read the MRZ — try a sharper, flatter photo.'); return }
      if (m.expiryDate) setExpiry(m.expiryDate)
      if (m.number) setNumber(m.number)
      if (m.fullName && !title) setTitle(`Passport · ${m.fullName}`)
      setOcrMsg(m.allValid ? '✅ Auto-filled (MRZ check digits valid).' : '⚠️ Auto-filled, but verify — some check digits failed.')
    } catch { setOcrMsg('OCR failed to run in this browser.') }
  }

  async function save() {
    setBusy(true)
    let blob = null, thumb = null, mime = null
    if (file) {
      blob = await encryptBytes(vaultKey, await file.arrayBuffer())
      mime = file.type
      const t = await makeThumb(file)
      if (t) thumb = await encryptBytes(vaultKey, t)
    }
    await saveDocument({
      personId, type, title: title || type, expiryDate: expiry || null, number: number || null,
      tripId: null, blob, thumb, mime, fileName: file?.name || null
    })
    setBusy(false)
    onSaved()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Add document</h3>
        <label>Owner
          <select value={personId} onChange={e => setPersonId(e.target.value)}>
            {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label>Type
          <select value={type} onChange={e => setType(e.target.value)}>
            {TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label>Title <input value={title} onChange={e => setTitle(e.target.value)} placeholder={type} /></label>
        <label>Expiry date <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} /></label>
        <div className="file-row">
          <label className="mini">📁 Choose file
            <input type="file" hidden onChange={e => setFile(e.target.files[0])} />
          </label>
          <label className="mini">📷 Camera
            <input type="file" accept="image/*" capture="environment" hidden onChange={e => setFile(e.target.files[0])} />
          </label>
          {file && <span className="file-name">{file.name}</span>}
        </div>
        {type === 'Passport' && file && (
          <button className="mini" style={{ marginBottom: 6 }} onClick={autoFill}>✨ Auto-fill from passport scan</button>
        )}
        {number && <div className="desc">Passport no. ···{number.slice(-4)}</div>}
        {ocrMsg && <div className="desc" style={{ marginTop: 6 }}>{ocrMsg}</div>}
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={save} disabled={busy}>{busy ? 'Encrypting…' : '🔒 Encrypt & save'}</button>
        </div>
      </div>
    </div>
  )
}
