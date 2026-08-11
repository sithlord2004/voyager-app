import { useEffect, useState } from 'react'
import { getSetting } from '../lib/db.js'
import { Icon } from './Icon.jsx'

// nav id -> shared Icon name
const ICON = {
  dashboard: 'home', trips: 'map', vault: 'shield', packing: 'bag',
  emergency: 'lifebuoy', settings: 'settings', help: 'help', lock: 'lock'
}
const PRIMARY = [
  ['dashboard', 'Dashboard'], ['trips', 'Trips'], ['vault', 'Vault'],
  ['packing', 'Packing'], ['emergency', 'Emergency']
]
const SECONDARY = [['settings', 'Settings'], ['help', 'Guide']]

function initials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '🧭'
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}

export default function Sidebar({ view, setView, onLock, onAsk }) {
  const [name, setName] = useState('')
  useEffect(() => { getSetting('displayName').then(n => setName(n || '')) }, [])

  const NavBtn = ([id, label]) => (
    <button key={id} className={'nav-item' + (view === id ? ' active' : '')} onClick={() => setView(id)}>
      <span className="ico"><Icon name={ICON[id]} size={20} /></span>
      <span className="nav-text">{label}</span>
    </button>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">🧭</div>
          <div><h1>Voyager</h1><span>TRAVEL HUB</span></div>
        </div>
        <button className="nav-item" onClick={onAsk}>
          <span className="ico"><Icon name="sparkles" size={20} /></span>
          <span className="nav-text">Ask Voyager</span>
        </button>
        {[...PRIMARY, ...SECONDARY].map(NavBtn)}
        <button className="nav-item lock-out" onClick={onLock}>
          <span className="ico"><Icon name="lock" size={20} /></span>
          <span className="nav-text">Lock</span>
        </button>
        <div className="profile">
          <div className="avatar">{initials(name)}</div>
          <div className="meta"><b>{name || 'Your vault'}</b><small>This device</small></div>
        </div>
      </aside>

      {/* Mobile top header (brand + secondary actions) */}
      <header className="mtop">
        <div className="mbrand"><span className="mlogo">🧭</span> Voyager</div>
        <div className="mtop-actions">
          <button className="m-iconbtn" onClick={onAsk} aria-label="Ask Voyager">
            <Icon name="sparkles" size={20} />
          </button>
          {SECONDARY.map(([id, label]) => (
            <button key={id} className={'m-iconbtn' + (view === id ? ' active' : '')} onClick={() => setView(id)} aria-label={label}>
              <Icon name={ICON[id]} size={20} />
            </button>
          ))}
          <button className="m-iconbtn" onClick={onLock} aria-label="Lock"><Icon name="lock" size={20} /></button>
        </div>
      </header>

      {/* Mobile bottom tab bar (primary nav) */}
      <nav className="mbar">
        {PRIMARY.map(([id, label]) => (
          <button key={id} className={'mtab' + (view === id ? ' active' : '')} onClick={() => setView(id)}>
            <Icon name={ICON[id]} size={22} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </>
  )
}
