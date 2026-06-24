// ---------------------------------------------------------------------------
// Voyager encryption layer — envelope encryption with the Web Crypto API.
//
//   Documents are encrypted with a random 256-bit DATA key (DEK).
//   The DEK itself is wrapped (encrypted) by two KEY-ENCRYPTION keys (KEKs):
//     • KEK_pass    derived from the user's passphrase   (PBKDF2)
//     • KEK_recovery derived from a one-time recovery code (PBKDF2)
//
// Either secret can unwrap the DEK, so a forgotten passphrase is recoverable
// via the recovery code — without the server (or anyone) ever holding the DEK.
// Document bytes are AES-256-GCM encrypted with the DEK before touching storage.
// ---------------------------------------------------------------------------

const enc = new TextEncoder()
const dec = new TextDecoder()
const PBKDF2_ITERATIONS = 210000
const VERIFIER_PLAINTEXT = 'voyager-verifier-v2'
const RECOVERY_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no ambiguous chars

function buf2b64(buf) { return btoa(String.fromCharCode(...new Uint8Array(buf))) }
function b642u8(b64) { return Uint8Array.from(atob(b64), c => c.charCodeAt(0)) }
export function randomBytes(len) { return crypto.getRandomValues(new Uint8Array(len)) }

// A human-friendly recovery code: 5 groups of 4, e.g. K7QM-3FRT-9XPL-...-...
export function generateRecoveryCode() {
  const pick = () => RECOVERY_ALPHABET[Math.floor(Math.random() * RECOVERY_ALPHABET.length)]
  return Array.from({ length: 5 }, () => Array.from({ length: 4 }, pick).join('')).join('-')
}

// Derive a wrapping key (KEK) from a secret + salt.
async function deriveKEK(secret, saltB64) {
  const base = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: b642u8(saltB64), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  )
}

async function aesEnc(key, bytes) {
  const iv = randomBytes(12)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes)
  return { iv: buf2b64(iv), data: buf2b64(ct) }
}
async function aesDec(key, { iv, data }) {
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b642u8(iv) }, key, b642u8(data))
}
async function importDEK(raw) {
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt'])
}

// First run: make a DEK, wrap it with both the passphrase and a recovery code.
// Returns the in-memory DEK, the vault material to persist, and the recovery
// code (shown to the user once — it is never stored in plaintext).
export async function createVault(passphrase) {
  const dek = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const dekRaw = await crypto.subtle.exportKey('raw', dek)
  const salt = buf2b64(randomBytes(16))
  const recoveryCode = generateRecoveryCode()

  const kekPass = await deriveKEK(passphrase, salt)
  const kekRec = await deriveKEK(recoveryCode, salt)

  const vault = {
    v: 2,
    salt,
    wrappedByPass: await aesEnc(kekPass, dekRaw),
    wrappedByRecovery: await aesEnc(kekRec, dekRaw),
    verifier: await encryptString(dek, VERIFIER_PLAINTEXT)
  }
  return { vault, recoveryCode, key: dek }
}

async function unwrapWith(secret, wrapped, vault) {
  try {
    const kek = await deriveKEK(secret, vault.salt)
    const dekRaw = await aesDec(kek, wrapped)
    const key = await importDEK(dekRaw)
    const ok = await decryptString(key, vault.verifier)
    return ok === VERIFIER_PLAINTEXT ? key : null
  } catch { return null }
}

// Unlock with the passphrase. Returns the DEK or null.
export function unlockVault(passphrase, vault) {
  return unwrapWith(passphrase, vault.wrappedByPass, vault)
}
// Unlock with the recovery code (case/space tolerant). Returns the DEK or null.
export function unlockWithRecovery(code, vault) {
  return unwrapWith(code.trim().toUpperCase().replace(/\s+/g, ''), vault.wrappedByRecovery, vault)
}

// Re-wrap the DEK under a new passphrase (used after recovery). Returns new vault.
export async function resetPassphrase(newPassphrase, key, vault) {
  const dekRaw = await crypto.subtle.exportKey('raw', key)
  const kekPass = await deriveKEK(newPassphrase, vault.salt)
  return { ...vault, wrappedByPass: await aesEnc(kekPass, dekRaw) }
}

// ---- Key-wrapping helpers (used by the WebAuthn/passkey unlock) ----
// Import 32 raw bytes (e.g. a WebAuthn PRF output) as an AES-GCM wrapping key.
export function importRawAesKey(bytes) {
  return crypto.subtle.importKey('raw', bytes.slice(0, 32), 'AES-GCM', false, ['encrypt', 'decrypt'])
}
// Wrap (encrypt) the DEK under a wrapping key; returns {iv,data}.
export async function wrapKey(wrappingKey, dek) {
  return aesEnc(wrappingKey, await crypto.subtle.exportKey('raw', dek))
}
// Unwrap to recover the DEK CryptoKey.
export async function unwrapKey(wrappingKey, wrapped) {
  return importDEK(await aesDec(wrappingKey, wrapped))
}

// ---- Document/string helpers (operate on the DEK) ----
export async function encryptString(key, str) { return aesEnc(key, enc.encode(str)) }
export async function decryptString(key, blob) { return dec.decode(await aesDec(key, blob)) }
export async function encryptBytes(key, arrayBuffer) { return aesEnc(key, arrayBuffer) }
export async function decryptBytes(key, blob) { return aesDec(key, blob) }
