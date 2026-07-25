// GET /api/advisory?cc=JP&name=Japan — returns normalised FCDO travel advice.
import { fetchAdvisory } from '../lib/fcdo.js'

const AUTH = process.env.SYNC_TOKEN
// Optional read-only token (see flight.js) so shared users get advice with no setup.
const READ = process.env.PUBLIC_READ_TOKEN
const authorized = h => h === 'Bearer ' + AUTH || (READ && h === 'Bearer ' + READ)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (!authorized(req.headers.authorization || '')) return res.status(401).json({ error: 'Unauthorized' })

  const { cc, name } = req.query || {}
  try {
    const advisory = await fetchAdvisory(cc, name)
    res.status(200).json({ advisory })
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) })
  }
}
