import { useEffect, useState, useCallback, useRef } from 'react'
import { db, seedIfEmpty, getSetting } from './lib/db.js'
import { getSyncConfig, setSyncConfig, syncNow } from './lib/sync.js'
import { readInviteFromHash, clearInviteHash } from './lib/invite.js'
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
import ModalPortal from './components/ModalPortal.jsx'

export default function App() {
  const [vaultKey, setVaultKey] = useState(null)   // in-memory only; null = locked
  const [view, setView] = useState('dashboard')
  const [data, setData] = useState(null)
  // An invite link (#invite=...) captured on load — offered once the vault is unlocked.
  const [invite, setInvite] = useState(() => readInviteFromHash())
  const [joining, setJoining] = useState('')

  async function acceptInvite() {
    setJoining('Joining…')
    try {
      const cur = await getSyncConfig()
      await setSyncConfig({ ...cur, enabled: true, endpoint: invite.endpoint, token: invite.token, familyId: invite.familyId })
      clearInviteHash()
      try { await syncNow() } catch { /* first sync may be slow/offline */ }
      await reload()
      setInvite(null); setJoining('')
    } catch { setJoining('⚠️ Could not join — check the link and try again.') }
  }
  function dismissInvite() { clearInviteHash(); setInvite(null) }

  // Apply saved theme (auto / light / dark) + text size on load.
  useEffect(() => {
    getSetting('theme').then(t => document.documentElement.setAttribute('data-theme', t || 'auto'))
    getSetting('fontScale').then(v => { if (v) document.documentElement.style.setProperty('--fs', String(v)) })
  }, [])

  // Keep the iOS status-bar colour in sync with the *app's* resolved theme
  // (not just the system), and update live when the theme is toggled.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (!meta) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const t = document.documentElement.getAttribute('data-theme') || 'auto'
      const dark = t === 'dark' || (t === 'auto' && mq.matches)
      meta.setAttribute('content', dark ? '#0e131b' : '#ffffff')
    }
    apply()
    const mo = new MutationObserver(apply)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    mq.addEventListener?.('change', apply)
    return () => { mo.disconnect(); mq.removeEventListener?.('change', apply) }
  }, [])

  const reload = useCallback(async () => {
    const [people, trips, documents, packing, myPersonId, showAllTrips] = await Promise.all([
      db.people.toArray(), db.trips.toArray(), db.documents.toArray(), db.packing.toArray(),
      getSetting('myPersonId'), getSetting('showAllTrips')
    ])
    const liveTrips = trips.filter(t => !t.deleted)
    // Per-traveller visibility: if this device is a specific person and "show all"
    // is off, hide trips they're not on. Trips with no travellers assigned stay
    // visible to everyone so nothing gets lost.
    const visibleTrips = (!myPersonId || showAllTrips)
      ? liveTrips
      : liveTrips.filter(t => !(t.travellerIds?.length) || t.travellerIds.includes(myPersonId))
    // Apply the same rule to anything tied to a hidden trip: its documents and
    // packing lists. Personal docs (no tripId) and standalone packing lists
    // (whose "tripId" is a list id, not a trip id) are unaffected.
    const hiddenTripIds = new Set(liveTrips.filter(t => !visibleTrips.includes(t)).map(t => t.id))
    const visibleDocuments = hiddenTripIds.size ? documents.filter(d => !d.tripId || !hiddenTripIds.has(d.tripId)) : documents
    const visiblePacking = hiddenTripIds.size ? packing.filter(k => !hiddenTripIds.has(k.tripId)) : packing
    setData({
      people: people.filter(p => !p.deleted),
      trips: visibleTrips,
      allTripCount: liveTrips.length,
      hiddenTripCount: liveTrips.length - visibleTrips.length,
      documents: visibleDocuments,
      packing: visiblePacking
    })
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

  // Silent auto-refresh: every few minutes (and when the app is refocused),
  // quietly pull cloud changes and re-read local data — no remount, so it never
  // interrupts what you're doing.
  useEffect(() => {
    if (!vaultKey) return
    let busy = false
    const tick = async () => {
      if (busy || document.hidden) return
      busy = true
      try {
        const cfg = await getSyncConfig()
        if (cfg.enabled) { try { await syncNow() } catch { /* offline is fine */ } }
        await reload()
      } catch { /* ignore */ }
      busy = false
    }
    const id = setInterval(tick, 5 * 60 * 1000)
    const onVis = () => { if (!document.hidden) tick() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis) }
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
    // Never start pull-to-refresh while a modal is open — let the modal scroll instead.
    if (document.querySelector('.modal-backdrop')) { touch.current.active = false; return }
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
    // Fast part: re-read local data + re-fetch live info (weather/flights) right away.
    try { await reload(); setRefreshKey(k => k + 1) } catch { /* ignore */ }
    setTimeout(() => setRefreshing(false), 350)
    // Cloud sync runs in the background so the refresh feels instant; when it
    // finishes, re-read so any pulled changes appear.
    ;(async () => {
      try { const cfg = await getSyncConfig(); if (cfg.enabled) { await syncNow(); await reload() } } catch { /* offline is fine */ }
    })()
  }

  return (
    <div className="app">
      <Sidebar view={view} setView={setView} onLock={() => { setVaultKey(null); setData(null) }} />
      <main className="main" onTouchStart={ptrStart} onTouchMove={ptrMove} onTouchEnd={ptrEnd}>
        {(pull > 4 || refreshing) && (
          <div className="ptr-banner">{refreshing ? '↻ Refreshing…' : pull >= PTR_THRESH ? 'Release to refresh ↑' : 'Pull to refresh ↓'}</div>
        )}
        {view === 'dashboard' && <Dashboard refreshKey={refreshKey} trips={data.trips} documents={data.documents} people={data.people} packing={data.packing} setView={setView} vaultKey={vaultKey} />}
        {view === 'trips' && <Trips trips={data.trips} documents={data.documents} people={data.people} reload={reload} hiddenTripCount={data.hiddenTripCount} />}
        {view === 'vault' && <Vault vaultKey={vaultKey} documents={data.documents} people={data.people} reload={reload} />}
        {view === 'packing' && <Packing trips={data.trips} packing={data.packing} reload={reload} />}
        {view === 'emergency' && <Emergency trips={data.trips} />}
        {view === 'settings' && <Settings vaultKey={vaultKey} people={data.people} reload={reload} />}
        {view === 'help' && <Help />}
        <footer className="app-footer">Voyager · {versionLabel()}</footer>
      </main>

      {invite && (
        <ModalPortal>
          <div className="modal-backdrop" onClick={dismissInvite}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
              <h3>Join a shared family?</h3>
              <p className="desc">This invite will connect this device to a shared Cloud sync so you see the same trips and documents.</p>
              <div className="desc" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
                <div><b>Family</b> · {invite.familyId || '—'}</div>
                <div style={{ wordBreak: 'break-all' }}><b>Server</b> · {invite.endpoint}</div>
              </div>
              <p className="desc" style={{ fontSize: 11.5, marginTop: 8 }}>Only accept invites from someone you trust. To open shared documents you'll also need their passphrase (or a restored backup).</p>
              {joining && <div className="desc">{joining}</div>}
              <div className="modal-actions">
                <button className="btn ghost" onClick={dismissInvite} disabled={!!joining && joining === 'Joining…'}>Not now</button>
                <button className="btn" onClick={acceptInvite} disabled={joining === 'Joining…'}>{joining === 'Joining…' ? 'Joining…' : 'Join family'}</button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  )
}
