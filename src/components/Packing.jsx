import { useMemo, useState } from 'react'
import { db, newId } from '../lib/db.js'

const CATEGORIES = ['Documents', 'Clothing', 'Weather-based', 'Electronics', 'Toiletries', 'Kids', 'Other']

export default function Packing({ trips, packing, reload }) {
  const [tripId, setTripId] = useState(trips[0]?.id || '')
  const trip = trips.find(t => t.id === tripId) || trips[0]
  const [name, setName] = useState('')
  const [cat, setCat] = useState('Clothing')

  const items = packing.filter(p => p.tripId === trip?.id)
  const cats = useMemo(() => {
    const m = {}
    items.forEach(i => { (m[i.category] ||= []).push(i) })
    return m
  }, [items])
  const pct = items.length ? Math.round(items.filter(i => i.checked).length / items.length * 100) : 0

  async function toggle(item) {
    await db.packing.update(item.id, { checked: !item.checked })
    reload()
  }
  async function addItem() {
    const nm = name.trim()
    if (!nm || !trip) return
    await db.packing.add({ id: newId(), tripId: trip.id, category: cat, name: nm, checked: false, source: 'manual' })
    setName('')
    reload()
  }
  async function removeItem(id) {
    await db.packing.delete(id)
    reload()
  }

  return (
    <div>
      <div className="topbar">
        <div><h2>Packing 🎒</h2><div className="sub">Tick items, add your own, remove what you don't need.</div></div>
        {trips.length > 1 && (
          <select value={tripId} onChange={e => setTripId(e.target.value)}
            style={{ marginLeft: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px', color: 'var(--text)' }}>
            {trips.map(t => <option key={t.id} value={t.id}>{t.destinationCity}</option>)}
          </select>
        )}
      </div>

      <div className="card" style={{ maxWidth: 560, marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <b style={{ fontSize: 14 }}>{trip?.destinationCity} — progress</b>
          <b style={{ fontSize: 14, color: 'var(--brand-2)' }}>{pct}%</b>
        </div>
        <div className="progressbar"><i style={{ width: pct + '%' }} /></div>
        <div className="file-row" style={{ marginTop: 12 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Add an item"
            onKeyDown={e => e.key === 'Enter' && addItem()} style={{ flex: 1, minWidth: 140 }} />
          <select value={cat} onChange={e => setCat(e.target.value)}
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 10px', color: 'var(--text)' }}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <button className="btn" onClick={addItem}>＋</button>
        </div>
      </div>

      <div className="pack-cols">
        {Object.entries(cats).map(([category, list]) => (
          <div className="pack-cat" key={category}>
            <b>{category}</b>
            {list.map(i => (
              <div key={i.id} className={'pk' + (i.checked ? ' done' : '')}>
                <div className="box" onClick={() => toggle(i)}>✓</div>
                <span onClick={() => toggle(i)} style={{ flex: 1 }}>{i.name}</span>
                {i.source === 'weather-auto' && <span className="tag">🌦️ auto</span>}
                <button onClick={() => removeItem(i.id)} title="Remove"
                  style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 14, marginLeft: 6 }}>✕</button>
              </div>
            ))}
          </div>
        ))}
        {!items.length && <div className="desc">No items yet — add some above.</div>}
      </div>
    </div>
  )
}
