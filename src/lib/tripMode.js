// ---------------------------------------------------------------------------
// Trip Mode — while you're actually away, the app reorients around *today*.
//
// Deliberately useful with zero input: day X of Y, today's weather, when you
// check out, and what your next flight is are all derived from the trip you
// already have. Day-by-day plans are additive on top of that.
// ---------------------------------------------------------------------------
import { toCode } from './airports.js'

const DAY = 86400000

export const isoDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const parse = s => (s ? new Date(s + 'T00:00') : null)

// The trip you're currently on (today falls within its dates), if any.
export function findActiveTrip(trips = [], now = new Date()) {
  const today = isoDate(now)
  return trips.find(t => t.startDate && t.endDate && t.startDate <= today && today <= t.endDate) || null
}

// Day 3 of 6, plus the list of dates so the UI can show a day strip.
export function tripDays(trip, now = new Date()) {
  const start = parse(trip?.startDate), end = parse(trip?.endDate)
  if (!start || !end) return null
  const total = Math.max(1, Math.round((end - start) / DAY) + 1)
  const today = new Date(isoDate(now) + 'T00:00')
  const index = Math.round((today - start) / DAY)          // 0-based
  const dates = Array.from({ length: total }, (_, i) => isoDate(new Date(start.getTime() + i * DAY)))
  return { total, index, dayNumber: index + 1, dates, today: isoDate(now) }
}

// The next flight from today onwards (used for "return flight Sunday").
export function nextFlight(trip, now = new Date()) {
  const today = isoDate(now)
  const legs = (trip?.legs || []).filter(l => (l.mode || 'flight') === 'flight' && l.number)
  const upcoming = legs
    .map(l => ({ ...l, date: l.date || trip.startDate }))
    .filter(l => l.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
  const l = upcoming[0]
  return l ? { ...l, route: `${toCode(l.from) || '?'} → ${toCode(l.to) || '?'}` } : null
}

// Where you're staying tonight, and when you check out.
export function currentStay(trip, now = new Date()) {
  const today = isoDate(now)
  const stays = (trip?.stays || []).filter(s => s.name)
  return stays.find(s => (!s.checkIn || s.checkIn <= today) && (!s.checkOut || today <= s.checkOut))
    || stays[0] || null
}

// Friendly day label: "Today", "Tomorrow", else "Wed 20 Aug".
export function dayLabel(dateStr, now = new Date()) {
  const today = isoDate(now)
  const tomorrow = isoDate(new Date(now.getTime() + DAY))
  if (dateStr === today) return 'Today'
  if (dateStr === tomorrow) return 'Tomorrow'
  return new Date(dateStr + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

export const shortDay = dateStr =>
  new Date(dateStr + 'T00:00').toLocaleDateString(undefined, { weekday: 'short' })
export const dayNum = dateStr => new Date(dateStr + 'T00:00').getDate()

// Sort plans by time, untimed last.
export const byTime = (a, b) =>
  (a.time || '99:99').localeCompare(b.time || '99:99') || (a.title || '').localeCompare(b.title || '')

// A maps link for a plan or stay address.
export const directionsUrl = q =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
