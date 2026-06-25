// POST /api/sync  — push dirty encrypted docs, pull remote changes since `since`.
// Deploy as a Vercel/Netlify serverless function (Node 18+).
//
// Auth: a shared bearer token (SYNC_TOKEN). For a family app this is simple and
// sufficient; swap for per-user auth later if you open it up.
//
// The `payload` we store is the client's already-encrypted record — the server
// cannot read any document. We also copy a few clear fields (expiry, type) into
// columns so the expiry-alert job can query them without decryption.

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY   // service role — bypasses RLS, server-only
)

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
}

// Read the JSON body whether or not Vercel pre-parsed it.
async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') { try { return JSON.parse(req.body) } catch { return {} } }
  return await new Promise(resolve => {
    let data = ''
    req.on('data', c => { data += c })
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')) } catch { resolve({}) } })
    req.on('error', () => resolve({}))
  })
}

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const auth = req.headers.authorization || ''
  if (auth !== 'Bearer ' + process.env.SYNC_TOKEN) return res.status(401).json({ error: 'Unauthorized' })

  const body = await readJson(req)
  const { familyId, since = 0, documents = [], trips = [], people = [] } = body || {}
  if (!familyId) return res.status(400).json({ error: 'familyId required' })

  // 1) Upsert incoming (already-encrypted) docs.
  if (documents.length) {
    const rows = documents.map(d => ({
      family_id: familyId,
      id: d.id,
      updated_at: d.updatedAt || Date.now(),
      expiry_date: d.expiryDate || null,
      doc_type: d.type || null,
      title: d.title || null,
      deleted: !!d.deleted,
      payload: d                       // ciphertext + metadata, stored verbatim
    }))
    const { error } = await supabase.from('documents').upsert(rows, { onConflict: 'family_id,id' })
    if (error) return res.status(500).json({ error: error.message })
  }

  // 1b) Upsert incoming trips.
  if (trips.length) {
    const rows = trips.map(t => ({
      family_id: familyId,
      id: t.id,
      updated_at: t.updatedAt || Date.now(),
      deleted: !!t.deleted,
      payload: t
    }))
    const { error } = await supabase.from('trips').upsert(rows, { onConflict: 'family_id,id' })
    if (error) return res.status(500).json({ error: error.message })
  }

  // 1c) Upsert incoming people (family members).
  if (people.length) {
    const rows = people.map(p => ({
      family_id: familyId,
      id: p.id,
      updated_at: p.updatedAt || Date.now(),
      deleted: !!p.deleted,
      payload: p
    }))
    const { error } = await supabase.from('people').upsert(rows, { onConflict: 'family_id,id' })
    if (error) return res.status(500).json({ error: error.message })
  }

  // 2) Return everything changed since the client's last sync.
  const { data: docData, error: docErr } = await supabase
    .from('documents').select('payload, updated_at').eq('family_id', familyId).gt('updated_at', since)
  if (docErr) return res.status(500).json({ error: docErr.message })

  const { data: tripData, error: tripErr } = await supabase
    .from('trips').select('payload, updated_at').eq('family_id', familyId).gt('updated_at', since)
  if (tripErr) return res.status(500).json({ error: tripErr.message })

  const { data: peopleData, error: peopleErr } = await supabase
    .from('people').select('payload, updated_at').eq('family_id', familyId).gt('updated_at', since)
  if (peopleErr) return res.status(500).json({ error: peopleErr.message })

  res.status(200).json({
    documents: (docData || []).map(r => ({ ...r.payload, updatedAt: Number(r.updated_at) })),
    trips: (tripData || []).map(r => ({ ...r.payload, updatedAt: Number(r.updated_at) })),
    people: (peopleData || []).map(r => ({ ...r.payload, updatedAt: Number(r.updated_at) })),
    serverTime: Date.now()
  })
}
