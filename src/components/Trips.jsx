import { useEffect, useState } from 'react'
import { geocode, tripWeather, WMO, FLAGS } from '../lib/weather.js'
import { daysUntil, createTrip, updateTrip, deleteTrip, setSetting } from '../lib/db.js'
import { parseItinerarySmart, extractTextFromFile } from '../lib/itinerary.js'
import { getSyncConfig } from '../lib/sync.js'
import { toCode } from '../lib/airports.js'
import { Icon } from './Icon.jsx'
import Postcard from './Postcard.jsx'
import JourneyMap from './JourneyMap.jsx'

// Display an endpoint consistently: flights as 3-letter codes, other modes as typed.
const legEndpoint = (v, mode) => mode === 'flight' ? (toCode(v) || '?') : (v || '?')

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MODES = [['flight', '✈️', 'Flight'], ['train', '🚆', 'Train'], ['car', '🚗', 'Car/Drive'], ['ferry', '⛴️', 'Ferry'], ['bus', '🚌', 'Bus']]
const modeIcon = m => (MODES.find(x => x[0] === m) || ['', '✈️'])[1]

// A live-status / live-departures link for legs that support it (flights & trains).
function liveUrl(l) {
  if (l.mode === 'flight' && l.number) return `https://www.google.com/search?q=${encodeURIComponent(l.number + ' flight status')}`
  if (l.mode === 'train') {
    const q = [l.number, l.from && 'from ' + l.from, l.to && 'to ' + l.to, 'live departures'].filter(Boolean).join(' ')
    return `https://www.google.com/search?q=${encodeURIComponent(q || 'train live departures')}`
  }
  return null
}

function fmtRange(s, e) {
  const a = new Date(s + 'T00:00'), b = new Date(e + 'T00:00')
  return `${MONTHS[a.getMonth()]} ${a.getDate()} – ${MONTHS[b.getMonth()]} ${b.getDate()}, ${b.getFullYear()}`
}

// Normalise a trip into a list of legs (supports new multi-leg trips, legacy
// single-flight trips, and imported trips).
function tripLegs(trip) {
  if (trip.legs?.length) return trip.legs
  if (trip.flight) return [{ from: trip.flight.depAirport, to: trip.flight.arrAirport, mode: 'flight', number: trip.flight.number, date: trip.startDate }]
  return []
}

function TripRow({ trip, docCount, onDelete, onEdit, onPostcard, onMap }) {
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
  const legsLine = legs.map(l => `${legEndpoint(l.from, l.mode)} ${modeIcon(l.mode)} ${legEndpoint(l.to, l.mode)}${l.number ? ' ' + l.number : ''}${l.seat ? ' · ' + l.seat : ''}`).join('   ·   ')
  const liveLegs = legs.filter(l => liveUrl(l))
  const stays = trip.stays || []
  const staysLine = stays.map(s => `${s.kind === 'airbnb' ? '🏠' : '🏨'} ${s.name}${s.checkIn ? ' · ' + s.checkIn : ''}`).join('   ·   ')

  return (
    <div className="trip-row">
      <div className="trip-flag">{w?.flag || '🗺️'}</div>
      <div className="info">
        <b>{trip.destinationCity} {w?.flag || ''}</b>
        <small>{fmtRange(trip.startDate, trip.endDate)} · {trip.travellerIds.length} travellers</small>
        {legsLine && <small style={{ opacity: .9 }}>{legsLine}</small>}
        {liveLegs.length > 0 && (
          <div className="leg-live">
            {liveLegs.map((l, i) => (
              <a key={i} className="mini" href={liveUrl(l)} target="_blank" rel="noopener noreferrer">
                {modeIcon(l.mode)} {l.number || (l.mode === 'flight' ? 'flight' : 'train')} · live
              </a>
            ))}
          </div>
        )}
        {staysLine && <small style={{ opacity: .9 }}>{staysLine}</small>}
      </div>
      <div className="cnt">
        <div><b>{docCount}</b><small>docs</small></div>
        <div><b>{w ? `${ic} ${w.temp}°` : '…'}</b><small>{w ? (w.mode === 'forecast' ? '🟢 forecast' : '📅 seasonal') : 'weather'}</small></div>
        <div><b>{legs.length || '—'}</b><small>{legs.length ? 'legs' : 'no legs'}</small></div>
      </div>
      <div className="countdown">{cd}</div>
      <div className="trip-actions">
        <button className="icon-btn" title="Journey map" onClick={() => onMap(trip)}><Icon name="map" size={17} /></button>
        <button className="icon-btn" title="Trip postcard" onClick={() => onPostcard(trip)}><Icon name="share" size={17} /></button>
        <button className="icon-btn" title="Edit trip" onClick={() => onEdit(trip)}><Icon name="edit" size={17} /></button>
        <button className="icon-btn" title="Delete trip" onClick={() => confirmDel ? onDelete(trip) : setConfirmDel(true)}
          style={confirmDel ? { color: '#f87171' } : null}>
          {confirmDel ? <span style={{ fontSize: 11, fontWeight: 700 }}>Sure?</span> : <Icon name="trash" size={17} />}
        </button>
      </div>
    </div>
  )
}

