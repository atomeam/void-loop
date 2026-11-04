// GET /api/status: Verse's uptime from its own hourly guards (lib/status.js), for a-to-mind.com/autopilot/#status (/status/ opens it).
// WHAT A STRANGER COULD MAKE THIS DO: nothing but read. Open GET, no input; one fixed D1 read of five fixed guard ids, answered as yes/no and
// times (never a record's text), cached at the edge for 60 s so a burst of visitors costs one read a minute.
import { GUARDS, summarize } from '../../lib/status.js';

export const TTL = 60;
// one fixed query: a ? per fixed guard id (GUARDS), never a value pasted in
const SQL = "SELECT ref, state, result, started FROM void_actions WHERE kind = 'watch.check' AND owner = 'owner' AND ref IN (" + GUARDS.map(() => '?').join(',') + ') AND started >= ? ORDER BY started DESC LIMIT 1000'; // void-review: ok (placeholders only)
const json = (o, status = 200) => Response.json(o, { status, headers: { 'cache-control': status === 200 ? 'public, max-age=60' : 'no-store' } });

export async function readStatus(env, now = Date.now()) {
  if (!env || !env.DB) return { ...summarize([], now), note: 'no database bound' };
  const ids = GUARDS.map((g) => g.id), since = new Date(now - 7 * 864e5).toISOString();
  let rows = [];
  try {
    rows = (await env.DB.prepare(SQL).bind(...ids, since).all()).results || [];
  } catch (_) { return { ...summarize([], now), note: 'the guards\' record did not answer' }; }
  return summarize(rows, now);
}

export async function onRequestGet({ request, env }) {
  const key = new Request(new URL(request.url).origin + '/__verse-status');
  try { const hit = await caches.default.match(key); if (hit) return json({ ...(await hit.json()), cached: true }); } catch (_) {}
  const out = await readStatus(env);
  if (!out.note) try { await caches.default.put(key, new Response(JSON.stringify(out), { headers: { 'cache-control': 'max-age=' + TTL } })); } catch (_) {}
  return json(out);
}
