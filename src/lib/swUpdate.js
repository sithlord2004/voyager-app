// ---------------------------------------------------------------------------
// PWA auto-update — pick up a new deploy without force-quitting the app.
//
// The service worker itself already activates immediately (skipWaiting +
// clientsClaim, set in vite.config.js). This file covers the other three things
// that keep an installed PWA stale:
//
//   • iOS almost never runs its own update check for a home-screen app, so we
//     check on foreground, on reconnect, and on a timer.
//   • The check for sw.js can itself be answered from HTTP cache and silently
//     no-op — `updateViaCache: 'none'` prevents that.
//   • An already-open page keeps running old code until something reloads it —
//     we reload once on `controllerchange`.
//
// IMPORTANT ADAPTATION: Voyager has real data-entry screens (add trip, add
// document, travel profile, packing). A surprise reload mid-typing would throw
// away the user's work — the exact bug we fixed by removing the remount-on-
// refresh behaviour. So the reload is gated on "is it safe right now?" and
// deferred until it is, rather than firing blindly.
// ---------------------------------------------------------------------------

const CHECK_INTERVAL = 90000   // catch-all for a session left open on screen
const RETRY_INTERVAL = 4000    // how often to re-test after deferring a reload

let swReloading = false        // one-shot guard: must never loop
let retryTimer = null

// Don't yank the page out from under someone who is in the middle of something.
function safeToReload() {
  // Any open modal means an in-progress form (trip, document, profile, invite).
  if (document.querySelector('.modal-backdrop')) return false
  // Actively typing.
  const el = document.activeElement
  if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return false
  return true
}

function reloadWhenSafe() {
  if (swReloading) return
  if (safeToReload()) {
    swReloading = true
    location.reload()
    return
  }
  // Busy right now — wait for a quiet moment and try again.
  if (retryTimer) return
  retryTimer = setInterval(() => {
    if (swReloading) { clearInterval(retryTimer); return }
    if (safeToReload()) {
      clearInterval(retryTimer); retryTimer = null
      swReloading = true
      location.reload()
    }
  }, RETRY_INTERVAL)
}

export function initServiceWorkerUpdates() {
  if (!('serviceWorker' in navigator)) return

  // On a first-ever visit the page starts uncontrolled and the new worker claims
  // it — that fires controllerchange too, but it's an install, not an update.
  // Reloading a brand-new visitor's first load would be jarring for no benefit.
  let hadController = Boolean(navigator.serviceWorker.controller)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) { hadController = true; return }
    reloadWhenSafe()
  })

  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
    .then(reg => {
      const check = () => { try { reg.update() } catch { /* can throw offline */ } }
      // Back in the foreground — the moment a stale version is most noticeable.
      document.addEventListener('visibilitychange', () => { if (!document.hidden) check() })
      // Connectivity returned.
      window.addEventListener('online', check)
      // Left open on screen.
      setInterval(() => { if (!document.hidden) check() }, CHECK_INTERVAL)
      check()
    })
    .catch(() => { /* SW unsupported or blocked — app still works */ })
}
