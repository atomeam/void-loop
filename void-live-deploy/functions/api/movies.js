// /api/movies?title=Talk+to+Me&year=2022: is this a real movie, and what can be played of it legally (skills/movie.js; lib/movies.js).
// Sources, all keyless: the iTunes Search API (poster, overview, official trailer, store link) and the Internet Archive (public-domain,
// Creative Commons and Blender open movies, played in a <video>). The title is untrusted: cleaned before any request, and the upstream hosts
// are fixed here. Not found = { verified: false } with nothing else, never a guess. No D1, no KV, no model; the edge caches an answer for a day.
import { cleanTitle, cleanYear, pickItunes, legalArchive, pickFile, archiveFileUrl, watchLinks, normTitle } from '../../lib/movies.js';
const UA = { 'user-agent': 'Verse/1.0 (+https://a-to-mind.com)', accept: 'application/json' };
async function getJson(u, ms = 5000) { const c = new AbortController(), t = setTimeout(() => c.abort(), ms); try { const r = await fetch(u, { headers: UA, signal: c.signal, cf: { cacheTtl: 86400 } }); if (!r.ok) throw new Error('upstream ' + r.status); return await r.json(); } finally { clearTimeout(t); } }
const reply = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=86400' } });

export async function lookup(title, year) {
  const [it, ar] = await Promise.all([
    getJson('https://itunes.apple.com/search?media=movie&entity=movie&limit=15&country=us&term=' + encodeURIComponent(title)).then((j) => pickItunes(j.results, title, year)).catch(() => null),
    getJson('https://archive.org/advancedsearch.php?q=' + encodeURIComponent('title:("' + title.replace(/"/g, '') + '") AND mediatype:movies') + '&fl[]=identifier&fl[]=title&fl[]=year&fl[]=licenseurl&fl[]=collection&fl[]=creator&sort[]=downloads+desc&rows=10&output=json')
      .then((j) => ((j.response && j.response.docs) || []).find((d) => legalArchive(d, title, year)) || null).catch(() => null),
  ]);
  if (!it && !ar) return { verified: false, title, year };
  let play = null;
  if (ar) {
    const id = ar.identifier, file = await getJson('https://archive.org/metadata/' + encodeURIComponent(id) + '/files').then((j) => pickFile(j.result)).catch(() => '');
    play = file ? { kind: 'video', src: archiveFileUrl(id, file), id, page: 'https://archive.org/details/' + id, license: 'public domain / Creative Commons, from the Internet Archive' }
      : { kind: 'embed', src: 'https://archive.org/embed/' + id, id, page: 'https://archive.org/details/' + id, license: 'public domain / Creative Commons, from the Internet Archive' };
  }
  const one = (v) => String(Array.isArray(v) ? v[0] : v || '');
  const name = (it && it.title) || cleanTitle(one(ar.title)), yr = (it && it.year) || cleanYear(one(ar && ar.year).slice(0, 4)) || year;
  return {
    verified: true, title: name, year: yr, genre: it ? it.genre : '', rating: it ? it.rating : '', director: it ? it.director : '', runtime: it ? it.runtime : null, overview: it ? it.overview : '',
    poster: it ? it.poster : ar ? 'https://archive.org/services/img/' + encodeURIComponent(ar.identifier) : '', trailer: it ? it.trailer : '',
    price: it ? it.price : null, rentPrice: it ? it.rentPrice : null, currency: it ? it.currency : '',
    play, free: !!play, links: watchLinks(name, yr, it ? it.store : ''), sources: [it && 'iTunes Search API', ar && 'Internet Archive'].filter(Boolean),
  };
}
export async function onRequestGet({ request }) {
  const q = new URL(request.url).searchParams, title = cleanTitle(q.get('title')), year = cleanYear(q.get('year'));
  if (!title || !normTitle(title)) return reply({ error: 'send ?title=' }, 400);
  return reply(await lookup(title, year));
}
