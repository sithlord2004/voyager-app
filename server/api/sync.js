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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const auth = req.headers.authorization || ''
  if (auth !== 'Bearer ' + process.env.SYNC_TOKEN) return res.status(401).json({ error: 'Unauthorized' })

  const { familyId, since = 0, documents = [] } = req.body || {}
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

  // 2) Return everything changed since the client's last sync.
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
