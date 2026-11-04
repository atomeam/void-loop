// The free API bots' own relay (bots/api-bots.js): GET /api/apibot?id=<api id>&q=<the bot's input> -> the API's own reply, passed through.
// A few free APIs answer fine but send no CORS header, so a browser on a-to-mind.com may not read them (xkcd, Fruityvice). Rather than leave
// those bots dead, Verse's server asks for the browser: same origin for the page, no CORS needed.
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED. This is an open GET, not an open proxy:
//   - the caller names an API id from a closed list (the APIS entries marked via: 'verse'), never a host, path or header; the address is
//     built by that bot's own url() and must stay on the host its sample address uses, or it is refused;
//   - one fetch, 6 second timeout, at most 200,000 characters read, no redirects followed, no cookies or keys sent;
//   - 30 cache misses a minute per connection (rateLimited(), its own bucket) on top of the guard's limits; a good answer is kept on the
//     edge for ten minutes per address, a failed one is never kept.
import { rateLimited } from './answer.js';
import { APIS } from '../../bots/api-bots.js';

export const RL_MAX = 30, TTL = 600, TIMEOUT_MS = 6000, MAX_CHARS = 200000;
const json = (o, status = 200) => Response.json(o, { status, headers: { 'cache-control': 'no-store' } });
/** the APIs this relay serves: only those marked via 'verse'. Pure. */
export const RELAYED = APIS.filter((a) => a.via === 'verse');
/** the address to fetch for an id and an input, or null when the id is not relayed or the address leaves the API's own host. Pure. */
export function relayAddress(id, q) {
  const a = RELAYED.find((x) => x.id === id); if (!a) return null;
  let u, home; try { u = new URL(a.url(String(q || a.sample).slice(0, 200))); home = new URL(a.url(a.sample)); } catch (_) { return null; }
  return u.protocol === 'https:' && u.host === home.host ? u.href : null;
}
export async function onRequestGet({ request, env, fetchFn = fetch }) {
  const p = new URL(request.url).searchParams, id = String(p.get('id') || ''), url = relayAddress(id, p.get('q'));
  if (!url) return json({ ok: false, kind: 'unknown', say: 'That API is not one Verse relays.', relayed: RELAYED.map((a) => a.id) }, 404);
  const cache = typeof caches !== 'undefined' ? caches.default : null, key = new Request(new URL(request.url).origin + '/__void-apibot/' + encodeURIComponent(url));
  if (cache) { try { const hit = await cache.match(key); if (hit) return hit; } catch (_) {} }
  if (await rateLimited(request, env || {}, 'apibot', RL_MAX)) return json({ ok: false, kind: 'limited', say: 'That is a lot of calls in a minute. Give it a moment.' }, 429);
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetchFn(url, { signal: ctl.signal, redirect: 'manual', headers: { accept: 'application/json', 'user-agent': 'Verse bots (+https://a-to-mind.com/bots/)' } });
    if (r.status !== 200) return json({ ok: false, kind: 'away', say: 'The API answered ' + r.status + '.' }, 502);
    const body = (await r.text()).slice(0, MAX_CHARS);
    const out = new Response(body, { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=' + TTL, 'x-relayed-from': new URL(url).host } });
    if (cache) { try { await cache.put(key, out.clone()); } catch (_) {} }
    return out;
  } catch (_) { return json({ ok: false, kind: 'away', say: 'The API did not answer in time.' }, 504); } finally { clearTimeout(timer); }
}
