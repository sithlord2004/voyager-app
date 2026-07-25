// ---------------------------------------------------------------------------
// Client-side flight status. Calls our serverless proxy (which hides the
// provider API key). Returns null when sync/flight isn't configured, so the UI
// can fall back to the trip's stored flight details.
// ---------------------------------------------------------------------------
import { getReadBackend } from './publicConfig.js'

export async function getFlightStatus(number, date) {
  const b = await getReadBackend()
  if (!b) return null
  try {
    const url = `${b.endpoint.replace(/\/$/, '')}/flight?number=${encodeURIComponent(number)}&date=${date}`
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + b.token } })
    if (!r.ok) return null
    const { status } = await r.json()
    return status || null
  } catch { return null }
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
