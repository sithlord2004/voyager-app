// POST /api/push-subscribe — register (or remove) a device for notifications.
//   body: { familyId, subscription, label }         -> save
//   body: { familyId, endpoint, remove: true }      -> delete
import { createClient } from '@supabase/supabase-js'
import { pushToFamily } from '../lib/push.js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const AUTH = process.env.SYNC_TOKEN

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') { try { return JSON.parse(req.body) } catch { return {} } }
  return await new Promise(resolve => {
    let d = ''
    req.on('data', c => { d += c })
    req.on('end', () => { try { resolve(JSON.parse(d || '{}')) } catch { resolve({}) } })
    req.on('error', () => resolve({}))
  })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if ((req.headers.authorization || '') !== 'Bearer ' + AUTH)
    return res.status(401).json({ error: 'Unauthorized' })

  const { familyId, subscription, endpoint, label, remove, test } = await readJson(req)
  if (!familyId) return res.status(400).json({ error: 'familyId required' })

  try {
    if (remove) {
      const ep = endpoint || subscription?.endpoint
      if (!ep) return res.status(400).json({ error: 'endpoint required' })
      await supabase.from('push_subs').delete().eq('endpoint', ep)
      return res.status(200).json({ ok: true, removed: true })
    }

    if (!subscription?.endpoint) return res.status(400).json({ error: 'subscription required' })
    const { error } = await supabase.from('push_subs').upsert({
      family_id: familyId,
      endpoint: subscription.endpoint,
      sub: subscription,
      label: label || null,
      created_at: Date.now()
    }, { onConflict: 'endpoint' })
    if (error) return res.status(500).json({ error: error.message })

    // Optional: prove it works straight away.
    if (test) {
      await pushToFamily(familyId, {
        title: 'Voyager notifications are on',
        body: 'You’ll get travel-day reminders and document alerts here.',
        tag: 'voyager-test'
      })
    }
    return res.status(200).json({ ok: true })
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) })
  }
}
