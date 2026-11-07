// GET /api/sitebench?site=dalyfeds.com -> { at, how, rows: [the site, Verse's /starboard/ page] }, measured live (lib/sitebench.js).
// Only the sites in TARGETS can be measured, so this route fetches no address a caller makes up. A result is kept 10 minutes at the edge,
// so a busy page does not refetch the other site on every visit; ?fresh=1 is ignored for that reason.
import { TARGETS, CACHE_S, bench } from '../../lib/sitebench.js';

const J = (b, s = 200, h = {}) => Response.json(b, { status: s, headers: { 'cache-control': 'no-store', ...h } });

export async function onRequestGet({ request }) {
  const u = new URL(request.url), site = String(u.searchParams.get('site') || 'dalyfeds.com').toLowerCase();
  if (!TARGETS[site]) return J({ error: 'no such site to measure', sites: Object.keys(TARGETS) }, 404);
  const key = new Request(u.origin + '/api/sitebench?site=' + encodeURIComponent(site) + '&v=1');
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  if (cache) { try { const hit = await cache.match(key); if (hit) return new Response(hit.body, { headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-bench': 'cached' } }); } catch (_) {} }
  let out; try { out = await bench(site, u.origin); } catch (e) { return J({ error: 'the benchmark could not run just now' }, 502); }
  const body = JSON.stringify(out);
  if (cache) { try { await cache.put(key, new Response(body, { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=' + CACHE_S } })); } catch (_) {} }
  return new Response(body, { headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-bench': 'live' } });
}
