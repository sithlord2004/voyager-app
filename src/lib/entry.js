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
// `nationalities` maps personId -> array of ISO codes (from their encrypted
// profile; dual nationals have more than one).
// `ruleNationality` is whose passports the live rule was written for (FCDO = GB).
// `homeCode` is the country you live in — a trip inside it is domestic, so no
// passport or entry requirements apply at all.
export function checkEntry(trip, travellers, passports, live, nationalities = {}, ruleNationality = 'GB', homeCode = '') {
  if (!trip) return null
  const dest = (trip.countryCode || '').toUpperCase()
  const home = (homeCode || '').toUpperCase()

  // Domestic trip: flying within your own country needs no passport (airlines
  // still want photo ID, but that's not an entry requirement).
  if (dest && home && dest === home) {
    return {
      domestic: true,
      rule: { months: 0, label: 'not needed for a domestic trip', source: 'domestic', from: 'departure' },
      requiredUntil: null,
      ruleNationality,
      anyMismatch: false,
      worst: 'ok',
      rows: travellers.map(p => ({
        id: p.id, name: p.name, level: 'ok', domestic: true,
        nat: (nationalities[p.id] || [])[0] || '',
        text: 'Domestic trip — no passport required. Carry photo ID for the airline.'
      }))
    }
  }
  const rule = validityRule(trip.countryCode, live)
  const end = trip.endDate ? new Date(trip.endDate + 'T00:00') : null
  const start = trip.startDate ? new Date(trip.startDate + 'T00:00') : null
  // Count from arrival or from departure, depending on how the rule is worded.
  const base = rule.from === 'arrival' ? (start || end) : end
  const requiredUntil = base ? addMonths(base, rule.months) : null

  const rows = travellers.map(p => {
    // Each passport, newest expiry first, tagged with the country that issued it.
    const docs = passports
      .filter(d => d.personId === p.id && d.expiryDate)
      .map(d => ({ exp: new Date(d.expiryDate + 'T00:00'), cc: (d.issuingCountry || '').toUpperCase() }))
      .sort((a, b) => b.exp - a.exp)

    // Nationalities we know about: from the profile, plus any passport we hold.
    const nats = [...new Set([
      ...(nationalities[p.id] || []).map(n => n.toUpperCase()),
      ...docs.map(d => d.cc).filter(Boolean)
    ])]
    // The live rule is written for one nationality. A dual national who holds
    // that nationality is covered, so only flag people who hold none of it.
    const natMismatch = !!(nats.length && rule.source === 'live' && !nats.includes(ruleNationality))
    const which = cc => cc ? ` on your ${cc} passport` : ''
    const base = { id: p.id, name: p.name, nat: nats.join(' / '), nats, natMismatch }

    if (!docs.length) {
      return { ...base, level: 'unknown',
        text: 'No passport expiry saved — add it in the Vault to check.' }
    }

    // Citizen of the destination? Then you enter on that passport: no visa and
    // no six-month rule — it only has to be valid.
    const citizen = dest ? docs.find(d => d.cc === dest) : null
    if (citizen) {
      if (end && citizen.exp < end) {
        return { ...base, level: 'bad', usedCc: citizen.cc,
          text: `Your ${citizen.cc} passport expires ${fmt(citizen.exp)} — before your return. Renew before travelling.` }
      }
      return { ...base, level: 'ok', usedCc: citizen.cc, citizen: true,
        text: `Entering as a citizen${which(citizen.cc)} — valid until ${fmt(citizen.exp)}. No visa needed.` }
    }

    // Otherwise: you're fine if ANY passport you hold meets the requirement.
    const passing = docs.find(d => !requiredUntil || d.exp >= requiredUntil)
    if (passing) {
      const tight = requiredUntil && passing.exp < addMonths(requiredUntil, 1)
      return { ...base, level: tight ? 'warn' : 'ok', usedCc: passing.cc,
        text: tight
          ? `Valid until ${fmt(passing.exp)}${which(passing.cc)} — only just meets the ${rule.label} rule. Fine, but cutting it close.`
          : `Passport valid until ${fmt(passing.exp)}${which(passing.cc)}.` }
    }

    // None qualify — report the best one and how far short it is.
    const best = docs[0]
    if (end && best.exp < end) {
      return { ...base, level: 'bad', usedCc: best.cc,
        text: `Passport expires ${fmt(best.exp)} — before your return. Renew before travelling.` }
    }
    const daysShort = Math.ceil((requiredUntil - best.exp) / DAY)
    return { ...base, level: 'bad', usedCc: best.cc,
      text: `${docs.length > 1 ? 'Best passport expires' : 'Expires'} ${fmt(best.exp)} — needs to be valid until ${fmt(requiredUntil)} (${rule.label}). Short by ~${daysShort} days.` }
  })

  const worst = rows.some(r => r.level === 'bad') ? 'bad'
    : rows.some(r => r.level === 'unknown') ? 'unknown'
    : rows.some(r => r.level === 'warn') ? 'warn' : 'ok'

  return { rule, requiredUntil, rows, worst, ruleNationality, anyMismatch: rows.some(r => r.natMismatch) }
}
