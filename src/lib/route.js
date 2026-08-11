// ---------------------------------------------------------------------------
// Rough driving time from an address to an airport, for the Travel Day
// "leave by" calculation.
//
// Both services are free and need no API key, which keeps Voyager key-less and
// costs nothing:
//   • Nominatim (OpenStreetMap) turns an address into coordinates
//   • OSRM computes a driving route between two points
//
// IMPORTANT: OSRM returns FREE-FLOW driving time — it has no live traffic. So
// we present the result as an estimate and add a modest allowance for traffic
// and parking. The user can always override the number.
// ---------------------------------------------------------------------------
import { AIRPORTS } from './airports.js'

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const OSRM = 'https://router.project-osrm.org/route/v1/driving'

// Address (free text) -> { lat, lon, label } or null.
export async function geocodeAddress(query) {
  const q = (query || '').trim()
  if (!q) return null
  const url = `${NOMINATIM}?format=json&limit=1&q=${encodeURIComponent(q)}`
  const r = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!r.ok) return null
  const [hit] = await r.json()
  if (!hit) return null
  return { lat: Number(hit.lat), lon: Number(hit.lon), label: hit.display_name }
}

// Driving minutes between two { lat, lon } points (free-flow, no traffic).
export async function drivingMinutes(from, to) {
  if (!from || !to) return null
  const url = `${OSRM}/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`
  const r = await fetch(url)
  if (!r.ok) return null
  const data = await r.json()
  const sec = data?.routes?.[0]?.duration
  return typeof sec === 'number' ? sec / 60 : null
}

// Full estimate: address -> airport code. Returns the raw drive time plus a
// suggested allowance (+20% for traffic, +5 min for parking/drop-off).
export async function estimateToAirport(address, airportCode) {
  const coords = AIRPORTS[(airportCode || '').toUpperCase()]
  if (!coords) return { error: `We don’t have coordinates for ${airportCode || 'that airport'}.` }

  const place = await geocodeAddress(address)
  if (!place) return { error: 'Couldn’t find that address — try adding the city.' }

  const drive = await drivingMinutes(place, { lat: coords[0], lon: coords[1] })
  if (drive == null) return { error: 'Couldn’t work out a driving route just now.' }

  const suggested = Math.max(5, Math.round(drive * 1.2) + 5)
  return { drive: Math.round(drive), suggested, label: place.label }
}
