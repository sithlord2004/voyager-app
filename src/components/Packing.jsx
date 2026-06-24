import { useMemo } from 'react'
import { db } from '../lib/db.js'

export default function Packing({ trips, packing, reload }) {
  const trip = trips[0]
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

  return (
    <div>
      <div className="topbar"><div><h2>Packing · {trip?.destinationCity} 🎒</h2>
        <div className="sub">Smart list — auto-suggested from weather &amp; trip type</div></div></div>

      <div className="card" style={{ maxWidth: 560, marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <b style={{ fontSize: 14 }}>Overall progress</b>
          <b style={{ fontSize: 14, color: 'var(--brand-2)' }}>{pct}%</b>
        </div>
        <div className="progressbar"><i style={{ width: pct + '%' }} /></div>
        <small style={{ color: 'var(--text-3)' }}>🌧️ Weather-based items are added automatically.</small>
      </div>

      <div className="pack-cols">
        {Object.entries(cats).map(([cat, list]) => (
          <div className="pack-cat" key={cat}>
            <b>{cat}</b>
            {list.map(i => (
              <div key={i.id} className={'pk' + (i.checked ? ' done' : '')} onClick={() => toggle(i)}>
                <div className="box">✓</div>
                <span>{i.name}</span>
                {i.source === 'weather-auto' && <span className="tag">🌦️ auto</span>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
