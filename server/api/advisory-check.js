// GET /api/advisory-check — DAILY. Checks official travel advice for each
// upcoming destination and notifies when it changes.
//
// This used to live inside /api/expiry-alerts, but that job runs hourly on a
// 30-second leash and scraping gov.uk is the slowest thing it did — for data
// that changes a few times a year. Splitting it keeps the hourly job fast and
// lets this one take its time.
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { fetchAdvisory } from '../lib/fcdo.js'
import { pushToFamily } from '../lib/push.js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const resend = new Resend(process.env.RESEND_API_KEY)

function withTimeout(promise, ms, label) {
  let t
  return Promise.race([
    promise,
    new Promise((_, rej) => { t = setTimeout(() => rej(new Error('timeout: ' + label)), ms) })
  ]).finally(() => clearTimeout(t))
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(204).end()

  const auth = req.headers.authorization || ''
  const isCron = auth === 'Bearer ' + process.env.CRON_SECRET
    || (req.query && req.query.key === process.env.CRON_SECRET)
  if (process.env.CRON_SECRET && !isCron) return res.status(401).json({ error: 'Unauthorized' })

  const startedAt = Date.now()
  const { data: families, error } = await supabase.from('families').select('*')
  if (error) return res.status(500).json({ error: error.message })

  let checked = 0, notified = 0
  for (const fam of families || []) {
    try {
      const { data: tripRows } = await supabase.from('trips')
        .select('payload').eq('family_id', fam.family_id).eq('deleted', false)

      const today = new Date()
      const seen = new Set()
      const changes = []

      for (const row of (tripRows || [])) {
        const t = row.payload
        if (!t || t.deleted || !t.countryCode || !t.endDate || new Date(t.endDate) < today) continue
        const cc = String(t.countryCode).toUpperCase()
        if (seen.has(cc)) continue
        seen.add(cc)

        const adv = await fetchAdvisory(cc, t.destinationCity)
        if (!adv || !adv.found) continue
        checked++

        const { data: st } = await supabase.from('advisory_state')
          .select('fingerprint').eq('family_id', fam.family_id).eq('country_code', cc).maybeSingle()
        // Only a CHANGE is worth telling anyone about — the first sighting of a
        // country just records a baseline.
        if (st && st.fingerprint && st.fingerprint !== adv.fingerprint) changes.push({ t, adv })
        await supabase.from('advisory_state').upsert(
          { family_id: fam.family_id, country_code: cc, fingerprint: adv.fingerprint, checked_at: Date.now() },
          { onConflict: 'family_id,country_code' })
      }

      if (changes.length) {
        const c0 = changes[0]
        await pushToFamily(fam.family_id, {
          title: `Travel advice updated — ${c0.adv.country || c0.t.destinationCity}`,
          body: c0.adv.changeDescription || c0.adv.levelLabel || 'The official advice has changed.',
          tag: 'voyager-advisory',
          url: '/'
        }).catch(() => {})
        notified++

        if (fam.alert_email) {
          const arows = changes.map(({ t, adv }) =>
            `<tr><td>${adv.country || t.destinationCity}</td><td>${adv.levelLabel}</td><td>${adv.changeDescription || 'Advice updated'}</td></tr>`
          ).join('')
          await withTimeout(resend.emails.send({
            from: 'Voyager <onboarding@resend.dev>',
            to: fam.alert_email,
            subject: `⚠️ Travel advice updated for ${changes.length} destination(s)`,
            html: `<h2>Travel advice has changed</h2>
              <table cellpadding="8" style="border-collapse:collapse">
                <tr><th align="left">Destination</th><th align="left">Status</th><th align="left">Latest update</th></tr>
                ${arows}
              </table>
              <p style="color:#64748b;font-size:13px">Source: UK Foreign Office (FCDO). Check the full advice before you travel.</p>`
          }), 8000, 'advisory email').catch(() => {})
        }
      }
    } catch { /* one family's failure shouldn't stop the rest */ }
  }

  res.status(200).json({ ok: true, countriesChecked: checked, familiesNotified: notified, ms: Date.now() - startedAt })
}
