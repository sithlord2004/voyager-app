// Remembers which notifications have already gone out today, so the job can be
// run every hour (to catch the right local time) without sending duplicates.
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

// True if this kind of notification has already been sent to this family today.
export async function alreadySent(familyId, kind, day) {
  try {
    const { data } = await supabase.from('notify_log')
      .select('family_id').eq('family_id', familyId).eq('kind', kind).eq('day', day).maybeSingle()
    return !!data
  } catch { return false }
}

export async function markSent(familyId, kind, day) {
  try {
    await supabase.from('notify_log')
      .upsert({ family_id: familyId, kind, day, sent_at: Date.now() }, { onConflict: 'family_id,kind,day' })
  } catch { /* a duplicate is better than a crash */ }
}

// Convenience: run `fn` only once per family per day for this `kind`.
export async function once(familyId, kind, day, fn) {
  if (await alreadySent(familyId, kind, day)) return false
  await fn()
  await markSent(familyId, kind, day)
  return true
}
