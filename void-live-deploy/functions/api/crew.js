// GET /api/crew: Verse's crew on /team/ and Verse's own wants (lib/team-crew-run.js crewView), for /team/ and /brain/.
// WHAT A STRANGER COULD MAKE THIS DO: nothing but read. Open GET, no input; a few fixed D1 reads; a private want (missed asks, sales) shows
// no number and no source. Cached at the edge for 60 s.
import { crewView } from '../../lib/team-crew-run.js';

const json = (o, status = 200) => Response.json(o, { status, headers: { 'cache-control': status === 200 ? 'public, max-age=60' : 'no-store', 'x-robots-tag': 'noindex' } });
export async function onRequestGet({ env }) {
  try { return json(await crewView(env)); } catch (_) { return json({ ok: false, say: 'the crew did not answer' }, 503); }
}
