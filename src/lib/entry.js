// ---------------------------------------------------------------------------
// "Ready to enter?" — the entry checks that actually catch people out.
//
// The big one is the six-month rule: many countries require your passport to be
// valid for six months BEYOND your return date, so a passport that looks in-date
// can still get you turned away at check-in. We compute that from the passport
// expiry already in your vault, and pair it with a link to the official source.
//
// This is guidance, not immigration advice — rules vary by nationality and
// change, so every result points at the official page for the final word.
// ---------------------------------------------------------------------------

// Countries that generally require 6 months' validity beyond arrival/stay.
const SIX_MONTH = new Set([
  'TH','VN','ID','PH','MY','SG','CN','IN','LK','NP','AE','QA','SA','JO','EG','IL',
  'TR','KE','ZA','NG','MA','BR','PE','CO','EC','MX','ID','MM','KH','LA','FJ','MV'
])
// Countries that generally require 3 months beyond departure (e.g. Schengen).
const THREE_MONTH = new Set([
  'FR','ES','IT','DE','NL','BE','PT','GR','AT','CH','SE','DK','NO','FI','IS','PL',
  'CZ','HU','HR','RO','SK','SI','EE','LV','LT','LU','MT','BG'
])

const DAY = 86400000
const addMonths = (date, n) => { const d = new Date(date); d.setMonth(d.getMonth() + n); return d }
const fmt = d => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

// How much validity the destination wants beyond your return.
// `live` is the parsed FCDO rule ({ months, from }) when we have it — official
// and current. The static table below is only the offline fallback.
export function validityRule(cc, live) {
  if (live && typeof live.months === 'number' && live.months > 0) {
    return {
      months: live.months,
      label: `${live.months} months beyond your ${live.from === 'arrival' ? 'arrival' : 'return'}`,
      source: 'live',
      from: live.from || 'departure'
    }
  }
  const c = (cc || '').toUpperCase()
  if (SIX_MONTH.has(c)) return { months: 6, label: '6 months beyond your return', source: 'offline', from: 'departure' }
  if (THREE_MONTH.has(c)) return { months: 3, label: '3 months beyond your departure', source: 'offline', from: 'departure' }
  return { months: 0, label: 'valid for the whole trip', source: 'offline', from: 'departure' }
}

// Official entry-requirements page (UK FCDO — matches the advisory feature).
export function officialLink(countryName) {
  const slug = (countryName || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return slug
    ? `https://www.gov.uk/foreign-travel-advice/${slug}/entry-requirements`
    : 'https://www.gov.uk/foreign-travel-advice'
}

// Build a per-traveller checklist for a trip.
//   travellers: [{ id, name }]
//   passports:  documents filtered to type 'Passport' (needs personId + expiryDate)
// `nationalities` maps personId -> ISO code (from their encrypted profile).
// `ruleNationality` is whose passports the live rule was written for (FCDO = GB).
export function checkEntry(trip, travellers, passports, live, nationalities = {}, ruleNationality = 'GB') {
  if (!trip) return null
  const rule = validityRule(trip.countryCode, live)
  const end = trip.endDate ? new Date(trip.endDate + 'T00:00') : null
  const start = trip.startDate ? new Date(trip.startDate + 'T00:00') : null
  // Count from arrival or from departure, depending on how the rule is worded.
  const base = rule.from === 'arrival' ? (start || end) : end
  const requiredUntil = base ? addMonths(base, rule.months) : null

  const rows = travellers.map(p => {
    const nat = (nationalities[p.id] || '').toUpperCase()
    // The live rule is written for one nationality; flag anyone travelling on a
    // different passport so they don't rely on a rule that may not apply.
    const natMismatch = !!(nat && rule.source === 'live' && nat !== ruleNationality)
    const base = { id: p.id, name: p.name, nat, natMismatch }

    const doc = passports
      .filter(d => d.personId === p.id && d.expiryDate)
      .sort((a, b) => b.expiryDate.localeCompare(a.expiryDate))[0]

    if (!doc) {
      return { ...base, level: 'unknown',
        text: 'No passport expiry saved — add it in the Vault to check.' }
    }
    const exp = new Date(doc.expiryDate + 'T00:00')
    if (end && exp < end) {
      return { ...base, level: 'bad',
        text: `Passport expires ${fmt(exp)} — before your return. Renew before travelling.` }
    }
    if (requiredUntil && exp < requiredUntil) {
      const daysShort = Math.ceil((requiredUntil - exp) / DAY)
      return { ...base, level: 'bad',
        text: `Expires ${fmt(exp)} — needs to be valid until ${fmt(requiredUntil)} (${rule.label}). Short by ~${daysShort} days.` }
    }
    // Valid, but flag if it's close to the line.
    if (requiredUntil && exp < addMonths(requiredUntil, 1)) {
      return { ...base, level: 'warn',
        text: `Valid until ${fmt(exp)} — only just meets the ${rule.label} rule. Fine, but cutting it close.` }
    }
    return { ...base, level: 'ok', text: `Passport valid until ${fmt(exp)}.` }
  })

  const worst = rows.some(r => r.level === 'bad') ? 'bad'
    : rows.some(r => r.level === 'unknown') ? 'unknown'
    : rows.some(r => r.level === 'warn') ? 'warn' : 'ok'

  return { rule, requiredUntil, rows, worst, ruleNationality, anyMismatch: rows.some(r => r.natMismatch) }
}
