import { useEffect, useState, useCallback, useRef } from 'react'
import { db, seedIfEmpty, getSetting } from './lib/db.js'
import { getSyncConfig, syncNow } from './lib/sync.js'
import LockScreen from './components/LockScreen.jsx'
import Sidebar from './components/Sidebar.jsx'
import Dashboard from './components/Dashboard.jsx'
import Trips from './components/Trips.jsx'
import Vault from './components/Vault.jsx'
import Packing from './components/Packing.jsx'
import Emergency from './components/Emergency.jsx'
import Settings from './components/Settings.jsx'
import Help from './components/Help.jsx'
import { versionLabel } from './lib/version.js'

export default function App() {
  const [vaultKey, setVaultKey] = useState(null)   // in-memory only; null = locked
  const [view, setView] = useState('dashboard')
  const [data, setData] = useState(null)

  // Apply saved theme (auto / light / dark) on load.
  useEffect(() => {
    getSetting('theme').then(t => document.documentElement.setAttribute('data-theme', t || 'auto'))
  }, [])

  const reload = useCallback(async () => {
    const [people, trips, documents, packing] = await Promise.all([
      db.people.toArray(), db.trips.toArray(), db.documents.toArray(), db.packing.toArray()
    ])
    setData({ people: people.filter(p => !p.deleted), trips: trips.filter(t => !t.deleted), documents, packing })
  }, [])

  // --- Pull to refresh (mobile) ---
  const [refreshKey, setRefreshKey] = useState(0)
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const touch = useRef({ y: 0, active: false })
  const PTR_THRESH = 64

  // Load data once the vault is unlocked.
  useEffect(() => {
    if (!vaultKey) return
    (async () => { await seedIfEmpty(); await reload() })()
  }, [vaultKey, reload])

  if (!vaultKey) return <LockScreen onUnlock={setVaultKey} />
  if (!data) return (
    <div className="lock">
      <div className="boot">
        <div className="lock-logo boot-pulse">🧭</div>
        <div className="boot-text">Loading your trips…</div>
      </div>
    </div>
  )

  function ptrStart(e) {
    if (window.scrollY <= 0 && !refreshing) touch.current = { y: e.touches[0].clientY, active: true }
    else touch.current.active = false
  }
  function ptrMove(e) {
    if (!touch.current.active || refreshing) return
    const dy = e.touches[0].clientY - touch.current.y
    if (dy > 0 && window.scrollY <= 0) setPull(Math.min(dy * 0.5, 80))
    else { setPull(0); if (dy < -4) touch.current.active = false }
  }
  async function ptrEnd() {
    const go = touch.current.active && pull >= PTR_THRESH && !refreshing
    touch.current.active = false
    setPull(0)
    if (!go) return
    setRefreshing(true)
    try {
      await reload()
      const cfg = await getSyncConfig()
      if (cfg.enabled) { try { await syncNow() } catch { /* offline is fine */ } }
      setRefreshKey(k => k + 1)
    } catch { /* ignore */ }
    setTimeout(() => setRefreshing(false), 500)
  }

  return (
    <div className="app">
      <Sidebar view={view} setView={setView} onLock={() => { setVaultKey(null); setData(null) }} />
      <main className="main" onTouchStart={ptrStart} onTouchMove={ptrMove} onTouchEnd={ptrEnd}>
        {(pull > 4 || refreshing) && (
          <div className="ptr-banner">{refreshing ? '↻ Refreshing…' : pull >= PTR_THRESH ? 'Release to refresh ↑' : 'Pull to refresh ↓'}</div>
        )}
        {view === 'dashboard' && <Dashboard key={refreshKey} trips={data.trips} documents={data.documents} people={data.people} packing={data.packing} />}
        {view === 'trips' && <Trips key={refreshKey} trips={data.trips} documents={data.documents} reload={reload} />}
        {view === 'vault' && <Vault key={refreshKey} vaultKey={vaultKey} documents={data.documents} people={data.people} reload={reload} />}
        {view === 'packing' && <Packing key={refreshKey} trips={data.trips} packing={data.packing} reload={reload} />}
        {view === 'emergency' && <Emergency key={refreshKey} trips={data.trips} />}
        {view === 'settings' && <Settings vaultKey={vaultKey} people={data.people} reload={reload} />}
        {view === 'help' && <Help />}
        <footer className="app-footer">Voyager · {versionLabel()}</footer>
      </main>
    </div>
  )
}