export default function Trips({ trips, documents, people = [], reload, hiddenTripCount = 0 }) {
  const [importing, setImporting] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const [seed, setSeed] = useState(null)
  const [postcard, setPostcard] = useState(null)
  const [mapTrip, setMapTrip] = useState(null)
  async function onDelete(trip) {
    await deleteTrip(trip.id)
    reload?.()
  }
  async function revealHidden() {
    await setSetting('showAllTrips', 1)
    reload?.()
  }
  return (
    <div>
      <div className="topbar">
        <div><h2>Trips</h2><div className="sub">Everything for each journey in one place.</div></div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn ghost" onClick={() => setAdding(true)}><Icon name="plus" size={15} /> Add manually</button>
          <button className="btn" onClick={() => setImporting(true)}><Icon name="download" size={15} /> Import itinerary</button>
        </div>
      </div>
      {hiddenTripCount > 0 && (
        <div className="desc" style={{ marginBottom: 10, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 10 }}>
          👤 Showing only trips you’re on. {hiddenTripCount} other family {hiddenTripCount === 1 ? 'trip is' : 'trips are'} hidden.{' '}
          <a onClick={revealHidden} style={{ cursor: 'pointer', fontWeight: 600 }}>Show all →</a>
        </div>
      )}
      {trips.map(t => (
        <TripRow key={t.id} trip={t} onDelete={onDelete} onEdit={setEditing} onPostcard={setPostcard} onMap={setMapTrip} docCount={documents.filter(d => d.tripId === t.id).length || t.travellerIds.length} />
      ))}
      <div className="desc" style={{ marginTop: 8 }}>
        🟢 <b>forecast</b> = live forecast (trip within ~14 days) &nbsp;·&nbsp; 📅 <b>seasonal</b> = historical average for those dates
      </div>
      {importing && <ImportModal onClose={() => setImporting(false)}
        onSeed={s => { setImporting(false); setSeed(s) }} />}
      {(adding || editing || seed) && <AddTripModal trip={editing} seed={seed} people={people}
        onClose={() => { setAdding(false); setEditing(null); setSeed(null) }}
        onSaved={() => { setAdding(false); setEditing(null); setSeed(null); reload?.() }} />}
      {postcard && <Postcard trip={postcard} onClose={() => setPostcard(null)} />}
      {mapTrip && <JourneyMap trip={mapTrip} onClose={() => setMapTrip(null)} />}
    </div>
  )
}

