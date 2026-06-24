import { useEffect, useState } from 'react'
import { getSetting, setSetting } from '../lib/db.js'
import { geocode } from '../lib/weather.js'

const EU = name => ({ name, rows: [['🆘 Emergencies (EU 112)', '112']] })
const ALL = (name, num) => ({ name, rows: [['🆘 All emergencies', num]] })
const NUMBERS = {
  GB: { name: 'United Kingdom', rows: [['🆘 Emergencies', '999 / 112']] },
  IE: { name: 'Ireland', rows: [['🆘 Emergencies', '112 / 999']] },
  FR: { name: 'France', rows: [['🆘 Emergencies (EU)', '112'], ['🚓 Police', '17'], ['🚑 Ambulance (SAMU)', '15']] },
  ES: { name: 'Spain', rows: [['🆘 Emergencies (EU)', '112'], ['🚓 Police', '091']] },
  IT: EU('Italy'), DE: { name: 'Germany', rows: [['🆘 Emergencies (EU)', '112'], ['🚓 Police', '110']] },
  NL: EU('Netherlands'), BE: EU('Belgium'), PT: EU('Portugal'), GR: EU('Greece'),
  AT: { name: 'Austria', rows: [['🆘 Emergencies (EU)', '112'], ['🚓 Police', '133'], ['🚑 Ambulance', '144']] },
  CH: { name: 'Switzerland', rows: [['🆘 Emergencies', '112'], ['🚓 Police', '117'], ['🚑 Ambulance', '144']] },
  SE: EU('Sweden'), DK: EU('Denmark'), FI: EU('Finland'),
  NO: { name: 'Norway', rows: [['🚓 Police', '112'], ['🚑 Ambulance', '113'], ['🚒 Fire', '110']] },
  IS: EU('Iceland'), PL: EU('Poland'), CZ: EU('Czechia'), HU: EU('Hungary'),
  HR: EU('Croatia'), RO: EU('Romania'), TR: ALL('Turkey', '112'), RU: ALL('Russia', '112'),
  JP: { name: 'Japan', rows: [['🚓 Police', '110'], ['🚑 Ambulance / Fire', '119'], ['☎️ Helpline (EN)', '0570-000-911']] },
  KR: { name: 'South Korea', rows: [['🚓 Police', '112'], ['🚑 Ambulance / Fire', '119']] },
  CN: { name: 'China', rows: [['🚓 Police', '110'], ['🚑 Ambulance', '120'], ['🚒 Fire', '119']] },
  HK: ALL('Hong Kong', '999'), TW: { name: 'Taiwan', rows: [['🚓 Police', '110'], ['🚑 Ambulance / Fire', '119']] },
  SG: { name: 'Singapore', rows: [['🚓 Police', '999'], ['🚑 Ambulance / Fire', '995']] },
  MY: ALL('Malaysia', '999'), ID: ALL('Indonesia', '112'),
  VN: { name: 'Vietnam', rows: [['🚓 Police', '113'], ['🚑 Ambulance', '115'], ['🚒 Fire', '114']] },
  PH: ALL('Philippines', '911'), TH: { name: 'Thailand', rows: [['🚓 Police', '191'], ['🚑 Ambulance', '1669'], ['🧳 Tourist Police', '1155']] },
  IN: ALL('India', '112'), LK: { name: 'Sri Lanka', rows: [['🚓 Police', '119'], ['🚑 Ambulance', '110']] },
  NP: { name: 'Nepal', rows: [['🚓 Police', '100'], ['🚑 Ambulance', '102']] },
  AE: { name: 'UAE', rows: [['🚓 Police', '999'], ['🚑 Ambulance', '998'], ['🚒 Fire', '997']] },
  QA: ALL('Qatar', '999'), SA: { name: 'Saudi Arabia', rows: [['🚓 Police', '999'], ['🚑 Ambulance', '997']] },
  IL: { name: 'Israel', rows: [['🚓 Police', '100'], ['🚑 Ambulance', '101'], ['🚒 Fire', '102']] },
  JO: ALL('Jordan', '911'), EG: { name: 'Egypt', rows: [['🚓 Police', '122'], ['🚑 Ambulance', '123']] },
  US: ALL('United States', '911'), CA: ALL('Canada', '911'), MX: ALL('Mexico', '911'),
  BR: { name: 'Brazil', rows: [['🚓 Police', '190'], ['🚑 Ambulance', '192'], ['🚒 Fire', '193']] },
  AR: ALL('Argentina', '911'), CL: { name: 'Chile', rows: [['🚓 Police', '133'], ['🚑 Ambulance', '131']] },
  CO: ALL('Colombia', '123'), PE: { name: 'Peru', rows: [['🚓 Police', '105'], ['🚒 Fire', '116']] },
  CR: ALL('Costa Rica', '911'),
  AU: ALL('Australia', '000'), NZ: ALL('New Zealand', '111'),
  ZA: { name: 'South Africa', rows: [['🚓 Police', '10111'], ['🚑 Ambulance', '10177'], ['📱 Mobile', '112']] },
  MA: { name: 'Morocco', rows: [['🚓 Police', '19'], ['🚑 Ambulance', '15'], ['📱 Mobile', '112']] },
  KE: ALL('Kenya', '999 / 112'), NG: ALL('Nigeria', '112')
}

