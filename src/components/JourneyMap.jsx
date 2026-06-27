import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { geocode } from '../lib/weather.js'
import { AIRPORTS } from '../lib/airports.js'

function legsOf(trip) {
  if (trip.legs?.length) return trip.legs
  if (trip.flight) return [{ from: trip.flight.depAirport, to: trip.flight.arrAirport, mode: 'flight' }]
  return []
}

// Great-circle arc between two [lat,lon] points → a natural curved flight path.
function arc(a, b, n = 48) {
  const toR = Math.PI / 180, toD = 180 / Math.PI
  const p1 = a[0] * toR, l1 = a[1] * toR, p2 = b[0] * toR, l2 = b[1] * toR
  const d = 2 * Math.asin(Math.sqrt(Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2))
  if (!d) return [a, b]
  const out = []
  for (let i = 0; i <= n; i++) {
    const f = i / n
    const A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d)
    const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2)
    const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2)
    const z = A * Math.sin(p1) + B * Math.sin(p2)
    out.push([Math.atan2(z, Math.sqrt(x * x + y * y)) * toD, Math.atan2(y, x) * toD])
  }
  return out
}

const pin = (emoji, color) => L.divIcon({
  className: 'jm-pin',
  html: `<span style="background:${color}">${emoji}</span>`,
  iconSize: [30, 30], iconAnchor: [15, 15]
})

export default function JourneyMap({ trip, onClose }) {
  const elRef = useRef(null)
  const [status, setStatus] = useState('Plotting your journey…')

  useEffect(() => {
    let map
    ;(async () => {
      const code = c => AIRPORTS[(c || '').trim().toUpperCase()]
      const pts = []
      legsOf(trip).forEach(l => {
        const f = code(l.from), t = code(l.to)
        if (f) pts.push({ coord: f, label: (l.from || '').toUpperCase() })
        if (t) pts.push({ coord: t, label: (l.to || '').toUpperCase() })
      })

      let dest = null
      try { const p = await geocode(trip.destinationCity); if (p) dest = { coord: [p.latitude, p.longitude], label: trip.destinationCity } } catch { /* ignore */ }

      if (!elRef.current) return
      map = L.map(elRef.current, { worldCopyJump: true }).setView([20, 0], 2)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map)

      const all = []
      for (let i = 0; i < pts.length - 1; i++) {
        L.polyline(arc(pts[i].coord, pts[i + 1].coord), { color: '#3b82f6', weight: 3, opacity: 0.9, dashArray: '1 0' }).addTo(map)
      }
      pts.forEach(p => { L.marker(p.coord, { icon: pin('✈️', '#0b2545') }).addTo(map).bindPopup(p.label); all.push(p.coord) })
      if (dest) { L.marker(dest.coord, { icon: pin('📍', '#dc2626') }).addTo(map).bindPopup(dest.label); all.push(dest.coord) }

      for (const s of (trip.stays || [])) {
        try {
          const p = await geocode(`${s.name}, ${trip.destinationCity}`)
          if (p) { const c = [p.latitude, p.longitude]; L.marker(c, { icon: pin(s.kind === 'airbnb' ? '🏠' : '🏨', '#0ea5e9') }).addTo(map).bindPopup(s.name); all.push(c) }
        } catch { /* skip unresolved stays */ }
      }

      setTimeout(() => {
        map.invalidateSize()
        if (all.length > 1) map.fitBounds(all, { padding: [40, 40], maxZoom: 7 })
        else if (all.length === 1) map.setView(all[0], 6)
      }, 60)
      setStatus(all.length ? '' : 'Add flight legs with airport codes (e.g. LHR → HND), or a destination city, to map this trip.')
    })()
    return () => { if (map) map.remove() }
  }, []) // eslint-disable-line

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640, width: '92vw' }}>
        <h3>🗺️ {trip.destinationCity} · journey</h3>
        <div className="journey-map" ref={elRef} />
        {status && <div className="desc" style={{ marginTop: 8 }}>{status}</div>}
        <div className="modal-actions" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
