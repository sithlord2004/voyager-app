// ---------------------------------------------------------------------------
// Web Push subscription (client side).
//
// iOS supports this from 16.4, but ONLY when the app has been added to the Home
// Screen — in a Safari tab the APIs simply aren't there. We detect that and say
// so plainly rather than failing silently.
//
// Needs VITE_VAPID_PUBLIC on the app project, matching VAPID_PUBLIC_KEY on the
// backend.
// ---------------------------------------------------------------------------
import { getSyncConfig } from './sync.js'

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC || ''

// Base64url VAPID key -> Uint8Array, as the Push API expects.
function urlBase64ToUint8Array(base64) {
  const padded = (base64 + '='.repeat((4 - base64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true

// What can this device actually do right now?
export function pushSupport() {
  const hasApi = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  if (!hasApi) {
    return {
      ok: false,
      reason: iOS
        ? 'On iPhone, notifications only work once Voyager is added to your Home Screen. Open it in Safari, tap Share → Add to Home Screen, then try again from there.'
        : 'This browser doesn’t support notifications.'
    }
  }
  if (!VAPID_PUBLIC) return { ok: false, reason: 'Notifications aren’t configured on this build (missing VAPID key).' }
  return { ok: true }
}

export const permission = () => (('Notification' in window) ? Notification.permission : 'unsupported')

async function post(body) {
  const cfg = await getSyncConfig()
  if (!cfg.endpoint || !cfg.token) throw new Error('Set up Cloud sync first — notifications are sent to your family.')
  const res = await fetch(cfg.endpoint.replace(/\/$/, '') + '/push-subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.token },
    body: JSON.stringify({ familyId: cfg.familyId, ...body })
  })
  if (!res.ok) {
    let detail = ''
    try { detail = (await res.json())?.error || '' } catch {}
    throw new Error(detail || `Server said ${res.status}`)
  }
  return res.json()
}

// Is this device already subscribed?
export async function isSubscribed() {
  try {
    const reg = await navigator.serviceWorker?.ready
    return !!(await reg?.pushManager.getSubscription())
  } catch { return false }
}

// Ask permission and register this device. Must be called from a tap.
export async function enablePush(label) {
  const s = pushSupport()
  if (!s.ok) throw new Error(s.reason)

  const perm = await Notification.requestPermission()
  if (perm !== 'granted') {
    throw new Error(perm === 'denied'
      ? 'Notifications are blocked. Allow them for Voyager in your device settings, then try again.'
      : 'Notifications weren’t enabled.')
  }

  const reg = await navigator.serviceWorker.ready
  const existing = await reg.pushManager.getSubscription()
  const sub = existing || await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC)
  })

  await post({ subscription: sub.toJSON(), label, test: true })
  return true
}

// Fire a test notification to this family's devices. Re-sends the existing
// subscription (harmless upsert) and asks the server to push straight back.
export async function sendTestPush() {
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) throw new Error('This device isn’t subscribed yet — turn notifications on first.')
  await post({ subscription: sub.toJSON(), test: true })
  return true
}

// Stop notifications on this device.
export async function disablePush() {
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (sub) {
    try { await post({ endpoint: sub.endpoint, remove: true }) } catch { /* still unsubscribe locally */ }
    await sub.unsubscribe()
  }
  return true
}
