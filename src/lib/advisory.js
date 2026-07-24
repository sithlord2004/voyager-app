// Client-side travel advisory. Calls our serverless proxy (which fetches the
// official UK FCDO feed and trims it). Returns null when sync/flight isn't
// configured, so the UI can degrade gracefully.
import { getSyncConfig } from './sync.js'

export async function getAdvisory(cc, name) {
  const cfg = await getSyncConfig()
  if (!cfg.endpoint || !cfg.token) return null
  try {
    const url = `${cfg.endpoint.replace(/\/$/, '')}/advisory?cc=${encodeURIComponent(cc || '')}&name=${encodeURIComponent(name || '')}`
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + cfg.token } })
    if (!r.ok) return null
    const { advisory } = await r.json()
    return advisory || null
  } catch { return null }
}
