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

export const newId = () => 'x' + crypto.randomUUID().slice(0, 12)

// Create or update a document and mark it dirty for the next sync.
export async function saveDocument(doc) {
  const rec = { ...doc, updatedAt: Date.now(), dirty: 1 }
  if (!rec.id) rec.id = newId()
  await db.documents.put(rec)
  return rec
}

// Create a trip (used by the itinerary importer and the new-trip flow).
export async function createTrip(trip) {
  const rec = { id: newId(), travellerIds: [], flight: null, ...trip }
  await db.trips.add(rec)
  return rec
}

// Clear the dirty flag once records are confirmed uploaded.
export async function markSynced(ids) {
  await db.transaction('rw', db.documents, async () => {
    for (const id of ids) await db.documents.update(id, { dirty: 0 })
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

// ---- Seed demo data so the app isn't empty on first unlock ----
export async function seedIfEmpty() {
  if (await db.people.count()) return
  await db.people.bulkAdd([
    { id: 'p1', name: 'Amit', initials: 'AM', color: '#3b82f6', relationship: 'self' },
    { id: 'p2', name: 'Priya', initials: 'PM', color: '#8b5cf6', relationship: 'spouse' },
    { id: 'p3', name: 'Aria', initials: 'AR', color: '#06b6d4', relationship: 'child' },
    { id: 'p4', name: 'Dev', initials: 'DV', color: '#22c55e', relationship: 'child' }
  ])
  await db.trips.bulkAdd([
    { id: 't1', destinationCity: 'Kyoto', countryCode: 'JP', startDate: '2026-07-02', endDate: '2026-07-12', travellerIds: ['p1','p2','p3','p4'], flight: { airline: 'Japan Airlines', number: 'JL044', depAirport: 'LHR', arrAirport: 'HND', depTime: '10:35' } },
    { id: 't2', destinationCity: 'Barcelona', countryCode: 'ES', startDate: '2026-09-14', endDate: '2026-09-21', travellerIds: ['p1','p2'], flight: null },
    { id: 't3', destinationCity: 'Banff', countryCode: 'CA', startDate: '2026-12-20', endDate: '2026-12-30', travellerIds: ['p1','p2','p3','p4'], flight: { airline: 'Air Canada', number: 'AC859', depAirport: 'LHR', arrAirport: 'YYC', depTime: '13:05' } }
  ])
  // Documents start as metadata-only stubs; real encrypted bytes are added
  // when the user scans a file in the Vault.
  await db.documents.bulkAdd([
    { id: 'd1', personId: 'p1', type: 'Passport', title: 'Passport', expiryDate: '2031-03-12', tripId: null, blob: null },
    { id: 'd2', personId: 'p2', type: 'Passport', title: 'Passport', expiryDate: '2031-07-08', tripId: null, blob: null },
    { id: 'd3', personId: 'p3', type: 'Passport', title: 'Passport', expiryDate: '2026-08-31', tripId: null, blob: null },
    { id: 'd4', personId: 'p1', type: 'Driving licence', title: 'UK licence', expiryDate: '2026-10-14', tripId: null, blob: null },
    { id: 'd5', personId: 'p1', type: 'Travel insurance', title: 'AXA-99481', expiryDate: '2027-01-01', tripId: null, blob: null },
    { id: 'd6', personId: 'p3', type: 'Vaccination record', title: 'Vaccinations', expiryDate: null, tripId: null, blob: null }
  ])
  await db.packing.bulkAdd([
    { id: 'k1', tripId: 't1', category: 'Documents', name: 'Passports (x4)', checked: true, source: 'template' },
    { id: 'k2', tripId: 't1', category: 'Documents', name: 'Printed e-tickets', checked: false, source: 'template' },
    { id: 'k3', tripId: 't1', category: 'Clothing', name: 'Rain jacket', checked: false, source: 'weather-auto' },
    { id: 'k4', tripId: 't1', category: 'Weather-based', name: 'Umbrella', checked: false, source: 'weather-auto' },
    { id: 'k5', tripId: 't1', category: 'Electronics', name: 'Type-A adapter', checked: true, source: 'template' },
    { id: 'k6', tripId: 't1', category: 'Kids', name: 'EpiPen', checked: true, source: 'manual' }
  ])
}

// Days until a date string (negative = past).
export function daysUntil(dateStr) {
  if (!dateStr) return Infinity
  return Math.round((new Date(dateStr + 'T00:00') - new Date()) / 86400000)
}
