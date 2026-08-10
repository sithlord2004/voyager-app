// Fetch + normalise UK FCDO travel advice for a destination (free, official,
// no key). Used by both /api/advisory (live card) and the daily email cron.

const CC_SLUG = {
  JP: 'japan', KR: 'south-korea', CN: 'china', HK: 'hong-kong', TW: 'taiwan', SG: 'singapore',
  MY: 'malaysia', ID: 'indonesia', VN: 'vietnam', PH: 'philippines', TH: 'thailand', IN: 'india',
  LK: 'sri-lanka', NP: 'nepal', AE: 'united-arab-emirates', QA: 'qatar', SA: 'saudi-arabia',
  IL: 'israel', JO: 'jordan', EG: 'egypt', US: 'usa', CA: 'canada', MX: 'mexico', BR: 'brazil',
  AR: 'argentina', CL: 'chile', CO: 'colombia', PE: 'peru', CR: 'costa-rica', AU: 'australia',
  NZ: 'new-zealand', ZA: 'south-africa', MA: 'morocco', KE: 'kenya', NG: 'nigeria', FR: 'france',
  ES: 'spain', IT: 'italy', DE: 'germany', NL: 'netherlands', BE: 'belgium', PT: 'portugal',
  GR: 'greece', AT: 'austria', CH: 'switzerland', SE: 'sweden', DK: 'denmark', FI: 'finland',
  NO: 'norway', IS: 'iceland', PL: 'poland', CZ: 'czech-republic', HU: 'hungary', HR: 'croatia',
  RO: 'romania', TR: 'turkey', RU: 'russia', IE: 'ireland', GB: 'uk'
}

const slugify = s => (s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// FCDO alert_status codes -> [severity, label]. Highest severity wins.
const LEVELS = {
  avoid_all_travel_to_whole_country: ['red', 'Advises against ALL travel'],
  avoid_all_but_essential_travel_to_whole_country: ['red', 'Advises against all but essential travel'],
  avoid_all_travel_to_parts: ['amber', 'Advises against all travel to parts'],
  avoid_all_but_essential_travel_to_parts: ['amber', 'Advises against all but essential travel to parts']
}

const strip = h => (h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

// Split an FCDO part's HTML into { "heading": "text" } by its <h2> headings.
function sections(html) {
  const out = {}
  for (const chunk of (html || '').split(/<h2[^>]*>/i).slice(1)) {
    const m = chunk.match(/^([\s\S]*?)<\/h2>([\s\S]*)$/i)
    if (m) out[strip(m[1]).toLowerCase()] = strip(m[2])
  }
  return out
}

// Pull live entry requirements out of the same document: the passport-validity
// rule (in months, so the app can compute the exact date), blank pages, plus the
// visa and vaccine wording. Falls back gracefully when a country words it oddly.
function extractEntry(parts) {
  const er = (parts || []).find(p => p.slug === 'entry-requirements')
  if (!er) return null
  const sec = sections(er.body)
  const passportText = sec['passport validity requirements'] || ''
  const visaText = sec['visa requirements'] || ''
  const vaccineText = sec['vaccine requirements'] || sec['vaccination requirements'] || ''

  // "at least 6 months after the date you arrive" / "6 months beyond..."
  const mMonths = passportText.match(/at least (\d+)\s*months?/i) || passportText.match(/(\d+)\s*months?['’]?\s*validity/i)
  const mPages = passportText.match(/at least (\d+)\s*blank page/i)
  // Does the rule count from arrival or from departure/exit?
  const fromArrival = /after the date you arrive|on arrival|date of arrival|you arrive/i.test(passportText)

  return {
    months: mMonths ? Number(mMonths[1]) : null,
    blankPages: mPages ? Number(mPages[1]) : null,
    from: fromArrival ? 'arrival' : 'departure',
    passportText: passportText.slice(0, 420),
    visaText: visaText.slice(0, 420),
    vaccineText: vaccineText.slice(0, 300)
  }
}

export async function fetchAdvisory(countryCode, countryName) {
  const slug = CC_SLUG[(countryCode || '').toUpperCase()] || slugify(countryName)
  if (!slug) return null
  let data
  try {
    const r = await fetch(`https://www.gov.uk/api/content/foreign-travel-advice/${slug}`)
    if (!r.ok) return { found: false, slug, link: 'https://www.gov.uk/foreign-travel-advice' }
    data = await r.json()
  } catch { return null }

  const alertStatus = data?.details?.alert_status || []
  let level = 'none', levelLabel = 'No specific warnings — see the latest advice before you travel'
  for (const a of alertStatus) {
    const m = LEVELS[a]
    if (m && (m[0] === 'red' || level !== 'red')) { level = m[0]; levelLabel = m[1] }
  }
  const parts = data?.details?.parts || []
  const summary = strip((parts[0] && parts[0].body) || data?.description || '').slice(0, 340)

  return {
    found: true,
    country: (data.title || '').replace(/ travel advice$/i, '') || countryName,
    slug,
    level,
    levelLabel,
    alertStatus,
    summary,
    updated: data.public_updated_at || data.updated_at || null,
    changeDescription: strip(data?.details?.change_description || ''),
    link: `https://www.gov.uk/foreign-travel-advice/${slug}`,
    // Live entry requirements (passport validity in months, visa + vaccine text)
    entry: extractEntry(parts),
    entryLink: `https://www.gov.uk/foreign-travel-advice/${slug}/entry-requirements`,
    fingerprint: (data.public_updated_at || '') + '|' + alertStatus.join(',')
  }
}
