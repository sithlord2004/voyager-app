// ---------------------------------------------------------------------------
// Encrypted backup. Exports a single .voyager file containing:
//   • the vault material (salt + wrapped DEK + verifier) — already safe to store
//   • all app records (people, trips, documents, packing) encrypted with the DEK
//
// Document blobs are already ciphertext; wrapping the whole bundle again means
// even the metadata (names, expiry dates) is encrypted at rest in the file.
// Restore needs the passphrase (or recovery code via the lock screen).
// ---------------------------------------------------------------------------
import { db, getSetting, setSetting } from './db.js'
import { encryptBytes, decryptBytes, unlockVault } from './crypto.js'

const enc = new TextEncoder()
const dec = new TextDecoder()

// Build and download an encrypted backup. `key` is the in-memory DEK.
export async function exportBackup(key) {
  const bundle = {
    people: await db.people.toArray(),
    trips: await db.trips.toArray(),
    documents: await db.documents.toArray(),
    packing: await db.packing.toArray()
  }
  const data = await encryptBytes(key, enc.encode(JSON.stringify(bundle)))
  const file = {
    app: 'voyager-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    vault: await getSetting('vault'),   // wrapped keys — not usable without a secret
    data                                // ciphertext bundle
  }
  const blob = new Blob([JSON.stringify(file)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `voyager-backup-${new Date().toISOString().slice(0, 10)}.voyager`
  a.click()
  URL.revokeObjectURL(url)
}

// Restore from a backup file's text + the passphrase that protected it.
// Returns the unlocked DEK on success, or throws.
export async function importBackup(fileText, passphrase) {
  let file
  try { file = JSON.parse(fileText) } catch { throw new Error('Not a valid backup file.') }
  if (file.app !== 'voyager-backup' || !file.vault || !file.data) throw new Error('Unrecognised backup file.')

  const key = await unlockVault(passphrase, file.vault)
  if (!key) throw new Error('Passphrase didn’t match this backup.')

  const bytes = await decryptBytes(key, file.data)
  const bundle = JSON.parse(dec.decode(bytes))

  await db.transaction('rw', db.people, db.trips, db.documents, db.packing, db.settings, async () => {
    await Promise.all([db.people.clear(), db.trips.clear(), db.documents.clear(), db.packing.clear()])
    await db.people.bulkPut(bundle.people || [])
    await db.trips.bulkPut(bundle.trips || [])
    await db.documents.bulkPut(bundle.documents || [])
    await db.packing.bulkPut(bundle.packing || [])
  })
  await setSetting('vault', file.vault)
  // Drop any passkey from this device — it's bound to the OLD vault key and would
  // otherwise unlock with the wrong key (documents would fail to decrypt). The user
  // re-enables Face ID after unlocking once with the restored passphrase.
  await setSetting('passkey', null)
  return key
}
