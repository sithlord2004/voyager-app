// ---------------------------------------------------------------------------
// IndexedDB schema (Dexie). Document file bytes are stored ENCRYPTED in the
// `blob` field; the metadata (type, owner, expiry) is kept in clear so the
// dashboard can show expiry badges without unlocking every file.
// ---------------------------------------------------------------------------
import Dexie from 'dexie'

export const db = new Dexie('voyager')

db.version(1).stores({
  settings: 'key',                              // key/value: vault salt, verifier, etc.
  people: 'id, name',
  trips: 'id, startDate',
  documents: 'id, personId, type, tripId, expiryDate',
  packing: 'id, tripId, category'
})

// v2 adds sync tracking: `dirty` (1 = needs upload) and `updatedAt` indexes.
db.version(2).stores({
  documents: 'id, personId, type, tripId, expiryDate, dirty, updatedAt'
})
// v3 adds the same sync tracking to trips.
db.version(3).stores({
  trips: 'id, startDate, dirty, updatedAt'
})
// v4 adds the same sync tracking to people (family members).
db.version(4).stores({
  people: 'id, name, dirty, updatedAt'
})

// v5 adds sync tracking to packing, so lists and tick-offs move between devices.
db.version(5).stores({
  packing: 'id, tripId, category, dirty, updatedAt'
})

// v6 adds day-by-day plans (Trip Mode): what you're doing on each day.
db.version(6).stores({
  plans: 'id, tripId, date, dirty, updatedAt'
})

export const newId = () => 'x' + crypto.randomUUID().slice(0, 12)

// ---- Day plan helpers (dirty so they sync to the family) ----
export async function savePlan(plan) {
  const rec = { ...plan, id: plan.id || newId(), updatedAt: Date.now(), dirty: 1 }
  await db.plans.put(rec)
  return rec
}
export async function updatePlan(id, patch) {
  await db.plans.update(id, { ...patch, updatedAt: Date.now(), dirty: 1 })
}
export async function deletePlan(id) {
  await db.plans.update(id, { deleted: 1, dirty: 1, updatedAt: Date.now() })
}

// ---- Packing helpers (all mark the row dirty so it syncs) ----
export async function savePacking(item) {
  const rec = { ...item, id: item.id || newId(), updatedAt: Date.now(), dirty: 1 }
  await db.packing.put(rec)
  return rec
}
export async function savePackingMany(items) {
  const now = Date.now()
  const recs = items.map(i => ({ ...i, id: i.id || newId(), updatedAt: now, dirty: 1 }))
  await db.packing.bulkPut(recs)
  return recs
}
export async function updatePacking(id, patch) {
  await db.packing.update(id, { ...patch, updatedAt: Date.now(), dirty: 1 })
}
// Soft-delete so the removal reaches other devices too.
export async function deletePacking(id) {
  await db.packing.update(id, { deleted: 1, dirty: 1, updatedAt: Date.now() })
}

// Create or update a document and mark it dirty for the next sync.
export async function saveDocument(doc) {
  const rec = { ...doc, updatedAt: Date.now(), dirty: 1 }
  if (!rec.id) rec.id = newId()
  await db.documents.put(rec)
  return rec
}

// Create a trip (used by the itinerary importer and the new-trip flow). Dirty so it syncs.
export async function createTrip(trip) {
  const rec = { id: newId(), travellerIds: [], flight: null, ...trip, updatedAt: Date.now(), dirty: 1 }
  await db.trips.add(rec)
  return rec
}

// Edit an existing trip; marks dirty so the change syncs.
export async function updateTrip(id, patch) {
  await db.trips.update(id, { ...patch, updatedAt: Date.now(), dirty: 1 })
}

// Soft-delete a trip so the removal syncs to other devices.
export async function deleteTrip(id) {
  await db.trips.update(id, { deleted: 1, dirty: 1, updatedAt: Date.now() })
}

// Add a family member; dirty so it syncs across devices.
export async function createPerson(person) {
  const rec = { id: newId(), relationship: 'family', ...person, updatedAt: Date.now(), dirty: 1 }
  await db.people.put(rec)
  return rec
}

// Edit a family member (e.g. their encrypted travel profile); dirty so it syncs.
export async function updatePerson(id, patch) {
  await db.people.update(id, { ...patch, updatedAt: Date.now(), dirty: 1 })
}

// Soft-delete a family member so the removal also syncs to other devices.
export async function deletePerson(id) {
  await db.people.update(id, { deleted: 1, dirty: 1, updatedAt: Date.now() })
}

// Clear the dirty flag once records are confirmed uploaded.
export async function markSynced(table, ids) {
  await db.transaction('rw', db[table], async () => {
    for (const id of ids) await db[table].update(id, { dirty: 0 })
  })
}

// ---- Settings helpers ----
export async function getSetting(key) {
  const row = await db.settings.get(key)
  return row?.value
}
export async function setSetting(key, value) {
  await db.settings.put({ key, value })
}
export async function isVaultInitialised() {
  return !!(await getSetting('vault'))
}

// First run starts empty — no demo data — so the app is ready to hand to anyone.
// A welcome card on the Dashboard guides a new user to add their family and
// first trip. (Kept as a no-op function so callers don't need to change.)
export async function seedIfEmpty() { /* intentionally empty */ }

// Days until a date string (negative = past).
export function daysUntil(dateStr) {
  if (!dateStr) return Infinity
  return Math.round((new Date(dateStr + 'T00:00') - new Date()) / 86400000)
}
