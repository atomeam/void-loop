// /api/media?kind=music&title=Hey+Jude&artist=The+Beatles: is this real, and what can be played of it legally (skills/media-pick.js; lib/media.js).
// One door for every kind; each kind is an adapter. Movies stay at /api/movies (functions/api/movies.js) and are reached from here too.
// Show: TVMaze (keyless): poster, summary, seasons and episodes, official site; it links out, nothing is streamed.
// Music: the iTunes Search API (keyless): track, artist, album, art and the 30 s official preview, played in an <audio>; the full song links out
// to Apple Music / Spotify / Bandcamp searches, never a full stream. The title is untrusted: cleaned before any request, the upstream host is fixed
// here. Not found = { verified: false } with nothing else, never a guess. No D1, no KV, no model; the edge caches an answer for a day.
import { cleanTitle, normTitle, pickSong, pickDeezerSong, listenLinks, pickShow, showLinks, showAvailability } from '../../lib/media.js';
import { cleanYear } from '../../lib/movies.js';
import { lookup as movie } from './movies.js';
const UA = { 'user-agent': 'Verse/1.0 (+https://a-to-mind.com)', accept: 'application/json' };
async function getJson(u, ms = 5000) { const c = new AbortController(), t = setTimeout(() => c.abort(), ms); try { const r = await fetch(u, { headers: UA, signal: c.signal, cf: { cacheTtlByStatus: { '200-299': 86400, '300-599': 0 } } }); if (!r.ok) throw new Error('upstream ' + r.status); return await r.json(); } finally { clearTimeout(t); } }
const reply = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=86400' } });

// owner, 2026-10-19: "I could not reach the music source just now". iTunes throttles shared cloud addresses, and a refusal used to come back as
// "not verified", cached for a day: one blip and that song failed all day. Now a second keyless source (Deezer) is asked when iTunes is away or does
// not know the song, and when neither could be reached the answer says so (unreachable) and is never cached (here, at the edge or upstream).
export async function music(title, artist, get = getJson) {
  const term = encodeURIComponent((title + ' ' + artist).trim());
  const it = await get('https://itunes.apple.com/search?media=music&entity=song&limit=15&country=us&term=' + term).catch(() => null);
  const a = it && pickSong(it.results, title, artist);
  if (a) return { verified: true, ...a, links: listenLinks(a.title, a.artist, a.store), sources: ['iTunes Search API'] };
  const dz = await get('https://api.deezer.com/search?limit=15&q=' + term).catch(() => null);
  const d = dz && pickDeezerSong(dz.data, title, artist);
  if (d) return { verified: true, ...d, links: listenLinks(d.title, d.artist, ''), sources: ['Deezer API'] };
  return it || dz ? { verified: false, title, artist } : { verified: false, unreachable: true, title, artist };
}
export async function show(title, year, viewer = '') {
  const j = await getJson('https://api.tvmaze.com/singlesearch/shows?embed=seasons&q=' + encodeURIComponent(title)).catch(() => null);
  const s = pickShow(j, title, year);
  if (!s) return { verified: false, title, year };
  const av = showAvailability(s, viewer), ok = av.state === 'ok';
  return { verified: true, ...s, availability: av.state, why: av.why, links: showLinks(s.title, s.year, s.site, s.page, !ok), sources: ['TVMaze'] };
}
export const ADAPTERS = { show: (q) => show(q.title, q.year, q.viewer), music: (q) => music(q.title, q.artist), movie: (q) => movie(q.title, q.year) };
export async function onRequestGet({ request }) {
  const q = new URL(request.url).searchParams, kind = String(q.get('kind') || ''), title = cleanTitle(q.get('title')), artist = cleanTitle(q.get('artist'));
  if (!ADAPTERS[kind]) return reply({ error: 'kind is one of ' + Object.keys(ADAPTERS).join(', ') }, 400);
  if (!title || !normTitle(title)) return reply({ error: 'send ?title=' }, 400);
  // a show's availability depends on where the viewer is (Cloudflare's country header), so that answer is cached privately, not at the edge
  const viewer = kind === 'show' ? String((request.cf && request.cf.country) || request.headers.get('cf-ipcountry') || '') : '';
  const out = await ADAPTERS[kind]({ title, artist, year: cleanYear(q.get('year')), viewer });
  // no source could be reached: a 503 the edge never keeps, so the next ask tries again instead of reading a day-old failure
  if (out && out.unreachable) { const r = reply(out, 503); r.headers.set('cache-control', 'no-store'); return r; }
  const res = reply(out);
  if (kind === 'show') res.headers.set('cache-control', 'private, max-age=3600');
  return res;
}
