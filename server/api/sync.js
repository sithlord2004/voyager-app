// POST /api/sync — push dirty encrypted docs, pull remote changes since `since`.
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
}

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const auth = req.headers.authorization || ''
  if (auth !== 'Bearer ' + process.env.SYNC_TOKEN) return res.status(401).json({ error: 'Unauthorized' })

  const { familyId, since = 0, documents = [] } = req.body || {}
  if (!familyId) return res.status(400).json({ error: 'familyId required' })

  if (documents.length) {
    const rows = documents.map(d => ({
      family_id: familyId,
      id: d.id,
      updated_at: d.updatedAt || Date.now(),
      expiry_date: d.expiryDate || null,
      doc_type: d.type || null,
      title: d.title || null,
      deleted: !!d.deleted,
      payload: d
    }))
    const { error } = await supabase.from('documents').upsert(rows, { onConflict: 'family_id,id' })
    if (error) return res.status(500).json({ error: error.message })
  }

  const { data, error } = await supabase
    .from('documents')
    .select('payload, updated_at')
    .eq('family_id', familyId)
    .gt('updated_at', since)
  if (error) return res.status(500).json({ error: error.message })

  res.status(200).json({
    documents: (data || []).map(r => ({ ...r.payload, updatedAt: Number(r.updated_at) })),
    serverTime: Date.now()
  })
}
