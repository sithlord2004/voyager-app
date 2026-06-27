// ---------------------------------------------------------------------------
// Opt-in cloud sync. We upload ENCRYPTED document records (the AES-GCM blob is
// already ciphertext) plus the small clear-text metadata the dashboard and the
// email-alert function need (type, owner, expiry). The server is dumb storage:
// it never receives a key and cannot read any document.
//
// Conflict strategy: last-write-wins by `updatedAt` — appropriate for a
// personal/family app (no real-time CRDT machinery).
//
// Uploads go up in small, size-capped batches and downloads come back in
// size-capped pages, so a big set of documents can't blow past the serverless
// request/response limits in one shot. Progress is saved as it goes, so an
// interrupted sync just resumes next time.
// ---------------------------------------------------------------------------
import { db, getSetting, setSetting, markSynced } from './db.js'

const MAX_BATCH_BYTES = 3_000_000   // keep each request well under typical ~4.5MB limits

export async function getSyncConfig() {
  return (await getSetting('sync')) || { enabled: false, endpoint: '', token: '', familyId: '', lastSync: 0 }
}
export async function setSyncConfig(cfg) {
  await setSetting('sync', cfg)
}

// Merge remote records into a local table with last-write-wins.
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

// Push local dirty records + pull remote changes, in safe-sized batches/pages.
export async function syncNow() {
  const cfg = await getSyncConfig()
  if (!cfg.enabled) throw new Error('Sync is off')
  if (!cfg.endpoint || !cfg.token) throw new Error('Add your sync endpoint and token in Settings')

  const url = cfg.endpoint.replace(/\/$/, '') + '/sync'
  const since = cfg.lastSync || 0
  let pushed = 0, pulled = 0, failed = 0, serverTime = Date.now()

  // One request. `body` supplies whichever table's batch we're pushing (others stay empty).
  async function call(body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.token },
      body: JSON.stringify({ familyId: cfg.familyId, since, documents: [], trips: [], people: [], ...body })
    })
    if (!res.ok) {
      // Surface the server's reason (e.g. a database error) instead of a bare status.
      let detail = ''
      try { detail = (await res.clone().json())?.error || '' } catch {}
      if (!detail) { try { detail = (await res.text()).slice(0, 140) } catch {} }
      throw new Error('Sync failed: ' + res.status + (detail ? ' — ' + detail : ''))
    }
    return res.json()
  }

  // 1) Download remote changes first, paginated so a large backlog of documents
  //    can't exceed the serverless response-size limit in a single response.
  let cursor = since
  for (let guard = 0; guard < 2000; guard++) {
    const r = await call({ since: cursor, paginate: true })
    pulled += await mergeInto('documents', r.documents || [])
    pulled += await mergeInto('trips', r.trips || [])
    pulled += await mergeInto('people', r.people || [])
    serverTime = r.serverTime || serverTime
    if (r.more && typeof r.cursor === 'number' && r.cursor > cursor) { cursor = r.cursor; continue }
    break
  }

  // 2) Upload local dirty records, table by table, in size-capped batches.
  async function pushTable(table) {
    const dirty = await db[table].where('dirty').equals(1).toArray()
    let batch = [], bytes = 0
    async function flush() {
      if (!batch.length) return
      const chunk = batch; batch = []; bytes = 0
      try {
        await call({ [table]: chunk })
        await markSynced(table, chunk.map(x => x.id))
        pushed += chunk.length
      } catch {
        failed += chunk.length        // leave them dirty so a later sync retries
      }
    }
    for (const rec of dirty) {
      const sz = JSON.stringify(rec).length
      if (batch.length && bytes + sz > MAX_BATCH_BYTES) await flush()
      batch.push(rec); bytes += sz
      if (bytes >= MAX_BATCH_BYTES) await flush()   // an oversized record goes on its own
    }
    await flush()
  }
  await pushTable('people')      // people & trips first so owners exist before documents
  await pushTable('trips')
  await pushTable('documents')

  await setSyncConfig({ ...cfg, lastSync: serverTime })
  return { pushed, pulled, failed }
}
