import { useEffect, useState } from 'react'
import { getSetting, setSetting } from '../lib/db.js'

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

export default function Emergency({ trips = [] }) {
  const next = [...trips].filter(t => new Date(t.endDate) >= new Date())
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0] || trips[0]
  const [country, setCountry] = useState(next?.countryCode && NUMBERS[next.countryCode] ? next.countryCode : 'GB')
  const [contacts, setContacts] = useState([])
  const [medical, setMedical] = useState([])

  useEffect(() => {
    getSetting('emergencyContacts').then(c => setContacts(c || []))
    getSetting('medicalNotes').then(m => setMedical(m || []))
  }, [])

  async function saveContacts(list) { setContacts(list); await setSetting('emergencyContacts', list) }
  async function saveMedical(list) { setMedical(list); await setSetting('medicalNotes', list) }

  const local = NUMBERS[country]
  const sorted = Object.entries(NUMBERS).sort((a, b) => a[1].name.localeCompare(b[1].name))

  return (
    <div>
      <div className="topbar"><div><h2>Emergency Card 🆘</h2>
        <div className="sub">Works offline · the info you want when things go wrong</div></div></div>

      <div className="card emg" style={{ marginBottom: 18 }}>
        <h3 style={{ color: '#fff' }}>
          <span className="ttl-ico">📍</span> Local emergency numbers
          <select value={country} onChange={e => setCountry(e.target.value)}
            style={{ marginLeft: 'auto', background: 'rgba(0,0,0,.3)', color: '#fff', border: '1px solid rgba(255,255,255,.25)', borderRadius: 8, padding: '5px 8px' }}>
            {sorted.map(([code, v]) => <option key={code} value={code}>{v.name}</option>)}
          </select>
        </h3>
        <div className="emg-grid">
          {local.rows.map(([label, num]) => (
            <div className="emg-item" key={label}><div className="lbl">{label}</div><b>{num}</b></div>
          ))}
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
