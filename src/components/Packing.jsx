import { useEffect, useMemo, useState } from 'react'
import { db, newId, getSetting, setSetting, savePacking, savePackingMany, updatePacking, deletePacking } from '../lib/db.js'
import { Icon } from './Icon.jsx'
import { PRESETS } from '../lib/packingPresets.js'

const CATEGORIES = ['Documents', 'Clothing', 'Weather-based', 'Electronics', 'Toiletries', 'Kids', 'Other']
const linkBtn = { background: 'none', border: 'none', color: 'var(--brand)', cursor: 'pointer', fontWeight: 600, padding: 0, fontSize: 12.5 }

// Packing lists live as db.packing rows keyed by a "context" id — either a trip's
// id, or a user-created list id. The list of user lists is stored in settings.
export default function Packing({ trips = [], packing = [], reload }) {
  const [lists, setLists] = useState([])
  const [activeId, setActiveId] = useState('')
  const [name, setName] = useState('')
  const [cat, setCat] = useState('Clothing')
  const [presetSel, setPresetSel] = useState('')
  const [msg, setMsg] = useState('')

  // Load (and seed) the user's saved lists. Existing '__default__' items become "My default list".
  useEffect(() => {
    getSetting('packingLists').then(ls => {
      const initial = (Array.isArray(ls) && ls.length) ? ls : [{ id: '__default__', name: 'My default list' }]
      if (!(Array.isArray(ls) && ls.length)) setSetting('packingLists', initial)
      setLists(initial)
      setActiveId(prev => prev || trips[0]?.id || initial[0].id)
    })
  }, []) // eslint-disable-line

  const activeTrip = trips.find(t => t.id === activeId)
  const activeList = lists.find(l => l.id === activeId)
  const isList = !!activeList && !activeTrip
  const activeName = activeTrip ? activeTrip.destinationCity : (activeList ? activeList.name : '')

  const items = packing.filter(p => p.tripId === activeId)
  const cats = useMemo(() => {
    const m = {}; items.forEach(i => { (m[i.category] ||= []).push(i) }); return m
  }, [items])
  const pct = items.length ? Math.round(items.filter(i => i.checked).length / items.length * 100) : 0

  function flash(t) { setMsg(t); setTimeout(() => setMsg(''), 2600) }
  async function persistLists(next) { setLists(next); await setSetting('packingLists', next) }

  async function toggle(item) { await updatePacking(item.id, { checked: !item.checked }); reload() }
  async function addItem() {
    const nm = name.trim(); if (!nm || !activeId) return
    await savePacking({ tripId: activeId, category: cat, name: nm, checked: false, source: 'manual' })
    setName('')
    reload()
  }
  async function removeItem(id) { await deletePacking(id); reload() }

  async function applyList(list, srcLabel) {
    if (!list?.length || !activeId) return
    const existing = new Set(items.map(i => (i.category + '|' + i.name).toLowerCase()))
    const toAdd = list.filter(([c, nm]) => nm && !existing.has((c + '|' + nm).toLowerCase()))
      .map(([c, nm]) => ({ tripId: activeId, category: c, name: nm, checked: false, source: 'preset' }))
    if (toAdd.length) await savePackingMany(toAdd)
    reload()
    flash(toAdd.length ? `✅ Added ${toAdd.length} item${toAdd.length === 1 ? '' : 's'} from ${srcLabel}` : `Nothing new to add from ${srcLabel}`)
  }

  // Copy-from sources: built-in presets + your other saved lists.
  const sources = [
    ...Object.keys(PRESETS).map(k => ({ key: 'p:' + k, label: k, get: () => PRESETS[k] })),
    ...lists.filter(l => l.id !== activeId).map(l => ({ key: 'l:' + l.id, label: `${l.name} (my list)`, get: () => packing.filter(p => p.tripId === l.id).map(i => [i.category, i.name]) }))
  ]
  const presetValue = sources.some(s => s.key === presetSel) ? presetSel : (sources[0]?.key || '')
  const applyPreset = () => { const s = sources.find(x => x.key === presetValue); if (s) applyList(s.get(), s.label) }

  async function newList() {
    const nm = (window.prompt('Name your new list (e.g. Beach, Ski, Weekend):') || '').trim()
    if (!nm) return
    const id = 'plist_' + newId()
    await persistLists([...lists, { id, name: nm }])
    setActiveId(id)
    flash(`✅ Created “${nm}” — add items or a preset`)
  }
  async function renameList() {
    if (!activeList) return
    const nm = (window.prompt('Rename this list:', activeList.name) || '').trim()
    if (!nm) return
    await persistLists(lists.map(l => l.id === activeId ? { ...l, name: nm } : l))
  }
  async function deleteList() {
    if (!activeList) return
    if (!window.confirm(`Delete “${activeList.name}” and its items?`)) return
    for (const r of packing.filter(p => p.tripId === activeId)) await deletePacking(r.id)
    const next = lists.filter(l => l.id !== activeId)
    await persistLists(next)
    setActiveId(trips[0]?.id || next[0]?.id || '')
    reload()
    flash('🗑 List deleted')
  }

  return (
    <div>
      <div className="topbar">
        <div><h2><Icon name="bag" size={23} /> Packing</h2><div className="sub">A list per trip, plus your own reusable lists.</div></div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={activeId} onChange={e => setActiveId(e.target.value)}
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px', color: 'var(--text)' }}>
            {trips.length > 0 && <optgroup label="Trips">{trips.map(t => <option key={t.id} value={t.id}>{t.destinationCity}</option>)}</optgroup>}
            {lists.length > 0 && <optgroup label="My lists">{lists.map(l => <option key={l.id} value={l.id}>⭐ {l.name}</option>)}</optgroup>}
          </select>
          <button className="btn ghost" onClick={newList}><Icon name="plus" size={15} /> List</button>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 560, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <b style={{ fontSize: 14 }}>{isList ? `⭐ ${activeName}` : (activeTrip ? `${activeName} — progress` : 'Packing')}</b>
          {!isList && activeTrip && <b style={{ fontSize: 14, color: 'var(--brand-2)' }}>{pct}%</b>}
          {isList && (
            <span style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
              <button onClick={renameList} style={linkBtn}>Rename</button>
              <button onClick={deleteList} style={{ ...linkBtn, color: '#f87171' }}>Delete</button>
            </span>
          )}
        </div>
        {!isList && activeTrip && <div className="progressbar"><i style={{ width: pct + '%' }} /></div>}
        {isList && <div className="desc" style={{ marginTop: 4 }}>A reusable list — add it to any trip from the box below.</div>}
        <div className="file-row" style={{ marginTop: 12 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Add an item"
            onKeyDown={e => e.key === 'Enter' && addItem()} style={{ flex: 1, minWidth: 140 }} />
          <select value={cat} onChange={e => setCat(e.target.value)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 10px', color: 'var(--text)' }}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <button className="btn" onClick={addItem} disabled={!activeId}><Icon name="plus" size={16} /></button>
        </div>
      </div>

      {sources.length > 0 && (
        <div className="card" style={{ maxWidth: 560, marginBottom: 18 }}>
          <b style={{ fontSize: 13.5 }}>📋 Add from a preset or your list</b>
          <div className="file-row" style={{ marginTop: 10 }}>
            <select value={presetValue} onChange={e => setPresetSel(e.target.value)}
              style={{ flex: 1, minWidth: 150, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 10px', color: 'var(--text)' }}>
              {sources.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <button className="btn" onClick={applyPreset} disabled={!activeId}>Add these</button>
          </div>
          <div className="desc" style={{ marginTop: 10 }}>Adds items into <b>{activeName || 'the current list'}</b>, skipping anything you've already got.</div>
        </div>
      )}

      <div className="pack-cols">
        {Object.entries(cats).map(([category, list]) => (
          <div className="pack-cat" key={category}>
            <b>{category}</b>
            {list.map(i => (
              <div key={i.id} className={'pk' + (i.checked ? ' done' : '')}>
                {!isList && <div className="box" onClick={() => toggle(i)}>✓</div>}
                <span onClick={() => { if (!isList) toggle(i) }} style={{ flex: 1 }}>{i.name}</span>
                {i.source === 'weather-auto' && <span className="tag">🌦️ auto</span>}
                <button onClick={() => removeItem(i.id)} title="Remove" style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 14, marginLeft: 6 }}>✕</button>
              </div>
            ))}
          </div>
        ))}
        {!items.length && activeId && <div className="desc">{isList ? 'This list is empty — add items or a preset above.' : 'No items yet — add your own above, or use a preset.'}</div>}
        {!activeId && <div className="desc">Create a list (＋ List) or add a trip to start packing.</div>}
      </div>

      {msg && <div className="toast show">{msg}</div>}
    </div>
  )
}
