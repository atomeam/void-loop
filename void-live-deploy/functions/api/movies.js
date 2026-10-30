// /api/movies?title=Talk+to+Me&year=2022: is this a real movie, and what can be played of it legally (skills/movie.js; lib/movies.js).
// Sources, all keyless: the iTunes Search API (poster, overview, official trailer, store link), Wikidata (year, director, runtime: the second
// source, asked at the same time, because iTunes refuses shared cloud addresses) and the Internet Archive (public-domain, Creative Commons and
// Blender open movies, played in a <video>). The title is untrusted: cleaned before any request, and the upstream hosts are fixed here.
// Not found = { verified: false } with nothing else, never a guess. When no source could be reached the answer says so (unreachable) and is not
// cached; a found movie is cached for a day. No D1, no KV, no model. Only a 2xx from upstream is cached at the edge.
import { cleanTitle, cleanYear, pickItunes, legalArchive, pickFile, archiveFileUrl, watchLinks, normTitle, WIKIDATA, wikidataQuery, pickWikidata } from '../../lib/movies.js';
const UA = { 'user-agent': 'Verse/1.0 (+https://a-to-mind.com)', accept: 'application/json' };
async function getJson(u, ms = 5000) { const c = new AbortController(), t = setTimeout(() => c.abort(), ms); try { const r = await fetch(u, { headers: UA, signal: c.signal, cf: { cacheTtlByStatus: { '200-299': 86400, '300-599': 0 } } }); if (!r.ok) throw new Error('upstream ' + r.status); return await r.json(); } finally { clearTimeout(t); } }
const reply = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': o.unreachable ? 'no-store' : 'public, max-age=86400' } });
const FAIL = Symbol('unreachable');

export async function lookup(title, year, get = getJson) {
  const ask = (u, pick) => get(u).then(pick, () => FAIL);
  const [it, wd, ar] = await Promise.all([
    ask('https://itunes.apple.com/search?media=movie&entity=movie&limit=15&country=us&term=' + encodeURIComponent(title), (j) => pickItunes(j && j.results, title, year)),
    ask(WIKIDATA + encodeURIComponent(wikidataQuery(title)), (j) => pickWikidata(j, title, year)),
    ask('https://archive.org/advancedsearch.php?q=' + encodeURIComponent('title:("' + title.replace(/"/g, '') + '") AND mediatype:movies') + '&fl[]=identifier&fl[]=title&fl[]=year&fl[]=licenseurl&fl[]=collection&fl[]=creator&sort[]=downloads+desc&rows=10&output=json',
      (j) => ((j && j.response && j.response.docs) || []).find((d) => legalArchive(d, title, year)) || null),
  ]);
  const got = (x) => (x && x !== FAIL ? x : null), i = got(it), w = got(wd), a = got(ar);
  if (!i && !w && !a) return it === FAIL && wd === FAIL && ar === FAIL ? { verified: false, unreachable: true, title, year } : { verified: false, title, year };
  let play = null;
  if (a) {
    const id = a.identifier, file = await get('https://archive.org/metadata/' + encodeURIComponent(id) + '/files').then((j) => pickFile(j && j.result)).catch(() => '');
    play = file ? { kind: 'video', src: archiveFileUrl(id, file), id, page: 'https://archive.org/details/' + id, license: 'public domain / Creative Commons, from the Internet Archive' }
      : { kind: 'embed', src: 'https://archive.org/embed/' + id, id, page: 'https://archive.org/details/' + id, license: 'public domain / Creative Commons, from the Internet Archive' };
  }
  const one = (v) => String(Array.isArray(v) ? v[0] : v || '');
  const name = (i && i.title) || (w && w.title) || cleanTitle(one(a.title)), yr = (i && i.year) || (w && w.year) || cleanYear(one(a && a.year).slice(0, 4)) || year;
  const links = watchLinks(name, yr, i ? i.store : '');
  if (w) links.push({ label: 'Wikidata: the record', url: w.page });
  return {
    verified: true, title: name, year: yr, genre: i ? i.genre : '', rating: i ? i.rating : '', director: (i && i.director) || (w && w.director) || '', runtime: (i && i.runtime) || (w && w.runtime) || null, overview: i ? i.overview : '',
    poster: i ? i.poster : a ? 'https://archive.org/services/img/' + encodeURIComponent(a.identifier) : '', trailer: i ? i.trailer : '',
    price: i ? i.price : null, rentPrice: i ? i.rentPrice : null, currency: i ? i.currency : '',
    play, free: !!play, links, sources: [i && 'iTunes Search API', w && 'Wikidata', a && 'Internet Archive'].filter(Boolean),
  };
}
export async function onRequestGet({ request }) {
  const q = new URL(request.url).searchParams, title = cleanTitle(q.get('title')), year = cleanYear(q.get('year'));
  if (!title || !normTitle(title)) return reply({ error: 'send ?title=' }, 400);
  return reply(await lookup(title, year));
}
