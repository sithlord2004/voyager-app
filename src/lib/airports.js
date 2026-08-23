// Coordinates [lat, lon] for major airports + a few metropolitan codes, used to
// plot flight legs on the journey map. Codes an entered leg uses are looked up
// here first; anything not found falls back to geocoding the destination city.
export const AIRPORTS = {
  // United Kingdom & Ireland
  LHR: [51.47, -0.45], LGW: [51.15, -0.18], STN: [51.88, 0.24], LCY: [51.50, 0.05],
  MAN: [53.35, -2.27], EDI: [55.95, -3.37], BHX: [52.45, -1.75], GLA: [55.87, -4.43],
  DUB: [53.42, -6.27], LON: [51.47, -0.45],
  // Europe
  CDG: [49.01, 2.55], ORY: [48.73, 2.38], PAR: [49.01, 2.55], AMS: [52.31, 4.76],
  FRA: [50.04, 8.56], MUC: [48.35, 11.79], BER: [52.36, 13.50], MAD: [40.47, -3.56],
  BCN: [41.30, 2.08], LIS: [38.77, -9.13], FCO: [41.80, 12.25], MXP: [45.63, 8.72],
  ZRH: [47.46, 8.55], VIE: [48.11, 16.57], CPH: [55.62, 12.66], ARN: [59.65, 17.92],
  OSL: [60.19, 11.10], HEL: [60.32, 24.96], IST: [41.26, 28.74], ATH: [37.94, 23.95],
  PRG: [50.10, 14.26], WAW: [52.17, 20.97], BRU: [50.90, 4.48], MOW: [55.41, 37.90],
  // North America
  JFK: [40.64, -73.78], EWR: [40.69, -74.17], LGA: [40.78, -73.87], NYC: [40.64, -73.78],
  LAX: [33.94, -118.41], SFO: [37.62, -122.38], ORD: [41.98, -87.90], MIA: [25.80, -80.29],
  BOS: [42.36, -71.01], SEA: [47.45, -122.31], DFW: [32.90, -97.04], ATL: [33.64, -84.43],
  DEN: [39.86, -104.67], LAS: [36.08, -115.15], IAD: [38.95, -77.46], SAN: [32.73, -117.19],
  YYZ: [43.68, -79.61], YVR: [49.19, -123.18], YYC: [51.13, -114.01], YUL: [45.47, -73.74],
  MEX: [19.44, -99.07], CUN: [21.04, -86.87],
  // South America
  GRU: [-23.43, -46.47], EZE: [-34.82, -58.54], SCL: [-33.39, -70.79], LIM: [-12.02, -77.11],
  BOG: [4.70, -74.15], GIG: [-22.81, -43.25],
  // Asia
  HND: [35.55, 139.78], NRT: [35.77, 140.39], TYO: [35.55, 139.78], KIX: [34.43, 135.24],
  ITM: [34.79, 135.44], OSA: [34.43, 135.24], ICN: [37.46, 126.44], SEL: [37.46, 126.44],
  PEK: [40.08, 116.58], PVG: [31.14, 121.81], HKG: [22.31, 113.91], TPE: [25.08, 121.23],
  SIN: [1.36, 103.99], BKK: [13.69, 100.75], KUL: [2.74, 101.71], CGK: [-6.13, 106.66],
  MNL: [14.51, 121.02], DEL: [28.56, 77.10], BOM: [19.09, 72.87], DPS: [-8.75, 115.17],
  HAN: [21.22, 105.81], SGN: [10.82, 106.66], CMB: [7.18, 79.88], KTM: [27.70, 85.36],
  // Middle East & Africa
  DXB: [25.25, 55.36], DOH: [25.27, 51.61], AUH: [24.43, 54.65], TLV: [32.01, 34.89],
  CAI: [30.11, 31.40], JNB: [-26.13, 28.25], CPT: [-33.97, 18.60], NBO: [-1.32, 36.93],
  CMN: [33.37, -7.59], RAK: [31.61, -8.04],
  // Oceania
  SYD: [-33.95, 151.18], MEL: [-37.67, 144.84], BNE: [-27.38, 153.12], PER: [-31.94, 115.97],
  ADL: [-34.95, 138.53], HBA: [-42.84, 147.51], CBR: [-35.31, 149.20], OOL: [-28.16, 153.51],
  CNS: [-16.89, 145.75], DRW: [-12.41, 130.88], LST: [-41.55, 147.21],
  AKL: [-37.01, 174.79], CHC: [-43.49, 172.53], WLG: [-41.33, 174.81], ZQN: [-45.02, 168.74],
  HNL: [21.32, -157.92], NAN: [-17.76, 177.44]
}

