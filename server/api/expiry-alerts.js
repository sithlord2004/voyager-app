// GET /api/expiry-alerts  — scheduled daily by cron (see vercel.json).
// Scans the CLEAR expiry metadata (never decrypts documents) and emails each
// family a summary of documents lapsing within the warning window.
//
// Because it reads only expiry_date / doc_type / title columns, zero-knowledge
// is preserved: the encrypted payloads are never touched.

import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const resend = new Resend(process.env.RESEND_API_KEY)
const WARN_DAYS = 180

function daysUntil(dateStr) {
  return Math.round((new Date(dateStr) - new Date()) / 86400000)
}

export default async function handler(req, res) {
  // Allow Vercel Cron (sends a secret header) or a manual authorized call.
  if (process.env.CRON_SECRET && req.headers.authorization !== 'Bearer ' + process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { data: families, error: fErr } = await supabase.from('families').select('*')
  if (fErr) return res.status(500).json({ error: fErr.message })

  let sent = 0
  for (const fam of families || []) {
    const { data: docs } = await supabase
      .from('documents')
      .select('doc_type, title, expiry_date')
      .eq('family_id', fam.family_id)
      .eq('deleted', false)
      .not('expiry_date', 'is', null)

    const soon = (docs || [])
      .map(d => ({ ...d, days: daysUntil(d.expiry_date) }))
      .filter(d => d.days >= 0 && d.days <= WARN_DAYS)
      .sort((a, b) => a.days - b.days)

    if (!soon.length) continue

    const rows = soon.map(d =>
      `<tr><td>${d.title || d.doc_type}</td><td>${d.doc_type || ''}</td>` +
      `<td>${new Date(d.expiry_date).toLocaleDateString()}</td>` +
      `<td style="color:${d.days < 90 ? '#dc2626' : '#d97706'}">${d.days} days</td></tr>`
    ).join('')

    await resend.emails.send({
      from: 'Voyager <alerts@your-domain.com>',
      to: fam.alert_email,
      subject: `✈️ ${soon.length} travel document(s) expiring soon`,
      html: `<h2>Documents needing attention</h2>
        <table cellpadding="8" style="border-collapse:collapse">
          <tr><th align="left">Document</th><th align="left">Type</th><th align="left">Expires</th><th align="left">In</th></tr>
          ${rows}
        </table>
        <p style="color:#64748b;font-size:13px">Remember: some countries require a passport valid 6 months beyond travel.</p>`
    })
    sent++
  }

  res.status(200).json({ ok: true, familiesNotified: sent })
}
