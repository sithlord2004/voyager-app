// Work out the local time at a destination, so notifications can arrive at a
// sensible hour *there* rather than whenever the cron happens to run.
//
// Uses Open-Meteo's geocoding API (free, no key — the same service the app
// already uses for weather), which returns an IANA timezone for a place.

const cache = new Map()   // city -> timezone, for the life of the function instance

export async function timezoneFor(city, countryCode) {
  const key = `${city || ''}|${countryCode || ''}`
  if (cache.has(key)) return cache.get(key)
  if (!city) return null
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&format=json`
    const r = await fetch(url)
    if (!r.ok) return null
    const j = await r.json()
    const tz = j?.results?.[0]?.timezone || null
    cache.set(key, tz)
    return tz
  } catch { return null }
}

// Current hour (0–23) and date (YYYY-MM-DD) in a given IANA timezone.
export function nowIn(timeZone) {
  const d = new Date()
  if (!timeZone) return { hour: d.getUTCHours(), date: d.toISOString().slice(0, 10) }
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit'
    }).formatToParts(d).reduce((acc, p) => (acc[p.type] = p.value, acc), {})
    return {
      hour: Number(parts.hour) % 24,
      date: `${parts.year}-${parts.month}-${parts.day}`
    }
  } catch {
    return { hour: d.getUTCHours(), date: d.toISOString().slice(0, 10) }
  }
}
