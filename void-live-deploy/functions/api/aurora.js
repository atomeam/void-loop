// GET /api/aurora → { kp, at } from NOAA's planetary K-index, or { kp: null }. Takes no input, writes nothing, spends no model budget; the
// edge cache keeps it to one upstream read per quarter hour however many strangers ask.
import { readKp, FRESH_S } from '../../lib/aurora-feed.js';
export async function onRequestGet({ request, waitUntil }) {
  const cache = typeof caches !== 'undefined' ? caches.default : null, key = new Request(new URL('/api/aurora', request.url).toString());
  if (cache) { const hit = await cache.match(key); if (hit) return hit; }
  const out = await readKp();
  const res = new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=' + (out.kp == null ? 60 : FRESH_S) } });
  if (cache && out.kp != null && waitUntil) waitUntil(cache.put(key, res.clone()));
  return res;
}
