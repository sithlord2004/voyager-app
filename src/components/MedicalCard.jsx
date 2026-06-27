import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { getSetting } from '../lib/db.js'

// Plain-text summary a paramedic can read straight off the QR (no app needed).
function buildText(name, contacts, medical) {
  const lines = ['MEDICAL ID' + (name ? ' — ' + name : '')]
  if (medical?.length) {
    lines.push('', 'Medical:')
    medical.forEach(m => lines.push(`- ${m.label ? m.label + ': ' : ''}${m.value}`))
  }
  if (contacts?.length) {
    lines.push('', 'Emergency contacts:')
    contacts.forEach(c => lines.push(`- ${c.label ? c.label + ': ' : ''}${c.value}`))
  }
  return lines.join('\n')
}

export default function MedicalCard({ contacts = [], medical = [], onClose }) {
  const [name, setName] = useState('')
  const [qr, setQr] = useState(null)

  useEffect(() => { getSetting('displayName').then(n => setName(n || '')) }, [])
  useEffect(() => {
    QRCode.toDataURL(buildText(name, contacts, medical), { margin: 1, width: 360, errorCorrectionLevel: 'M' })
      .then(setQr).catch(() => setQr(null))
  }, [name, contacts, medical])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal med-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="med-card" id="med-card">
          <div className="med-head"><span>✚ MEDICAL ID</span>{name && <b>{name}</b>}</div>
          <div className="med-body">
            <div className="med-fields">
              {medical.length ? (
                <div className="med-sec"><h4>Medical</h4>
                  {medical.map((m, i) => <div key={i} className="med-line"><b>{m.label || '—'}</b><span>{m.value}</span></div>)}
                </div>
              ) : <div className="med-none">No medical notes added yet — add them in the Emergency screen.</div>}
              {contacts.length > 0 && (
                <div className="med-sec"><h4>In an emergency, contact</h4>
                  {contacts.map((c, i) => <div key={i} className="med-line"><b>{c.label || '—'}</b><span>{c.value}</span></div>)}
                </div>
              )}
            </div>
            {qr && <img className="med-qr" src={qr} alt="Medical ID QR code" />}
          </div>
          <div className="med-foot">Scan the code for these details · Made with Voyager</div>
        </div>
        <div className="modal-actions med-actions" style={{ justifyContent: 'center' }}>
          <button className="btn ghost" onClick={onClose}>Close</button>
          <button className="btn" onClick={() => window.print()}>🖨 Print / Save PDF</button>
        </div>
      </div>
    </div>
  )
}