function AddTripModal({ onClose, onSaved, trip, seed, people = [] }) {
  const src = trip || seed || null
  const seedLegs = src ? tripLegs(src) : []
  const [city, setCity] = useState(src?.destinationCity || '')
  const [start, setStart] = useState(src?.startDate || '')
  const [end, setEnd] = useState(src?.endDate || '')
  const [legs, setLegs] = useState(seedLegs.length ? seedLegs.map(l => ({ date: l.date || '', from: l.from || '', to: l.to || '', mode: l.mode || 'flight', number: l.number || '', seat: l.seat || '' })) : [{ date: '', from: '', to: '', mode: 'flight', number: '', seat: '' }])
  const [stays, setStays] = useState(src?.stays || [])
  const [travellerIds, setTravellerIds] = useState(src?.travellerIds || [])
  const [busy, setBusy] = useState(false)

  const toggleTraveller = id => setTravellerIds(travellerIds.includes(id) ? travellerIds.filter(x => x !== id) : [...travellerIds, id])

  const setLeg = (i, patch) => setLegs(legs.map((l, idx) => idx === i ? { ...l, ...patch } : l))
  const addLeg = () => setLegs([...legs, { date: '', from: '', to: '', mode: 'flight', number: '', seat: '' }])
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
      .filter(l => l.from || l.to || l.number || l.date || l.seat)
      .map(l => {
        const up = l.mode === 'flight'   // only flights use uppercase codes; keep station/service names as typed
        return {
          date: l.date, mode: l.mode,
          from: up ? l.from.trim().toUpperCase() : l.from.trim(),
          to: up ? l.to.trim().toUpperCase() : l.to.trim(),
          number: up ? l.number.trim().toUpperCase() : l.number.trim(),
          seat: (l.seat || '').trim()
        }
      })
    const cleanStays = stays.filter(s => s.name.trim()).map(s => ({ ...s, name: s.name.trim(), ref: (s.ref || '').trim() }))
    const fields = { destinationCity: city.trim(), startDate: start, endDate: end || start, countryCode, legs: cleanLegs, stays: cleanStays, travellerIds }
    if (trip) await updateTrip(trip.id, fields)
    else await createTrip(fields)
    setBusy(false)
    onSaved()
  }

  const fieldStyle = { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text)', fontSize: 14, minHeight: 40 }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <h3>{trip ? 'Edit trip' : seed ? 'Review imported trip' : 'Add a trip'}</h3>
        {seed && <p className="desc" style={{ marginTop: -4 }}>Pulled from your booking — check each leg, then save.</p>}
        <label>Main destination (for weather) <input value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. London" /></label>
        <label>Leaving <input type="date" value={start} onChange={e => setStart(e.target.value)} /></label>
        <label>Returning <input type="date" value={end} onChange={e => setEnd(e.target.value)} /></label>

        {people.length > 0 && (
          <>
            <div style={{ fontSize: 12.5, color: 'var(--text-2)', margin: '10px 0 8px', fontWeight: 600 }}>Who's travelling?</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              {people.map(p => {
                const on = travellerIds.includes(p.id)
                return (
                  <button key={p.id} type="button" onClick={() => toggleTraveller(p.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
                      border: '1px solid ' + (on ? (p.color || '#3b82f6') : 'var(--border)'),
                      background: on ? (p.color || '#3b82f6') : 'transparent',
                      color: on ? '#fff' : 'var(--text)', fontSize: 13, fontWeight: 600
                    }}>
                    <span>{on ? '✓' : '＋'}</span>{p.name}
                  </button>
                )
              })}
            </div>
            {travellerIds.length === 0 && <p className="desc" style={{ marginTop: 0, fontSize: 11.5 }}>Tip: with nobody selected, this trip shows for everyone.</p>}
          </>
        )}

        <div style={{ fontSize: 12.5, color: 'var(--text-2)', margin: '4px 0 8px', fontWeight: 600 }}>Journey legs</div>
        {legs.map((l, i) => (
          <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 10, marginBottom: 10, display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="date" value={l.date} onChange={e => setLeg(i, { date: e.target.value })} style={{ ...fieldStyle, flex: '1 1 132px', minWidth: 120 }} />
              <select value={l.mode} onChange={e => setLeg(i, { mode: e.target.value })} style={{ ...fieldStyle, flex: '2 1 150px', minWidth: 0 }}>
                {MODES.map(([v, ic, label]) => <option key={v} value={v}>{ic} {label}</option>)}
              </select>
              {legs.length > 1 && <button onClick={() => removeLeg(i)} title="Remove leg"
                style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 16 }}>✕</button>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={l.from} onChange={e => setLeg(i, { from: e.target.value })}
                placeholder={l.mode === 'flight' ? 'From (e.g. LHR)' : l.mode === 'train' ? 'From station' : 'From'} style={{ ...fieldStyle, flex: 1 }} />
              <input value={l.to} onChange={e => setLeg(i, { to: e.target.value })}
                placeholder={l.mode === 'flight' ? 'To (e.g. HND)' : l.mode === 'train' ? 'To station' : 'To'} style={{ ...fieldStyle, flex: 1 }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={l.number} onChange={e => setLeg(i, { number: e.target.value })}
                placeholder={l.mode === 'flight' ? 'Flight number (optional)' : l.mode === 'train' ? 'Service (e.g. Eurostar 9024)' : 'Reference / number (optional)'} style={{ ...fieldStyle, flex: 1 }} />
              <input value={l.seat || ''} onChange={e => setLeg(i, { seat: e.target.value })}
                placeholder={l.mode === 'flight' ? 'Seat (optional)' : l.mode === 'train' ? 'Coach / seat (optional)' : 'Seat / detail (optional)'} style={{ ...fieldStyle, flex: 1 }} />
            </div>
          </div>
        ))}
        <button className="btn ghost" onClick={addLeg} style={{ width: '100%' }}><Icon name="plus" size={15} /> Add another leg</button>

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
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input type="date" value={s.checkIn} onChange={e => setStay(i, { checkIn: e.target.value })} style={{ ...fieldStyle, flex: '1 1 140px', minWidth: 0 }} />
              <input type="date" value={s.checkOut} onChange={e => setStay(i, { checkOut: e.target.value })} style={{ ...fieldStyle, flex: '1 1 140px', minWidth: 0 }} />
            </div>
            <input value={s.ref} onChange={e => setStay(i, { ref: e.target.value })} placeholder="Confirmation # / address (optional)" style={fieldStyle} />
          </div>
        ))}
        <button className="btn ghost" onClick={addStay} style={{ width: '100%' }}><Icon name="plus" size={15} /> Add a stay</button>

        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={save} disabled={busy || !city.trim() || !start}>{busy ? 'Saving…' : trip ? 'Save changes' : 'Create trip'}</button>
        </div>
      </div>
    </div>
  )
}

