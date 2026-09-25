// GET /api/flight?number=JL044&date=2026-07-02
const AUTH = process.env.SYNC_TOKEN
// A separate read-only token (optional) baked into the client so shared users
// get live flights without your private sync secret. Scoped to this endpoint.
const READ = process.env.PUBLIC_READ_TOKEN
// Jarvis (a separate personal-assistant app) reads live status server-to-server
// with its own token, so it can be revoked without touching the others.
const JARVIS = process.env.JARVIS_TOKEN
// Each token is guarded by a truthiness check: without it, an unset variable
// would make the literal string "Bearer undefined" a valid credential.
const authorized = h =>
  (AUTH && h === 'Bearer ' + AUTH) ||
  (READ && h === 'Bearer ' + READ) ||
  (JARVIS && h === 'Bearer ' + JARVIS)

// Pick the right instance. A flight number can return several (the same number
// on neighbouring dates, or a different segment entirely), and blindly taking
// the first is how you end up showing someone another flight's gate.
function pickInstance(list, { date, from, to }) {
  if (!list.length) return null
  const iata = f => (f?.departure?.airport?.iata || '').toUpperCase()
  const dest = f => (f?.arrival?.airport?.iata || '').toUpperCase()
  const depDate = f => String(f?.departure?.scheduledTime?.local || '').slice(0, 10)

  let c = list
  if (from) c = c.filter(f => iata(f) === from.toUpperCase())
  if (to && c.some(f => dest(f) === to.toUpperCase())) c = c.filter(f => dest(f) === to.toUpperCase())
  const sameDay = c.filter(f => depDate(f) === date)
  if (sameDay.length) c = sameDay

  // If the caller told us the route and nothing matches it, we'd rather return
  // nothing than confidently show the wrong aircraft's gate.
  if (from && !c.length) return null
  return c[0] || (from ? null : list[0])
}

async function fetchStatus(number, date, from, to) {
  // No key configured = live flight status is switched off. Return nothing
  // rather than calling the provider, so it can't accrue usage or overage.
  if (!process.env.AERODATABOX_KEY) return null
  const url = `https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(number)}/${date}`
  const r = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': process.env.AERODATABOX_KEY,
      'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com'
    }
  })
  if (!r.ok) throw new Error('provider ' + r.status)
  const body = await r.json()
  const list = Array.isArray(body) ? body : (body ? [body] : [])
  const f = pickInstance(list, { date, from, to })
  if (!f) return null
  return {
    number: f.number,
    status: f.status,
    fetchedAt: Date.now(),
    airline: f.airline?.name,
    departure: {
      airport: f.departure?.airport?.iata,
      scheduled: f.departure?.scheduledTime?.local,
      revised: f.departure?.revisedTime?.local,
      terminal: f.departure?.terminal,
      gate: f.departure?.gate
    },
    arrival: {
      airport: f.arrival?.airport?.iata,
      scheduled: f.arrival?.scheduledTime?.local,
      revised: f.arrival?.revisedTime?.local,
      terminal: f.arrival?.terminal,
      gate: f.arrival?.gate,
      baggageBelt: f.arrival?.baggageBelt
    }
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (!authorized(req.headers.authorization || ''))
    return res.status(401).json({ error: 'Unauthorized' })

  const { number, date, from, to } = req.query || {}
  if (!number || !date) return res.status(400).json({ error: 'number and date required' })

  try {
    const status = await fetchStatus(number, date, from, to)
    res.status(200).json({ status })
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) })
  }
}
