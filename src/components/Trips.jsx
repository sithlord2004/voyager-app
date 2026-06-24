import { useEffect, useState } from 'react'
import { geocode, tripWeather, WMO, FLAGS } from '../lib/weather.js'
import { db, daysUntil, createTrip } from '../lib/db.js'
import { parseItinerarySmart, extractTextFromFile } from '../lib/itinerary.js'
import { getSyncConfig } from '../lib/sync.js'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function fmtRange(s, e) {
  const a = new Date(s + 'T00:00'), b = new Date(e + 'T00:00')
  return `${MONTHS[a.getMonth()]} ${a.getDate()} – ${MONTHS[b.getMonth()]} ${b.getDate()}, ${b.getFullYear()}`
}

function TripRow({ trip, docCount, onDelete }) {
  const [w, setW] = useState(null)
  const [confirmDel, setConfirmDel] = useState(false)
  useEffect(() => {
    (async () => {
      const p = await geocode(trip.destinationCity)
      if (!p) return
      const tw = await tripWeather(p.latitude, p.longitude, trip.startDate, trip.endDate)
      setW({ ...tw, flag: FLAGS[p.country_code] || '' })
    })()
  }, [trip.id])

  const du = daysUntil(trip.startDate)
  const cd = du < 0 ? 'past' : du === 0 ? 'today' : `in ${du} days`
  const ic = w ? (WMO[w.code] || ['',''])[0] : ''

  return (
    <div className="trip-row">
      <div className="trip-flag">{w?.flag || '🗺️'}</div>
      <div className="info">
        <b>{trip.destinationCity} {w?.flag || ''}</b>
        <small>{fmtRange(trip.startDate, trip.endDate)} · {trip.travellerIds.length} travellers{trip.flight ? ' · ' + trip.flight.number : ''}</small>
      </div>
      <div className="cnt">
        <div><b>{docCount}</b><small>docs</small></div>
        <div><b>{w ? `${ic} ${w.temp}°` : '…'}</b><small>{w ? (w.mode === 'forecast' ? '🟢 forecast' : '📅 seasonal') : 'weather'}</small></div>
        <div><b>{trip.flight ? '✈️' : '—'}</b><small>{trip.flight ? 'tracked' : 'no flight'}</small></div>
      </div>
      <div className="countdown">{cd}</div>
      <button title="Delete trip" onClick={() => confirmDel ? onDelete(trip) : setConfirmDel(true)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: confirmDel ? 12 : 16, marginLeft: 10, color: confirmDel ? '#f87171' : 'inherit', opacity: 0.85 }}>
        {confirmDel ? 'Confirm?' : '🗑'}</button>
    </div>
  )
}

export default function Trips({ trips, documents, reload }) {
  const [importing, setImporting] = useState(false)
  async function onDelete(trip) {
    await db.trips.delete(trip.id)
    reload?.()
  }
  return (
    <div>
      <div className="topbar">
        <div><h2>Trips</h2><div className="sub">Everything for each journey in one place.</div></div>
        <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => setImporting(true)}>📩 Import itinerary</button>
      </div>
      {trips.map(t => (
        <TripRow key={t.id} trip={t} onDelete={onDelete} docCount={documents.filter(d => d.tripId === t.id).length || t.travellerIds.length} />
      ))}
      <div className="desc" style={{ marginTop: 8 }}>
        🟢 <b>forecast</b> = live forecast (trip within ~14 days) &nbsp;·&nbsp; 📅 <b>seasonal</b> = historical average for those dates
      </div>
      {importing && <ImportModal onClose={() => setImporting(false)} onSaved={() => { setImporting(false); reload?.() }} />}
    </div>
  )
}

function ImportModal({ onClose, onSaved }) {
  const [text, setText] = useState('')
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)

  async function runParse(t) {
    const cfg = await getSyncConfig()
    setDraft(await parseItinerarySmart(t, cfg))
  }
  async function onFile(file) {
    if (!file) return
    setBusy(true)
    try { const t = await extractTextFromFile(file); setText(t); await runParse(t) }
    catch { setDraft(null) }
    setBusy(false)
  }
  async function parsePasted() { setBusy(true); await runParse(text); setBusy(false) }
  function field(k, v) { setDraft({ ...draft, [k]: v }) }

  async function save() {
    await createTrip({
      destinationCity: draft.destinationCity, startDate: draft.startDate, endDate: draft.endDate,
      flight: draft.flightNumber ? {
        number: draft.flightNumber, airline: draft.airline,
        depAirport: draft.depAirport, arrAirport: draft.arrAirport, depTime: ''
      } : null
    })
    onSaved()
  }

  const c = draft?.confidence
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Import itinerary</h3>
        {!draft ? (
          <>
            <p className="desc">Upload a booking PDF/email, or paste the confirmation text. We’ll pull out the trip — you confirm before saving.</p>
            <div className="file-row">
              <label className="mini">📁 Upload file
                <input type="file" accept=".pdf,.txt,.eml,.ics" hidden onChange={e => onFile(e.target.files[0])} />
              </label>
              <span className="file-name">{busy ? 'Reading…' : 'PDF, .eml, .txt'}</span>
            </div>
            <label>…or paste text
              <textarea rows={5} value={text} onChange={e => setText(e.target.value)} placeholder="Paste your booking confirmation here" />
            </label>
            <div className="modal-actions">
              <button className="btn ghost" onClick={onClose}>Cancel</button>
              <button className="btn" onClick={parsePasted} disabled={!text.trim()}>Extract trip →</button>
            </div>
          </>
        ) : (
          <>
            <p className="desc">{draft.source === 'llm' ? '✨ AI-assisted extraction. ' : `Found ${c?.dates ?? 0} date(s), ${c?.flights ?? 0} flight(s). `}Check and edit:</p>
            <label>Destination <input value={draft.destinationCity} onChange={e => field('destinationCity', e.target.value)} placeholder="City" /></label>
            <div style={{ display: 'flex', gap: 10 }}>
              <label style={{ flex: 1 }}>Start <input type="date" value={draft.startDate} onChange={e => field('startDate', e.target.value)} /></label>
              <label style={{ flex: 1 }}>End <input type="date" value={draft.endDate} onChange={e => field('endDate', e.target.value)} /></label>
            </div>
            <label>Flight number <input value={draft.flightNumber} onChange={e => field('flightNumber', e.target.value)} placeholder="e.g. JL044" /></label>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setDraft(null)}>← Back</button>
              <button className="btn" onClick={save} disabled={!draft.destinationCity || !draft.startDate}>＋ Create trip</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
