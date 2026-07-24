import { useEffect, useMemo, useState } from 'react'
import { db, newId, getSetting, setSetting } from '../lib/db.js'
import { Icon } from './Icon.jsx'
import { PRESETS } from '../lib/packingPresets.js'

const CATEGORIES = ['Documents', 'Clothing', 'Weather-based', 'Electronics', 'Toiletries', 'Kids', 'Other']

export default function Packing({ trips, packing, reload }) {
  const [tripId, setTripId] = useState(trips[0]?.id || '')
  const trip = trips.find(t => t.id === tripId) || trips[0]
  const [name, setName] = useState('')
  const [cat, setCat] = useState('Clothing')
  const [preset, setPreset] = useState('Essentials')
  const [myDefault, setMyDefault] = useState(null)
  const [msg, setMsg] = useState('')

  useEffect(() => { getSetting('packingDefault').then(d => setMyDefault(Array.isArray(d) && d.length ? d : null)) }, [])

  const items = packing.filter(p => p.tripId === trip?.id)
  const cats = useMemo(() => {
    const m = {}
    items.forEach(i => { (m[i.category] ||= []).push(i) })
    return m
  }, [items])
  const pct = items.length ? Math.round(items.filter(i => i.checked).length / items.length * 100) : 0

  const presetNames = [...Object.keys(PRESETS), ...(myDefault ? ['My default list'] : [])]

  function flash(t) { setMsg(t); setTimeout(() => setMsg(''), 2600) }

  async function toggle(item) { await db.packing.update(item.id, { checked: !item.checked }); reload() }
  async function addItem() {
    const nm = name.trim()
    if (!nm || !trip) return
    await db.packing.add({ id: newId(), tripId: trip.id, category: cat, name: nm, checked: false, source: 'manual' })
    setName('')
    reload()
  }
  async function removeItem(id) { await db.packing.delete(id); reload() }

  // Bulk-add a [category, name] list to the current trip, skipping anything already present.
  async function applyList(list, srcLabel) {
    if (!trip || !list?.length) return
    const existing = new Set(items.map(i => (i.category + '|' + i.name).toLowerCase()))
    const toAdd = list
      .filter(([c, nm]) => nm && !existing.has((c + '|' + nm).toLowerCase()))
      .map(([c, nm]) => ({ id: newId(), tripId: trip.id, category: c, name: nm, checked: false, source: 'preset' }))
    if (toAdd.length) await db.packing.bulkAdd(toAdd)
    reload()
    flash(toAdd.length ? `✅ Added ${toAdd.length} item${toAdd.length === 1 ? '' : 's'} from ${srcLabel}` : `Nothing new to add from ${srcLabel}`)
  }
  function addPreset() {
    if (preset === 'My default list') applyList(myDefault, 'your default')
    else applyList(PRESETS[preset], preset)
  }
  async function saveDefault() {
    const list = items.map(i => [i.category, i.name])
    await setSetting('packingDefault', list)
    setMyDefault(list.length ? list : null)
    flash(`💾 Saved ${list.length} item${list.length === 1 ? '' : 's'} as your default list`)
  }

  return (
    <div>
      <div className="topbar">
        <div><h2><Icon name="bag" size={23} /> Packing</h2><div className="sub">Tick items, add your own, or start from a preset.</div></div>
        {trips.length > 1 && (
          <select value={tripId} onChange={e => setTripId(e.target.value)}
            style={{ marginLeft: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px', color: 'var(--text)' }}>
            {trips.map(t => <option key={t.id} value={t.id}>{t.destinationCity}</option>)}
          </select>
        )}
      </div>

      <div className="card" style={{ maxWidth: 560, marginBottom: 14 }}>
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

      <div className="card" style={{ maxWidth: 560, marginBottom: 18 }}>
        <b style={{ fontSize: 13.5 }}>📋 Start from a list</b>
        <div className="file-row" style={{ marginTop: 10 }}>
          <select value={preset} onChange={e => setPreset(e.target.value)}
            style={{ flex: 1, minWidth: 150, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 10px', color: 'var(--text)' }}>
            {presetNames.map(n => <option key={n}>{n}</option>)}
          </select>
          <button className="btn" onClick={addPreset} disabled={!trip}>Add to trip</button>
        </div>
        <div className="desc" style={{ marginTop: 10, lineHeight: 1.6 }}>
          Presets skip anything you've already got.{' '}
          <button onClick={saveDefault} disabled={!items.length}
            style={{ background: 'none', border: 'none', color: items.length ? 'var(--brand)' : 'var(--text-3)', cursor: items.length ? 'pointer' : 'default', fontWeight: 600, padding: 0, fontSize: 12.5 }}>
            💾 Save this trip's list as my default
          </button>
          {myDefault && <span> — reuse it on any trip via “My default list”.</span>}
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
        {!items.length && <div className="desc">No items yet — add your own above, or use “Start from a list”.</div>}
      </div>

      {msg && <div className="toast show">{msg}</div>}
    </div>
  )
}
