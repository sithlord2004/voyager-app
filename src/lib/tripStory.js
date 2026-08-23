// ---------------------------------------------------------------------------
// Trip Story — turn a finished trip into a keepsake you actually keep.
//
// The output is ONE self-contained HTML file: styles inline, photos inlined as
// data URLs, the route drawn as SVG (no map tiles). That means it opens on any
// device, years from now, with no app, no internet and nothing to install — and
// it prints to PDF straight from the browser.
// ---------------------------------------------------------------------------
import { AIRPORTS, toCode } from './airports.js'

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const DAY = 86400000
// Local date, NOT toISOString() — in UTC+10 that would roll every day back one
// and misalign the whole itinerary against its days.
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const longDate = s => new Date(s + 'T00:00').toLocaleDateString(undefined,
  { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const shortDate = s => new Date(s + 'T00:00').toLocaleDateString(undefined,
  { weekday: 'short', day: 'numeric', month: 'short' })

// Great-circle distance in km.
function haversine(a, b) {
  const R = 6371, toRad = d => d * Math.PI / 180
  const dLat = toRad(b[0] - a[0]), dLon = toRad(b[1] - a[1])
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

const WMO = {
  0: 'clear', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast', 45: 'fog', 48: 'freezing fog',
  51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle', 61: 'light rain', 63: 'rain',
  65: 'heavy rain', 71: 'light snow', 73: 'snow', 75: 'heavy snow', 80: 'showers',
  81: 'showers', 82: 'heavy showers', 95: 'thunderstorms', 96: 'thunderstorms', 99: 'thunderstorms'
}

// Historical weather for each day of the trip. Free, no key. Optional garnish —
// if it fails (offline, or the archive hasn't caught up yet) the story still builds.
export async function fetchTripWeather(city, startDate, endDate) {
  try {
    const g = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&format=json`)
    const hit = (await g.json())?.results?.[0]
    if (!hit) return {}
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${hit.latitude}&longitude=${hit.longitude}`
      + `&start_date=${startDate}&end_date=${endDate}`
      + `&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`
    const r = await fetch(url)
    if (!r.ok) return {}
    const d = await r.json()
    const out = {}
    ;(d?.daily?.time || []).forEach((day, i) => {
      const max = d.daily.temperature_2m_max?.[i], min = d.daily.temperature_2m_min?.[i]
      if (max == null) return
      out[day] = `${Math.round(min)}–${Math.round(max)}°C, ${WMO[d.daily.weather_code?.[i]] || ''}`.replace(/, $/, '')
    })
    return out
  } catch { return {} }
}

// A simple, tile-free route drawing: airports as dots, joined in order.
function routeSvg(legs) {
  const pts = []
  for (const l of legs) {
    for (const code of [toCode(l.from), toCode(l.to)]) {
      const c = AIRPORTS[code]
      if (c && (!pts.length || pts[pts.length - 1].code !== code)) pts.push({ code, lat: c[0], lon: c[1] })
    }
  }
  if (pts.length < 2) return ''

  const W = 640, H = 260, pad = 46
  const lats = pts.map(p => p.lat), lons = pts.map(p => p.lon)
  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
  const minLon = Math.min(...lons), maxLon = Math.max(...lons)
  const spanLat = Math.max(0.5, maxLat - minLat), spanLon = Math.max(0.5, maxLon - minLon)
  const x = p => pad + ((p.lon - minLon) / spanLon) * (W - pad * 2)
  const y = p => pad + (1 - (p.lat - minLat) / spanLat) * (H - pad * 2)

  let path = ''
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]
    const mx = (x(a) + x(b)) / 2, my = (y(a) + y(b)) / 2 - 30   // gentle arc
    path += `<path d="M${x(a)},${y(a)} Q${mx},${my} ${x(b)},${y(b)}" fill="none" stroke="#4b8ef0" stroke-width="2.5" stroke-linecap="round"/>`
  }
  const dots = pts.map(p =>
    `<circle cx="${x(p)}" cy="${y(p)}" r="5" fill="#fff" stroke="#4b8ef0" stroke-width="2.5"/>` +
    `<text x="${x(p)}" y="${y(p) - 14}" text-anchor="middle" font-size="13" font-weight="600" fill="#334155">${esc(p.code)}</text>`
  ).join('')
  return `<svg viewBox="0 0 ${W} ${H}" class="route" xmlns="http://www.w3.org/2000/svg">${path}${dots}</svg>`
}

function stats(trip, legs) {
  const days = Math.round((new Date(trip.endDate) - new Date(trip.startDate)) / DAY) + 1
  let km = 0
  for (const l of legs) {
    const a = AIRPORTS[toCode(l.from)], b = AIRPORTS[toCode(l.to)]
    if (a && b) km += haversine(a, b)
  }
  return { days, km: Math.round(km), flights: legs.length }
}

// Build the whole keepsake. `photos` are data URLs; `weather` maps date -> text.
export function buildTripStory({ trip, plans = [], people = [], photos = [], weather = {} }) {
  const legs = (trip.legs || []).filter(l => (l.mode || 'flight') === 'flight')
  const s = stats(trip, legs)
  const travellers = (trip.travellerIds?.length ? people.filter(p => trip.travellerIds.includes(p.id)) : people)
    .map(p => p.name).filter(Boolean)

  // Every date of the trip, with its plans and the weather it actually had.
  const start = new Date(trip.startDate + 'T00:00')
  const dates = Array.from({ length: s.days }, (_, i) => iso(new Date(start.getTime() + i * DAY)))
  const byDate = {}
  for (const p of plans) {
    if (p.deleted || p.tripId !== trip.id) continue
    ;(byDate[p.date] ||= []).push(p)
  }

  const daysHtml = dates.map((d, i) => {
    const items = (byDate[d] || []).sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))
    const flight = legs.find(l => (l.date || trip.startDate) === d)
    const rows = [
      ...(flight ? [`<li class="fl"><span class="t">${esc(flight.number || 'Flight')}</span>
        <span>${esc(toCode(flight.from))} → ${esc(toCode(flight.to))}</span></li>`] : []),
      ...items.map(p => `<li><span class="t">${esc(p.time || '')}</span><span>${esc(p.title)}${
        p.place ? ` <em>· ${esc(p.place)}</em>` : ''}${p.note ? `<br><small>${esc(p.note)}</small>` : ''}</span></li>`)
    ]
    if (!rows.length) return ''            // quiet days are left out, not padded
    return `<section class="day">
      <h3><span class="num">Day ${i + 1}</span> ${esc(shortDate(d))}
        ${weather[d] ? `<span class="wx">${esc(weather[d])}</span>` : ''}</h3>
      <ul>${rows.join('')}</ul>
    </section>`
  }).join('')

  const photosHtml = photos.length
    ? `<section class="photos">${photos.map(src => `<img src="${src}" alt="">`).join('')}</section>`
    : ''

  const staysHtml = (trip.stays || []).filter(x => x.name).map(x =>
    `<li>${esc(x.name)}${x.checkIn ? ` <em>· ${esc(shortDate(x.checkIn))}${x.checkOut ? ` – ${esc(shortDate(x.checkOut))}` : ''}</em>` : ''}</li>`
  ).join('')

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(trip.destinationCity)} — ${esc(new Date(trip.startDate + 'T00:00').getFullYear())}</title>
<style>
  :root{--ink:#16202e;--soft:#64748b;--line:#e6ebf2;--accent:#4b8ef0}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#f4f6fa;color:var(--ink);font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;padding:28px 18px 60px}
  .wrap{max-width:720px;margin:0 auto}
  .cover{background:linear-gradient(140deg,#1e3a8a,#0ea5e9 62%,#38bdf8);color:#fff;border-radius:22px;padding:38px 30px;text-align:center;box-shadow:0 12px 40px -18px rgba(20,40,80,.5)}
  .cover .kicker{text-transform:uppercase;letter-spacing:2.4px;font-size:11px;opacity:.85}
  .cover h1{font-size:44px;line-height:1.1;letter-spacing:-1.2px;margin:8px 0 6px;font-weight:800}
  .cover .dates{font-size:15px;opacity:.95}
  .cover .who{margin-top:14px;font-size:13.5px;opacity:.9}
  .stats{display:flex;gap:12px;justify-content:center;margin:22px 0 8px;flex-wrap:wrap}
  .stat{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px 20px;min-width:104px}
  .stat b{display:block;font-size:24px;letter-spacing:-.5px}
  .stat span{font-size:11.5px;color:var(--soft);text-transform:uppercase;letter-spacing:.7px}
  .card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:24px;margin-top:18px}
  .card h2{font-size:13px;text-transform:uppercase;letter-spacing:1.2px;color:var(--soft);margin-bottom:14px;font-weight:700}
  .route{width:100%;height:auto;display:block}
  .day{padding:16px 0;border-top:1px solid var(--line)}
  .day:first-of-type{border-top:none;padding-top:0}
  .day h3{font-size:15px;font-weight:650;display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}
  .num{background:var(--accent);color:#fff;border-radius:999px;padding:2px 11px;font-size:12px;font-weight:700}
  .wx{margin-left:auto;font-size:12.5px;color:var(--soft);font-weight:500}
  .day ul{list-style:none}
  .day li{display:flex;gap:14px;padding:5px 0;font-size:15px}
  .day li .t{color:var(--accent);font-weight:650;min-width:52px;font-variant-numeric:tabular-nums}
  .day li.fl .t{color:#0f766e}
  .day em{color:var(--soft);font-style:normal}
  .day small{color:var(--soft);font-size:13px}
  .photos{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-top:18px}
  .photos img{width:100%;height:190px;object-fit:cover;border-radius:14px;display:block}
  .stays{list-style:none;font-size:15px}
  .stays li{padding:4px 0}
  footer{text-align:center;color:var(--soft);font-size:12px;margin-top:30px}
  @media print{
    body{background:#fff;padding:0}
    .card,.stat{border-color:#ddd;box-shadow:none}
    .cover{box-shadow:none;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .day{break-inside:avoid}
  }
</style></head><body><div class="wrap">

  <div class="cover">
    <div class="kicker">A Voyager trip story</div>
    <h1>${esc(trip.destinationCity)}</h1>
    <div class="dates">${esc(longDate(trip.startDate))} — ${esc(longDate(trip.endDate))}</div>
    ${travellers.length ? `<div class="who">with ${travellers.map(esc).join(' &amp; ')}</div>` : ''}
  </div>

  <div class="stats">
    <div class="stat"><b>${s.days}</b><span>${s.days === 1 ? 'Day' : 'Days'}</span></div>
    ${s.flights ? `<div class="stat"><b>${s.flights}</b><span>${s.flights === 1 ? 'Flight' : 'Flights'}</span></div>` : ''}
    ${s.km ? `<div class="stat"><b>${s.km.toLocaleString()}</b><span>km flown</span></div>` : ''}
  </div>

  ${legs.length ? `<div class="card"><h2>The journey</h2>${routeSvg(legs)}</div>` : ''}
  ${staysHtml ? `<div class="card"><h2>Where we stayed</h2><ul class="stays">${staysHtml}</ul></div>` : ''}
  ${daysHtml ? `<div class="card"><h2>Day by day</h2>${daysHtml}</div>` : ''}
  ${photosHtml ? `<div class="card"><h2>Photos</h2>${photosHtml}</div>` : ''}

  <footer>Made with Voyager · ${esc(new Date().toLocaleDateString())}</footer>
</div></body></html>`
}
