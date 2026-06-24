import { useEffect, useState } from 'react'
import { getSetting } from '../lib/db.js'

// Clean monochrome line icons (stroke = currentColor, so they follow the theme).
const I = paths => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths}</svg>
)
const ICONS = {
  dashboard: I(<><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>),
  trips: I(<><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" /><line x1="9" y1="3" x2="9" y2="18" /><line x1="15" y1="6" x2="15" y2="21" /></>),
  vault: I(<><path d="M12 3l8 3v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" /><path d="M9 12l2 2 4-4" /></>),
  packing: I(<><rect x="4" y="7" width="16" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /><line x1="4" y1="12" x2="20" y2="12" /></>),
  emergency: I(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.5" /><line x1="12" y1="2.5" x2="12" y2="8.5" /><line x1="12" y1="15.5" x2="12" y2="21.5" /><line x1="2.5" y1="12" x2="8.5" y2="12" /><line x1="15.5" y1="12" x2="21.5" y2="12" /></>),
  settings: I(<><circle cx="9" cy="7" r="2" /><line x1="4" y1="7" x2="7" y2="7" /><line x1="11" y1="7" x2="20" y2="7" /><circle cx="15" cy="17" r="2" /><line x1="4" y1="17" x2="13" y2="17" /><line x1="17" y1="17" x2="20" y2="17" /></>),
  help: I(<><circle cx="12" cy="12" r="9" /><path d="M9.5 9.2a2.6 2.6 0 0 1 4.8 1.3c0 1.7-2.3 2-2.3 3.5" /><circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" /></>),
  lock: I(<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>)
}

const NAV = [
  ['dashboard', 'Dashboard'],
  ['trips', 'Trips'],
  ['vault', 'Vault'],
  ['packing', 'Packing'],
  ['emergency', 'Emergency'],
  ['settings', 'Settings'],
  ['help', 'Guide']
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
      {NAV.map(([id, label]) => (
        <button key={id} className={'nav-item' + (view === id ? ' active' : '')} onClick={() => setView(id)}>
          <span className="ico">{ICONS[id]}</span>
          <span className="nav-text">{label}</span>
        </button>
      ))}
      <button className="nav-item lock-out" onClick={onLock}>
        <span className="ico">{ICONS.lock}</span>
        <span className="nav-text">Lock</span>
      </button>
      <div className="profile">
        <div className="avatar">{initials(name)}</div>
        <div className="meta"><b>{name || 'Your vault'}</b><small>This device</small></div>
      </div>
    </aside>
  )
}
