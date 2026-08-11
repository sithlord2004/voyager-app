import { useEffect, useMemo, useState } from 'react'
import { db, savePlan, updatePlan, deletePlan } from '../lib/db.js'
import {
  findActiveTrip, tripDays, nextFlight, currentStay,
  dayLabel, shortDay, dayNum, byTime, directionsUrl, isoDate
} from '../lib/tripMode.js'
import { Icon } from './Icon.jsx'

// While you're away, the app leads with today rather than with planning.
export default function TripMode({ trips = [], refreshKey, wx, sun }) {
  const trip = useMemo(() => findActiveTrip(trips), [trips, refreshKey])
  const [plans, setPlans] = useState([])
  const [selected, setSelected] = useState(isoDate())
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ time: '', title: '', note: '', place: '' })

  const days = trip ? tripDays(trip) : null

  async function loadPlans() {
    if (!trip) return
    const rows = await db.plans.where('tripId').equals(trip.id).toArray()
    setPlans(rows.filter(p => !p.deleted))
  }
  useEffect(() => { loadPlans() }, [trip?.id, refreshKey]) // eslint-disable-line
  useEffect(() => { setSelected(isoDate()) }, [trip?.id])

  if (!trip || !days) return null

  const stay = currentStay(trip)
  const flight = nextFlight(trip)
  const dayPlans = plans.filter(p => p.date === selected).sort(byTime)
  const isToday = selected === isoDate()
  const checkoutToday = stay?.checkOut && stay.checkOut === isoDate()
  const flightToday = flight && flight.date === isoDate()

  async function addPlan() {
    if (!draft.title.trim()) return
    await savePlan({
      tripId: trip.id, date: selected,
      time: draft.time || '', title: draft.title.trim(),
      note: draft.note.trim(), place: draft.place.trim()
    })
    setDraft({ time: '', title: '', note: '', place: '' })
    setAdding(false)
    loadPlans()
  }
  async function removePlan(id) { await deletePlan(id); loadPlans() }
  async function toggleDone(p) { await updatePlan(p.id, { done: !p.done }); loadPlans() }

  return (
    <div className="card tm">
      <div className="tm-head">
        <div>
          <span className="tm-kicker">Trip in progress</span>
          <h3 style={{ margin: '2px 0 0' }}>
            Day {days.dayNumber} of {days.total} in {trip.destinationCity || 'your trip'}
          </h3>
        </div>
        {wx?.temp != null && <span className="tm-temp">{wx.icon} {Math.round(wx.temp)}°</span>}
      </div>

      {/* What today holds, with no input required. */}
      <div className="tm-facts">
        {sun?.sunset && <span className="tm-fact">Sunset {sun.sunset}</span>}
        {stay && (
          <span className="tm-fact">
            {stay.name}
            {stay.checkOut ? ` · out ${dayLabel(stay.checkOut)}` : ''}
          </span>
        )}
        {flight && (
          <span className={'tm-fact' + (flightToday ? ' urgent' : '')}>
            {flight.number} {flight.route} · {dayLabel(flight.date)}
          </span>
        )}
      </div>

      {(checkoutToday || flightToday) && (
        <div className="tm-alert">
          {flightToday ? 'Flying today — see your leave-by time above.' : 'Checking out today.'}
        </div>
      )}

      {/* Day strip */}
      <div className="tm-days">
        {days.dates.map(d => {
          const has = plans.some(p => p.date === d)
          return (
            <button key={d} className={'tm-day' + (d === selected ? ' on' : '') + (d === days.today ? ' now' : '')}
              onClick={() => setSelected(d)}>
              <span>{shortDay(d)}</span><b>{dayNum(d)}</b>
              <i className={'tm-dot' + (has ? ' has' : '')} />
            </button>
          )
        })}
      </div>

      {/* That day's plans */}
      <div className="tm-plans">
        {dayPlans.length === 0 && !adding && (
          <div className="tm-empty">
            Nothing planned for {isToday ? 'today' : dayLabel(selected).toLowerCase()}.
          </div>
        )}
        {dayPlans.map(p => (
          <div className={'tm-plan' + (p.done ? ' done' : '')} key={p.id}>
            <button className="tm-check" onClick={() => toggleDone(p)} aria-label="Done">
              {p.done ? <Icon name="check" size={14} /> : null}
            </button>
            <div className="tm-plan-body">
              <b>{p.time ? <span className="tm-time">{p.time}</span> : null}{p.title}</b>
              {p.note && <small>{p.note}</small>}
              {p.place && (
                <a className="mini" href={directionsUrl(`${p.place}, ${trip.destinationCity || ''}`)}
                   target="_blank" rel="noopener noreferrer">{p.place} · directions</a>
              )}
            </div>
            <button className="tm-x" onClick={() => removePlan(p.id)} aria-label="Remove">
              <Icon name="x" size={15} />
            </button>
          </div>
        ))}

        {adding ? (
          <div className="tm-add">
            <div className="tm-add-row">
              <input className="tm-t" type="time" value={draft.time}
                onChange={e => setDraft({ ...draft, time: e.target.value })} />
              <input value={draft.title} placeholder="What's the plan?"
                onChange={e => setDraft({ ...draft, title: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && addPlan()} />
            </div>
            <input value={draft.place} placeholder="Where (optional)"
              onChange={e => setDraft({ ...draft, place: e.target.value })} />
            <input value={draft.note} placeholder="Note, booking ref… (optional)"
              onChange={e => setDraft({ ...draft, note: e.target.value })} />
            <div className="modal-actions" style={{ marginTop: 8 }}>
              <button className="btn ghost" onClick={() => { setAdding(false); setDraft({ time: '', title: '', note: '', place: '' }) }}>Cancel</button>
              <button className="btn" onClick={addPlan} disabled={!draft.title.trim()}>Add</button>
            </div>
          </div>
        ) : (
          <button className="mini tm-addbtn" onClick={() => setAdding(true)}>
            <Icon name="plus" size={14} /> Add something on {isToday ? 'today' : dayLabel(selected).toLowerCase()}
          </button>
        )}
      </div>
    </div>
  )
}
