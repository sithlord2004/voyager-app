// ---------------------------------------------------------------------------
// Travel Day — the app's job on the actual day of travel.
//
// Planning is well covered elsewhere; this is about the morning itself. The one
// number people really want is "when do I need to leave?", worked backwards
// from the flight: doors close, boarding, bag-drop cutoff, how long you want at
// the airport, and how long it takes to get there.
//
// Times come from live flight data when we have it (so a delay pushes the whole
// timeline), and everything degrades gracefully when we don't.
// ---------------------------------------------------------------------------
import { airportCountry, toCode } from './airports.js'

const MIN = 60000
export const DEFAULT_MINUTES_TO_AIRPORT = 45

// How long before departure you want to *be* at the airport, and when bag drop
// and boarding typically happen. International needs a bigger buffer.
const BUFFERS = {
  domestic:      { atAirport: 60,  bagDrop: 45, boarding: 30, doors: 15 },
  international: { atAirport: 120, bagDrop: 60, boarding: 40, doors: 20 }
}

const localISODate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// A flight leg is "domestic" when both ends are in the same country.
export function legIsDomestic(leg) {
  const a = airportCountry(leg?.from), b = airportCountry(leg?.to)
  return !!(a && b && a === b)
}

// Find a flight departing today (or already under way today) across all trips.
// Returns { trip, leg } or null.
export function findTravelDayFlight(trips = [], now = new Date()) {
  const today = localISODate(now)
  for (const trip of trips) {
    const legs = (trip.legs || []).filter(l => (l.mode || 'flight') === 'flight' && l.number)
    for (const leg of legs) {
      const date = leg.date || trip.startDate
      if (date === today) return { trip, leg, date }
    }
  }
  return null
}

// Build the day's milestones. `depISO`/`arrISO` are local ISO strings from the
// flight feed; without them we can still show the ordered checklist, just
// without clock times.
export function buildTimeline({ depISO, arrISO, domestic, minutesToAirport = DEFAULT_MINUTES_TO_AIRPORT }) {
  if (!depISO) return []
  const dep = new Date(depISO)
  if (isNaN(dep)) return []
  const b = domestic ? BUFFERS.domestic : BUFFERS.international
  const before = mins => new Date(dep.getTime() - mins * MIN)

  const items = [
    { key: 'checkin',  label: 'Check-in opens',        at: new Date(dep.getTime() - 24 * 60 * MIN), note: 'Online check-in' },
    { key: 'leave',    label: 'Leave for the airport', at: before(b.atAirport + minutesToAirport), hero: true,
      note: `${minutesToAirport} min journey + ${b.atAirport} min at the airport` },
    { key: 'arrive',   label: 'Be at the airport',     at: before(b.atAirport) },
    { key: 'bag',      label: 'Bag drop closes',       at: before(b.bagDrop), note: 'Typical cutoff — check your airline' },
    { key: 'boarding', label: 'Boarding starts',       at: before(b.boarding) },
    { key: 'doors',    label: 'Gate closes',           at: before(b.doors), note: 'Be at the gate before this' },
    { key: 'dep',      label: 'Departure',             at: dep }
  ]
  if (arrISO && !isNaN(new Date(arrISO))) {
    items.push({ key: 'arr', label: 'Arrives', at: new Date(arrISO) })
  }
  return items
}

// Mark each milestone as done / next / upcoming so the UI can highlight where
// you are in the day.
export function markProgress(items, now = new Date()) {
  let nextFound = false
  return items.map(it => {
    const done = it.at <= now
    const isNext = !done && !nextFound
    if (isNext) nextFound = true
    return { ...it, done, isNext }
  })
}

export const fmtClock = d =>
  d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

// "in 2h 15m" / "in 40m" / "now" / "1h 5m ago"
export function relativeTo(target, now = new Date()) {
  const diff = target - now
  const past = diff < 0
  const mins = Math.round(Math.abs(diff) / MIN)
  if (mins === 0) return 'now'
  const h = Math.floor(mins / 60), m = mins % 60
  const text = h ? `${h}h${m ? ' ' + m + 'm' : ''}` : `${m}m`
  return past ? `${text} ago` : `in ${text}`
}

// A short human route label, e.g. "MEL → HBA".
export const routeLabel = leg => `${toCode(leg?.from) || '—'} → ${toCode(leg?.to) || '—'}`