// Common city / airport names -> IATA, so a leg typed as "Melbourne" shows the
// same "MEL" style as live flight data (which always returns codes).
const CITY_IATA = {
  melbourne: 'MEL', sydney: 'SYD', brisbane: 'BNE', perth: 'PER', adelaide: 'ADL', hobart: 'HBA',
  canberra: 'CBR', 'gold coast': 'OOL', cairns: 'CNS', darwin: 'DRW', launceston: 'LST',
  auckland: 'AKL', wellington: 'WLG', christchurch: 'CHC', queenstown: 'ZQN',
  london: 'LHR', manchester: 'MAN', edinburgh: 'EDI', glasgow: 'GLA', dublin: 'DUB',
  paris: 'CDG', amsterdam: 'AMS', frankfurt: 'FRA', munich: 'MUC', berlin: 'BER', madrid: 'MAD',
  barcelona: 'BCN', lisbon: 'LIS', rome: 'FCO', milan: 'MXP', zurich: 'ZRH', vienna: 'VIE',
  copenhagen: 'CPH', stockholm: 'ARN', oslo: 'OSL', helsinki: 'HEL', istanbul: 'IST', athens: 'ATH',
  'new york': 'JFK', 'los angeles': 'LAX', 'san francisco': 'SFO', chicago: 'ORD', miami: 'MIA',
  boston: 'BOS', seattle: 'SEA', toronto: 'YYZ', vancouver: 'YVR', 'mexico city': 'MEX',
  tokyo: 'HND', osaka: 'KIX', kyoto: 'KIX', seoul: 'ICN', beijing: 'PEK', shanghai: 'PVG',
  'hong kong': 'HKG', taipei: 'TPE', singapore: 'SIN', bangkok: 'BKK', 'kuala lumpur': 'KUL',
  jakarta: 'CGK', bali: 'DPS', manila: 'MNL', delhi: 'DEL', mumbai: 'BOM', dubai: 'DXB',
  doha: 'DOH', 'abu dhabi': 'AUH', 'tel aviv': 'TLV', cairo: 'CAI', johannesburg: 'JNB',
  'cape town': 'CPT', nairobi: 'NBO', casablanca: 'CMN', marrakesh: 'RAK', marrakech: 'RAK',
  'sao paulo': 'GRU', 'são paulo': 'GRU', 'rio de janeiro': 'GIG', 'buenos aires': 'EZE',
  santiago: 'SCL', lima: 'LIM', bogota: 'BOG', cancun: 'CUN', montreal: 'YUL', calgary: 'YYC',
  denver: 'DEN', 'las vegas': 'LAS', washington: 'IAD', 'san diego': 'SAN', dallas: 'DFW',
  atlanta: 'ATL', honolulu: 'HNL', hanoi: 'HAN', 'ho chi minh': 'SGN', colombo: 'CMB', kathmandu: 'KTM'
}

