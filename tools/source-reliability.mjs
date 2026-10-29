// Source reliability (asked by Verse, its self-page: "Create a 'source-reliability' metric within the 'Words and the world'
// family to help raise its proven rating."). Most of the Words and the world family answers from someone else's data (Wiktionary,
// Datamuse, TVMaze, Open Library, TheMealDB ...), so how far to trust an answer is how far to trust its source. Copied from how
// Wikipedia rates a claim (WP:RS: a named, published source; a second one to check it against; a record of it being right), read
// off the repo only, never a claim and never a live probe:
//   sources   the outside sites the skill reads or names: every https URL in the skill's file and in the server route it calls
//             (functions/api/<route>.js), grouped by site (api.tvmaze.com and www.tvmaze.com are one source, tvmaze.com)
//   named     the card shows where the answer came from (a class="src" line: "Source: ...", "Read from ...", "Dated sources: ...")
//   second    it has a second outside source to fall back on or check against (two or more sites)
//   answered  a record of the real source answering: a kept live answer (findings/<skill>/*.json, "attempt": "live", "ok": true, the
//             families' fourth kind of evidence). The benchmark's success rate does not count: it stubs outside services ("this
//             measures Verse, not their uptime", tools/bench.mjs), so it says the ask reached the skill, not that the source answered.
// Each is one point (0 to 3). It changes no rating and lowers no bar: the tiers stay tools/families.mjs's. What it adds is the way
// up the existing rules leave open: for each tested or checked skill that reads an outside source, whether one kept live answer from
// that source (a findings/<skill>/ file, tools/rides-live.mjs is the pattern) would make it proven under ratingOf as it stands.
// tools/families.mjs writes it into families.json (each skill's `source`, the family's `sources`); the family-health card shows it.
import { ratingOf } from './families.mjs';

export const SOURCE_FAMILIES = ['words']; // the families the metric is kept for (Verse asked for Words and the world)
// sites that are never a source of an answer: placeholders, XML namespaces, Verse's own site
const NOT_SOURCES = new Set(['example.org', 'example.com', 'w3.org', 'schema.org', 'a-to-mind.com', 'localhost']);
const TWO_PART = /^(?:co|com|org|gov|ac|net|edu)\.[a-z]{2}$/; // bbc.co.uk is a site, co.uk is not

/** the site a host belongs to: api.tvmaze.com -> tvmaze.com, news.bbc.co.uk -> bbc.co.uk. Pure. */
export function siteOf(host) {
  const h = String(host || '').toLowerCase().replace(/\.$/, '');
  const p = h.split('.').filter(Boolean);
  if (p.length < 2) return h;
  return TWO_PART.test(p.slice(-2).join('.')) && p.length >= 3 ? p.slice(-3).join('.') : p.slice(-2).join('.');
}

/** the outside sites named in some code: every https URL's site, sorted, Verse's own and placeholders left out. Pure. */
export function sitesIn(text) {
  const out = new Set();
  for (const m of String(text || '').matchAll(/https:\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)+)/gi)) { const s = siteOf(m[1]); if (s && !NOT_SOURCES.has(s)) out.add(s); }
  return [...out].sort();
}

/** the server routes a skill calls ('/api/movies?...' -> 'movies'); /api/answer is Verse's own model, not an outside source. Pure. */
export function routesIn(text) {
  return [...new Set([...String(text || '').matchAll(/['"`]\/api\/([a-z0-9-]+)/g)].map((m) => m[1]))].filter((r) => r !== 'answer').sort();
}

/** whether the card says where its answer came from: a class="src" line in the skill. Pure. */
export const namesSource = (text) => /class=(?:\\?["'])src\b/.test(String(text || ''));

/** a skill's sources read off the repo: { sites, named, routes }. read: path -> text (throws when missing). Pure apart from the reads. */
export function scanSkill(name, read) {
  let src = ''; try { src = read('void-live-deploy/skills/' + name + '.js'); } catch (_) { return { sites: [], named: false, routes: [] }; }
  const routes = routesIn(src);
  let all = src;
  for (const r of routes) { try { all += '\n' + read('void-live-deploy/functions/api/' + r + '.js'); } catch (_) {} }
  return { sites: sitesIn(all), named: namesSource(src), routes };
}

/** one skill's source reliability from its scan, its families row and its evidence. null when it reads no outside source. Pure.
 *  scan: { sites, named }; row: { tier }; ev: the evidence ratingOf takes (suite, browser, bench, live, liveAt, streak). */
export function reliabilityOf(scan, row = {}, ev = {}, today = new Date().toISOString().slice(0, 10)) {
  const sites = (scan && Array.isArray(scan.sites) ? scan.sites : []).slice(0, 6);
  if (!sites.length) return null;
  const named = !!(scan && scan.named), second = sites.length >= 2;
  const live = +(ev && ev.live) || 0;
  const answered = live > 0; // a kept answer from the real service; the benchmark stubs services, so it never counts here
  const out = { sites, named, second, answered, points: [named, second, answered].filter(Boolean).length };
  // the way up the existing rules leave open: would one kept live answer, dated today, make it proven? (ratingOf decides, unchanged)
  const tier = row && row.tier;
  if (tier && tier !== 'proven' && ratingOf({ ...ev, live: live + 1, liveAt: today }, today).tier === 'proven') out.next = 'live';
  out.words = reliabilityWords(out); // what the family-health card shows
  return out;
}

/** a skill's source reliability in words, for its row on the card. Pure. */
export function reliabilityWords(r) {
  if (!r || !Array.isArray(r.sites) || !r.sites.length) return '';
  const w = ['source ' + r.points + ' of 3: ' + r.sites.slice(0, 3).join(', ') + (r.sites.length > 3 ? ' and ' + (r.sites.length - 3) + ' more' : '')];
  w.push(r.named ? 'named on the card' : 'not named on the card');
  w.push(r.second ? 'a second source' : 'no second source');
  w.push(r.answered ? 'a kept live answer' : 'no kept live answer yet');
  let s = w.join('; ');
  if (r.next === 'live') s += '. One kept live answer from ' + r.sites[0] + ' would make it proven';
  return s;
}

/** the family's summary: how many skills read an outside source, name it, have a second one, have a record; and the ones one
 *  kept live answer would make proven. rows: the family's skill rows, each with its `source`. Pure. */
export function familySources(rows) {
  const r = (rows || []).filter((s) => s && s.source && Array.isArray(s.source.sites) && s.source.sites.length);
  if (!r.length) return null;
  const n = (k) => r.filter((s) => s.source[k]).length;
  const out = { read: r.length, named: n('named'), second: n('second'), answered: n('answered'),
    points: Math.round(r.reduce((t, s) => t + (+s.source.points || 0), 0) / r.length * 100) / 100,
    one_live_from_proven: r.filter((s) => s.source.next === 'live').map((s) => s.name) };
  out.words = familySourcesWords(out); // what the family-health card shows
  return out;
}

/** the family's summary in words, for the top of its list on the card. Pure. */
export function familySourcesWords(f) {
  if (!f || !(f.read > 0)) return '';
  const lift = Array.isArray(f.one_live_from_proven) ? f.one_live_from_proven : [];
  return 'Source reliability: ' + f.read + ' skills answer from outside sources; ' + f.named + ' name the source on the card, ' + f.second + ' have a second source, '
    + f.answered + ' have a kept live answer from it (' + f.points + ' of 3 on average).'
    + (lift.length ? ' One kept live answer each would make ' + lift.length + ' more proven: ' + lift.slice(0, 6).join(', ') + (lift.length > 6 ? ' and ' + (lift.length - 6) + ' more' : '') + '.' : '');
}
