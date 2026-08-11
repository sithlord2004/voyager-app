import { useEffect, useState } from 'react'
import { db, savePlan, updatePlan, deletePlan } from '../lib/db.js'
import { tripDays, dayLabel, shortDay, dayNum, byTime, directionsUrl, isoDate } from '../lib/tripMode.js'
import { Icon } from './Icon.jsx'

// The day-by-day planner: a day strip plus that day's items. Shared by Trip Mode
// (today, while you're away) and the Trips page (planning ahead), so both stay
// in step and there's only one place to fix.
export default function DayPlans({ trip, defaultDate, compact = false }) {
  const days = trip ? tripDays(trip) : null
  const [plans, setPlans] = useState([])
  const [selected, setSelected] = useState(defaultDate || days?.dates?.[0] || isoDate())
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ time: '', title: '', note: '', place: '' })

  async function load() {
    if (!trip) return
    const rows = await db.plans.where('tripId').equals(trip.id).toArray()
    setPlans(rows.filter(p => !p.deleted))
  }
  useEffect(() => { load() }, [trip?.id]) // eslint-disable-line
  useEffect(() => {
    // Default to today when the trip is under way, otherwise its first day.
    const today = isoDate()
    setSelected(defaultDate || (days?.dates?.includes(today) ? today : days?.dates?.[0]) || today)
  }, [trip?.id]) // eslint-disable-line

  if (!trip || !days) return null
  const dayPlans = plans.filter(p => p.date === selected).sort(byTime)
  const isToday = selected === isoDate()
  const whenWord = isToday ? 'today' : dayLabel(selected).toLowerCase()

  async function add() {
    if (!draft.title.trim()) return
    await savePlan({
      tripId: trip.id, date: selected, time: draft.time || '',
      title: draft.title.trim(), note: draft.note.trim(), place: draft.place.trim()
    })
    setDraft({ time: '', title: '', note: '', place: '' })
    setAdding(false)
    load()
  }
  async function remove(id) { await deletePlan(id); load() }
  async function toggle(p) { await updatePlan(p.id, { done: !p.done }); load() }

  return (
    <>
      <div className="tm-days">
        {days.dates.map(d => (
          <button key={d} className={'tm-day' + (d === selected ? ' on' : '') + (d === days.today ? ' now' : '')}
            onClick={() => setSelected(d)}>
            <span>{shortDay(d)}</span><b>{dayNum(d)}</b>
            <i className={'tm-dot' + (plans.some(p => p.date === d) ? ' has' : '')} />
          </button>
        ))}
      </div>

      <div className="tm-plans">
        {dayPlans.length === 0 && !adding && (
          <div className="tm-empty">Nothing planned for {whenWord}.</div>
        )}
        {dayPlans.map(p => (
          <div className={'tm-plan' + (p.done ? ' done' : '')} key={p.id}>
            <button className="tm-check" onClick={() => toggle(p)} aria-label="Done">
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
            <button className="tm-x" onClick={() => remove(p.id)} aria-label="Remove">
              <Icon name="x" size={15} />
            </button>
          </div>
        ))}

        {adding ? (
          <div className="tm-add">
            <div className="tm-add-row">
              <input className="tm-t" type="time" value={draft.time}
                onChange={e => setDraft({ ...draft, time: e.target.value })} />
              <input value={draft.title} placeholder="What's the plan?" autoFocus
                onChange={e => setDraft({ ...draft, title: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && add()} />
            </div>
            <input value={draft.place} placeholder="Where (optional)"
              onChange={e => setDraft({ ...draft, place: e.target.value })} />
            {!compact && (
              <input value={draft.note} placeholder="Note, booking ref… (optional)"
                onChange={e => setDraft({ ...draft, note: e.target.value })} />
            )}
            <div className="modal-actions" style={{ marginTop: 8 }}>
              <button className="btn ghost" onClick={() => { setAdding(false); setDraft({ time: '', title: '', note: '', place: '' }) }}>Cancel</button>
              <button className="btn" onClick={add} disabled={!draft.title.trim()}>Add</button>
            </div>
          </div>
        ) : (
          <button className="mini tm-addbtn" onClick={() => setAdding(true)}>
            <Icon name="plus" size={14} /> Add something on {whenWord}
          </button>
        )}
      </div>
    </>
  )
}
