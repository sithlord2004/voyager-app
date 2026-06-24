// ---------------------------------------------------------------------------
// Open-Meteo weather (no API key). Live forecast within ~14 days of a trip,
// otherwise a seasonal average pulled from the historical archive for the
// same calendar dates last year.
// ---------------------------------------------------------------------------

export const WMO = {
  0:['☀️','Clear'],1:['🌤️','Mainly clear'],2:['⛅','Partly cloudy'],3:['☁️','Overcast'],
  45:['🌫️','Fog'],48:['🌫️','Rime fog'],51:['🌦️','Light drizzle'],53:['🌦️','Drizzle'],55:['🌦️','Heavy drizzle'],
  61:['🌧️','Light rain'],63:['🌧️','Rain'],65:['🌧️','Heavy rain'],71:['🌨️','Light snow'],73:['🌨️','Snow'],75:['❄️','Heavy snow'],
  80:['🌦️','Showers'],81:['🌦️','Showers'],82:['⛈️','Violent showers'],85:['🌨️','Snow showers'],86:['❄️','Snow showers'],
  95:['⛈️','Thunderstorm'],96:['⛈️','Thunderstorm + hail'],99:['⛈️','Thunderstorm + hail']
}
export const FLAGS = { JP:'🇯🇵', ES:'🇪🇸', CA:'🇨🇦', FR:'🇫🇷', IT:'🇮🇹', GB:'🇬🇧', US:'🇺🇸', TH:'🇹🇭', AU:'🇦🇺', DE:'🇩🇪', GR:'🇬🇷', MX:'🇲🇽', IN:'🇮🇳', PT:'🇵🇹', NL:'🇳🇱' }

const avg = a => a.reduce((x, y) => x + y, 0) / a.length
const mode = a => { const m = {}; let best = a[0], bc = 0; a.forEach(v => { m[v] = (m[v]||0)+1; if (m[v] > bc) { bc = m[v]; best = v } }); return best }

export async function geocode(city) {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`)
  const j = await r.json()
  return j.results?.[0] || null
}

// Current conditions + 5-day forecast for the dashboard hero.
export async function currentWeather(lat, lon) {
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5`)
  return r.json()
}

// Resolve a trip's representative temperature: live forecast if near,
// otherwise a seasonal average. Returns { temp, code, mode: 'forecast'|'seasonal' }.
export async function tripWeather(lat, lon, startDate, endDate) {
  const days = Math.round((new Date(startDate + 'T00:00') - new Date()) / 86400000)
  if (days <= 14 && days >= -1) {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max&timezone=auto&forecast_days=16`)
    const w = await r.json()
    const hi = [], codes = []
    w.daily.time.forEach((d, i) => { if (d >= startDate && d <= endDate) { hi.push(w.daily.temperature_2m_max[i]); codes.push(w.daily.weather_code[i]) } })
    if (hi.length) return { temp: Math.round(avg(hi)), code: mode(codes), mode: 'forecast' }
  }
  const ly = new Date(startDate + 'T00:00').getFullYear() - 1
  const s = `${ly}-${startDate.slice(5)}`, e = `${ly}-${endDate.slice(5)}`
  const r = await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${s}&end_date=${e}&daily=temperature_2m_max,weather_code&timezone=auto`)
  const w = await r.json()
  const hi = (w.daily?.temperature_2m_max || []).filter(v => v != null)
  if (hi.length) return { temp: Math.round(avg(hi)), code: mode(w.daily.weather_code || [0]), mode: 'seasonal' }
  return { temp: null, code: 0, mode: 'seasonal' }
}
