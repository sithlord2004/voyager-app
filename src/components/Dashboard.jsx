import { useEffect, useState } from 'react'
import { geocode, currentWeather, WMO, FLAGS } from '../lib/weather.js'
import { getFlightStatus, statusChip } from '../lib/flights.js'
import { getSetting } from '../lib/db.js'
import { toCode } from '../lib/airports.js'
import { checkEntry, officialLink } from '../lib/entry.js'
import { getAdvisory } from '../lib/advisory.js'
import { loadProfile } from '../lib/profile.js'
import { toNationalityCodes, sourceFor, nationalityLabel } from '../lib/nationality.js'
import { Icon } from './Icon.jsx'
import TravelDay from './TravelDay.jsx'
import TripMode from './TripMode.jsx'

const DOW = ['SUN','MON','TUE','WED','THU','FRI','SAT']

// Small circular progress ring for the trip-readiness score.
function Ring({ pct }) {
  const r = 26, c = 2 * Math.PI * r
  const stroke = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" style={{ flexShrink: 0 }}>
      <circle cx="34" cy="34" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="7" />
      <circle cx="34" cy="34" r={r} fill="none" stroke={stroke} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform="rotate(-90 34 34)"
        style={{ transition: 'stroke-dashoffset .6s ease' }} />
      <text x="34" y="39" textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--text)">{pct}%</text>
    </svg>
  )
}

