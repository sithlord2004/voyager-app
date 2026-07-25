// Sync invites: pack the Cloud-sync settings (endpoint, token, Family ID) into a
// single link/QR so another device can join with one tap instead of typing them.
// The payload sits in the URL *hash* (#invite=...), which browsers never send to
// the server — so the token stays out of any request logs.

function b64urlEncode(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function b64urlDecode(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/')
  return decodeURIComponent(escape(atob(s)))
}

// Build the shareable invite URL from a sync config.
export function makeInviteUrl(cfg) {
  const payload = { e: cfg.endpoint || '', t: cfg.token || '', f: cfg.familyId || '' }
  const code = b64urlEncode(JSON.stringify(payload))
  const base = location.origin + location.pathname
  return `${base}#invite=${code}`
}

// Read an invite from the current URL hash (or return null).
export function readInviteFromHash() {
  const m = (location.hash || '').match(/invite=([^&]+)/)
  if (!m) return null
  try {
    const { e, t, f } = JSON.parse(b64urlDecode(m[1]))
    if (!e || !t) return null
    return { endpoint: e, token: t, familyId: f || '' }
  } catch { return null }
}

// Remove the invite from the address bar once handled.
export function clearInviteHash() {
  history.replaceState(null, '', location.origin + location.pathname + location.search)
}
