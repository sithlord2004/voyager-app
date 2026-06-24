// ---------------------------------------------------------------------------
// Opt-in cloud sync. We upload ENCRYPTED document records (the AES-GCM blob is
// already ciphertext) plus the small clear-text metadata the dashboard and the
// email-alert function need (type, owner, expiry). The server is dumb storage:
// it never receives a key and cannot read any document.
//
// Conflict strategy: last-write-wins by `updatedAt` — appropriate for a
// personal/family app (no real-time CRDT machinery).
// ---------------------------------------------------------------------------
import { db, getSetting, setSetting, markSynced } from './db.js'

export async function getSyncConfig() {
  return (await getSetting('sync')) || { enabled: false, endpoint: '', token: '', familyId: '', lastSync: 0 }
}
export async function setSyncConfig(cfg) {
  await setSetting('sync', cfg)
}

// Push local dirty docs, pull anything changed remotely since last sync, merge.
export async function syncNow() {
  const cfg = await getSyncConfig()
  if (!cfg.enabled) throw new Error('Sync is off')
  if (!cfg.endpoint || !cfg.token) throw new Error('Add your sync endpoint and token in Settings')

  const dirty = await db.documents.where('dirty').equals(1).toArray()

  const res = await fetch(cfg.endpoint.replace(/\/$/, '') + '/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.token },
    body: JSON.stringify({ familyId: cfg.familyId, since: cfg.lastSync || 0, documents: dirty })
  })
  if (!res.ok) throw new Error('Sync failed: ' + res.status)
  const { documents: remote = [], serverTime } = await res.json()

  // Merge remote -> local with last-write-wins.
  let pulled = 0
  await db.transaction('rw', db.documents, async () => {
    for (const r of remote) {
      const local = await db.documents.get(r.id)
      if (!local || (r.updatedAt || 0) > (local.updatedAt || 0)) {
        await db.documents.put({ ...r, dirty: 0 })
        pulled++
      }
    }
  })

  await markSynced(dirty.map(d => d.id))
  await setSyncConfig({ ...cfg, lastSync: serverTime || Date.now() })
  return { pushed: dirty.length, pulled }
}
