import { useEffect, useState } from 'react'
import { encryptBytes, decryptBytes } from '../lib/crypto.js'
import { db, daysUntil, saveDocument } from '../lib/db.js'
import { getSyncConfig, syncNow } from '../lib/sync.js'
import { scanPassport } from '../lib/ocr.js'
import { Icon } from './Icon.jsx'
import Collapsible from './Collapsible.jsx'

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

// Shrink large photos before storing: caps the longest side and re-encodes as
// JPEG so documents stay small (fast & reliable to sync) while still clearly
// readable. Also converts iPhone HEIC to universal JPEG. Non-images pass through.
async function prepareFile(file) {
  if (!file.type.startsWith('image/')) return { bytes: await file.arrayBuffer(), mime: file.type, name: file.name }
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, 2200 / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * scale)
    c.height = Math.round(bmp.height * scale)
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.82))
    // Use the shrunk version when it's actually smaller (or when converting HEIC/PNG).
    if (blob && (blob.size < file.size || !/jpe?g$/i.test(file.type))) {
      const name = /\.jpe?g$/i.test(file.name) ? file.name : file.name.replace(/\.[^.]+$/, '') + '.jpg'
      return { bytes: await blob.arrayBuffer(), mime: 'image/jpeg', name }
    }
  } catch { /* fall back to the original below */ }
  return { bytes: await file.arrayBuffer(), mime: file.type, name: file.name }
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
  const [msg, setMsg] = useState('')
  const [adding, setAdding] = useState(false)
  const [syncOn, setSyncOn] = useState(false)
  const [viewer, setViewer] = useState(null) // { url, mime, name } for the in-app viewer
  const ownerName = id => people.find(p => p.id === id)?.name || ''

  useEffect(() => { getSyncConfig().then(c => setSyncOn(c.enabled)) }, [])

  async function onView(doc) {
    setMsg('Decrypting…')
    let bytes
    try {
      bytes = await decryptBytes(vaultKey, doc.blob)
    } catch {
      // Wrong key (e.g. unlocked with a passkey bound to an old vault) or corrupt data.
      setMsg("⚠️ Couldn't decrypt this file. If you just restored a backup, lock the app and unlock with your passphrase (not Face ID), then try again.")
      setTimeout(() => setMsg(''), 7000)
      return
    }
    setMsg('')
    const url = URL.createObjectURL(new Blob([bytes], { type: doc.mime || 'application/octet-stream' }))
    const mime = doc.mime || ''
    if (mime.startsWith('image/') || mime === 'application/pdf') {
      setViewer({ url, mime, name: doc.fileName || doc.title })
    } else {
      // Other file types: trigger a download (more reliable than a new tab in PWAs).
      const a = document.createElement('a')
      a.href = url; a.download = doc.fileName || doc.title || 'document'
      document.body.appendChild(a); a.click(); a.remove()
    }
  }
  function closeViewer() { if (viewer) URL.revokeObjectURL(viewer.url); setViewer(null) }

  async function handleSync() {
    setMsg('Syncing…')
    try {
      const r = await syncNow()
      flash(`✅ Synced · ↑${r.pushed} ↓${r.pulled}` + (r.failed ? ` · ⚠️ ${r.failed} too large` : ''))
    } catch (e) { flash('⚠️ ' + e.message) }
  }
  function flash(t) { setMsg(t); reload(); setTimeout(() => setMsg(''), 2600) }

  // Soft-delete: mark removed + dirty so it also clears from synced devices.
  // (No window.confirm — it's blocked in installed PWAs; the button two-taps instead.)
  async function onDelete(doc) {
    await db.documents.update(doc.id, { deleted: 1, dirty: 1, updatedAt: Date.now() })
    if (syncOn) { try { await syncNow() } catch {} }
    flash('🗑 Deleted')
  }

  // Group documents under each family member (collapsible) to avoid one long scroll.
  const visible = documents.filter(d => !d.deleted)
  const groups = people.map(p => ({ p, docs: visible.filter(d => d.personId === p.id) })).filter(g => g.docs.length)
  const orphans = visible.filter(d => !people.some(p => p.id === d.personId))

  const grid = docs => (
    <div className="doc-grid">
      {docs.map(d => <DocCard key={d.id} doc={d} vaultKey={vaultKey} ownerName={ownerName} onView={onView} onDelete={onDelete} />)}
    </div>
  )

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

      {visible.length ? (
        <>
          {groups.map((g, i) => (
            {groups.map(g => (
            <Collapsible key={g.p.id} id={'vault-' + g.p.id} icon="user" title={g.p.name} badge={g.docs.length}>
              {grid(g.docs)}
            </Collapsible>
          ))}
          {orphans.length > 0 && (
            <Collapsible id="vault-other" icon="users" title="Other" badge={orphans.length}>{grid(orphans)}</Collapsible>
          )}
        </>
      ) : (
        <div className="empty">
          <div className="ico"><Icon name="shield" size={22} /></div>
          <b>No documents here yet</b>
          <span>Tap “＋ Add document” to store your first one — encrypted on this device.</span>
        </div>
      )}

      {adding && <AddDocModal people={people} vaultKey={vaultKey}
        onClose={() => setAdding(false)}
        onSaved={() => { setAdding(false); flash('✅ Encrypted & stored on device') }} />}

      {viewer && (
        <div className="modal-backdrop" onClick={closeViewer}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '94vw', width: 'auto', textAlign: 'center' }}>
            {viewer.mime.startsWith('image/')
              ? <img src={viewer.url} alt={viewer.name}
                  style={{ maxWidth: '100%', maxHeight: '78vh', borderRadius: 10, display: 'block', margin: '0 auto' }} />
              : <iframe src={viewer.url} title={viewer.name}
                  style={{ width: '86vw', maxWidth: 760, height: '78vh', border: 'none', borderRadius: 10, background: '#fff' }} />}
            <div className="modal-actions" style={{ justifyContent: 'center', marginTop: 14 }}>
              <a className="btn ghost" href={viewer.url} download={viewer.name}>⬇️ Download</a>
              <button className="btn" onClick={closeViewer}>Close</button>
            </div>
          </div>
        </div>
      )}

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

  // Read the passport MRZ and pre-fill the form (all in-browser).
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
    let blob = null, thumb = null, mime = null, fileName = null
    if (file) {
      const prepared = await prepareFile(file)   // shrink/convert large photos first
      blob = await encryptBytes(vaultKey, prepared.bytes)
      mime = prepared.mime
      fileName = prepared.name
      const t = await makeThumb(file)
      if (t) thumb = await encryptBytes(vaultKey, t)
    }
    await saveDocument({
      personId, type, title: title || type, expiryDate: expiry || null, number: number || null,
      tripId: null, blob, thumb, mime, fileName
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
