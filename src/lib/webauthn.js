// ---------------------------------------------------------------------------
// Convenience unlock with a platform passkey (Face ID / Touch ID / Windows
// Hello) using WebAuthn's PRF extension.
//
// The authenticator deterministically returns a secret (PRF output) for our
// fixed salt. We derive an AES key from it and use it to WRAP the vault's DEK,
// storing only the wrapped key. To unlock, the user passes biometric/PIN, the
// authenticator returns the same PRF secret, and we unwrap the DEK. The
// passphrase stays the root of trust; this is an additional, device-bound path.
//
// Requires a platform authenticator + a browser supporting the PRF extension
// (Chrome/Edge/Safari recent). Gracefully unavailable otherwise.
// ---------------------------------------------------------------------------
import { getSetting, setSetting } from './db.js'
import { importRawAesKey, wrapKey, unwrapKey } from './crypto.js'

const PRF_SALT = new TextEncoder().encode('voyager-prf-salt-v1')
const rand = n => crypto.getRandomValues(new Uint8Array(n))
const b64 = b => btoa(String.fromCharCode(...new Uint8Array(b)))
const u8 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0))

export function passkeySupported() {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials
}
export async function isPasskeyEnabled() {
  return !!(await getSetting('passkey'))
}
export async function disablePasskey() {
  await setSetting('passkey', null)
}

// Run an assertion and return the PRF secret bytes for a given credential id.
async function getPrf(credentialId) {
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: rand(32),
      allowCredentials: credentialId ? [{ type: 'public-key', id: credentialId }] : [],
      userVerification: 'required',
      extensions: { prf: { eval: { first: PRF_SALT } } }
    }
  })
  const prf = assertion.getClientExtensionResults?.()?.prf?.results?.first
  if (!prf) throw new Error('This device/browser doesn’t support passkey encryption (PRF).')
  return new Uint8Array(prf)
}

// Create a passkey and wrap the live DEK with its PRF secret.
export async function enablePasskey(dek) {
  if (!passkeySupported()) throw new Error('Passkeys aren’t available here.')
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: rand(32),
      rp: { name: 'Voyager' },
      user: { id: rand(16), name: 'voyager-vault', displayName: 'Voyager Vault' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { userVerification: 'required', residentKey: 'preferred' },
      extensions: { prf: { eval: { first: PRF_SALT } } }
    }
  })
  const prf = await getPrf(cred.rawId)               // second step: obtain the secret
  const wrapping = await importRawAesKey(prf)
  const wrapped = await wrapKey(wrapping, dek)
  await setSetting('passkey', { credentialId: b64(cred.rawId), wrapped })
}

// Unlock the vault using the passkey; returns the DEK CryptoKey.
export async function unlockWithPasskey() {
  const pk = await getSetting('passkey')
  if (!pk) throw new Error('No passkey set up on this device.')
  const prf = await getPrf(u8(pk.credentialId))
  const wrapping = await importRawAesKey(prf)
  return unwrapKey(wrapping, pk.wrapped)
}
