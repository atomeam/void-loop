// /api/media?kind=music&title=Hey+Jude&artist=The+Beatles: is this real, and what can be played of it legally (skills/media-pick.js; lib/media.js).
// One door for every kind; each kind is an adapter. Movies stay at /api/movies (functions/api/movies.js) and are reached from here too.
// Show: TVMaze (keyless): poster, summary, seasons and episodes, official site; it links out, nothing is streamed.
// Music: the iTunes Search API (keyless): track, artist, album, art and the 30 s official preview, played in an <audio>; the full song links out
// to Apple Music / Spotify / Bandcamp searches, never a full stream. The title is untrusted: cleaned before any request, the upstream host is fixed
// here. Not found = { verified: false } with nothing else, never a guess. No D1, no KV, no model; the edge caches an answer for a day.
import { cleanTitle, normTitle, pickSong, listenLinks, pickShow, showLinks, showAvailability } from '../../lib/media.js';
import { cleanYear } from '../../lib/movies.js';
import { lookup as movie } from './movies.js';
const UA = { 'user-agent': 'V01D/1.0 (+https://a-to-mind.com)', accept: 'application/json' };
async function getJson(u, ms = 5000) { const c = new AbortController(), t = setTimeout(() => c.abort(), ms); try { const r = await fetch(u, { headers: UA, signal: c.signal, cf: { cacheTtl: 86400 } }); if (!r.ok) throw new Error('upstream ' + r.status); return await r.json(); } finally { clearTimeout(t); } }
const reply = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=86400' } });

export async function music(title, artist) {
  const j = await getJson('https://itunes.apple.com/search?media=music&entity=song&limit=15&country=us&term=' + encodeURIComponent((title + ' ' + artist).trim())).catch(() => null);
  const s = j && pickSong(j.results, title, artist);
  if (!s) return { verified: false, title, artist };
  return { verified: true, ...s, links: listenLinks(s.title, s.artist, s.store), sources: ['iTunes Search API'] };
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
  const res = reply(await ADAPTERS[kind]({ title, artist, year: cleanYear(q.get('year')), viewer }));
  if (kind === 'show') res.headers.set('cache-control', 'private, max-age=3600');
  return res;
}
