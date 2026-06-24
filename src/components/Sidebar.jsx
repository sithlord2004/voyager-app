import { useEffect, useState } from 'react'
import { getSetting } from '../lib/db.js'

const NAV = [
  ['dashboard', '🏠', 'Dashboard'],
  ['trips', '🗺️', 'Trips'],
  ['vault', '🔐', 'Document Vault'],
  ['packing', '🎒', 'Packing'],
  ['emergency', '🆘', 'Emergency'],
  ['settings', '⚙️', 'Settings']
]

function initials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '🧭'
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}

export default function Sidebar({ view, setView, onLock }) {
  const [name, setName] = useState('')
  useEffect(() => { getSetting('displayName').then(n => setName(n || '')) }, [])

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo">🧭</div>
        <div><h1>Voyager</h1><span>TRAVEL HUB</span></div>
      </div>
      {NAV.map(([id, ico, label]) => (
        <button key={id} className={'nav-item' + (view === id ? ' active' : '')} onClick={() => setView(id)}>
          <span className="ico">{ico}</span> {label}
        </button>
      ))}
      <button className="nav-item lock-out" onClick={onLock}>
        <span className="ico">🔒</span> Lock vault
      </button>
      <div className="profile">
        <div className="avatar">{initials(name)}</div>
        <div className="meta"><b>{name || 'Your vault'}</b><small>This device</small></div>
      </div>
    </aside>
  )
}
