import { useRef, useState } from 'react'
import { buildTripStory, fetchTripWeather } from '../lib/tripStory.js'
import { Icon } from './Icon.jsx'
import ModalPortal from './ModalPortal.jsx'

// Photos are shrunk before being embedded — a keepsake you can email should be
// a few MB, not fifty. 1400px is plenty for screen and print.
async function shrink(file, max = 1400, quality = 0.78) {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale)
  c.height = Math.round(bmp.height * scale)
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', quality)
}

export default function TripStory({ trip, plans = [], people = [], onClose }) {
  const [photos, setPhotos] = useState([])
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const fileRef = useRef(null)

  async function addPhotos(files) {
    if (!files?.length) return
    setBusy(`Preparing ${files.length} photo${files.length === 1 ? '' : 's'}…`)
    const out = []
    for (const f of Array.from(files).slice(0, 40)) {
      if (!f.type.startsWith('image/')) continue
      try { out.push(await shrink(f)) } catch { /* skip anything unreadable */ }
    }
    setPhotos(p => [...p, ...out])
    setBusy('')
  }

  const approxMb = (photos.reduce((n, p) => n + p.length, 0) * 0.75 / 1048576).toFixed(1)

  async function create() {
    setBusy('Building your trip story…')
    // Historical weather is a lovely detail but never blocks the export.
    const weather = await fetchTripWeather(trip.destinationCity, trip.startDate, trip.endDate)
    const html = buildTripStory({ trip, plans, people, photos, weather })
    const name = `${trip.destinationCity.replace(/\s+/g, '-')}-${new Date(trip.startDate + 'T00:00').getFullYear()}.html`
    const file = new File([html], name, { type: 'text/html' })
    setBusy('')

    // Share sheet on a phone (Save to Files, AirDrop, Mail); download elsewhere.
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: `${trip.destinationCity} — trip story` }); return }
      catch { /* cancelled — fall through to download */ }
    }
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url; a.download = name
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
    setMsg('Saved. Open it in any browser — it works offline and prints to PDF.')
  }

  return (
    <ModalPortal>
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
          <h3>Trip story · {trip.destinationCity}</h3>
          <p className="desc">
            A keepsake of this trip as a single file: the route, day by day with the weather you
            actually had, and your photos. It opens on any device, works offline and prints to PDF.
          </p>

          <div className="ts-photos">
            {photos.map((src, i) => (
              <div className="ts-thumb" key={i}>
                <img src={src} alt="" />
                <button onClick={() => setPhotos(p => p.filter((_, j) => j !== i))} aria-label="Remove">
                  <Icon name="x" size={13} />
                </button>
              </div>
            ))}
            <button className="ts-add" onClick={() => fileRef.current?.click()}>
              <Icon name="image" size={20} />
              <span>Add photos</span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden
              onChange={e => { addPhotos(e.target.files); e.target.value = '' }} />
          </div>

          {photos.length > 0 && (
            <p className="desc" style={{ fontSize: 11.5 }}>
              {photos.length} photo{photos.length === 1 ? '' : 's'} · about {approxMb} MB.
              Photos are only used for this file — they aren’t stored in the app or synced.
            </p>
          )}

          {busy && <div className="desc">{busy}</div>}
          {msg && <div className="desc">{msg}</div>}

          <div className="modal-actions">
            <button className="btn ghost" onClick={onClose}>Close</button>
            <button className="btn" onClick={create} disabled={!!busy}>
              {busy ? 'Working…' : 'Create trip story'}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}
