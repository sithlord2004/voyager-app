// Optional build-time backend for READ-ONLY services — live flight status and
// travel-safety advice — so people you share the app with get them with zero
// setup. This token only ever authorises /flight and /advisory (never sync), so
// it's safe to ship in the client bundle: it can't touch anyone's private data.
//
// Set these on the APP's Vercel project (Environment Variables), then redeploy:
//   VITE_PUBLIC_ENDPOINT = https://your-backend.vercel.app/api
//   VITE_PUBLIC_TOKEN    = <the PUBLIC_READ_TOKEN you set on the backend>
import { getSyncConfig } from './sync.js'

const PUBLIC_ENDPOINT = import.meta.env.VITE_PUBLIC_ENDPOINT || ''
const PUBLIC_TOKEN = import.meta.env.VITE_PUBLIC_TOKEN || ''

export function publicBackend() {
  return PUBLIC_ENDPOINT && PUBLIC_TOKEN ? { endpoint: PUBLIC_ENDPOINT, token: PUBLIC_TOKEN } : null
}

// Which backend to use for read-only lookups: a user's own Cloud sync config
// wins (their key, their quota); otherwise fall back to the shared public one.
export async function getReadBackend() {
  const cfg = await getSyncConfig()
  if (cfg.endpoint && cfg.token) return { endpoint: cfg.endpoint, token: cfg.token }
  return publicBackend()
}
