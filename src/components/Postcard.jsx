import { useEffect, useRef, useState } from 'react'
import { geocode, tripWeather, WMO, FLAGS } from '../lib/weather.js'

const FONT = '-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const daysToGo = d => Math.ceil((new Date(d + 'T00:00') - new Date()) / 86400000)
const fmtDate = d => new Date(d + 'T00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

// Shrink the font until the text fits within maxW.
function fit(ctx, text, weight, startPx, maxW) {
  let px = startPx
  do { ctx.font = `${weight} ${px}px ${FONT}`; px -= 4 } while (ctx.measureText(text).width > maxW && px > 40)
}

function drawPostcard(canvas, trip, wx, country) {
  const ctx = canvas.getContext('2d')
  const W = canvas.width, H = canvas.height

  // Sky gradient + bottom shade for legibility
  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, '#1e3a8a'); g.addColorStop(0.55, '#0ea5e9'); g.addColorStop(1, '#38bdf8')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  const v = ctx.createLinearGradient(0, H * 0.45, 0, H)
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.5)')
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H)

  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'

  ctx.globalAlpha = 0.9
  ctx.font = `600 36px ${FONT}`
  ctx.fillText('✈   V O Y A G E R', W / 2, 96)
  ctx.globalAlpha = 1

  const flag = FLAGS[trip.countryCode] || '🗺️'
  fit(ctx, trip.destinationCity, 800, 150, W - 120)
  ctx.fillText(trip.destinationCity, W / 2, H * 0.45)

  ctx.globalAlpha = 0.92
  ctx.font = `500 50px ${FONT}`
  ctx.fillText(`${flag}  ${country || trip.countryCode || ''}`.trim(), W / 2, H * 0.45 + 84)
  ctx.globalAlpha = 1

  const du = daysToGo(trip.startDate)
  const cd = du > 0 ? `${du} day${du === 1 ? '' : 's'} to go` : du === 0 ? 'Today!' : 'Adventure in progress'
  ctx.font = `800 84px ${FONT}`
  ctx.fillText(cd, W / 2, H * 0.69)

  ctx.globalAlpha = 0.9
  ctx.font = `500 44px ${FONT}`
  ctx.fillText(`${fmtDate(trip.startDate)}  →  ${fmtDate(trip.endDate)}`, W / 2, H * 0.69 + 74)
  ctx.globalAlpha = 1

  if (wx && wx.temp != null) {
    const wc = WMO[wx.code] || ['🌡️', '']
    ctx.font = `600 48px ${FONT}`
    ctx.fillText(`${wc[0]}  ${wx.temp}°C · ${wc[1]}`, W / 2, H * 0.83)
  }

  const n = trip.travellerIds?.length || 0
  if (n) {
    ctx.globalAlpha = 0.85
    ctx.font = `500 38px ${FONT}`
    ctx.fillText(`${n} traveller${n === 1 ? '' : 's'}`, W / 2, H * 0.83 + 64)
    ctx.globalAlpha = 1
  }

  ctx.globalAlpha = 0.8
  ctx.font = `500 32px ${FONT}`
  ctx.fillText('Made with Voyager', W / 2, H - 70)
  ctx.globalAlpha = 1
}

export default function Postcard({ trip, onClose }) {
  const canvasRef = useRef(null)
  const [url, setUrl] = useState(null)
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let wx = null, country = ''
      try {
        const p = await geocode(trip.destinationCity)
        if (p) { country = p.country || ''; wx = await tripWeather(p.latitude, p.longitude, trip.startDate, trip.endDate) }
      } catch { /* draw without weather */ }
      if (cancelled || !canvasRef.current) return
      drawPostcard(canvasRef.current, trip, wx, country)
      canvasRef.current.toBlob(b => {
        if (cancelled || !b) return
        setUrl(URL.createObjectURL(b)); setBusy(false)
      }, 'image/png')
    })()
    return () => { cancelled = true }
  }, []) // eslint-disable-line

  async function share() {
    const blob = await new Promise(r => canvasRef.current.toBlob(r, 'image/png'))
    const file = new File([blob], `${trip.destinationCity}-voyager.png`, { type: 'image/png' })
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: `${trip.destinationCity} · Voyager` }) } catch { /* user cancelled */ }
    } else if (url) {
      const a = document.createElement('a'); a.href = url; a.download = file.name; a.click()
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380, textAlign: 'center' }}>
        <canvas ref={canvasRef} width={1080} height={1350}
          style={{ width: '100%', borderRadius: 14, display: busy ? 'none' : 'block' }} />
        {busy && <div className="empty"><div className="ico" style={{ fontSize: 22 }}>🎴</div><b>Creating your postcard…</b></div>}
        <div className="modal-actions" style={{ justifyContent: 'center', marginTop: 14 }}>
          <button className="btn ghost" onClick={onClose}>Close</button>
          {url && <a className="btn ghost" href={url} download={`${trip.destinationCity}-voyager.png`}>⬇️ Save</a>}
          <button className="btn" onClick={share} disabled={busy}>📤 Share</button>
        </div>
      </div>
    </div>
  )
}
