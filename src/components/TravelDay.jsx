import { useEffect, useMemo, useState } from 'react'
import { getFlightStatus, statusChip } from '../lib/flights.js'
import { getSetting, setSetting } from '../lib/db.js'
import {
  findTravelDayFlight, legIsDomestic, buildTimeline, markProgress,
  fmtClock, relativeTo, routeLabel, DEFAULT_MINUTES_TO_AIRPORT
} from '../lib/travelDay.js'
import { Icon } from './Icon.jsx'

// The day-of-travel companion. Only renders when a flight departs today.
export default function TravelDay({ trips = [], setView, refreshKey }) {
  const found = useMemo(() => findTravelDayFlight(trips), [trips, refreshKey])
  const [status, setStatus] = useState(null)
  const [mins, setMins] = useState(DEFAULT_MINUTES_TO_AIRPORT)
  const [editing, setEditing] = useState(false)
  const [now, setNow] = useState(new Date())

  // Tick every 30s so countdowns stay honest without being wasteful.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => { getSetting('minutesToAirport').then(v => setMins(v || DEFAULT_MINUTES_TO_AIRPORT)) }, [])

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
    await setSetting('minutesToAirport', n)
  }

  if (!found) return null
  const { trip, leg } = found

  const dep = status?.departure, arr = status?.arrival
  // A revised time (delay) moves the whole day, which is the point.
  const depISO = dep?.revised || dep?.scheduled || null
  const arrISO = arr?.revised || arr?.scheduled || null
  const delayed = !!(dep?.revised && dep?.scheduled && dep.revised !== dep.scheduled)

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
            Journey to the airport
            <span>
              <input type="number" min="0" max="240" value={mins}
                onChange={e => saveMins(e.target.value)} /> min
              <button className="mini" onClick={() => setEditing(false)}>Done</button>
            </span>
          </label>
        ) : (
          <button className="mini" onClick={() => setEditing(true)}>
            Airport is {mins} min away · adjust
          </button>
        )}
        <div className="td-actions">
          <button className="mini" onClick={() => setView?.('vault')}>Documents</button>
          <button className="mini" onClick={() => setView?.('packing')}>Packing</button>
          <button className="mini" onClick={() => setView?.('emergency')}>At {trip.destinationCity || 'destination'}</button>
        </div>
      </div>
    </div>
  )
}
