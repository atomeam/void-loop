// GET /api/filmfind?q=films+by+Kurosawa  (also: find me a sci-fi film from the 80s, film metadata for Ikiru) -> JSON film metadata
// { ask, count, films: [{ title, year, director, runtime_min, genres, plot, source: { name, url } }], sources, note } (lib/film-discovery.js).
// Hostile read (every new unauthenticated endpoint): a stranger can make this send at most MAX_YEARS (10) GETs to one fixed host (itunes.apple.com),
// with a cleaned term of at most 80 characters; it writes nothing, sends nothing, has no D1/KV/model, takes no body. Limit in lib/guard.js
// (filmfind: 20 a minute per connection, body 0) and the edge caches every answer for a day, so repeats cost no upstream call.
import { discover } from '../../lib/film-discovery.js';
const UA = { 'user-agent': 'V01D/1.0 (+https://a-to-mind.com)', accept: 'application/json' };
export async function getJson(u, ms = 5000) {
  if (!/^https:\/\/itunes\.apple\.com\/search\?/.test(u)) throw new Error('host');
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(u, { headers: UA, signal: c.signal, cf: { cacheTtl: 86400 } }); if (!r.ok) throw new Error('upstream ' + r.status); return await r.json(); } finally { clearTimeout(t); }
}
const reply = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': status === 200 && o.count ? 'public, max-age=86400' : 'no-store' } });
export async function onRequestGet({ request }) {
  const q = (new URL(request.url).searchParams.get('q') || '').slice(0, 160);
  if (!q.trim()) return reply({ error: 'send ?q= (for example films by Kurosawa)' }, 400);
  return reply(await discover(q, getJson));
}
