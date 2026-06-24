import { useEffect, useState } from 'react'
import { geocode, tripWeather, WMO, FLAGS } from '../lib/weather.js'
import { daysUntil, createTrip, updateTrip, deleteTrip } from '../lib/db.js'
import { parseItinerarySmart, extractTextFromFile } from '../lib/itinerary.js'
import { getSyncConfig } from '../lib/sync.js'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MODES = [['flight', '✈️', 'Flight'], ['train', '🚆', 'Train'], ['car', '🚗', 'Car/Drive'], ['ferry', '⛴️', 'Ferry'], ['bus', '🚌', 'Bus']]
const modeIcon = m => (MODES.find(x => x[0] === m) || ['', '✈️'])[1]

function fmtRange(s, e) {
  const a = new Date(s + 'T00:00'), b = new Date(e + 'T00:00')
  return `${MONTHS[a.getMonth()]} ${a.getDate()} – ${MONTHS[b.getMonth()]} ${b.getDate()}, ${b.getFullYear()}`
}

function tripLegs(trip) {
  if (trip.legs?.length) return trip.legs
  if (trip.flight) return [{ from: trip.flight.depAirport, to: trip.flight.arrAirport, mode: 'flight', number: trip.flight.number, date: trip.startDate }]
  return []
}

function TripRow({ trip, docCount, onDelete, onEdit }) {
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
  const ic = w ? (WMO[w.code] || ['', ''])[0] : ''
  const legs = tripLegs(trip)
  const legsLine = legs.map(l => `${l.from || '?'} ${modeIcon(l.mode)} ${l.to || '?'}${l.number ? ' ' + l.number : ''}`).join('   ·   ')
  const stays = trip.stays || []
  const staysLine = stays.map(s => `${s.kind === 'airbnb' ? '🏠' : '🏨'} ${s.name}${s.checkIn ? ' · ' + s.checkIn : ''}`).join('   ·   ')

  return (
    <div className="trip-row">
      <div className="trip-flag">{w?.flag || '🗺️'}</div>
      <div className="info">
        <b>{trip.destinationCity} {w?.flag || ''}</b>
        <small>{fmtRange(trip.startDate, trip.endDate)} · {trip.travellerIds.length} travellers</small>
        {legsLine && <small style={{ opacity: .9 }}>{legsLine}</small>}
        {staysLine && <small style={{ opacity: .9 }}>{staysLine}</small>}
      </div>
      <div className="cnt">
        <div><b>{docCount}</b><small>docs</small></div>
        <div><b>{w ? `${ic} ${w.temp}°` : '…'}</b><small>{w ? (w.mode === 'forecast' ? '🟢 forecast' : '📅 seasonal') : 'weather'}</small></div>
        <div><b>{legs.length || '—'}</b><small>{legs.length ? 'legs' : 'no legs'}</small></div>
      </div>
      <div className="countdown">{cd}</div>
      <button className="mini" title="Edit trip" onClick={() => onEdit(trip)} style={{ marginLeft: 10 }}>✏️</button>
      <button title="Delete trip" onClick={() => confirmDel ? onDelete(trip) : setConfirmDel(true)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: confirmDel ? 12 : 16, marginLeft: 8, color: confirmDel ? '#f87171' : 'inherit', opacity: 0.85 }}>
        {confirmDel ? 'Confirm?' : '🗑'}</button>
    </div>
  )
}

export default function Trips({ trips, documents, reload }) {
  const [importing, setImporting] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  async function onDelete(trip) {
    await deleteTrip(trip.id)
    reload?.()
  }
  return (
    <div>
      <div className="topbar">
        <div><h2>Trips</h2><div className="sub">Everything for each journey in one place.</div></div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn ghost" onClick={() => setAdding(true)}>＋ Add manually</button>
          <button className="btn" onClick={() => setImporting(true)}>📩 Import itinerary</button>
        </div>
      </div>
      {trips.map(t => (
        <TripRow key={t.id} trip={t} onDelete={onDelete} onEdit={setEditing} docCount={documents.filter(d => d.tripId === t.id).length || t.travellerIds.length} />
      ))}
      <div className="desc" style={{ marginTop: 8 }}>
        🟢 <b>forecast</b> = live forecast (trip within ~14 days) &nbsp;·&nbsp; 📅 <b>seasonal</b> = historical average for those dates
      </div>
      {importing && <ImportModal onClose={() => setImporting(false)} onSaved={() => { setImporting(false); reload?.() }} />}
      {(adding || editing) && <AddTripModal trip={editing}
        onClose={() => { setAdding(false); setEditing(null) }}
        onSaved={() => { setAdding(false); setEditing(null); reload?.() }} />}
    </div>
  )
}

