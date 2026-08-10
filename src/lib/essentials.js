// ---------------------------------------------------------------------------
// Destination essentials — the practical stuff you want on landing: what plug
// to pack, whether the tap water is drinkable, tipping norms, which side they
// drive on, and the local currency.
//
// Deliberately static so it works offline on the plane. Figures are general
// guidance, not guarantees — norms vary by region and change over time.
// ---------------------------------------------------------------------------

// [plugTypes, voltage, tapWater, tipping, drivingSide, currency]
const D = (plug, volts, water, tip, side, cur) =>
  ({ plug, volts, water, tip, side, cur })

export const ESSENTIALS = {
  GB: D('G', '230V · 50Hz', 'safe', '10–12.5% in restaurants (often added as service)', 'left', 'GBP £'),
  IE: D('G', '230V · 50Hz', 'safe', '10–15% in restaurants', 'left', 'EUR €'),
  FR: D('C / E', '230V · 50Hz', 'safe', 'Service included; round up', 'right', 'EUR €'),
  ES: D('C / F', '230V · 50Hz', 'safe', 'Small change; 5–10% for good service', 'right', 'EUR €'),
  IT: D('C / F / L', '230V · 50Hz', 'safe', 'Cover charge common; tipping optional', 'right', 'EUR €'),
  DE: D('C / F', '230V · 50Hz', 'safe', 'Round up 5–10%', 'right', 'EUR €'),
  NL: D('C / F', '230V · 50Hz', 'safe', 'Round up 5–10%', 'right', 'EUR €'),
  BE: D('C / E', '230V · 50Hz', 'safe', 'Service included; round up', 'right', 'EUR €'),
  PT: D('C / F', '230V · 50Hz', 'safe', '5–10% in restaurants', 'right', 'EUR €'),
  GR: D('C / F', '230V · 50Hz', 'bottled', '5–10% in restaurants', 'right', 'EUR €'),
  AT: D('C / F', '230V · 50Hz', 'safe', 'Round up 5–10%', 'right', 'EUR €'),
  CH: D('C / J', '230V · 50Hz', 'safe', 'Service included; round up', 'right', 'CHF'),
  SE: D('C / F', '230V · 50Hz', 'safe', 'Service included; rounding is fine', 'right', 'SEK'),
  DK: D('C / E / K', '230V · 50Hz', 'safe', 'Service included', 'right', 'DKK'),
  NO: D('C / F', '230V · 50Hz', 'safe', 'Service included; round up', 'right', 'NOK'),
  FI: D('C / F', '230V · 50Hz', 'safe', 'Service included', 'right', 'EUR €'),
  IS: D('C / F', '230V · 50Hz', 'safe', 'No tipping expected', 'right', 'ISK'),
  PL: D('C / E', '230V · 50Hz', 'safe', '10% in restaurants', 'right', 'PLN'),
  CZ: D('C / E', '230V · 50Hz', 'safe', '10% in restaurants', 'right', 'CZK'),
  HU: D('C / F', '230V · 50Hz', 'safe', '10% (check if service added)', 'right', 'HUF'),
  HR: D('C / F', '230V · 50Hz', 'safe', '10% in restaurants', 'right', 'EUR €'),
  RO: D('C / F', '230V · 50Hz', 'bottled', '10% in restaurants', 'right', 'RON'),
  TR: D('C / F', '230V · 50Hz', 'bottled', '5–10% in restaurants', 'right', 'TRY'),

  US: D('A / B', '120V · 60Hz', 'safe', '15–20% expected in restaurants; $1–2/drink at bars', 'right', 'USD $'),
  CA: D('A / B', '120V · 60Hz', 'safe', '15–20% expected in restaurants', 'right', 'CAD $'),
  MX: D('A / B', '127V · 60Hz', 'bottled', '10–15% in restaurants', 'right', 'MXN'),

  BR: D('C / N', '127/220V · 60Hz', 'bottled', '10% usually added', 'right', 'BRL'),
  AR: D('C / I', '220V · 50Hz', 'bottled', '10% in restaurants', 'right', 'ARS'),
  CL: D('C / L', '220V · 50Hz', 'safe', '10% usually added', 'right', 'CLP'),
  PE: D('A / B / C', '220V · 60Hz', 'bottled', '10% in restaurants', 'right', 'PEN'),
  CO: D('A / B', '110V · 60Hz', 'bottled', '10% usually added', 'right', 'COP'),

  JP: D('A / B', '100V · 50/60Hz', 'safe', 'No tipping — it can cause offence', 'left', 'JPY ¥'),
  KR: D('C / F', '220V · 60Hz', 'safe', 'No tipping expected', 'right', 'KRW ₩'),
  CN: D('A / I / C', '220V · 50Hz', 'bottled', 'Not customary', 'right', 'CNY ¥'),
  HK: D('G', '220V · 50Hz', 'safe', '10% often added', 'left', 'HKD $'),
  TW: D('A / B', '110V · 60Hz', 'bottled', 'Not customary; 10% may be added', 'right', 'TWD'),
  SG: D('G', '230V · 50Hz', 'safe', 'Not customary; service charge added', 'left', 'SGD $'),
  MY: D('G', '240V · 50Hz', 'bottled', 'Not customary', 'left', 'MYR'),
  TH: D('A / B / C', '220V · 50Hz', 'bottled', 'Round up; 10% appreciated', 'left', 'THB ฿'),
  VN: D('A / C / F', '220V · 50Hz', 'bottled', 'Not expected; appreciated', 'right', 'VND'),
  ID: D('C / F', '230V · 50Hz', 'bottled', '5–10%; often included', 'left', 'IDR'),
  PH: D('A / B / C', '220V · 60Hz', 'bottled', '10% common', 'right', 'PHP ₱'),
  IN: D('C / D / M', '230V · 50Hz', 'bottled', '5–10% in restaurants', 'left', 'INR ₹'),
  LK: D('D / G / M', '230V · 50Hz', 'bottled', '10% often added', 'left', 'LKR'),
  NP: D('C / D / M', '230V · 50Hz', 'bottled', '10% in restaurants', 'right', 'NPR'),

  AE: D('G', '230V · 50Hz', 'safe', '10–15%; service often added', 'right', 'AED'),
  QA: D('G', '240V · 50Hz', 'safe', '10% often added', 'right', 'QAR'),
  SA: D('G', '230V · 50Hz', 'bottled', '10% common', 'right', 'SAR'),
  IL: D('C / H / M', '230V · 50Hz', 'safe', '10–15% in restaurants', 'right', 'ILS ₪'),
  JO: D('B / C / D / F / G / J', '230V · 50Hz', 'bottled', '10% common', 'right', 'JOD'),
  EG: D('C / F', '220V · 50Hz', 'bottled', '5–10% (baksheesh common)', 'right', 'EGP'),
  MA: D('C / E', '220V · 50Hz', 'bottled', '5–10% in restaurants', 'right', 'MAD'),
  ZA: D('D / M / N', '230V · 50Hz', 'safe', '10–15% in restaurants', 'left', 'ZAR'),
  KE: D('G', '240V · 50Hz', 'bottled', '10% in restaurants', 'left', 'KES'),
  NG: D('D / G', '230V · 50Hz', 'bottled', '10% common', 'right', 'NGN'),

  AU: D('I', '230V · 50Hz', 'safe', 'Not expected; round up for good service', 'left', 'AUD $'),
  NZ: D('I', '230V · 50Hz', 'safe', 'Not expected', 'left', 'NZD $'),
  FJ: D('I', '240V · 50Hz', 'bottled', 'Not expected', 'left', 'FJD $')
}

const WATER_LABEL = {
  safe: ['Tap water generally safe to drink', 'ok'],
  bottled: ['Stick to bottled or filtered water', 'warn']
}

// Look up essentials for a country code. Returns null when we have no data,
// so the UI can simply hide the card rather than show blanks.
export function getEssentials(cc) {
  const e = ESSENTIALS[(cc || '').toUpperCase()]
  if (!e) return null
  const [waterText, waterLevel] = WATER_LABEL[e.water] || WATER_LABEL.bottled
  return { ...e, waterText, waterLevel }
}
