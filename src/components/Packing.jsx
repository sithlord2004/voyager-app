import { useMemo, useState } from 'react'
import { db, newId } from '../lib/db.js'
import { Icon } from './Icon.jsx'
import { PRESETS } from '../lib/packingPresets.js'

const CATEGORIES = ['Documents', 'Clothing', 'Weather-based', 'Electronics', 'Toiletries', 'Kids', 'Other']
// A reusable list that isn't tied to any trip. Stored like normal packing rows
// under this special tripId, so all the same add/remove/preset logic just works.
const DEFAULT = { id: '__default__', destinationCity: '⭐ My default list' }

export default function Packing({ trips = [], packing = [], reload }) {
  const options = [...trips, DEFAULT]
  const [tripId, setTripId] = useState(trips[0]?.id || DEFAULT.id)
  const trip = tripId === DEFAULT.id ? DEFAULT : (trips.find(t => t.id === tripId) || DEFAULT)
  const isDefault = trip.id === DEFAULT.id
  const [name, setName] = useState('')
  const [cat, setCat] = useState('Clothing')
  const [preset, setPreset] = useState('Essentials')
  const [msg, setMsg] = useState('')

  const items = packing.filter(p => p.tripId === trip.id)
  const defaultCount = packing.filter(p => p.tripId === DEFAULT.id).length
  const cats = useMemo(() => {
    const m = {}
    items.forEach(i => { (m[i.category] ||= []).push(i) })
    return m
  }, [items])
  const pct = items.length ? Math.round(items.filter(i => i.checked).length / items.length * 100) : 0

  const presetNames = [...Object.keys(PRESETS), ...((!isDefault && defaultCount) ? ['My default list'] : [])]

  function flash(t) { setMsg(t); setTimeout(() => setMsg(''), 2600) }
  async function toggle(item) { await db.packing.update(item.id, { checked: !item.checked }); reload() }
  async function addItem() {
    const nm = name.trim()
    if (!nm) return
    await db.packing.add({ id: newId(), tripId: trip.id, category: cat, name: nm, checked: false, source: 'manual' })
    setName('')
    reload()
  }
  async function removeItem(id) { await db.packing.delete(id); reload() }

  // Bulk-add a [category, name] list to the current list, skipping duplicates.
  async function applyList(list, srcLabel) {
    if (!list?.length) return
    const existing = new Set(items.map(i => (i.category + '|' + i.name).toLowerCase()))
    const toAdd = list
      .filter(([c, nm]) => nm && !existing.has((c + '|' + nm).toLowerCase()))
      .map(([c, nm]) => ({ id: newId(), tripId: trip.id, category: c, name: nm, checked: false, source: 'preset' }))
    if (toAdd.length) await db.packing.bulkAdd(toAdd)
    reload()
    flash(toAdd.length ? `✅ Added ${toAdd.length} item${toAdd.length === 1 ? '' : 's'} from ${srcLabel}` : `Nothing new to add from ${srcLabel}`)
  }
  function addPreset() {
    if (preset === 'My default list') applyList(packing.filter(p => p.tripId === DEFAULT.id).map(i => [i.category, i.name]), 'your default list')
    else applyList(PRESETS[preset], preset)
  }
  // Copy the current trip's items into the reusable default list.
  async function copyToDefault() {
    const existing = new Set(packing.filter(p => p.tripId === DEFAULT.id).map(i => (i.category + '|' + i.name).toLowerCase()))
    const toAdd = items
      .filter(i => !existing.has((i.category + '|' + i.name).toLowerCase()))
      .map(i => ({ id: newId(), tripId: DEFAULT.id, category: i.category, name: i.name, checked: false, source: 'default' }))
    if (toAdd.length) await db.packing.bulkAdd(toAdd)
    reload()
    flash(`💾 Added ${toAdd.length} item${toAdd.length === 1 ? '' : 's'} to your default list`)
  }

  return (
    <div>
      <div className="topbar">
        <div><h2><Icon name="bag" size={23} /> Packing</h2><div className="sub">Build a list per trip, or a reusable default — no trip needed.</div></div>
        <select value={tripId} onChange={e => setTripId(e.target.value)}
          style={{ marginLeft: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px', color: 'var(--text)' }}>
          {options.map(t => <option key={t.id} value={t.id}>{t.destinationCity}</option>)}
        </select>
      </div>

      <div className="card" style={{ maxWidth: 560, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <b style={{ fontSize: 14 }}>{isDefault ? '⭐ My default list' : `${trip.destinationCity} — progress`}</b>
          {!isDefault && <b style={{ fontSize: 14, color: 'var(--brand-2)' }}>{pct}%</b>}
        </div>
        {!isDefault && <div className="progressbar"><i style={{ width: pct + '%' }} /></div>}
        {isDefault && <div className="desc" style={{ marginTop: 4 }}>Build a reusable list here, then drop it onto any trip via “My default list”.</div>}
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
        <b style={{ fontSize: 13.5 }}>📋 Start from a preset</b>
        <div className="file-row" style={{ marginTop: 10 }}>
          <select value={preset} onChange={e => setPreset(e.target.value)}
            style={{ flex: 1, minWidth: 150, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 10px', color: 'var(--text)' }}>
            {presetNames.map(n => <option key={n}>{n}</option>)}
          </select>
          <button className="btn" onClick={addPreset}>Add these</button>
        </div>
        <div className="desc" style={{ marginTop: 10, lineHeight: 1.6 }}>
          Presets skip anything you've already got.
          {!isDefault && items.length > 0 && <>{' '}
            <button onClick={copyToDefault} style={{ background: 'none', border: 'none', color: 'var(--brand)', cursor: 'pointer', fontWeight: 600, padding: 0, fontSize: 12.5 }}>
              💾 Add this list to my default
            </button></>}
        </div>
      </div>

      <div className="pack-cols">
        {Object.entries(cats).map(([category, list]) => (
          <div className="pack-cat" key={category}>
            <b>{category}</b>
            {list.map(i => (
              <div key={i.id} className={'pk' + (i.checked ? ' done' : '')}>
                {!isDefault && <div className="box" onClick={() => toggle(i)}>✓</div>}
                <span onClick={() => { if (!isDefault) toggle(i) }} style={{ flex: 1 }}>{i.name}</span>
                {i.source === 'weather-auto' && <span className="tag">🌦️ auto</span>}
                <button onClick={() => removeItem(i.id)} title="Remove"
                  style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 14, marginLeft: 6 }}>✕</button>
              </div>
            ))}
          </div>
        ))}
        {!items.length && <div className="desc">{isDefault ? 'Your default list is empty — add items or a preset above.' : 'No items yet — add your own above, or use a preset.'}</div>}
      </div>

      {msg && <div className="toast show">{msg}</div>}
    </div>
  )
}
