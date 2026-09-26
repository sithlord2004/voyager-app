// GET /api/flights?familyId=...&from=2026-09-24&limit=20
// Read-only. Upcoming flight legs only. Never touches documents or people.
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })
  // Its own token: revoking Jarvis must not disturb Voyager.
  if ((req.headers.authorization || '') !== 'Bearer ' + process.env.JARVIS_TOKEN)
    return res.status(401).json({ error: 'Unauthorized' })

  const familyId = String(req.query.familyId || '')
  if (!familyId) return res.status(400).json({ error: 'familyId required' })
  const from = String(req.query.from || new Date().toISOString().slice(0, 10))
  const limit = Math.min(Number(req.query.limit) || 20, 100)

  const { data, error } = await supabase.from('trips')
    .select('id, payload').eq('family_id', familyId).eq('deleted', false)
  if (error) return res.status(500).json({ error: error.message })

  // First names only, for "who is on this flight". No other person detail is
  // read or returned.
  const { data: peopleRows } = await supabase.from('people')
    .select('payload').eq('family_id', familyId).eq('deleted', false)
  const nameById = {}
  for (const r of peopleRows || []) {
    const p = r.payload
    if (p?.id && p.name && !p.deleted) nameById[p.id] = String(p.name).trim().split(/\s+/)[0]
  }

  const wanted = String(req.query.traveller || '').trim().toLowerCase()
  const unresolved = new Set()
  const flights = []
  for (const row of data || []) {
    const t = row.payload
    if (!t || t.deleted) continue
    ;(t.legs || []).forEach((leg, i) => {
      if ((leg.mode || 'flight') !== 'flight' || !leg.number) return
      const date = leg.date || t.startDate
      if (!date || date < from) return
      const prev = (t.legs || [])[i - 1]
      // Per-leg travellers if a leg ever carries them; otherwise the trip's.
      const ids = (leg.travellerIds?.length ? leg.travellerIds : t.travellerIds) || []
      const names = ids.map(id => nameById[id]).filter(Boolean)
      // Only claim to know who's aboard when EVERY id resolved. A partial or
      // empty list would be worse than silence: Jarvis keeps flights whose
      // `travellers` include Amit, so an empty array would hide his flights
      // entirely. Omitting the key makes Jarvis fall back to showing them all.
      const known = ids.length > 0 && names.length === ids.length
      if (!known) ids.forEach(id => { if (!nameById[id]) unresolved.add(id) })
      flights.push({
        tripId: row.id,
        destination: t.destinationCity || null,
        legIndex: i,
        number: String(leg.number).replace(/\s+/g, '').toUpperCase(),
        from: leg.from || null,
        to: leg.to || null,
        date,                                   // local date at `from`
        depTimeLocal: leg.depTime || null,      // wall clock at `from`, no offset
        arrTimeLocal: leg.arrTime || null,      // wall clock at `to`, no offset
        seat: leg.seat || null,
        isOutbound: i === 0,
        isConnection: !!(prev && prev.to && leg.from &&
          String(prev.to).toUpperCase() === String(leg.from).toUpperCase()),
        ...(known ? { travellers: names } : {})
      })
    })
  }
  flights.sort((a, b) => a.date.localeCompare(b.date) || a.legIndex - b.legIndex)

  // ?traveller=Amit — only flights we can positively confirm include them.
  const filtered = wanted
    ? flights.filter(f => (f.travellers || []).some(n => n.toLowerCase() === wanted))
    : flights

  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({
    flights: filtered.slice(0, limit),
    // Surfaced so a missing name is never silent: these people exist on trips
    // but aren't synced to the cloud, so their flights carry no `travellers`.
    ...(unresolved.size ? { unresolvedTravellerIds: [...unresolved] } : {})
  })
}