const EMBASSY = {
  GB: { name: 'United Kingdom', url: 'https://www.gov.uk/world/embassies' },
  US: { name: 'United States', url: 'https://www.usembassy.gov/' },
  AU: { name: 'Australia', url: 'https://www.dfat.gov.au/about-us/our-locations/missions' },
  CA: { name: 'Canada', url: 'https://travel.gc.ca/assistance/embassies-consulates' },
  IE: { name: 'Ireland', url: 'https://www.ireland.ie/en/dfa/embassies/' },
  NZ: { name: 'New Zealand', url: 'https://www.mfat.govt.nz/en/embassies/' },
  IN: { name: 'India', url: 'https://www.mea.gov.in/indian-missions-abroad-new.htm' },
  DE: { name: 'Germany', url: 'https://www.auswaertiges-amt.de/en/embassies' },
  FR: { name: 'France', url: 'https://www.diplomatie.gouv.fr/en/the-ministry-and-its-network/' }
}

async function fetchHospitals(lat, lon) {
  const q = `[out:json][timeout:15];(node["amenity"="hospital"](around:8000,${lat},${lon});way["amenity"="hospital"](around:8000,${lat},${lon}););out center 8;`
  const r = await fetch('https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(q))
  const j = await r.json()
  return (j.elements || [])
    .filter(e => e.tags?.name)
    .map(e => ({ name: e.tags.name, phone: e.tags.phone || e.tags['contact:phone'] || '', lat: e.lat || e.center?.lat, lon: e.lon || e.center?.lon }))
    .slice(0, 6)
}

export default function Emergency({ trips = [] }) {
  const next = [...trips].filter(t => new Date(t.endDate) >= new Date())
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0] || trips[0]
  const [dest, setDest] = useState(next?.destinationCity || '')
  const [cc, setCc] = useState(next?.countryCode || 'GB')
  const [countryName, setCountryName] = useState('')
  const [hospitals, setHospitals] = useState(null)
  const [hLoading, setHLoading] = useState(false)
  const [home, setHome] = useState('GB')
  const [contacts, setContacts] = useState([])
  const [medical, setMedical] = useState([])

  useEffect(() => {
    getSetting('emergencyContacts').then(c => setContacts(c || []))
    getSetting('medicalNotes').then(m => setMedical(m || []))
    getSetting('homeCountry').then(h => setHome(h || 'GB'))
    if (dest) lookup(dest)
  }, []) // eslint-disable-line

  async function lookup(city) {
    if (!city.trim()) return
    setHLoading(true); setHospitals(null)
    try {
      const p = await geocode(city.trim())
      if (p) {
        if (p.country_code) setCc(p.country_code)
        setCountryName(p.country || '')
        const list = await fetchHospitals(p.latitude, p.longitude)
        setHospitals(list)
      } else setHospitals([])
    } catch { setHospitals([]) }
    setHLoading(false)
  }
  async function changeHome(v) { setHome(v); await setSetting('homeCountry', v) }
  async function saveContacts(list) { setContacts(list); await setSetting('emergencyContacts', list) }
  async function saveMedical(list) { setMedical(list); await setSetting('medicalNotes', list) }

  const local = NUMBERS[cc]
  const emb = EMBASSY[home]

  return (
    <div>
      <div className="topbar"><div><h2>Emergency Card 🆘</h2>
        <div className="sub">Local numbers, nearby hospitals &amp; your embassy — for wherever you are</div></div></div>

      <div className="file-row" style={{ maxWidth: 620, marginBottom: 16 }}>
        <input value={dest} onChange={e => setDest(e.target.value)} placeholder="Destination city (e.g. Tokyo)"
          onKeyDown={e => e.key === 'Enter' && lookup(dest)} style={{ flex: 1 }} />
        <button className="btn" onClick={() => lookup(dest)}>🔎 Look up</button>
      </div>

      <div className="card emg" style={{ marginBottom: 18 }}>
        <h3 style={{ color: '#fff' }}>
          <span className="ttl-ico">📍</span> Emergency numbers{countryName ? ` — ${countryName}` : ''}
        </h3>
        <div className="emg-grid">
          {(local ? local.rows : [['🆘 Try 112 / 911', 'check locally']]).map(([label, num]) => (
            <div className="emg-item" key={label}><div className="lbl">{label}</div><b>{num}</b></div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3><span className="ttl-ico">🏥</span> Hospitals {dest ? `· ${dest}` : ''}</h3>
        {hLoading && <div className="desc">Finding hospitals nearby…</div>}
        {!hLoading && hospitals && hospitals.map((h, i) => (
          <div className="alert" key={i}>
            <div className="ai" style={{ background: 'rgba(34,197,94,.15)' }}>🏥</div>
            <div className="body"><b>{h.name}</b>{h.phone && <small>{h.phone}</small>}</div>
            {h.lat && <a className="mini" href={`https://www.google.com/maps/search/?api=1&query=${h.lat},${h.lon}`} target="_blank" rel="noopener noreferrer">🗺️ Map</a>}
          </div>
        ))}
        {dest
          ? <a className="btn" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('hospitals near ' + dest)}`} target="_blank" rel="noopener noreferrer">🗺️ Open hospitals near {dest} in Maps</a>
          : <div className="desc">Enter a destination above to find nearby hospitals.</div>}
        <div className="desc" style={{ marginTop: 8 }}>In a real emergency, call the number above first.</div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3><span className="ttl-ico">🏛️</span> Your embassy</h3>
        <label className="switch-row" style={{ maxWidth: 360 }}>
          <span>Your home country</span>
          <select value={home} onChange={e => changeHome(e.target.value)}
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', color: 'var(--text)' }}>
            {Object.entries(EMBASSY).map(([code, v]) => <option key={code} value={code}>{v.name}</option>)}
          </select>
        </label>
        <p className="desc">Find the nearest {emb?.name} embassy/consulate{countryName ? ` in ${countryName}` : dest ? ` in ${dest}` : ''}.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a className="btn" target="_blank" rel="noopener noreferrer"
            href={`https://www.google.com/search?q=${encodeURIComponent((emb?.name || '') + ' embassy in ' + (countryName || dest || ''))}`}>🔎 Find embassy →</a>
          {emb && <a className="btn ghost" href={emb.url} target="_blank" rel="noopener noreferrer">Official locator</a>}
        </div>
      </div>

      <div className="two-col">
        <EditList title="👨‍👩‍👧‍👦 Emergency contacts" icon="📞" items={contacts} onChange={saveContacts}
          placeholder1="Name (e.g. Mum)" placeholder2="Phone / detail" />
        <EditList title="🧬 Medical notes" icon="🩺" items={medical} onChange={saveMedical}
          placeholder1="Who (e.g. Aria)" placeholder2="Detail (e.g. Allergy: peanuts)" />
      </div>
    </div>
  )
}

function EditList({ title, icon, items, onChange, placeholder1, placeholder2 }) {
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  function add() {
    if (!a.trim() && !b.trim()) return
    onChange([...items, { label: a.trim(), value: b.trim() }])
    setA(''); setB('')
  }
  function remove(idx) { onChange(items.filter((_, i) => i !== idx)) }

  return (
    <div className="card">
      <h3>{title}</h3>
      {items.length ? items.map((it, idx) => (
        <div className="alert" key={idx}>
          <div className="ai" style={{ background: 'rgba(59,130,246,.15)' }}>{icon}</div>
          <div className="body"><b>{it.label || '—'}</b><small>{it.value}</small></div>
          <button className="mini" style={{ color: '#f87171' }} onClick={() => remove(idx)}>✕</button>
        </div>
      )) : <div className="desc" style={{ marginBottom: 8 }}>Nothing added yet.</div>}
      <div className="file-row">
        <input value={a} onChange={e => setA(e.target.value)} placeholder={placeholder1} style={{ flex: 1, minWidth: 110 }} />
        <input value={b} onChange={e => setB(e.target.value)} placeholder={placeholder2}
          onKeyDown={e => e.key === 'Enter' && add()} style={{ flex: 1, minWidth: 110 }} />
        <button className="btn" onClick={add}>＋</button>
      </div>
    </div>
  )
}
