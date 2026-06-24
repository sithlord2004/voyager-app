// POST /api/sync — push dirty encrypted docs + trips, pull remote changes since `since`.
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
}
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
  const { familyId, since = 0, documents = [], trips = [] } = body || {}
  if (!familyId) return res.status(400).json({ error: 'familyId required' })

  if (documents.length) {
    const rows = documents.map(d => ({
      family_id: familyId, id: d.id, updated_at: d.updatedAt || Date.now(),
      expiry_date: d.expiryDate || null, doc_type: d.type || null, title: d.title || null,
      deleted: !!d.deleted, payload: d
    }))
    const { error } = await supabase.from('documents').upsert(rows, { onConflict: 'family_id,id' })
    if (error) return res.status(500).json({ error: error.message })
  }

  if (trips.length) {
    const rows = trips.map(t => ({
      family_id: familyId, id: t.id, updated_at: t.updatedAt || Date.now(),
      deleted: !!t.deleted, payload: t
    }))
    const { error } = await supabase.from('trips').upsert(rows, { onConflict: 'family_id,id' })
    if (error) return res.status(500).json({ error: error.message })
  }

  const { data: docData, error: docErr } = await supabase
    .from('documents').select('payload, updated_at').eq('family_id', familyId).gt('updated_at', since)
  if (docErr) return res.status(500).json({ error: docErr.message })

  const { data: tripData, error: tripErr } = await supabase
    .from('trips').select('payload, updated_at').eq('family_id', familyId).gt('updated_at', since)
  if (tripErr) return res.status(500).json({ error: tripErr.message })

  res.status(200).json({
    documents: (docData || []).map(r => ({ ...r.payload, updatedAt: Number(r.updated_at) })),
    trips: (tripData || []).map(r => ({ ...r.payload, updatedAt: Number(r.updated_at) })),
    serverTime: Date.now()
  })
}
