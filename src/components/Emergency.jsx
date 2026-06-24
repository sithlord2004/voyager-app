import { useEffect, useState } from 'react'
import { getSetting, setSetting } from '../lib/db.js'

const NUMBERS = {
  JP: { name: 'Japan', rows: [['🚓 Police', '110'], ['🚑 Ambulance / Fire', '119'], ['☎️ Japan Helpline (EN)', '0570-000-911']] },
  ES: { name: 'Spain', rows: [['🆘 Emergencies (EU)', '112'], ['🚓 Police', '091']] },
  CA: { name: 'Canada', rows: [['🆘 All emergencies', '911']] },
  US: { name: 'United States', rows: [['🆘 All emergencies', '911']] },
  GB: { name: 'United Kingdom', rows: [['🆘 Emergencies', '999 / 112']] },
  FR: { name: 'France', rows: [['🆘 Emergencies (EU)', '112'], ['🚓 Police', '17'], ['🚑 Ambulance (SAMU)', '15']] },
  IT: { name: 'Italy', rows: [['🆘 Emergencies (EU)', '112']] },
  DE: { name: 'Germany', rows: [['🆘 Emergencies (EU)', '112'], ['🚓 Police', '110']] },
  NL: { name: 'Netherlands', rows: [['🆘 Emergencies (EU)', '112']] },
  GR: { name: 'Greece', rows: [['🆘 Emergencies (EU)', '112']] },
  PT: { name: 'Portugal', rows: [['🆘 Emergencies (EU)', '112']] },
  AU: { name: 'Australia', rows: [['🆘 All emergencies', '000']] },
  TH: { name: 'Thailand', rows: [['🚓 Police', '191'], ['🚑 Ambulance', '1669'], ['🧳 Tourist Police', '1155']] },
  IN: { name: 'India', rows: [['🆘 All emergencies', '112']] },
  MX: { name: 'Mexico', rows: [['🆘 All emergencies', '911']] }
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

  return (
    <div>
      <div className="topbar"><div><h2>Emergency Card 🆘</h2>
        <div className="sub">Works offline · the info you want when things go wrong</div></div></div>

      <div className="card emg" style={{ marginBottom: 18 }}>
        <h3 style={{ color: '#fff' }}>
          <span className="ttl-ico">📍</span> Local emergency numbers
          <select value={country} onChange={e => setCountry(e.target.value)}
            style={{ marginLeft: 'auto', background: 'rgba(0,0,0,.3)', color: '#fff', border: '1px solid rgba(255,255,255,.25)', borderRadius: 8, padding: '5px 8px' }}>
            {Object.entries(NUMBERS).map(([code, v]) => <option key={code} value={code}>{v.name}</option>)}
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
