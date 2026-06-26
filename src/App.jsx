import { useEffect, useState, useCallback } from 'react'
import { db, seedIfEmpty, getSetting } from './lib/db.js'
import LockScreen from './components/LockScreen.jsx'
import Sidebar from './components/Sidebar.jsx'
import Dashboard from './components/Dashboard.jsx'
import Trips from './components/Trips.jsx'
import Vault from './components/Vault.jsx'
import Packing from './components/Packing.jsx'
import Emergency from './components/Emergency.jsx'
import Settings from './components/Settings.jsx'
import Help from './components/Help.jsx'

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

  // Load data once the vault is unlocked.
  useEffect(() => {
    if (!vaultKey) return
    (async () => { await seedIfEmpty(); await reload() })()
  }, [vaultKey, reload])

  if (!vaultKey) return <LockScreen onUnlock={setVaultKey} />
  if (!data) return <div className="lock"><div className="lock-logo">🧭</div></div>

  return (
    <div className="app">
      <Sidebar view={view} setView={setView} onLock={() => { setVaultKey(null); setData(null) }} />
      <main className="main">
        {view === 'dashboard' && <Dashboard trips={data.trips} documents={data.documents} people={data.people} packing={data.packing} />}
        {view === 'trips' && <Trips trips={data.trips} documents={data.documents} reload={reload} />}
        {view === 'vault' && <Vault vaultKey={vaultKey} documents={data.documents} people={data.people} reload={reload} />}
        {view === 'packing' && <Packing trips={data.trips} packing={data.packing} reload={reload} />}
        {view === 'emergency' && <Emergency trips={data.trips} />}
        {view === 'settings' && <Settings vaultKey={vaultKey} people={data.people} reload={reload} />}
        {view === 'help' && <Help />}
      </main>
    </div>
  )
}
