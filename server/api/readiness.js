// GET /api/readiness?familyId=...&tripId=...   Verdicts only. No identity data.
//
// Deliberately selects ONLY the clear-text columns it needs from `documents`
// plus the opaque personId — never `payload` — so the encrypted scan, the
// document number and the issuing country cannot leave the server.
import { createClient } from '@supabase/supabase-js'
import { fetchAdvisory } from '../lib/fcdo.js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

// Mirrors the offline table in src/lib/entry.js — keep the two in step.
const SIX = new Set(['TH','VN','ID','PH','MY','SG','CN','IN','LK','NP','AE','QA','SA','JO','EG','IL','TR','KE','ZA','NG','MA','BR','PE','CO','EC','MX','MM','KH','LA','FJ','MV'])
const THREE = new Set(['FR','ES','IT','DE','NL','BE','PT','GR','AT','CH','SE','DK','NO','FI','IS','PL','CZ','HU','HR','RO','SK','SI','EE','LV','LT','LU','MT','BG'])
const monthsRequired = cc => SIX.has(cc) ? 6 : THREE.has(cc) ? 3 : 0
const addMonths = (iso, n) => { const d = new Date(iso + 'T00:00'); d.setMonth(d.getMonth() + n); return d }
// Format a Date back to YYYY-MM-DD in LOCAL terms. Using toISOString() here
// would roll the date back a day in any UTC+ timezone — the reported deadline
// would be a day earlier than the one actually used for the comparison.
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })
  if ((req.headers.authorization || '') !== 'Bearer ' + process.env.JARVIS_TOKEN)
    return res.status(401).json({ error: 'Unauthorized' })

  const familyId = String(req.query.familyId || '')
  const tripId = String(req.query.tripId || '')
  if (!familyId || !tripId) return res.status(400).json({ error: 'familyId and tripId required' })

  const { data: tripRow } = await supabase.from('trips')
    .select('payload').eq('family_id', familyId).eq('id', tripId).eq('deleted', false).maybeSingle()
  const trip = tripRow?.payload
  if (!trip || trip.deleted) return res.status(404).json({ error: 'Trip not found' })

  // ONLY clear-text columns + the opaque owner id. Never `payload`.
  const { data: docs } = await supabase.from('documents')
    .select('id, doc_type, expiry_date, personId:payload->>personId')
    .eq('family_id', familyId).eq('deleted', false).not('expiry_date', 'is', null)

  const cc = String(trip.countryCode || '').toUpperCase()
  const need = monthsRequired(cc)
  const mustBeValidUntil = addMonths(trip.endDate, need)   // validity beyond trip END
  const ids = trip.travellerIds || []

  const passports = (docs || [])
    .filter(d => /passport/i.test(d.doc_type || ''))
    // Scope to this trip's travellers when known; otherwise show all, because
    // older trips predate traveller assignment and silently returning nothing
    // would be worse than returning too much.
    .filter(d => !ids.length || ids.includes(d.personId))
    .map(d => {
      const exp = new Date(d.expiry_date + 'T00:00')
      return {
        documentId: d.id,                 // opaque
        personId: d.personId || null,     // opaque; names are NOT exposed
        expiryDate: d.expiry_date,        // a date, not an identity detail
        requiredMonthsBeyondTrip: need,
        mustBeValidUntil: ymd(mustBeValidUntil),
        verdict: exp >= mustBeValidUntil ? 'ok'
               : exp >= new Date(trip.endDate + 'T00:00') ? 'too_short'
               : 'expired_before_return'
      }
    })

  let advisory = null
  try {
    const a = await fetchAdvisory(cc, trip.destinationCity)
    if (a?.found) advisory = {
      level: a.level, levelLabel: a.levelLabel, summary: a.summary,
      officialUpdated: a.updated, link: a.link
    }
  } catch { /* advisory is best-effort */ }

  const { data: st } = await supabase.from('advisory_state')
    .select('checked_at').eq('family_id', familyId).eq('country_code', cc).maybeSingle()

  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({
    tripId, destination: trip.destinationCity || null, countryCode: cc || null,
    tripStart: trip.startDate, tripEnd: trip.endDate,
    passports,
    advisory,
    advisoryLastCheckedAt: st?.checked_at || null,
    visa: {
      known: false,
      reason: 'Voyager does not compute visa or eTA requirements. Source these elsewhere.',
      officialLink: `${advisory?.link || 'https://www.gov.uk/foreign-travel-advice'}/entry-requirements`
    },
    computedAt: Date.now()
  })
}
