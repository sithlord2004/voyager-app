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
    fingerprint: (data.public_updated_at || '') + '|' + alertStatus.join(',')
  }
}
