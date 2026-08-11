import { useEffect, useRef, useState } from 'react'
import { db, savePlan } from '../lib/db.js'
import { answer, parseAddPlan } from '../lib/ask.js'
import { Icon } from './Icon.jsx'
import ModalPortal from './ModalPortal.jsx'

const SUGGESTIONS = [
  'When do we check out?',
  'What flight are we on?',
  'When does my passport expire?',
  'What’s planned today?',
  'How much is packed?'
]

// Speech recognition is built into the browser (no service, no key). Safari and
// Chrome expose it under different names; absent elsewhere, we just hide the mic.
const SR = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null

export default function Ask({ data, setView, onClose }) {
  const [q, setQ] = useState('')
  const [result, setResult] = useState(null)   // { text, view } | { unknown }
  const [pending, setPending] = useState(null) // a parsed plan awaiting confirmation
  const [listening, setListening] = useState(false)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)
  const recRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function ask(text) {
    const question = (text ?? q).trim()
    if (!question) return
    setQ(question)

    // "Add dinner at 7pm tomorrow" — parse, then confirm before writing.
    const plan = parseAddPlan(question, data.trips)
    if (plan) { setPending(plan); setResult(null); return }

    setResult(answer(question, data))
    setPending(null)
  }

  async function confirmAdd() {
    setBusy(true)
    await savePlan({
      tripId: pending.tripId, date: pending.date, time: pending.time,
      title: pending.title, place: pending.place, note: ''
    })
    setBusy(false)
    setResult({ text: `Added “${pending.title}” to ${pending.tripName}.`, view: 'dashboard' })
    setPending(null)
    setQ('')
  }

  function toggleMic() {
    if (!SR) return
    if (listening) { recRef.current?.stop(); setListening(false); return }
    const rec = new SR()
    recRef.current = rec
    rec.lang = navigator.language || 'en-GB'
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onresult = e => {
      const said = e.results?.[0]?.[0]?.transcript || ''
      setListening(false)
      if (said) { setQ(said); ask(said) }
    }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    try { rec.start(); setListening(true) } catch { setListening(false) }
  }

  function go(view) { setView?.(view); onClose() }

  return (
    <ModalPortal>
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal ask" onClick={e => e.stopPropagation()}>
          <h3>Ask Voyager</h3>

          <div className="ask-bar">
            <Icon name="search" size={17} />
            <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && ask()}
              placeholder="Ask about your trip…" />
            {SR && (
              <button className={'ask-mic' + (listening ? ' on' : '')} onClick={toggleMic}
                aria-label={listening ? 'Stop listening' : 'Speak'}>
                <Icon name="mic" size={17} />
              </button>
            )}
          </div>

          {!result && !pending && (
            <div className="ask-sugg">
              {SUGGESTIONS.map(s => (
                <button key={s} className="mini" onClick={() => ask(s)}>{s}</button>
              ))}
            </div>
          )}

          {/* Natural-language add: show what we understood, then confirm. */}
          {pending && (
            <div className="ask-answer">
              <b>Add this to {pending.tripName}?</b>
              <div className="ask-plan">
                <div><span>What</span>{pending.title}</div>
                <div><span>When</span>{new Date(pending.date + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}{pending.time ? ` at ${pending.time}` : ''}</div>
                {pending.place && <div><span>Where</span>{pending.place}</div>}
              </div>
              <div className="modal-actions">
                <button className="btn ghost" onClick={() => { setPending(null); }}>Cancel</button>
                <button className="btn" onClick={confirmAdd} disabled={busy}>{busy ? 'Adding…' : 'Add it'}</button>
              </div>
            </div>
          )}

          {result && !result.unknown && (
            <div className="ask-answer">
              <p>{result.text}</p>
              {result.view && (
                <button className="mini" onClick={() => go(result.view)}>Open {result.view}</button>
              )}
            </div>
          )}

          {result?.unknown && (
            <div className="ask-answer">
              <p>I don’t know that one.</p>
              <span className="desc">
                I can answer things from your own trips, documents, packing and destination —
                dates, flights, seats, expiry, plugs, tipping, what’s planned. Try one of the
                suggestions, or open the section you need.
              </span>
            </div>
          )}

          <div className="modal-actions">
            <button className="btn ghost" onClick={onClose}>Close</button>
          </div>
          <p className="desc" style={{ fontSize: 11, marginTop: 6 }}>
            Answered on your device from your own data — nothing is sent anywhere, and it works offline.
          </p>
        </div>
      </div>
    </ModalPortal>
  )
}
