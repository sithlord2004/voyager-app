// ---------------------------------------------------------------------------
// "Ask Voyager" — the local answer engine.
//
// Most real questions on a trip are lookups: when do we check out, what's the
// flight number, is my passport still valid, what's the plug type. Those are
// answered here — deterministically, instantly, and crucially WITHOUT a network,
// so it still works on the plane.
//
// Anything it doesn't recognise returns `unknown`, and the UI can then offer the
// (opt-in, online) language model instead. It says "I don't know" rather than
// guessing, which matters when the answer is a passport date.
// ---------------------------------------------------------------------------
import { findActiveTrip, tripDays, nextFlight, currentStay, isoDate, dayLabel, byTime } from './tripMode.js'
import { getEssentials } from './essentials.js'
import { checkEntry } from './entry.js'
import { toCode } from './airports.js'

const has = (q, ...words) => words.some(w => q.includes(w))
const fmtDate = d => d ? new Date(d + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) : ''
// Expiry dates must carry the year — "expires 5 November" is dangerously vague.
const fmtDateY = d => d ? new Date(d + 'T00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : ''

// The trip a question is most likely about: the one you're on, else the next.
function focusTrip(trips) {
  const active = findActiveTrip(trips)
  if (active) return active
  const today = isoDate()
  return [...trips].filter(t => t.endDate >= today).sort((a, b) => a.startDate.localeCompare(b.startDate))[0]
    || trips[0] || null
}

// answer(question, data) -> { text, view?, unknown? }
export function answer(question, data = {}) {
  const q = (question || '').toLowerCase().trim()
  if (!q) return { unknown: true, text: '' }

  const { trips = [], plans = [], documents = [], people = [], packing = [] } = data
  const trip = focusTrip(trips)
  const active = findActiveTrip(trips)
  const say = (text, view) => ({ text, view })

  // ---- Trip basics -------------------------------------------------------
  if (has(q, 'where are we going', 'where am i going', 'next trip', 'where to')) {
    if (!trip) return say('No trips saved yet.', 'trips')
    return say(`${trip.destinationCity} — ${fmtDate(trip.startDate)} to ${fmtDate(trip.endDate)}.`, 'trips')
  }

  if (has(q, 'what day', 'which day', 'day are we', 'how long left', 'days left')) {
    if (!active) {
      if (!trip) return say('No trips saved yet.', 'trips')
      const days = Math.round((new Date(trip.startDate) - new Date(isoDate())) / 86400000)
      return say(days > 0 ? `${trip.destinationCity} is in ${days} day${days === 1 ? '' : 's'}.` : `Your ${trip.destinationCity} trip has finished.`)
    }
    const d = tripDays(active)
    return say(`Day ${d.dayNumber} of ${d.total} in ${active.destinationCity}. ${d.total - d.dayNumber} day${d.total - d.dayNumber === 1 ? '' : 's'} left.`)
  }

  // ---- Stays -------------------------------------------------------------
  if (has(q, 'check out', 'checkout', 'check-out')) {
    const stay = currentStay(trip)
    if (!stay?.checkOut) return say('No check-out date saved for your stay.', 'trips')
    return say(`Check out of ${stay.name} on ${fmtDate(stay.checkOut)}.`)
  }
  if (has(q, 'check in', 'check-in') && !has(q, 'flight')) {
    const stay = currentStay(trip)
    if (!stay?.checkIn) return say('No check-in date saved for your stay.', 'trips')
    return say(`Check in to ${stay.name} on ${fmtDate(stay.checkIn)}.`)
  }
  if (has(q, 'where are we staying', 'where am i staying', 'hotel', 'airbnb', 'accommodation')) {
    const stay = currentStay(trip)
    if (!stay) return say('No accommodation saved for this trip.', 'trips')
    return say(`${stay.name}${stay.ref ? ` · ${stay.ref}` : ''}${stay.checkOut ? `. Out ${fmtDate(stay.checkOut)}.` : ''}`, 'trips')
  }

  // ---- Flights -----------------------------------------------------------
  if (has(q, 'flight', 'fly', 'flying', 'plane', 'departure', 'take off', 'takeoff')) {
    if (!trip) return say('No trips saved yet.', 'trips')
    const f = nextFlight(trip)
    if (!f) return say('No flights saved on this trip.', 'trips')
    const seat = f.seat ? ` Seat ${f.seat}.` : ''
    return say(`${f.number}: ${toCode(f.from)} → ${toCode(f.to)} on ${fmtDate(f.date)}.${seat}`)
  }
  if (has(q, 'seat')) {
    const f = trip ? nextFlight(trip) : null
    if (!f?.seat) return say('No seat saved — you can add it to the flight leg in Trips.', 'trips')
    return say(`Seat ${f.seat} on ${f.number}.`)
  }

  // ---- Documents ---------------------------------------------------------
  if (has(q, 'passport')) {
    const live = documents.filter(d => !d.deleted && d.type === 'Passport')
    if (!live.length) return say('No passports saved in the Vault.', 'vault')
    if (has(q, 'expire', 'expiry', 'valid', 'renew')) {
      const lines = live.map(d => {
        const who = people.find(p => p.id === d.personId)?.name || d.title || 'Passport'
        return d.expiryDate ? `${who}: expires ${fmtDateY(d.expiryDate)}` : `${who}: no expiry saved`
      })
      return say(lines.join('\n'), 'vault')
    }
    if (has(q, 'number')) {
      return say('Passport numbers are in each person’s travel profile — open the Vault to view them.', 'vault')
    }
    return say(`${live.length} passport${live.length === 1 ? '' : 's'} saved in the Vault.`, 'vault')
  }

  if (has(q, 'visa', 'entry requirement', 'do i need', 'six month', '6 month')) {
    if (!trip) return say('No trips saved yet.', 'trips')
    const travellers = trip.travellerIds?.length ? people.filter(p => trip.travellerIds.includes(p.id)) : people
    const e = checkEntry(trip, travellers, documents.filter(d => !d.deleted && d.type === 'Passport'))
    if (!e) return say('Not enough trip detail to check.', 'trips')
    if (e.domestic) return say('Domestic trip — no passport or visa needed. Just photo ID for the airline.')
    return say(`Passports usually need to be ${e.rule.label}. ${e.rows.map(r => `${r.name}: ${r.text}`).join(' ')}`)
  }

  if (has(q, 'document', 'expiring', 'expires')) {
    const soon = documents.filter(d => !d.deleted && d.expiryDate)
      .map(d => ({ d, days: Math.round((new Date(d.expiryDate) - new Date()) / 86400000) }))
      .filter(x => x.days < 365).sort((a, b) => a.days - b.days)
    if (!soon.length) return say('Nothing expiring in the next year.', 'vault')
    return say(soon.slice(0, 4).map(({ d, days }) =>
      `${d.title || d.type}: ${days} days`).join('\n'), 'vault')
  }

  // ---- Packing -----------------------------------------------------------
  if (has(q, 'pack', 'packed', 'packing')) {
    const items = packing.filter(k => k.tripId === trip?.id)
    if (!items.length) return say('Nothing on the packing list for this trip yet.', 'packing')
    const done = items.filter(i => i.checked).length
    const left = items.filter(i => !i.checked).slice(0, 5).map(i => i.name)
    return say(`${done} of ${items.length} packed.${left.length ? ` Still to do: ${left.join(', ')}.` : ' All done.'}`, 'packing')
  }

  // ---- Destination essentials -------------------------------------------
  const ess = getEssentials(trip?.countryCode)
  if (ess) {
    if (has(q, 'plug', 'adapter', 'adaptor', 'socket', 'charge')) return say(`Type ${ess.plug} plugs, ${ess.volts}.`, 'emergency')
    if (has(q, 'water', 'drink the water', 'tap')) return say(ess.waterText + '.', 'emergency')
    if (has(q, 'tip', 'tipping', 'gratuity')) return say(ess.tip + '.', 'emergency')
    if (has(q, 'drive', 'driving', 'side of the road')) return say(`They drive on the ${ess.side}.`, 'emergency')
    if (has(q, 'currency', 'money', 'cash')) return say(`Local currency: ${ess.cur}.`, 'emergency')
  }
  if (has(q, 'emergency number', 'ambulance', 'police', '999', '112', '911')) {
    return say('Emergency numbers for your destination are on the Emergency page.', 'emergency')
  }

  // ---- Today's plans -----------------------------------------------------
  if (has(q, 'today', 'plan', 'doing', 'schedule', 'itinerary', 'tomorrow')) {
    if (!trip) return say('No trips saved yet.', 'trips')
    const date = has(q, 'tomorrow') ? isoDate(new Date(Date.now() + 86400000)) : isoDate()
    const list = plans.filter(p => !p.deleted && p.tripId === trip.id && p.date === date).sort(byTime)
    if (!list.length) return say(`Nothing planned for ${dayLabel(date).toLowerCase()}.`)
    return say(list.map(p => `${p.time ? p.time + ' — ' : ''}${p.title}`).join('\n'))
  }

  // ---- Who -----------------------------------------------------------------
  if (has(q, 'who is coming', 'who’s coming', 'whos coming', 'who is travelling', 'travellers')) {
    if (!trip) return say('No trips saved yet.', 'trips')
    const names = (trip.travellerIds?.length ? people.filter(p => trip.travellerIds.includes(p.id)) : people).map(p => p.name)
    return say(names.length ? names.join(', ') + '.' : 'No travellers assigned to this trip.', 'trips')
  }

  return { unknown: true, text: '' }
}

// ---- Natural-language "add a plan" ---------------------------------------
// Deliberately conservative: we parse, then the UI shows what it understood and
// waits for confirmation — it never silently writes to your itinerary.
export function parseAddPlan(question, trips = []) {
  const q = (question || '').trim()
  if (!/^(add|book|schedule|plan|remind me to)\b/i.test(q)) return null
  const trip = focusTrip(trips)
  if (!trip) return null

  let rest = q.replace(/^(add|book|schedule|plan|remind me to)\s+/i, '')

  // Time: "7pm", "19:00", "at 7.30pm"
  let time = ''
  const tm = rest.match(/\bat\s+(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\b/i) || rest.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/i)
  if (tm) {
    let h = Number(tm[1]); const mi = tm[2] ? Number(tm[2]) : 0
    const ap = (tm[3] || '').toLowerCase()
    if (ap === 'pm' && h < 12) h += 12
    if (ap === 'am' && h === 12) h = 0
    time = `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`
    rest = rest.replace(tm[0], ' ')
  }

  // Day: today / tomorrow / a weekday name
  let date = isoDate()
  if (/\btomorrow\b/i.test(rest)) { date = isoDate(new Date(Date.now() + 86400000)); rest = rest.replace(/\btomorrow\b/i, ' ') }
  else {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const dm = rest.match(new RegExp(`\\b(on\\s+)?(${days.join('|')})\\b`, 'i'))
    if (dm) {
      const target = days.indexOf(dm[2].toLowerCase())
      const now = new Date()
      const delta = (target - now.getDay() + 7) % 7 || 7
      date = isoDate(new Date(now.getTime() + delta * 86400000))
      rest = rest.replace(dm[0], ' ')
    }
  }

  // Place: "at Franklin" / "in Salamanca"
  let place = ''
  const pm = rest.match(/\b(?:at|in)\s+([A-Z][\w' -]{2,40})/)
  if (pm) { place = pm[1].trim(); rest = rest.replace(pm[0], ' ') }

  const title = rest.replace(/\s{2,}/g, ' ').replace(/^[\s,–-]+|[\s,–-]+$/g, '')
  if (!title) return null
  return { tripId: trip.id, tripName: trip.destinationCity, date, time, title, place }
}
