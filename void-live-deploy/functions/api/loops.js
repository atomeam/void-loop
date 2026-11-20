// GET /api/loops: every loop Verse runs, for the owner only (anyone else gets the same answer as a missing page). The census is written
// every 3 hours by the conductor's tick (tools/loop-census.mjs) into its record on the conductor-state branch, with the catch-up clock's
// starts (tools/catchup-core.mjs); this reads that record from GitHub's raw host (which answers Cloudflare) and passes on the census and
// the clock's last 24 hours. Read only, no input. Cached at the edge for 5 minutes.
import { ownerGate } from '../../lib/owner-gate.js';

export const RAW = 'https://raw.githubusercontent.com/atomeam/void-loop/conductor-state/domains/conductor.json';
const NO = () => new Response('no', { status: 404, headers: { 'cache-control': 'no-store' } });

/** what the owner sees from the conductor's record. Pure. */
export function loopsOf(record) {
  const r = record && typeof record === 'object' ? record : {};
  const ticks = Array.isArray(r.ticks) ? r.ticks : [];
  const caught = ticks.flatMap((t) => (t.catchup || []).map((wf) => ({ at: t.at, wf })));
  const cancelled = ticks.flatMap((t) => (t.cancelled || []).map((x) => ({ at: t.at, run: x })));
  return { updated: r.updated || null, census: r.census || null, clock: { ticks24: ticks.length, caughtUp24: caught.length, caught: caught.slice(-40), cancelled24: cancelled.length }, broken: r.broken || [] };
}

export async function onRequestGet({ request, env }, fetchFn = fetch) {
  if (!(await ownerGate(request, env))) return NO();
  let record = null;
  try { const r = await fetchFn(RAW, { cf: { cacheTtl: 300 } }); if (r.ok) record = await r.json(); } catch (_) { record = null; }
  if (!record) return Response.json({ error: 'the conductor record did not answer' }, { status: 502, headers: { 'cache-control': 'no-store' } });
  return Response.json(loopsOf(record), { headers: { 'cache-control': 'private, max-age=60' } });
}
