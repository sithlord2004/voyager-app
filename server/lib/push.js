// Web Push sender. Works on iOS 16.4+ for apps installed to the Home Screen,
// and on Android/desktop Chrome & Firefox.
//
// Needs three env vars on the backend project:
//   VAPID_PUBLIC_KEY   (same value the app is built with)
//   VAPID_PRIVATE_KEY  (secret)
//   VAPID_SUBJECT      (mailto:you@example.com — required by the spec)
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

let configured = false
function configure() {
  if (configured) return true
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false
  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:voyager@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  configured = true
  return true
}

// Send one notification to every device registered for a family.
// Subscriptions that the push service reports as gone (404/410) are deleted, so
// uninstalled apps don't pile up forever.
export async function pushToFamily(familyId, payload) {
  if (!configure()) return { sent: 0, skipped: 'VAPID keys not set' }

  const { data, error } = await supabase.from('push_subs').select('endpoint, sub').eq('family_id', familyId)
  if (error || !data?.length) return { sent: 0 }

  let sent = 0
  const dead = []
  await Promise.all(data.map(async row => {
    try {
      await webpush.sendNotification(row.sub, JSON.stringify(payload), { TTL: 12 * 3600 })
      sent++
    } catch (e) {
      const code = e?.statusCode
      if (code === 404 || code === 410) dead.push(row.endpoint)
    }
  }))
  if (dead.length) await supabase.from('push_subs').delete().in('endpoint', dead)
  return { sent, removed: dead.length }
}
