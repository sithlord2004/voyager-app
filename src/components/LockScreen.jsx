import { useEffect, useState } from 'react'
import { createVault, unlockVault, unlockWithRecovery, resetPassphrase } from '../lib/crypto.js'
import { getSetting, setSetting, isVaultInitialised } from '../lib/db.js'
import { isPasskeyEnabled, unlockWithPasskey } from '../lib/webauthn.js'

export default function LockScreen({ onUnlock }) {
  const [phase, setPhase] = useState('loading') // loading | setup | show-recovery | unlock | recover
  const [pass, setPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [code, setCode] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [pendingKey, setPendingKey] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [hasPasskey, setHasPasskey] = useState(false)

  useEffect(() => {
    isVaultInitialised().then(ok => setPhase(ok ? 'unlock' : 'setup'))
    isPasskeyEnabled().then(setHasPasskey)
  }, [])

  async function handlePasskey() {
    setBusy(true); setError('')
    try { onUnlock(await unlockWithPasskey()) }
    catch (e) { setError(e.message); setBusy(false) }
  }

  function reset() { setPass(''); setConfirm(''); setCode(''); setError('') }

  async function handleSetup(e) {
    e.preventDefault()
    if (pass.length < 8) return setError('Use at least 8 characters.')
    if (pass !== confirm) return setError('Passphrases don’t match.')
    setBusy(true)
    const { vault, recoveryCode, key } = await createVault(pass)
    await setSetting('vault', vault)
    setBusy(false)
    setRecoveryCode(recoveryCode)
    setPendingKey(key)
    setPhase('show-recovery')
  }

  async function handleUnlock(e) {
    e.preventDefault()
    setBusy(true)
    const vault = await getSetting('vault')
    const key = await unlockVault(pass, vault)
    setBusy(false)
    if (key) onUnlock(key)
    else setError('Incorrect passphrase.')
  }

  async function handleRecover(e) {
    e.preventDefault()
    if (pass.length < 8) return setError('New passphrase needs 8+ characters.')
    if (pass !== confirm) return setError('Passphrases don’t match.')
    setBusy(true)
    const vault = await getSetting('vault')
    const key = await unlockWithRecovery(code, vault)
    if (!key) { setBusy(false); return setError('That recovery code didn’t match.') }
    const newVault = await resetPassphrase(pass, key, vault)
    await setSetting('vault', newVault)
    setBusy(false)
    onUnlock(key)
  }

  function copyCode() { navigator.clipboard?.writeText(recoveryCode) }

  return (
    <div className="lock">
      <div className="lock-card">
        <div className="lock-logo">🧭</div>
        <h1>Voyager</h1>

        {phase === 'loading' && <p className="lock-sub">…</p>}

        {phase === 'setup' && (
          <form onSubmit={handleSetup}>
            <p className="lock-sub">Create a passphrase. It encrypts everything on this device.</p>
            <input type="password" placeholder="New passphrase" value={pass}
                   onChange={e => { setPass(e.target.value); setError('') }} autoFocus />
            <input type="password" placeholder="Confirm passphrase" value={confirm}
                   onChange={e => { setConfirm(e.target.value); setError('') }} />
            {error && <div className="lock-err">{error}</div>}
            <button className="lock-btn" disabled={busy}>{busy ? 'Securing…' : '🛡️ Create secure vault'}</button>
          </form>
        )}

        {phase === 'show-recovery' && (
          <div>
            <p className="lock-sub">Save your <b>recovery code</b>. It’s the only way back in if you forget your passphrase — we can’t recover it for you.</p>
            <div className="recovery-code">{recoveryCode}</div>
            <button className="lock-btn ghost" onClick={copyCode} type="button">📋 Copy code</button>
            <button className="lock-btn" onClick={() => onUnlock(pendingKey)}>
              I’ve saved it — continue
            </button>
            <small className="lock-note">Store it in a password manager or print it. Anyone with this code can open your vault.</small>
          </div>
        )}

        {phase === 'unlock' && (
          <form onSubmit={handleUnlock}>
            <p className="lock-sub">Enter your passphrase to unlock your encrypted vault.</p>
            <input type="password" placeholder="Passphrase" value={pass}
                   onChange={e => { setPass(e.target.value); setError('') }} autoFocus />
            {error && <div className="lock-err">{error}</div>}
            <button className="lock-btn" disabled={busy}>{busy ? 'Unlocking…' : '🔓 Unlock'}</button>
            {hasPasskey && (
              <button type="button" className="lock-btn ghost" onClick={handlePasskey} disabled={busy}>
                👤 Unlock with Face ID / passkey
              </button>
            )}
            <button type="button" className="link-btn" onClick={() => { reset(); setPhase('recover') }}>
              Forgot passphrase? Use recovery code
            </button>
          </form>
        )}

        {phase === 'recover' && (
          <form onSubmit={handleRecover}>
            <p className="lock-sub">Enter your recovery code and choose a new passphrase.</p>
            <input placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" value={code}
                   onChange={e => { setCode(e.target.value); setError('') }} autoFocus />
            <input type="password" placeholder="New passphrase" value={pass}
                   onChange={e => { setPass(e.target.value); setError('') }} />
            <input type="password" placeholder="Confirm new passphrase" value={confirm}
                   onChange={e => { setConfirm(e.target.value); setError('') }} />
            {error && <div className="lock-err">{error}</div>}
            <button className="lock-btn" disabled={busy}>{busy ? 'Recovering…' : '🔑 Recover &amp; set passphrase'}</button>
            <button type="button" className="link-btn" onClick={() => { reset(); setPhase('unlock') }}>
              Back to unlock
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
