// ---------------------------------------------------------------------------
// Itinerary parsing. Turns a pasted/uploaded booking confirmation into a draft
// trip (destination, dates, flight). Heuristic regex extraction — good for the
// common airline/hotel email formats; the user always confirms before saving.
//
// For higher accuracy on messy PDFs you can route the text to an LLM via a
// serverless function; this client-side parser keeps the app working offline.
// ---------------------------------------------------------------------------

const MONTHS = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 }

// A small IATA -> city table so an arrival airport implies a destination.
export const IATA_CITY = {
  LHR:'London', LGW:'London', LCY:'London', CDG:'Paris', ORY:'Paris', AMS:'Amsterdam',
  FCO:'Rome', MXP:'Milan', BCN:'Barcelona', MAD:'Madrid', LIS:'Lisbon', ATH:'Athens',
  FRA:'Frankfurt', MUC:'Munich', BER:'Berlin', DUB:'Dublin', ZRH:'Zurich', VIE:'Vienna',
  JFK:'New York', EWR:'New York', LGA:'New York', LAX:'Los Angeles', SFO:'San Francisco',
  ORD:'Chicago', MIA:'Miami', YYZ:'Toronto', YYC:'Calgary', YVR:'Vancouver',
  HND:'Tokyo', NRT:'Tokyo', KIX:'Osaka', ICN:'Seoul', PEK:'Beijing', PVG:'Shanghai',
  HKG:'Hong Kong', SIN:'Singapore', BKK:'Bangkok', DXB:'Dubai', DOH:'Doha',
  SYD:'Sydney', MEL:'Melbourne', AKL:'Auckland', DEL:'Delhi', BOM:'Mumbai'
}

const pad = n => String(n).padStart(2, '0')

// Extract every date we can recognise, returned as sorted ISO strings.
export function extractDates(text) {
  const found = new Set()
  // ISO yyyy-mm-dd
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) found.add(`${m[1]}-${m[2]}-${m[3]}`)
  // "2 Jul 2026" / "02 July 2026"
  for (const m of text.matchAll(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})\b/g)) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()]
    if (mo) found.add(`${m[3]}-${pad(mo)}-${pad(+m[1])}`)
  }
  // "Jul 2, 2026" / "July 2 2026"
  for (const m of text.matchAll(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/g)) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()]
    if (mo) found.add(`${m[3]}-${pad(mo)}-${pad(+m[2])}`)
  }
  return [...found].sort()
}

// Flight numbers like "JL044", "BA 245", "AC859".
export function extractFlights(text) {
  const out = []
  for (const m of text.matchAll(/\b([A-Z]{2})\s?(\d{2,4}[A-Z]?)\b/g)) {
    const code = m[1] + m[2]
    // skip obvious non-flights (e.g. UK postcodes won't match \d so we're fine)
    if (!out.includes(code)) out.push(code)
  }
  return out
}

// Airport codes and a best-guess arrival (destination).
export function extractAirports(text) {
  const codes = []
  // Prefer explicit routes: "LHR → HND", "LHR-HND", "LHR to HND"
  for (const m of text.matchAll(/\b([A-Z]{3})\s*(?:→|-|to|–)\s*([A-Z]{3})\b/g)) {
    codes.push(m[1], m[2])
  }
  if (!codes.length) for (const m of text.matchAll(/\b([A-Z]{3})\b/g)) {
    if (IATA_CITY[m[1]]) codes.push(m[1])
  }
  return codes
}

export function parseItinerary(text) {
  const dates = extractDates(text)
  const flights = extractFlights(text)
  const airports = extractAirports(text)

  // Destination: explicit "Destination: X" wins; else the ARRIVAL airport's city
  // (airports come as [dep, arr, ...] from the route match).
  let destinationCity = null
  const explicit = text.match(/destination[:\s]+([A-Za-z .'-]{3,30})/i)
  if (explicit) destinationCity = explicit[1].trim()
  const arrCode = airports[1] || airports[0]
  if (!destinationCity && arrCode && IATA_CITY[arrCode]) destinationCity = IATA_CITY[arrCode]

  const airlineMatch = text.match(/\b(Japan Airlines|Air Canada|British Airways|Lufthansa|Emirates|Qatar Airways|United|Delta|American Airlines|Ryanair|easyJet|Vueling|KLM|Air France|Singapore Airlines)\b/i)

  return {
    destinationCity: destinationCity || '',
    startDate: dates[0] || '',
    endDate: dates[dates.length - 1] || dates[0] || '',
    flightNumber: flights[0] || '',
    depAirport: airports[0] || '',
    arrAirport: airports[1] || arr || '',
    airline: airlineMatch ? airlineMatch[0] : '',
    confidence: {
      dates: dates.length, flights: flights.length, airports: airports.length
    }
  }
}

// Smart parse: try the LLM endpoint (if a backend is configured) for messy text,
// and fall back to the local regex parser. Always returns the same shape.
export async function parseItinerarySmart(text, syncCfg) {
  const local = parseItinerary(text)
  if (!syncCfg?.endpoint || !syncCfg?.token) return { ...local, source: 'regex' }
  try {
    const r = await fetch(`${syncCfg.endpoint.replace(/\/$/, '')}/parse-itinerary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + syncCfg.token },
      body: JSON.stringify({ text: text.slice(0, 6000) })
    })
    if (!r.ok) return { ...local, source: 'regex' }
    const { draft } = await r.json()
    // Prefer LLM fields, but keep any local field the LLM left blank.
    return {
      destinationCity: draft.destinationCity || local.destinationCity,
      startDate: draft.startDate || local.startDate,
      endDate: draft.endDate || local.endDate,
      flightNumber: draft.flightNumber || local.flightNumber,
      depAirport: draft.depAirport || local.depAirport,
      arrAirport: draft.arrAirport || local.arrAirport,
      airline: draft.airline || local.airline,
      confidence: local.confidence,
      source: 'llm'
    }
  } catch { return { ...local, source: 'regex' } }
}

// Read text from an uploaded file. Plain text/.eml/.ics are direct; PDFs use a
// lazily-imported pdf.js so the main bundle stays small.
export async function extractTextFromFile(file) {
  const name = (file.name || '').toLowerCase()
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    const pdfjs = await import('pdfjs-dist')
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
    let text = ''
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      text += content.items.map(it => it.str).join(' ') + '\n'
    }
    return text
  }
  return file.text() // .txt, .eml, .ics, etc.
}
