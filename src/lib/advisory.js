// Client-side travel advisory. Calls our serverless proxy (which fetches the
// official UK FCDO feed and trims it). Returns a status object so the UI can
// tell "sync not configured" apart from "backend not reachable / no page".
import { getSyncConfig } from './sync.js'

export async function getAdvisory(cc, name) {
  const cfg = await getSyncConfig()
  if (!cfg.endpoint || !cfg.token) return { status: 'unconfigured' }
  try {
    const url = `${cfg.endpoint.replace(/\/$/, '')}/advisory?cc=${encodeURIComponent(cc || '')}&name=${encodeURIComponent(name || '')}`
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + cfg.token } })
    if (!r.ok) return { status: 'error', code: r.status }
    const { advisory } = await r.json()
    if (!advisory) return { status: 'none' }
    return { status: 'ok', ...advisory }
  } catch (e) {
    return { status: 'error', message: String(e?.message || e) }
  }
}
