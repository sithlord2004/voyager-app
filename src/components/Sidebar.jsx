const NAV = [
  ['dashboard', '🏠', 'Dashboard'],
  ['trips', '🗺️', 'Trips'],
  ['vault', '🔐', 'Document Vault'],
  ['packing', '🎒', 'Packing'],
  ['emergency', '🆘', 'Emergency'],
  ['settings', '⚙️', 'Settings']
]

export default function Sidebar({ view, setView, onLock }) {
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
        <div className="avatar">AM</div>
        <div className="meta"><b>Amit M.</b><small>Family · 4 profiles</small></div>
      </div>
    </aside>
  )
}
