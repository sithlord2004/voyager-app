import { useEffect, useMemo, useState } from 'react'
import { getFlightStatus, statusChip } from '../lib/flights.js'
import { getSetting, setSetting } from '../lib/db.js'
import {
  findTravelDayFlight, legIsDomestic, buildTimeline, markProgress,
  fmtClock, relativeTo, routeLabel, legKey, DEFAULT_MINUTES_TO_AIRPORT
} from '../lib/travelDay.js'
import { toCode } from '../lib/airports.js'
import { estimateToAirport } from '../lib/route.js'
import { Icon } from './Icon.jsx'
import FlightRadar from './FlightRadar.jsx'

// The day-of-travel companion. Only renders when a flight departs today.
export default function TravelDay({ trips = [], setView, refreshKey }) {
  const found = useMemo(() => findTravelDayFlight(trips), [trips, refreshKey])
  const [status, setStatus] = useState(null)
  const [mins, setMins] = useState(DEFAULT_MINUTES_TO_AIRPORT)
  const [editing, setEditing] = useState(false)
  const [now, setNow] = useState(new Date())
  const [addr, setAddr] = useState('')
  const [estimating, setEstimating] = useState(false)
  const [estMsg, setEstMsg] = useState('')
  const [radar, setRadar] = useState(false)

  // Tick every 30s so countdowns stay honest without being wasteful.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  // The journey to the airport differs per flight: leaving home for the
  // outbound, leaving your hotel/Airbnb for the return. So we remember a time
  // per flight, falling back to your usual home-to-airport figure.
  useEffect(() => {
    if (!found) return
    let off = false
    ;(async () => {
      const [byLeg, home] = await Promise.all([
        getSetting('airportMinutesByLeg'), getSetting('minutesToAirport')
      ])
      const saved = byLeg?.[legKey(found.trip, found.leg, found.date)]
      if (!off) setMins(saved ?? home ?? DEFAULT_MINUTES_TO_AIRPORT)

      // Pre-fill the address box: whatever was used last for this flight, or
      // for a return leg, the place you're staying.
      const addrs = await getSetting('airportAddrByLeg')
      const savedAddr = addrs?.[legKey(found.trip, found.leg, found.date)]
      const stay = (found.trip.stays || [])[0]
      const guess = !found.outbound && stay?.name
        ? `${stay.name}, ${found.trip.destinationCity || ''}`.replace(/, $/, '')
        : ''
      if (!off) setAddr(savedAddr || guess)
    })()
    return () => { off = true }
  }, [found?.leg?.number, found?.date]) // eslint-disable-line

  useEffect(() => {
    if (!found) return
    let off = false
    getFlightStatus(found.leg.number, found.date)
      .then(s => { if (!off && s) setStatus(s) })
      .catch(() => {})
    return () => { off = true }
  }, [found?.leg?.number, found?.date, refreshKey]) // eslint-disable-line

  async function saveMins(v) {
    const n = Math.max(0, Math.min(240, Number(v) || 0))
    setMins(n)
    if (!found) return
    // Remember it for this specific flight…
    const byLeg = (await getSetting('airportMinutesByLeg')) || {}
    byLeg[legKey(found.trip, found.leg, found.date)] = n
    await setSetting('airportMinutesByLeg', byLeg)
    // …and, for the flight you leave home for, update the usual default too.
    if (found.outbound) await setSetting('minutesToAirport', n)
  }

  // Look the address up and suggest a journey time (free-flow driving + a
  // small allowance). The user can still type over it.
  async function estimate() {
    if (!found || !addr.trim()) return
    setEstimating(true); setEstMsg('Looking up…')
    try {
      const r = await estimateToAirport(addr, toCode(found.leg.from))
      if (r.error) { setEstMsg('⚠️ ' + r.error) }
      else {
        await saveMins(r.suggested)
        const addrs = (await getSetting('airportAddrByLeg')) || {}
        addrs[legKey(found.trip, found.leg, found.date)] = addr.trim()
        await setSetting('airportAddrByLeg', addrs)
        setEstMsg(`≈${r.drive} min drive → set to ${r.suggested} min (allows for traffic and parking).`)
      }
    } catch { setEstMsg('⚠️ Couldn’t reach the mapping service — you may be offline.') }
    setEstimating(false)
  }

  if (!found) return null
  const { trip, leg, outbound } = found
  const fromWhere = outbound ? 'home' : (trip.destinationCity || 'where you’re staying')

  const dep = status?.departure, arr = status?.arrival
  // A revised time (delay) moves the whole day, which is the point. If live data
  // isn't available (no key, quota spent, or too far ahead), fall back to the
  // times saved on the leg — so the timeline still works.
  const legDep = leg.depTime ? `${found.date}T${leg.depTime}:00` : null
  const legArr = leg.arrTime ? `${found.date}T${leg.arrTime}:00` : null
  const depISO = dep?.revised || dep?.scheduled || legDep
  const arrISO = arr?.revised || arr?.scheduled || legArr
  const delayed = !!(dep?.revised && dep?.scheduled && dep.revised !== dep.scheduled)

  // Once you've landed, the day is done — stop showing a live countdown for a
  // flight that's already over. We allow a short grace period after arrival
  // (bags, transfers), and fall back to a few hours after departure when we
  // have no arrival time to go on.
  const finishedAt = arrISO ? new Date(arrISO).getTime() + 90 * 60000
    : depISO ? new Date(depISO).getTime() + 6 * 3600000
    : null
  if (finishedAt && now.getTime() > finishedAt) return null

  const items = markProgress(
    buildTimeline({ depISO, arrISO, domestic: legIsDomestic(leg), minutesToAirport: mins }),
    now
  )
  const leave = items.find(i => i.key === 'leave')
  const next = items.find(i => i.isNext)
  const [chipCls, chipLabel] = status ? statusChip(status.status) : ['st-ontime', 'scheduled']

  const gate = [dep?.terminal && `Terminal ${dep.terminal}`, dep?.gate && `Gate ${dep.gate}`]
    .filter(Boolean).join(' · ')

  return (
    <div className="card td">
      <div className="td-head">
        <div>
          <span className="td-kicker">Travel day</span>
          <h3 style={{ margin: '2px 0 0' }}>
            {leg.number} · {routeLabel(leg)}{trip.destinationCity ? ` · ${trip.destinationCity}` : ''}
          </h3>
        </div>
        <span className={'status-chip ' + chipCls}>{chipLabel}</span>
      </div>

      {leave && (
        <div className={'td-hero' + (leave.done ? ' past' : '')}>
          <div className="td-hero-label">{leave.done ? 'You should have left by' : 'Leave for the airport by'}</div>
          <div className="td-hero-time">{fmtClock(leave.at)}</div>
          <div className="td-hero-sub">{relativeTo(leave.at, now)} · {leave.note}</div>
        </div>
      )}

      {!depISO && (
        <p className="desc">
          Live times aren’t available for this flight yet (they usually appear a few days out),
          so times below will fill in automatically once they are.
        </p>
      )}

      {delayed && (
        <p className="desc" style={{ color: 'var(--amber)' }}>
          ⚠️ Delayed — everything below is based on the revised departure of {fmtClock(new Date(dep.revised))}.
        </p>
      )}

      {gate && <div className="td-gate">{gate}{arr?.baggageBelt ? ` · Belt ${arr.baggageBelt} on arrival` : ''}</div>}

      <div className="td-line">
        {items.map(it => (
          <div key={it.key} className={'td-step' + (it.done ? ' done' : '') + (it.isNext ? ' next' : '')}>
            <span className="td-dot" />
            <div className="td-body">
              <b>{it.label}</b>
              {it.note && <small>{it.note}</small>}
            </div>
            <div className="td-when">
              <b>{fmtClock(it.at)}</b>
              {it.isNext && <small>{relativeTo(it.at, now)}</small>}
            </div>
          </div>
        ))}
      </div>

      <div className="td-foot">
        {editing ? (
          <label className="td-mins">
            {`Journey from ${fromWhere} to ${toCode(leg.from) || 'the airport'}`}
            <span>
              <input type="number" min="0" max="240" value={mins}
                onChange={e => saveMins(e.target.value)} /> min
              <button className="mini" onClick={() => setEditing(false)}>Done</button>
            </span>
            <span className="td-est">
              <input value={addr} onChange={e => setAddr(e.target.value)}
                placeholder={outbound ? 'Your address…' : 'Where you’re staying…'} />
              <button className="mini" onClick={estimate} disabled={estimating || !addr.trim()}>
                {estimating ? 'Estimating…' : 'Estimate'}
              </button>
            </span>
            {estMsg && <small className="td-est-msg">{estMsg}</small>}
          </label>
        ) : (
          <button className="mini" onClick={() => setEditing(true)}>
            {mins} min from {fromWhere} to {toCode(leg.from) || 'the airport'} · adjust
          </button>
        )}
        <div className="td-actions">
          <button className="mini" onClick={() => setRadar(true)}>Track flight</button>
          <button className="mini" onClick={() => setView?.('vault')}>Documents</button>
          <button className="mini" onClick={() => setView?.('packing')}>Packing</button>
          <button className="mini" onClick={() => setView?.('emergency')}>At {trip.destinationCity || 'destination'}</button>
        </div>
      </div>
      {radar && <FlightRadar leg={leg} status={status} onClose={() => setRadar(false)} />}
    </div>
  )
}
