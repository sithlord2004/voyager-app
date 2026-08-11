// ---------------------------------------------------------------------------
// Client-side flight status. Calls our serverless proxy (which hides the
// provider API key). Returns null when the backend isn't configured, so the UI
// can fall back to the trip's stored flight details.
//
// The provider bills per request and has a monthly quota, so every lookup is
// CACHED and de-duplicated:
//   • a result is reused for 20 minutes (gate/delay data doesn't move faster)
//   • simultaneous requests for the same flight share one network call
//   • flights more than ~3 days out aren't looked up at all — the provider has
//     no useful data that far ahead, so asking just burns quota
// ---------------------------------------------------------------------------
import { getReadBackend } from './publicConfig.js'

const TTL_MS = 20 * 60 * 1000        // reuse a result for 20 minutes
const LOOKUP_WINDOW_DAYS = 3         // don't ask about flights further out
const CACHE_KEY = 'voyager:flightCache'

const inflight = new Map()           // key -> Promise, so we never double-fetch

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') } catch { return {} }
}
function writeCache(c) {
  try {
    // Drop anything stale so this can't grow forever.
    const now = Date.now()
    for (const k of Object.keys(c)) if (now - (c[k]?.at || 0) > TTL_MS * 6) delete c[k]
    localStorage.setItem(CACHE_KEY, JSON.stringify(c))
  } catch { /* storage full or unavailable — caching is optional */ }
}

const daysAway = date => {
  const d = new Date(date + 'T00:00')
  return isNaN(d) ? 0 : Math.round((d - new Date()) / 86400000)
}

export async function getFlightStatus(number, date, { force = false } = {}) {
  if (!number || !date) return null
  const key = `${number}_${date}`

  const cache = readCache()
  const hit = cache[key]
  // On the day of the flight, gates and delays actually change, so allow a
  // fresher check; further out, nothing moves and we save the quota.
  const isToday = date === new Date().toISOString().slice(0, 10)
  const ttl = isToday ? 5 * 60 * 1000 : TTL_MS
  if (!force && hit && Date.now() - hit.at < ttl) return hit.status

  // Too far ahead to be worth a request (and returning the cached value, if any).
  const away = daysAway(date)
  if (!force && (away > LOOKUP_WINDOW_DAYS || away < -1)) return hit?.status ?? null

  if (inflight.has(key)) return inflight.get(key)

  const p = (async () => {
    const b = await getReadBackend()
    if (!b) return null
    try {
      const url = `${b.endpoint.replace(/\/$/, '')}/flight?number=${encodeURIComponent(number)}&date=${date}`
      const r = await fetch(url, { headers: { Authorization: 'Bearer ' + b.token } })
      if (!r.ok) return hit?.status ?? null
      const { status } = await r.json()
      const c = readCache()
      c[key] = { at: Date.now(), status: status || null }
      writeCache(c)
      return status || null
    } catch {
      return hit?.status ?? null          // offline: fall back to what we know
    } finally {
      inflight.delete(key)
    }
  })()

  inflight.set(key, p)
  return p
}

// Map a provider status to a colour + label for the widget chip.
export function statusChip(status) {
  const s = (status || '').toLowerCase()
  if (s.includes('cancel')) return ['st-cancel', 'Cancelled']
  if (s.includes('delay') || s.includes('revised')) return ['st-delay', 'Delayed']
  if (s.includes('arriv')) return ['st-ontime', 'Arrived']
  if (s.includes('depart') || s.includes('air')) return ['st-ontime', 'En route']
  if (s.includes('expect') || s.includes('schedul')) return ['st-ontime', 'On time']
  return ['st-ontime', status || 'Scheduled']
}
