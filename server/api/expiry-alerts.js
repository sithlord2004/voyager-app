// GET /api/expiry-alerts — daily cron: emails + push notifications for
// expiring documents, travel-advisory changes, and the day's travel.
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { fetchAdvisory } from '../lib/fcdo.js'
import { pushToFamily } from '../lib/push.js'
import { timezoneFor, nowIn } from '../lib/localtime.js'
import { once } from '../lib/notifyLog.js'

// When (in the traveller's own local time) the daily notifications should land.
const BRIEFING_HOUR = 8
const HOUR_WINDOW = 2   // 08:00–09:59 local, so an hourly job still catches it

// Scheduled departure time for a flight (best-effort; used to enrich the
// travel-day notification).
async function fetchFlight(number, date) {
  if (!process.env.AERODATABOX_KEY) return null
  const r = await fetch(`https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(number)}/${date}`, {
    headers: {
      'X-RapidAPI-Key': process.env.AERODATABOX_KEY,
      'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com'
    }
  })
  if (!r.ok) return null
  const arr = await r.json()
  const f = Array.isArray(arr) ? arr[0] : arr
  if (!f) return null
  return {
    departure: {
      scheduled: f.departure?.scheduledTime?.local,
      revised: f.departure?.revisedTime?.local
    }
  }
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const resend = new Resend(process.env.RESEND_API_KEY)
// Passports get a full year's warning: many countries require six months'
// validity beyond travel, and renewals take time. Everything else: six months.
const PASSPORT_WINDOW = 365
const OTHER_WINDOW = 180

// The cron runs daily, so without this we'd nag every single day for months.
// Instead we speak up only at these countdown milestones.
const MILESTONES = [365, 270, 180, 120, 90, 60, 30, 14, 7, 1]

const isPassport = d => /passport/i.test(d.doc_type || '')
const windowFor = d => (isPassport(d) ? PASSPORT_WINDOW : OTHER_WINDOW)

function daysUntil(dateStr) {
  return Math.round((new Date(dateStr) - new Date()) / 86400000)
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()

  const auth = req.headers.authorization || ''
  const isCron = auth === 'Bearer ' + process.env.CRON_SECRET
    || (req.query && req.query.key === process.env.CRON_SECRET)
  // "Check now" from the app: authenticated with the sync token, scoped to one
  // family, and it ignores the milestone schedule so you see the current state.
  const manualFamily = auth === 'Bearer ' + process.env.SYNC_TOKEN ? (req.query?.familyId || '') : ''
  const force = !!manualFamily

  if (!force && process.env.CRON_SECRET && !isCron) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  let families, fErr
  if (force) {
    // Use the family's alert row if it exists; otherwise push-only (no email).
    const { data } = await supabase.from('families').select('*').eq('family_id', manualFamily).maybeSingle()
    families = [data || { family_id: manualFamily, alert_email: null }]
  } else {
    ({ data: families, error: fErr } = await supabase.from('families').select('*'))
  }
  if (fErr) return res.status(500).json({ error: fErr.message })

  const utcDay = new Date().toISOString().slice(0, 10)

  let sent = 0
  for (const fam of families || []) {
    // Pull the owner id out of the JSON payload without dragging the (large,
    // encrypted) document body along with it.
    const { data: docs } = await supabase
      .from('documents')
      .select('doc_type, title, expiry_date, personId:payload->>personId')
      .eq('family_id', fam.family_id)
      .eq('deleted', false)
      .not('expiry_date', 'is', null)

    // Family member names, so an alert can say *whose* passport it is.
    const nameById = {}
    try {
      const { data: peopleRows } = await supabase.from('people')
        .select('payload').eq('family_id', fam.family_id).eq('deleted', false)
      for (const r of (peopleRows || [])) {
        const p = r.payload
        if (p?.id && p.name && !p.deleted) nameById[p.id] = p.name
      }
    } catch { /* names are a nicety */ }
    const ownerOf = d => nameById[d.personId] || ''

    const soon = (docs || [])
      .map(d => ({ ...d, days: daysUntil(d.expiry_date) }))
      .filter(d => d.days >= 0 && d.days <= windowFor(d))
      .sort((a, b) => a.days - b.days)

    // Only the ones hitting a milestone today actually trigger an alert —
    // unless this is a manual "check now", which reports whatever's in range.
    const due = force ? soon : soon.filter(d => MILESTONES.includes(d.days))

    // Push: documents expiring (titles only — never contents).
    if (due.length) {
      const first = due[0]
      const months = Math.round(first.days / 30)
      const when = first.days >= 60 ? `in about ${months} months` : `in ${first.days} days`
      const owner = ownerOf(first)
      const thing = isPassport(first) ? 'passport' : (first.title || first.doc_type || 'document')
      // "Cesca’s passport" when we know the owner, otherwise just "Passport".
      const subject = owner ? `${owner}’s ${thing}` : thing.charAt(0).toUpperCase() + thing.slice(1)
      const others = due.length > 1 ? ` Plus ${due.length - 1} other document${due.length > 2 ? 's' : ''}.` : ''
      await once(fam.family_id, 'expiry', utcDay, () => pushToFamily(fam.family_id, {
        title: `${subject} expires ${when}`,
        body: (isPassport(first)
          ? 'Renew in good time — many countries need 6 months’ validity beyond your travel dates.'
          : `${first.days} days left.`) + others,
        tag: 'voyager-expiry',
        url: '/?view=vault'
      }).catch(() => {}))
    }

    // Push: packing nudge two days out, deep-linked to the packing screen.
    try {
      const { data: tripRows } = await supabase.from('trips')
        .select('payload').eq('family_id', fam.family_id).eq('deleted', false)
      const inTwoDays = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)
      for (const row of (tripRows || [])) {
        const t = row.payload
        if (!t || t.deleted || t.startDate !== inTwoDays) continue

        // How far along is the packing list for this trip? (Packing syncs, so
        // we can skip the nudge entirely when everything's already ticked off.)
        const { data: packRows } = await supabase.from('packing')
          .select('payload').eq('family_id', fam.family_id).eq('deleted', false)
        const items = (packRows || []).map(r => r.payload)
          .filter(p => p && !p.deleted && p.tripId === t.id)
        const total = items.length
        const done = items.filter(p => p.checked).length
        if (total > 0 && done >= total) break   // already packed — say nothing

        await once(fam.family_id, 'packing', utcDay, () => pushToFamily(fam.family_id, {
          title: `${t.destinationCity || 'Your trip'} in 2 days`,
          body: total
            ? `${done} of ${total} packed — finish your list.`
            : 'Time to start your packing list.',
          tag: 'voyager-packing',
          url: '/?view=packing'
        }).catch(() => {}))
        break   // one nudge per family per day
      }
    } catch { /* best-effort */ }

    // Push: morning briefing while a trip is under way — today's plans, or a
    // quiet "day 3 of 6" if nothing's planned. Skipped on a flight day, since
    // the travel-day notice below covers that better.
    try {
      const { data: tripRows } = await supabase.from('trips')
        .select('payload').eq('family_id', fam.family_id).eq('deleted', false)
      const today = new Date().toISOString().slice(0, 10)
      for (const row of (tripRows || [])) {
        const t = row.payload
        if (!t || t.deleted || !t.startDate || !t.endDate) continue
        if (!(t.startDate <= today && today <= t.endDate)) continue

        // Send at ~8am where they actually are, not where the server is. When
        // forced ("check now") we ignore the clock entirely.
        const tz = await timezoneFor(t.destinationCity, t.countryCode)
        const local = nowIn(tz)
        const inWindow = local.hour >= BRIEFING_HOUR && local.hour < BRIEFING_HOUR + HOUR_WINDOW
        if (!force && !inWindow) break

        // A flight today? Let the travel-day push handle it instead.
        const flying = (t.legs || []).some(l =>
          (l.mode || 'flight') === 'flight' && l.number && (l.date || t.startDate) === today)
        if (flying) break

        const { data: planRows } = await supabase.from('plans')
          .select('payload').eq('family_id', fam.family_id).eq('deleted', false)
        const todays = (planRows || []).map(r => r.payload)
          .filter(p => p && !p.deleted && p.tripId === t.id && p.date === today)
          .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))

        const day = Math.round((new Date(today) - new Date(t.startDate)) / 86400000) + 1
        const total = Math.round((new Date(t.endDate) - new Date(t.startDate)) / 86400000) + 1
        const first = todays[0]
        // Once per day, keyed to the traveller's local date.
        await once(fam.family_id, 'briefing', local.date, () => pushToFamily(fam.family_id, {
          title: `Day ${day} of ${total} in ${t.destinationCity || 'your trip'}`,
          body: todays.length
            ? `${first.time ? first.time + ' — ' : ''}${first.title}${todays.length > 1 ? ` (+${todays.length - 1} more today)` : ''}`
            : 'Nothing planned today.',
          tag: 'voyager-today',
          url: '/'
        }).catch(() => {}))
        break
      }
    } catch { /* best-effort */ }

    // Push: travel day — a flight departing today, with its scheduled time.
    try {
      const { data: tripRows } = await supabase.from('trips')
        .select('payload').eq('family_id', fam.family_id).eq('deleted', false)
      const today = new Date().toISOString().slice(0, 10)
      for (const row of (tripRows || [])) {
        const t = row.payload
        if (!t || t.deleted) continue
        const leg = (t.legs || []).find(l =>
          (l.mode || 'flight') === 'flight' && l.number && (l.date || t.startDate) === today)
        if (!leg) continue
        let when = ''
        try {
          const st = await fetchFlight(leg.number, today)
          const dep = st?.departure?.revised || st?.departure?.scheduled
          if (dep) when = ` departs ${String(dep).slice(11, 16)}`
        } catch { /* time is a bonus, not required */ }
        await once(fam.family_id, 'travelday', utcDay, () => pushToFamily(fam.family_id, {
          title: `Travel day — ${leg.number}`,
          body: `${leg.from || ''} → ${leg.to || ''}${when}. Open Voyager for your leave-by time.`,
          tag: 'voyager-travelday',
          url: '/'
        }).catch(() => {}))
        break   // one notice per family per day
      }
    } catch { /* best-effort */ }

    if (due.length && fam.alert_email && !force) {
      const rows = soon.map(d =>
        `<tr><td>${d.title || d.doc_type}</td><td>${ownerOf(d) || '—'}</td><td>${d.doc_type || ''}</td>` +
        `<td>${new Date(d.expiry_date).toLocaleDateString()}</td>` +
        `<td style="color:${d.days < 90 ? '#dc2626' : '#d97706'}">${d.days} days</td></tr>`
      ).join('')

      await resend.emails.send({
        from: 'Voyager <onboarding@resend.dev>',
        to: fam.alert_email,
        subject: `✈️ ${soon.length} travel document(s) expiring soon`,
        html: `<h2>Documents needing attention</h2>
          <table cellpadding="8" style="border-collapse:collapse">
            <tr><th align="left">Document</th><th align="left">Owner</th><th align="left">Type</th><th align="left">Expires</th><th align="left">In</th></tr>
            ${rows}
          </table>
          <p style="color:#64748b;font-size:13px">Remember: some countries require a passport valid 6 months beyond travel.</p>`
      })
      sent++
    }

    // Travel-advisory change check for the family's upcoming trips (best-effort).
    try {
      const { data: tripRows } = await supabase.from('trips').select('payload').eq('family_id', fam.family_id).eq('deleted', false)
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
        const { data: st } = await supabase.from('advisory_state')
          .select('fingerprint').eq('family_id', fam.family_id).eq('country_code', cc).maybeSingle()
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
      }
      if (changes.length && fam.alert_email && !force) {
        const arows = changes.map(({ t, adv }) =>
          `<tr><td>${adv.country || t.destinationCity}</td><td>${adv.levelLabel}</td><td>${adv.changeDescription || 'Advice updated'}</td></tr>`
        ).join('')
        await resend.emails.send({
          from: 'Voyager <onboarding@resend.dev>',
          to: fam.alert_email,
          subject: `⚠️ Travel advice updated for ${changes.length} destination(s)`,
          html: `<h2>Travel advice has changed</h2>
            <table cellpadding="8" style="border-collapse:collapse">
              <tr><th align="left">Destination</th><th align="left">Status</th><th align="left">Latest update</th></tr>
              ${arows}
            </table>
            <p style="color:#64748b;font-size:13px">Source: UK Foreign Office (FCDO). Check the full advice before you travel.</p>`
        })
        sent++
      }
    } catch { /* advisory check is best-effort; never fail the whole cron */ }
  }

  res.status(200).json({ ok: true, familiesNotified: sent })
}