// Which country each airport is in. Used to tell a domestic hop (MEL → HBA)
// from an international one, without depending on any per-device setting.
export const AIRPORT_COUNTRY = {
  LHR:'GB', LGW:'GB', STN:'GB', LCY:'GB', MAN:'GB', EDI:'GB', BHX:'GB', GLA:'GB', LON:'GB',
  DUB:'IE',
  CDG:'FR', ORY:'FR', PAR:'FR', AMS:'NL', BRU:'BE',
  FRA:'DE', MUC:'DE', BER:'DE', MAD:'ES', BCN:'ES', LIS:'PT',
  FCO:'IT', MXP:'IT', ZRH:'CH', VIE:'AT', CPH:'DK', ARN:'SE', OSL:'NO', HEL:'FI',
  IST:'TR', ATH:'GR', PRG:'CZ', WAW:'PL', MOW:'RU',
  JFK:'US', EWR:'US', LGA:'US', NYC:'US', LAX:'US', SFO:'US', ORD:'US', MIA:'US',
  BOS:'US', SEA:'US', DFW:'US', ATL:'US', DEN:'US', LAS:'US', IAD:'US', SAN:'US', HNL:'US',
  YYZ:'CA', YVR:'CA', YYC:'CA', YUL:'CA', MEX:'MX', CUN:'MX',
  GRU:'BR', GIG:'BR', EZE:'AR', SCL:'CL', LIM:'PE', BOG:'CO',
  HND:'JP', NRT:'JP', TYO:'JP', KIX:'JP', ITM:'JP', OSA:'JP',
  ICN:'KR', SEL:'KR', PEK:'CN', PVG:'CN', HKG:'HK', TPE:'TW', SIN:'SG',
  BKK:'TH', KUL:'MY', CGK:'ID', DPS:'ID', MNL:'PH', DEL:'IN', BOM:'IN',
  HAN:'VN', SGN:'VN', CMB:'LK', KTM:'NP',
  DXB:'AE', AUH:'AE', DOH:'QA', TLV:'IL', CAI:'EG',
  JNB:'ZA', CPT:'ZA', NBO:'KE', CMN:'MA', RAK:'MA',
  SYD:'AU', MEL:'AU', BNE:'AU', PER:'AU', ADL:'AU', HBA:'AU', CBR:'AU',
  OOL:'AU', CNS:'AU', DRW:'AU', LST:'AU',
  AKL:'NZ', CHC:'NZ', WLG:'NZ', ZQN:'NZ', NAN:'FJ'
}

// Country for a leg endpoint, accepting a code or a city name ('' if unknown).
export function airportCountry(s) {
  return AIRPORT_COUNTRY[toCode(s)] || ''
}

// Normalise a leg endpoint to a short 3-letter code so flights read consistently
// (MEL, HBA, LHR) whether the user typed a code, a city name, or something messy
// like "Melbourne Airport" or "Melbourne (MEL)".
export function toCode(s) {
  const t = (s || '').trim()
  if (!t) return ''
  const up = t.toUpperCase()

  // Already a bare 3-letter code — keep it.
  if (/^[A-Z]{3}$/.test(up)) return up

  // "Melbourne (MEL)" / "Tokyo [HND]" — trust an explicit parenthesised code.
  const paren = up.match(/[([]([A-Z]{3})[)\]]/)
  if (paren) return paren[1]

  // Exact city-name match.
  const lower = t.toLowerCase()
  if (CITY_IATA[lower]) return CITY_IATA[lower]

  // Strip common noise ("International", "Airport", terminal, punctuation) and
  // retry the leading city phrase.
  const cleaned = lower
    .replace(/\b(international|intl\.?|regional|airport|apt|terminal\s*\d*|airfield)\b/g, '')
    .replace(/[,/(].*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (CITY_IATA[cleaned]) return CITY_IATA[cleaned]

  // Try the leading word(s): "london heathrow" -> london -> LHR.
  const words = cleaned.split(' ').filter(Boolean)
  if (words.length > 1 && CITY_IATA[`${words[0]} ${words[1]}`]) return CITY_IATA[`${words[0]} ${words[1]}`]
  if (words[0] && CITY_IATA[words[0]]) return CITY_IATA[words[0]]

  // Any standalone 3-letter token in the string (e.g. "MEL Tullamarine").
  const tok = up.match(/\b[A-Z]{3}\b/)
  if (tok) return tok[0]

  // Fall back to the first word, upper-cased, so at least it's uniform.
  return (cleaned || lower).split(' ')[0].toUpperCase()
}