function AddTripModal({ onClose, onSaved, trip }) {
  const seedLegs = trip ? tripLegs(trip) : []
  const [city, setCity] = useState(trip?.destinationCity || '')
  const [start, setStart] = useState(trip?.startDate || '')
  const [end, setEnd] = useState(trip?.endDate || '')
  const [legs, setLegs] = useState(seedLegs.length ? seedLegs.map(l => ({ date: l.date || '', from: l.from || '', to: l.to || '', mode: l.mode || 'flight', number: l.number || '' })) : [{ date: '', from: '', to: '', mode: 'flight', number: '' }])
  const [stays, setStays] = useState(trip?.stays || [])
  const [busy, setBusy] = useState(false)

  const setLeg = (i, patch) => setLegs(legs.map((l, idx) => idx === i ? { ...l, ...patch } : l))
  const addLeg = () => setLegs([...legs, { date: '', from: '', to: '', mode: 'flight', number: '' }])
  const removeLeg = i => setLegs(legs.filter((_, idx) => idx !== i))

  const setStay = (i, patch) => setStays(stays.map((s, idx) => idx === i ? { ...s, ...patch } : s))
  const addStay = () => setStays([...stays, { kind: 'hotel', name: '', checkIn: '', checkOut: '', ref: '' }])
  const removeStay = i => setStays(stays.filter((_, idx) => idx !== i))

  async function save() {
    if (!city.trim() || !start) return
    setBusy(true)
    let countryCode = null
    try { const p = await geocode(city.trim()); if (p) countryCode = p.country_code } catch {}
    const cleanLegs = legs
      .filter(l => l.from || l.to || l.number || l.date)
      .map(l => ({ ...l, from: l.from.trim().toUpperCase(), to: l.to.trim().toUpperCase(), number: l.number.trim().toUpperCase() }))
    const cleanStays = stays.filter(s => s.name.trim()).map(s => ({ ...s, name: s.name.trim(), ref: (s.ref || '').trim() }))
    const fields = { destinationCity: city.trim(), startDate: start, endDate: end || start, countryCode, legs: cleanLegs, stays: cleanStays }
    if (trip) await updateTrip(trip.id, fields)
    else await createTrip(fields)
    setBusy(false)
    onSaved()
  }

  const fieldStyle = { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text)', fontSize: 14, minHeight: 40 }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <h3>{trip ? 'Edit trip' : 'Add a trip'}</h3>
        <label>Main destination (for weather) <input value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. London" /></label>
        <div style={{ display: 'flex', gap: 10 }}>
          <label style={{ flex: 1 }}>Leaving <input type="date" value={start} onChange={e => setStart(e.target.value)} /></label>
          <label style={{ flex: 1 }}>Returning <input type="date" value={end} onChange={e => setEnd(e.target.value)} /></label>
        </div>

        <div style={{ fontSize: 12.5, color: 'var(--text-2)', margin: '4px 0 8px', fontWeight: 600 }}>Journey legs</div>
        {legs.map((l, i) => (
          <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 10, marginBottom: 10, display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="date" value={l.date} onChange={e => setLeg(i, { date: e.target.value })} style={{ ...fieldStyle, flex: 1 }} />
              <select value={l.mode} onChange={e => setLeg(i, { mode: e.target.value })} style={fieldStyle}>
                {MODES.map(([v, ic, label]) => <option key={v} value={v}>{ic} {label}</option>)}
              </select>
              {legs.length > 1 && <button onClick={() => removeLeg(i)} title="Remove leg"
                style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 16 }}>✕</button>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={l.from} onChange={e => setLeg(i, { from: e.target.value })} placeholder="From (e.g. MEL)" style={{ ...fieldStyle, flex: 1 }} />
              <input value={l.to} onChange={e => setLeg(i, { to: e.target.value })} placeholder="To (e.g. LON)" style={{ ...fieldStyle, flex: 1 }} />
            </div>
            <input value={l.number} onChange={e => setLeg(i, { number: e.target.value })}
              placeholder={l.mode === 'flight' ? 'Flight number (optional)' : 'Reference / number (optional)'} style={fieldStyle} />
          </div>
        ))}
        <button className="btn ghost" onClick={addLeg} style={{ width: '100%' }}>＋ Add another leg</button>

        <div style={{ fontSize: 12.5, color: 'var(--text-2)', margin: '16px 0 8px', fontWeight: 600 }}>Stays (hotels / Airbnb)</div>
        {stays.map((s, i) => (
          <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 10, marginBottom: 10, display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={s.kind} onChange={e => setStay(i, { kind: e.target.value })} style={fieldStyle}>
                <option value="hotel">🏨 Hotel</option>
                <option value="airbnb">🏠 Airbnb</option>
                <option value="other">🏡 Other</option>
              </select>
              <input value={s.name} onChange={e => setStay(i, { name: e.target.value })} placeholder="Name / property" style={{ ...fieldStyle, flex: 1 }} />
              <button onClick={() => removeStay(i)} title="Remove stay"
                style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="date" value={s.checkIn} onChange={e => setStay(i, { checkIn: e.target.value })} style={{ ...fieldStyle, flex: 1 }} />
              <input type="date" value={s.checkOut} onChange={e => setStay(i, { checkOut: e.target.value })} style={{ ...fieldStyle, flex: 1 }} />
            </div>
            <input value={s.ref} onChange={e => setStay(i, { ref: e.target.value })} placeholder="Confirmation # / address (optional)" style={fieldStyle} />
          </div>
        ))}
        <button className="btn ghost" onClick={addStay} style={{ width: '100%' }}>＋ Add a stay</button>

        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={save} disabled={busy || !city.trim() || !start}>{busy ? 'Saving…' : trip ? 'Save changes' : '＋ Create trip'}</button>
        </div>
      </div>
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
      legs: draft.flightNumber ? [{ from: draft.depAirport, to: draft.arrAirport, mode: 'flight', number: draft.flightNumber, date: draft.startDate }] : []
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
              <label style={{ flex: 1 }}>Leaving <input type="date" value={draft.startDate} onChange={e => field('startDate', e.target.value)} /></label>
              <label style={{ flex: 1 }}>Returning <input type="date" value={draft.endDate} onChange={e => field('endDate', e.target.value)} /></label>
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
