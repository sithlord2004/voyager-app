import { useEffect, useState } from 'react'
import { geocode, currentWeather, WMO, FLAGS } from '../lib/weather.js'
import { getFlightStatus, statusChip } from '../lib/flights.js'

const DOW = ['SUN','MON','TUE','WED','THU','FRI','SAT']

export default function Dashboard({ trips, documents, people }) {
  const next = [...trips].filter(t => new Date(t.endDate) >= new Date())
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0] || trips[0]
  const [city, setCity] = useState(next?.destinationCity || 'Kyoto')
  const [wx, setWx] = useState(null)
  const [place, setPlace] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fs, setFs] = useState(null) // live flight status (null until/unless configured)

  useEffect(() => {
    if (next?.flight?.number) getFlightStatus(next.flight.number, next.startDate).then(setFs)
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

  // expiry alerts from clear-text metadata
  const alerts = documents
    .filter(d => d.expiryDate)
    .map(d => ({ d, days: Math.round((new Date(d.expiryDate) - new Date()) / 86400000) }))
    .filter(x => x.days < 180)
    .sort((a, b) => a.days - b.days)
  const ownerName = id => people.find(p => p.id === id)?.name || ''

  return (
    <div>
      <div className="topbar">
        <div>
          <h2>Good evening, Amit ✈️</h2>
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
            {(() => { const [cls, label] = fs ? statusChip(fs.status) : ['st-ontime', next?.flight ? 'On time' : '—']
              return <h3><span className="ttl-ico">✈️</span> Flight Status
                <span style={{ marginLeft: 'auto' }} className={'status-chip ' + cls}>{label}</span></h3> })()}
            <div className="desc">
              {next?.flight ? `${next.flight.number} · ${next.flight.airline}` : 'No flight added'}
              {fs ? ' · 🟢 live' : next?.flight ? ' · add backend in Settings for live status' : ''}
            </div>
            {next?.flight && (
              <div className="flight">
                <div className="air">🛫</div>
                <div className="route">
                  <div className="ap">
                    <b>{fs?.departure?.airport || next.flight.depAirport}</b>
                    <div className="time">{fs?.departure?.revised?.slice(11, 16) || fs?.departure?.scheduled?.slice(11, 16) || next.flight.depTime}</div>
                  </div>
                  <div className="planeline"><span className="dur">{fs?.departure?.gate ? `Gate ${fs.departure.gate}` : 'Live tracking'}</span></div>
                  <div className="ap">
                    <b>{fs?.arrival?.airport || next.flight.arrAirport}</b>
                    <div className="time">{fs?.arrival?.scheduled?.slice(11, 16) || '+1'}</div>
                  </div>
                </div>
              </div>
            )}
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
