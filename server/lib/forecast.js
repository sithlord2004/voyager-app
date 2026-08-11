// Today's forecast for a destination, for the morning briefing.
// Open-Meteo: free, no API key — the same service the app uses on the dashboard.

// A compact description for the small amount of room a notification gives us.
const WMO = {
  0: 'clear', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast',
  45: 'fog', 48: 'freezing fog', 51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle',
  61: 'light rain', 63: 'rain', 65: 'heavy rain', 66: 'freezing rain', 67: 'freezing rain',
  71: 'light snow', 73: 'snow', 75: 'heavy snow', 77: 'snow grains',
  80: 'rain showers', 81: 'rain showers', 82: 'heavy showers',
  85: 'snow showers', 86: 'snow showers',
  95: 'thunderstorms', 96: 'thunderstorms', 99: 'thunderstorms'
}

const geoCache = new Map()

async function coordsFor(city) {
  if (!city) return null
  if (geoCache.has(city)) return geoCache.get(city)
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&format=json`)
    if (!r.ok) return null
    const hit = (await r.json())?.results?.[0]
    const c = hit ? { lat: hit.latitude, lon: hit.longitude } : null
    geoCache.set(city, c)
    return c
  } catch { return null }
}

// -> "12–18°C, rain showers" (or null if unavailable; the briefing still sends)
export async function todayForecast(city, localDate) {
  const c = await coordsFor(city)
  if (!c) return null
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}`
      + `&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=3`
    const r = await fetch(url)
    if (!r.ok) return null
    const d = await r.json()
    const i = Math.max(0, (d?.daily?.time || []).indexOf(localDate))
    const max = d?.daily?.temperature_2m_max?.[i]
    const min = d?.daily?.temperature_2m_min?.[i]
    const code = d?.daily?.weather_code?.[i]
    if (max == null) return null
    const desc = WMO[code] || ''
    return `${Math.round(min)}–${Math.round(max)}°C${desc ? ', ' + desc : ''}`
  } catch { return null }
}
