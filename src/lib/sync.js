import { db, getSetting, setSetting, markSynced } from './db.js'

export async function getSyncConfig() {
  return (await getSetting('sync')) || { enabled: false, endpoint: '', token: '', familyId: '', lastSync: 0 }
}
export async function setSyncConfig(cfg) {
  await setSetting('sync', cfg)
}

async function mergeInto(table, remote) {
  let pulled = 0
  await db.transaction('rw', db[table], async () => {
    for (const r of remote) {
      const local = await db[table].get(r.id)
      if (!local || (r.updatedAt || 0) > (local.updatedAt || 0)) {
        await db[table].put({ ...r, dirty: 0 })
        pulled++
      }
    }
  })
  return pulled
}

export async function syncNow() {
  const cfg = await getSyncConfig()
  if (!cfg.enabled) throw new Error('Sync is off')
  if (!cfg.endpoint || !cfg.token) throw new Error('Add your sync endpoint and token in Settings')

  const dirtyDocs = await db.documents.where('dirty').equals(1).toArray()
  const dirtyTrips = await db.trips.where('dirty').equals(1).toArray()

  const res = await fetch(cfg.endpoint.replace(/\/$/, '') + '/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.token },
    body: JSON.stringify({ familyId: cfg.familyId, since: cfg.lastSync || 0, documents: dirtyDocs, trips: dirtyTrips })
  })
  if (!res.ok) throw new Error('Sync failed: ' + res.status)
  const { documents: remoteDocs = [], trips: remoteTrips = [], serverTime } = await res.json()

  const pulledDocs = await mergeInto('documents', remoteDocs)
  const pulledTrips = await mergeInto('trips', remoteTrips)

  await markSynced('documents', dirtyDocs.map(d => d.id))
  await markSynced('trips', dirtyTrips.map(t => t.id))
  await setSyncConfig({ ...cfg, lastSync: serverTime || Date.now() })
  return { pushed: dirtyDocs.length + dirtyTrips.length, pulled: pulledDocs + pulledTrips }
}
