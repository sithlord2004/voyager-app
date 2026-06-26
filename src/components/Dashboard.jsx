import { useEffect, useState } from 'react'
import { geocode, currentWeather, WMO, FLAGS } from '../lib/weather.js'
import { getFlightStatus, statusChip } from '../lib/flights.js'
import { getSetting } from '../lib/db.js'
import { Icon } from './Icon.jsx'

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

export default function Dashboard({ trips, documents, people, packing = [] }) {
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
  }, []) // eslint-disable-line

  async function load(c) {
    setLoading(true)
    const p = await geocode(c)
    if (!p) { setLoading(false); setWx(null); return }
    const w = await currentWeather(p.latitude, p.longitude)
    setPlace(p); setWx(w); setLoading(false)
  }
  useEffect(() => { load(city) }, []) // eslint-disable-line

  const cur = wx?.current
  const code = cur ? (WMO[cur.weather_code] || ['🌡️','—']) : ['…','']
  const flag = place ? (FLAGS[place.country_code] || '') : ''

  // expiry alerts — ignore deleted docs and docs whose owner no longer exists
  const alerts = documents
    .filter(d => d.expiryDate && !d.deleted && people.some(p => p.id === d.personId))
    .map(d => ({ d, days: Math.round((new Date(d.expiryDate) - new Date()) / 86400000) }))
    .filter(x => x.days < 180)
    .sort((a, b) => a.days - b.days)
  const ownerName = id => people.find(p => p.id === id)?.name || ''

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
          <h2>{greeting}{name ? ', ' + name : ''} ✈️</h2>
          <div className="sub">Your next adventure is just around the corner.</div>
        </div>
      </div>

      <div className="two-col">
        <div className="hero">
          <div className="bgimg" />
          <div className="toprow">
            <span className="pill">{code[0]} {loading ? 'Loading…' : code[1]}</span>
            <form className="wx-search" onSubmit={e => { e.preventDefault(); load(city) }}>
              <span>🔎</span>
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
          </div>
        </div>

        <div className="grid">
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

          <div className="card">
            <h3><Icon name="plane" /> Flights</h3>
            {flightLegs.length ? flightLegs.map((l, i) => {
              const s = statuses[l.number + '_' + (l.date || next.startDate)]
              const [cls, label] = s ? statusChip(s.status) : ['st-ontime', 'scheduled']
              return (
                <div className="flight" key={i} style={{ marginBottom: 10 }}>
                  <div className="air">🛫</div>
                  <div className="route">
                    <div className="ap">
                      <b>{s?.departure?.airport || l.from || '—'}</b>
                      <div className="time">{s?.departure?.revised?.slice(11, 16) || s?.departure?.scheduled?.slice(11, 16) || ''}</div>
                    </div>
                    <div className="planeline"><span className="dur">{l.number}{s?.departure?.gate ? ` · Gate ${s.departure.gate}` : ''}</span></div>
                    <div className="ap">
                      <b>{s?.arrival?.airport || l.to || '—'}</b>
                      <div className="time">{s?.arrival?.scheduled?.slice(11, 16) || ''}</div>
                    </div>
                  </div>
                  <span className={'status-chip ' + cls} style={{ marginLeft: 8 }}>{s ? `🟢 ${label}` : label}</span>
                </div>
              )
            }) : <div className="desc">No flights on this trip</div>}
            {flightLegs.length > 0 && Object.keys(statuses).length === 0 &&
              <div className="desc" style={{ marginTop: 2 }}>Showing scheduled — live status needs the backend (Settings) and is available ~7 days out.</div>}
          </div>

          <div className="card">
            <h3><Icon name="bell" /> Needs your attention</h3>
            {alerts.length ? alerts.slice(0, 3).map(({ d, days }) => (
              <div key={d.id} className={'alert ' + (days < 90 ? 'danger' : 'warn')}>
                <div className="ai">{days < 90 ? '🛂' : '🪪'}</div>
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
    </div>
  )
}
