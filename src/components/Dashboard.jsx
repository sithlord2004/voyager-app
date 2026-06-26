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

      <div className="grid