function ImportModal({ onClose, onSeed }) {
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

  // All detected legs (new multi-leg array, or the single legacy flight).
  const legs = draft
    ? (draft.legs?.length ? draft.legs
      : (draft.flightNumber ? [{ mode: 'flight', number: draft.flightNumber, from: draft.depAirport, to: draft.arrAirport, date: draft.startDate }] : []))
    : []

  // Hand everything to the full trip editor for review + save.
  function proceed() {
    const stay = draft.stay
    onSeed({
      destinationCity: draft.destinationCity || '',
      startDate: draft.startDate || stay?.checkIn || '',
      endDate: draft.endDate || stay?.checkOut || draft.startDate || '',
      legs,
      stays: stay ? [{
        kind: stay.kind || 'hotel',
        name: (stay.name || '').trim() || 'Stay',
        checkIn: stay.checkIn || '', checkOut: stay.checkOut || '',
        ref: [stay.ref, stay.address].filter(Boolean).join(' · ')
      }] : []
    })
  }

  const c = draft?.confidence
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Import itinerary</h3>
        {!draft ? (
          <>
            <p className="desc">Upload a booking PDF/email, or paste the confirmation text. We’ll pull out the trip — you review and edit everything before saving.</p>
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
              <button className="btn" onClick={parsePasted} disabled={busy || !text.trim()}>{busy ? 'Reading…' : 'Extract trip →'}</button>
            </div>
          </>
        ) : (
          <>
            <p className="desc">{draft.source === 'llm' ? '✨ AI-assisted extraction. ' : `Found ${c?.dates ?? 0} date(s), ${c?.flights ?? 0} flight(s). `}Here’s what we found:</p>
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, display: 'grid', gap: 8, fontSize: 13.5 }}>
              <div><b>Destination</b> · {draft.destinationCity || <span style={{ opacity: .6 }}>not detected — add on next screen</span>}</div>
              <div><b>Dates</b> · {draft.startDate || '—'}{draft.endDate && draft.endDate !== draft.startDate ? ` → ${draft.endDate}` : ''}</div>
              <div>
                <b>Journey</b>
                {legs.length ? (
                  <div style={{ marginTop: 4, display: 'grid', gap: 3 }}>
                    {legs.map((l, i) => (
                      <div key={i} style={{ opacity: .95 }}>
                        {modeIcon(l.mode)} {(l.from || '?')} → {(l.to || '?')}{l.number ? ' · ' + l.number : ''}{l.date ? ' · ' + l.date : ''}
                      </div>
                    ))}
                  </div>
                ) : <span style={{ opacity: .6 }}> · no legs detected — add on next screen</span>}
              </div>
              {draft.stay && (
                <div><b>Stay</b> · {draft.stay.kind === 'airbnb' ? '🏠' : '🏨'} {draft.stay.name || 'Stay'}{draft.stay.checkIn ? ' · ' + draft.stay.checkIn : ''}</div>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setDraft(null)}>← Back</button>
              <button className="btn" onClick={proceed}>Review &amp; add →</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
