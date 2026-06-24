// GET /api/flight?number=JL044&date=2026-07-02
// Proxies a flight-status provider (AeroDataBox via RapidAPI) so the API key
// never ships to the browser. Returns a normalised status object.
//
// Swap the provider easily — only `fetchStatus` and the env var change.

const AUTH = process.env.SYNC_TOKEN // reuse the family token for a simple gate

async function fetchStatus(number, date) {
  const url = `https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(number)}/${date}`
  const r = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': process.env.AERODATABOX_KEY,
      'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com'
    }
  })
  if (!r.ok) throw new Error('provider ' + r.status)
  const arr = await r.json()
  const f = Array.isArray(arr) ? arr[0] : arr
  if (!f) return null
  return {
    number: f.number,
    status: f.status,                                   // e.g. "Expected", "Departed", "Arrived"
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
      terminal: f.arrival?.terminal
    }
  }
}

export default async function handler(req, res) {
  if ((req.headers.authorization || '') !== 'Bearer ' + AUTH)
    return res.status(401).json({ error: 'Unauthorized' })

  const { number, date } = req.query || {}
  if (!number || !date) return res.status(400).json({ error: 'number and date required' })

  try {
    const status = await fetchStatus(number, date)
    res.status(200).json({ status })
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) })
  }
}