export default function Dashboard({ trips, documents, people, packing = [], refreshKey, setView, vaultKey }) {
  // Brand-new install: no family added yet. Show a friendly welcome instead of
  // empty widgets, guiding the user to set up.
  const firstRun = (people?.length || 0) === 0 && (trips?.length || 0) === 0
  if (firstRun) {
    return (
      <div>
        <div className="topbar"><div><h2>Welcome to Voyager 🧭</h2>
          <div className="sub">Your private, encrypted travel companion. Let's get you set up.</div></div></div>
        <div className="card" style={{ maxWidth: 640 }}>
          <h3><Icon name="bulb" /> Three quick steps</h3>
          <ol style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, paddingLeft: 18 }}>
            <li><b>Add yourself and your family</b> — in Settings, so documents and trips can belong to the right people.</li>
            <li><b>Add your first trip</b> — manually, or import a booking email/PDF.</li>
            <li><b>Save your documents</b> — passports and more, encrypted on your device.</li>
          </ol>
          <div className="modal-actions" style={{ justifyContent: 'flex-start', marginTop: 8, flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => setView?.('settings')}><Icon name="users" size={15} /> Add your family</button>
            <button className="btn ghost" onClick={() => setView?.('trips')}><Icon name="plus" size={15} /> Add a trip</button>
          </div>
          <p className="desc" style={{ marginTop: 12, fontSize: 12 }}>Everything stays on your device, encrypted with your passphrase. Cloud sync is optional and off by default.</p>
        </div>
      </div>
    )
  }
  const [name, setName] = useState('')
  useEffect(() => { getSetting('displayName').then(n => setName(n || '')) }, [])
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const next = [...trips].filter(t => new Date(t.endDate) >= new Date())
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0] || trips[0]
  const [city, setCity] = useState(next?.destinationCity || 'Kyoto')
  const [wx, setWx] = useState(null)
  const [place, setPlace] = useState(null)
  const [loading, setLoading] = useState(true)
  // All flight legs of the next trip (supports multi-leg trips + legacy single flight)
  const flightLegs = (next?.legs?.length
    ? next.legs
    : (next?.flight ? [{ mode: 'flight', number: next.flight.number, from: next.flight.depAirport, to: next.flight.arrAirport, date: next.startDate }] : [])
  ).filter(l => l.mode === 'flight' && l.number)

  const [statuses, setStatuses] = useState({})
  useEffect(() => {
    flightLegs.forEach(l => {
      const key = l.number + '_' + (l.date || next.startDate)
      getFlightStatus(l.number, l.date || next?.startDate).then(s => { if (s) setStatuses(prev => ({ ...prev, [key]: s })) })
    })
  }, [refreshKey]) // eslint-disable-line

  async function load(c) {
    setLoading(true)
    const p = await geocode(c)
    if (!p) { setLoading(false); setWx(null); return }
    const w = await currentWeather(p.latitude, p.longitude)
    setPlace(p); setWx(w); setLoading(false)
  }
  useEffect(() => { load(city) }, [refreshKey]) // eslint-disable-line

  const cur = wx?.current
  const code = cur ? (WMO[cur.weather_code] || ['🌡️','—']) : ['…','']
  const flag = place ? (FLAGS[place.country_code] || '') : ''

  // Destination local time + sun + UV (all from the same Open-Meteo call).
  const offs = wx?.utc_offset_seconds
  const destTime = typeof offs === 'number'
    ? new Date(Date.now() + new Date().getTimezoneOffset() * 60000 + offs * 1000)
        .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null
  const uv = wx?.daily?.uv_index_max?.[0]
  const uvLabel = uv == null ? '' : uv < 3 ? 'Low' : uv < 6 ? 'Moderate' : uv < 8 ? 'High' : uv < 11 ? 'Very high' : 'Extreme'

  // expiry alerts — ignore deleted docs and docs whose owner no longer exists
  const alerts = documents
    .filter(d => d.expiryDate && !d.deleted && people.some(p => p.id === d.personId))
    .map(d => ({ d, days: Math.round((new Date(d.expiryDate) - new Date()) / 86400000) }))
    .filter(x => x.days < 180)
    .sort((a, b) => a.days - b.days)
  const ownerName = id => people.find(p => p.id === id)?.name || ''

  // "Ready to enter?" — passport-validity checks for the next trip. We pull the
  // live rule from the official FCDO entry-requirements page when the backend is
  // reachable, and fall back to the built-in table offline.
  const [entryLive, setEntryLive] = useState(null)
  useEffect(() => {
    if (!next) return
    let off = false
    getAdvisory(next.countryCode, next.destinationCity)
      .then(a => { if (!off && a?.status === 'ok' && a.entry) setEntryLive({ ...a.entry, link: a.entryLink }) })
      .catch(() => {})
    return () => { off = true }
  }, [next?.id, next?.countryCode, refreshKey]) // eslint-disable-line

  const tripTravellers = next ? (next.travellerIds?.length ? people.filter(p => next.travellerIds.includes(p.id)) : people) : []
  const passportDocs = documents.filter(d => !d.deleted && d.type === 'Passport')

  // Each traveller's nationality comes from their encrypted profile, so we can
  // tell whose passport the live (UK-written) rule actually applies to.
  const [nationalities, setNationalities] = useState({})
  useEffect(() => {
    if (!vaultKey || !people.length) return
    let off = false
    ;(async () => {
      const out = {}
      for (const p of people) {
        if (!p.profileEnc) continue
        const prof = await loadProfile(vaultKey, p)
        // Dual nationals: "British, Australian" -> ['GB','AU']
        const codes = toNationalityCodes(prof.nationality, prof.passportCountry)
        if (codes.length) out[p.id] = codes
      }
      if (!off) setNationalities(out)
    })()
    return () => { off = true }
  }, [vaultKey, people.map(p => p.id + (p.profileEnc ? '1' : '0')).join(',')]) // eslint-disable-line

  // Where you live — a trip inside your own country is domestic (no passport).
  const [homeCode, setHomeCode] = useState('')
  useEffect(() => { getSetting('homeCountry').then(h => setHomeCode(h || '')) }, [refreshKey])

  const entry = next ? checkEntry(next, tripTravellers, passportDocs, entryLive, nationalities, 'GB', homeCode) : null

  // Trip readiness — rolls up the essentials for the next trip into one score.
  const travellers = next ? (next.travellerIds?.length ? people.filter(p => next.travellerIds.includes(p.id)) : people) : []
  const passportOk = pid => documents.some(d => !d.deleted && d.personId === pid && d.type === 'Passport' && (!d.expiryDate || new Date(d.expiryDate) >= new Date(next.endDate)))
  const passportsReady = travellers.length > 0 && travellers.every(p => passportOk(p.id))
  const insuranceReady = documents.some(d => !d.deleted && d.type === 'Travel insurance' && (!d.expiryDate || new Date(d.expiryDate) >= new Date(next?.startDate || 0)))
  const tripPacking = packing.filter(k => k.tripId === next?.id)
  const packPct = tripPacking.length ? Math.round(tripPacking.filter(k => k.checked).length / tripPacking.length * 100) : 0
  const flightsReady = flightLegs.length > 0
  const readyItems = [
    { label: 'Passports valid', ok: passportsReady },
    { label: 'Travel insurance', ok: insuranceReady },
    { label: 'Flights booked', ok: flightsReady },
    { label: `Packing ${packPct}%`, ok: packPct === 100 }
  ]
  const readyScore = next ? Math.round(((passportsReady ? 1 : 0) + (insuranceReady ? 1 : 0) + (flightsReady ? 1 : 0) + packPct / 100) / 4 * 100) : 0

  return (
    <div>
      <div className="topbar">
        <div>
          <h2>{greeting}{name ? ', ' + name : ''}</h2>
          <div className="sub">Your next adventure is just around the corner.</div>
        </div>
      </div>

      <div className="grid dash">
        <TravelDay trips={trips} setView={setView} refreshKey={refreshKey} />
        <TripMode trips={trips} refreshKey={refreshKey}
          wx={cur ? { temp: cur.temperature_2m, icon: code[0] } : null}
          sun={{ sunset: wx?.daily?.sunset?.[0]?.slice(11, 16) }} />

        <div className="hero">
          <div className="bgimg" />
          <div className="toprow">
            <span className="pill">{code[0]} {loading ? 'Loading…' : code[1]}</span>
            <form className="wx-search" onSubmit={e => { e.preventDefault(); load(city) }}>
              <span style={{ display: 'inline-flex', opacity: .85 }}><Icon name="search" size={14} /></span>
              <input value={city} onChange={e => setCity(e.target.value)} placeholder="Try any city…" />
            </form>
          </div>
          <div>
            <h2>{place ? `${place.name} ${flag}` : city}</h2>
            <div className="when">{place ? `${place.admin1 ? place.admin1 + ', ' : ''}${place.country} · live local weather` : 'Fetching…'}</div>
            <div className={'weather-row' + (loading ? ' wx-loading' : '')}>
              <div className="temp">{cur ? Math.round(cur.temperature_2m) : '–'}<sup>°C</sup></div>
              <div className="wx-meta">
                {cur ? <>Feels like {Math.round(cur.apparent_temperature)}° · Humidity {cur.relative_humidity_2m}%<br />
                  Wind {Math.round(cur.wind_speed_10m)} km/h<br />
                  <b style={{ opacity: .9 }}>🟢 Live · Open-Meteo</b></> : 'Fetching live data…'}
              </div>
            </div>
            <div className="forecast">
              {wx?.daily?.time?.map((d, i) => {
                const c = WMO[wx.daily.weather_code[i]] || ['🌡️','']
                return <div className="fc" key={d}>
                  <b>{DOW[new Date(d + 'T00:00').getDay()]}</b>
                  <div className="ic">{c[0]}</div>
                  <small>{Math.round(wx.daily.temperature_2m_max[i])}°/{Math.round(wx.daily.temperature_2m_min[i])}°</small>
                </div>
              })}
            </div>
            {cur && wx?.daily && (
              <div className="wx-extra">
                {destTime && <div className="wxx"><span>🕐</span>{destTime} local</div>}
                {wx.daily.sunrise?.[0] && <div className="wxx"><span>🌅</span>{wx.daily.sunrise[0].slice(11, 16)}</div>}
                {wx.daily.sunset?.[0] && <div className="wxx"><span>🌇</span>{wx.daily.sunset[0].slice(11, 16)}</div>}
                {uv != null && <div className="wxx"><span>☀️</span>UV {Math.round(uv)} · {uvLabel}</div>}
              </div>
            )}
          </div>
        </div>

        <div className="card ready">
          <h3><Icon name="shield" /> Trip readiness</h3>
          {next ? (
            <div className="ready-body">
              <Ring pct={readyScore} />
              <div className="ready-list">
                {readyItems.map(it => (
                  <div className={'ready-item' + (it.ok ? ' done' : '')} key={it.label}>
                    <span className="rk">{it.ok ? '✓' : '○'}</span>{it.label}
                  </div>
                ))}
              </div>
            </div>
          ) : <div className="desc">Add a trip to see how ready you are.</div>}
        </div>

        {next && flightLegs.length > 0 && (
          <div className="fl-section">
            <h3 className="sec-h"><Icon name="plane" /> Upcoming flights</h3>
            {flightLegs.map((l, i) => {
              const s = statuses[l.number + '_' + (l.date || next.startDate)]
              const [cls, label] = s ? statusChip(s.status) : ['st-ontime', 'scheduled']
              const dep = s?.departure, arr = s?.arrival
              const depTime = dep?.revised?.slice(11, 16) || dep?.scheduled?.slice(11, 16) || ''
              const arrTime = arr?.revised?.slice(11, 16) || arr?.scheduled?.slice(11, 16) || ''
              const depGate = [dep?.terminal && `Terminal ${dep.terminal}`, dep?.gate && `Gate ${dep.gate}`].filter(Boolean).join(' · ')
              const arrGate = [arr?.terminal && `Terminal ${arr.terminal}`, arr?.gate && `Gate ${arr.gate}`, arr?.baggageBelt && `Belt ${arr.baggageBelt}`].filter(Boolean).join(' · ')
              return (
                <div className="card" key={i}>
                  <div className="fl-top">
                    <span className="fl-no"><Icon name="plane" size={15} /> {l.number}{s?.airline ? ' · ' + s.airline : ''}</span>
                    <span className={'status-chip ' + cls}>{label}</span>
                  </div>
                  <div className="fl-route">
                    <div className="ap">
                      <b>{toCode(dep?.airport || l.from) || '—'}</b>
                      <div className="time">{depTime}</div>
                      {depGate && <div className="fl-gate">{depGate}</div>}
                    </div>
                    <div className="fl-line" />
                    <div className="ap">
                      <b>{toCode(arr?.airport || l.to) || '—'}</b>
                      <div className="time">{arrTime}</div>
                      {arrGate && <div className="fl-gate">{arrGate}</div>}
                    </div>
                  </div>
                </div>
              )
            })}
            {Object.keys(statuses).length === 0 &&
              <div className="desc">Showing scheduled — live status needs the backend (Settings) and is available ~7 days out.</div>}
          </div>
        )}

        {entry && entry.rows.length > 0 && (
          <div className="card">
            <h3><Icon name="idcard" /> {entry.domestic ? 'Travel documents' : `Ready to enter${next.destinationCity ? ' · ' + next.destinationCity : ''}?`}</h3>
            {entry.domestic ? (
              <p className="desc" style={{ marginBottom: 10 }}>
                This is a domestic trip — no passport or entry requirements. Just bring photo ID for the airline.
              </p>
            ) : (
              <p className="desc" style={{ marginBottom: 10 }}>
                Passports usually need to be {entry.rule.label}
                {entry.requiredUntil ? ` — i.e. valid past ${entry.requiredUntil.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}.
              </p>
            )}
            {entry.rows.map(r => {
              const src = r.natMismatch ? sourceFor(r.nat, next.destinationCountry || next.destinationCity) : null
              return (
                <div className={'entry-row entry-' + r.level} key={r.id}>
                  <span className="er-dot" />
                  <div className="er-body">
                    <b>{r.name}{r.nat && <span className="er-nat">{nationalityLabel(r.nat)}</span>}</b>
                    <small>{r.text}</small>
                    {src && (
                      <small className="er-note">
                        Rule below is for {nationalityLabel(entry.ruleNationality)} passports —{' '}
                        <a href={src.url} target="_blank" rel="noopener noreferrer">check {src.name} →</a>
                      </small>
                    )}
                  </div>
                </div>
              )
            })}

            {!entry.domestic && entryLive?.passportText && (
              <div className="entry-official">
                <b>Official — passport validity {entry.anyMismatch ? '(British passports)' : ''}</b>
                <p>{entryLive.passportText}</p>
                {entryLive.visaText && <><b>Visas</b><p>{entryLive.visaText}</p></>}
              </div>
            )}

            {!entry.domestic && (
              <div className="desc" style={{ marginTop: 10 }}>
                {entry.rule.source === 'live'
                  ? <>🟢 Live rule from the UK Foreign Office. Requirements vary by nationality — </>
                  : <>Using built-in guidance (offline). Rules vary by nationality — </>}
                <a href={entryLive?.link || officialLink(next.destinationCountry || next.destinationCity)}
                   target="_blank" rel="noopener noreferrer">
                  read the official entry requirements →
                </a>
              </div>
            )}
          </div>
        )}

        <div className="card">
          <h3><Icon name="bell" /> Needs your attention</h3>
          {alerts.length ? alerts.slice(0, 3).map(({ d, days }) => (
            <div key={d.id} className={'alert ' + (days < 90 ? 'danger' : 'warn')}>
              <div className="ai"><Icon name="calendar" size={16} /></div>
              <div className="body">
                <b>{ownerName(d.personId)}'s {d.type.toLowerCase()} expires soon</b>
                <small>{new Date(d.expiryDate).toLocaleDateString()}</small>
              </div>
              <div className="when">{days} days</div>
            </div>
          )) : <div className="desc">Nothing expiring soon 🎉</div>}
        </div>
      </div>
    </div>
  )
}
