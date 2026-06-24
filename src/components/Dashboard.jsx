import { useEffect, useState } from 'react'
import { geocode, currentWeather, WMO, FLAGS } from '../lib/weather.js'
import { getFlightStatus, statusChip } from '../lib/flights.js'
import { getSetting } from '../lib/db.js'

const DOW = ['SUN','MON','TUE','WED','THU','FRI','SAT']

export default function Dashboard({ trips, documents, people }) {
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
          <div className="card">
            <h3><span className="ttl-ico">✈️</span> Flights</h3>
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
            <h3><span className="ttl-ico">🔔</span> Needs your attention</h3>
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
