import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { AIRPORTS, toCode } from '../lib/airports.js'
import { Icon } from './Icon.jsx'
import ModalPortal from './ModalPortal.jsx'

// Great-circle points between two [lat,lon] pairs, for a curved flight path.
function arc(a, b, n = 64) {
  const toRad = d => d * Math.PI / 180, toDeg = r => r * 180 / Math.PI
  const [lat1, lon1] = a.map(toRad), [lat2, lon2] = b.map(toRad)
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2))
  if (!d) return [a, b]
  const pts = []
  for (let i = 0; i <= n; i++) {
    const f = i / n
    const A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d)
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2)
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2)
    const z = A * Math.sin(lat1) + B * Math.sin(lat2)
    pts.push([toDeg(Math.atan2(z, Math.hypot(x, y))), toDeg(Math.atan2(y, x))])
  }
  return pts
}

const planeIcon = deg => L.divIcon({
  className: 'fr-plane',
  html: `<span style="transform:rotate(${deg}deg)">✈</span>`,
  iconSize: [28, 28], iconAnchor: [14, 14]
})
const dot = color => L.divIcon({
  className: 'fr-dot', html: `<span style="background:${color}"></span>`,
  iconSize: [12, 12], iconAnchor: [6, 6]
})

// Where the aircraft is, estimated from how far through the scheduled flight we
// are. This is an ESTIMATE from the timetable, not a live radar feed — labelled
// as such in the UI rather than implying precision we don't have.
function progressOf(depISO, arrISO, now = new Date()) {
  if (!depISO || !arrISO) return null
  const dep = new Date(depISO), arr = new Date(arrISO)
  if (isNaN(dep) || isNaN(arr) || arr <= dep) return null
  const pct = Math.min(1, Math.max(0, (now - dep) / (arr - dep)))
  const minsLeft = Math.max(0, Math.round((arr - now) / 60000))
  return { pct, minsLeft, dep, arr, airborne: now >= dep && now <= arr }
}

export default function FlightRadar({ leg, status, onClose }) {
  const elRef = useRef(null)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])

  const from = AIRPORTS[toCode(leg?.from)]
  const to = AIRPORTS[toCode(leg?.to)]
  const depISO = status?.departure?.revised || status?.departure?.scheduled
  const arrISO = status?.arrival?.revised || status?.arrival?.scheduled
  const prog = progressOf(depISO, arrISO, now)

  useEffect(() => {
    if (!elRef.current || !from || !to) return
    const map = L.map(elRef.current, { zoomControl: false, attributionControl: false })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 10 }).addTo(map)

    const path = arc(from, to)
    L.polyline(path, { color: '#4b8ef0', weight: 3, opacity: .9 }).addTo(map)
    L.marker(from, { icon: dot('#22c55e') }).addTo(map).bindPopup(toCode(leg.from))
    L.marker(to, { icon: dot('#ef4444') }).addTo(map).bindPopup(toCode(leg.to))

    if (prog) {
      const i = Math.min(path.length - 2, Math.floor(prog.pct * (path.length - 1)))
      const p = path[i], nxt = path[i + 1]
      const bearing = Math.atan2(nxt[1] - p[1], nxt[0] - p[0]) * 180 / Math.PI
      L.marker(p, { icon: planeIcon(bearing) }).addTo(map)
      // Flown portion, in a stronger colour.
      L.polyline(path.slice(0, i + 1), { color: '#22b6d6', weight: 4 }).addTo(map)
    }

    map.fitBounds(L.latLngBounds(path), { padding: [30, 30] })
    setTimeout(() => map.invalidateSize(), 60)
    return () => map.remove()
  }, [leg?.number, prog?.pct]) // eslint-disable-line

  const missing = !from || !to

  return (
    <ModalPortal>
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal fr" onClick={e => e.stopPropagation()}>
          <div className="viewer-bar">
            <span className="viewer-name">{leg?.number} · {toCode(leg?.from)} → {toCode(leg?.to)}</span>
            <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={20} /></button>
          </div>

          {missing ? (
            <p className="desc">We don’t have coordinates for one of these airports, so there’s no map to draw.</p>
          ) : (
            <>
              <div ref={elRef} className="fr-map" />
              <div className="fr-stat">
                {prog?.airborne ? (
                  <>
                    <b>{Math.round(prog.pct * 100)}% of the way</b>
                    <span>Landing in about {prog.minsLeft} min{prog.minsLeft === 1 ? '' : 's'}</span>
                  </>
                ) : prog && now < prog.dep ? (
                  <>
                    <b>Not departed yet</b>
                    <span>Scheduled {prog.dep.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </>
                ) : prog ? (
                  <><b>Landed</b><span>Arrived {prog.arr.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></>
                ) : (
                  <><b>Route</b><span>Live times aren’t available for this flight yet.</span></>
                )}
              </div>
              <p className="desc" style={{ fontSize: 11 }}>
                Position is estimated from the scheduled departure and arrival times — it’s not a live radar feed.
              </p>
            </>
          )}
        </div>
      </div>
    </ModalPortal>
  )
}
