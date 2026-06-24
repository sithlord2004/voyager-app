// POST /api/parse-itinerary   { text }
// Uses an LLM to extract a structured trip from messy booking text (handles
// formats the regex parser misses). Returns the same shape as the client parser
// so the UI can use either interchangeably.
//
// Provider-agnostic: this example calls the Anthropic Messages API. Swap the
// fetch for OpenAI/others by changing the URL, headers, and body.

const SCHEMA_HINT = `Return ONLY minified JSON with keys:
{"destinationCity":string,"startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD","flightNumber":string,"depAirport":string,"arrAirport":string,"airline":string}
Use "" for unknown fields. Dates must be ISO. Destination is the arrival city of the outbound flight.`

export default async function handler(req, res) {
  if ((req.headers.authorization || '') !== 'Bearer ' + process.env.SYNC_TOKEN)
    return res.status(401).json({ error: 'Unauthorized' })
  const { text } = req.body || {}
  if (!text || text.length < 10) return res.status(400).json({ error: 'text required' })

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: `${SCHEMA_HINT}\n\nBooking text:\n${text.slice(0, 6000)}` }]
      })
    })
    if (!r.ok) throw new Error('LLM ' + r.status)
    const data = await r.json()
    const raw = data.content?.[0]?.text || '{}'
    const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1))
    res.status(200).json({ draft: json })
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) })
  }
}
