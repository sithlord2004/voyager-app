// ---------------------------------------------------------------------------
// Nationality awareness for entry requirements.
//
// The live rule we fetch comes from the UK Foreign Office, which writes for
// BRITISH passport holders. If someone in the family travels on a different
// passport, that rule may not apply to them — so we detect the mismatch and
// point them at their own government's official source instead.
// ---------------------------------------------------------------------------

// Free-text nationality ("British", "UK", "Australian"…) -> ISO country code.
const NATIONALITY_CODES = {
  british: 'GB', uk: 'GB', 'united kingdom': 'GB', english: 'GB', scottish: 'GB',
  welsh: 'GB', 'northern irish': 'GB', gb: 'GB', gbr: 'GB',
  australian: 'AU', australia: 'AU', au: 'AU', aus: 'AU',
  american: 'US', 'united states': 'US', usa: 'US', us: 'US',
  canadian: 'CA', canada: 'CA', ca: 'CA',
  'new zealander': 'NZ', 'new zealand': 'NZ', kiwi: 'NZ', nz: 'NZ',
  irish: 'IE', ireland: 'IE', ie: 'IE',
  indian: 'IN', india: 'IN', 'in': 'IN',
  german: 'DE', french: 'FR', spanish: 'ES', italian: 'IT', dutch: 'NL',
  portuguese: 'PT', polish: 'PL', swedish: 'SE', danish: 'DK', norwegian: 'NO',
  'south african': 'ZA', singaporean: 'SG', japanese: 'JP', chinese: 'CN'
}

// Official entry-requirement sources by passport nationality.
const SOURCES = {
  GB: { name: 'UK Foreign Office',
        url: c => `https://www.gov.uk/foreign-travel-advice/${slug(c)}/entry-requirements` },
  AU: { name: 'Smartraveller (Australia)',
        url: c => `https://www.smartraveller.gov.au/destinations/${slug(c)}` },
  NZ: { name: 'SafeTravel (New Zealand)',
        url: () => 'https://www.safetravel.govt.nz/destinations' },
  CA: { name: 'Travel.gc.ca (Canada)',
        url: c => `https://travel.gc.ca/destinations/${slug(c)}` },
  US: { name: 'US State Department',
        url: () => 'https://travel.state.gov/content/travel/en/international-travel/International-Travel-Country-Information-Pages.html' },
  IE: { name: 'Ireland — DFA travel advice',
        url: c => `https://www.ireland.ie/en/dfa/overseas-travel/advice/${slug(c)}/` }
}

// Anything we don't have a national source for: IATA's Travel Centre covers all
// passports and is what airlines themselves check against.
const FALLBACK = {
  name: 'IATA Travel Centre',
  url: () => 'https://www.iatatravelcentre.com/'
}

const slug = s => (s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// Dual nationals are common, so accept a list: "British, Australian" /
// "British & Australian" / "British and Australian" -> ['GB','AU'].
export function toNationalityCodes(...texts) {
  const out = []
  for (const t of texts) {
    for (const piece of (t || '').split(/[,/&+;]|\band\b/i)) {
      const code = toNationalityCode(piece)
      if (code && !out.includes(code)) out.push(code)
    }
  }
  return out
}

// Normalise a free-text nationality to a country code (or '' if unrecognised).
export function toNationalityCode(text) {
  const t = (text || '').trim().toLowerCase()
  if (!t) return ''
  if (NATIONALITY_CODES[t]) return NATIONALITY_CODES[t]
  // "British citizen", "Australian (passport)" — try the first word.
  const first = t.split(/[\s(,/]+/)[0]
  return NATIONALITY_CODES[first] || (/^[a-z]{2}$/.test(t) ? t.toUpperCase() : '')
}

// Where should THIS passport holder check requirements for THIS destination?
export function sourceFor(natCode, destinationName) {
  const s = SOURCES[(natCode || '').toUpperCase()] || FALLBACK
  return { name: s.name, url: s.url(destinationName) }
}

// Human label for a code, for messages like "for Australian passports".
const ADJECTIVE = {
  GB: 'British', AU: 'Australian', US: 'US', CA: 'Canadian', NZ: 'New Zealand',
  IE: 'Irish', IN: 'Indian', DE: 'German', FR: 'French', ES: 'Spanish',
  IT: 'Italian', NL: 'Dutch', PT: 'Portuguese', PL: 'Polish', SE: 'Swedish',
  DK: 'Danish', NO: 'Norwegian', ZA: 'South African', SG: 'Singaporean',
  JP: 'Japanese', CN: 'Chinese'
}
export const nationalityLabel = code => ADJECTIVE[(code || '').toUpperCase()] || code || ''

// Countries offered when tagging which passport is which.
export const COUNTRIES = [
  ['GB', 'United Kingdom'], ['AU', 'Australia'], ['NZ', 'New Zealand'], ['IE', 'Ireland'],
  ['US', 'United States'], ['CA', 'Canada'], ['IN', 'India'], ['ZA', 'South Africa'],
  ['SG', 'Singapore'], ['DE', 'Germany'], ['FR', 'France'], ['ES', 'Spain'], ['IT', 'Italy'],
  ['NL', 'Netherlands'], ['PT', 'Portugal'], ['PL', 'Poland'], ['SE', 'Sweden'],
  ['DK', 'Denmark'], ['NO', 'Norway'], ['JP', 'Japan'], ['CN', 'China']
]
export const countryName = code =>
  (COUNTRIES.find(c => c[0] === (code || '').toUpperCase()) || [])[1] || code || ''
