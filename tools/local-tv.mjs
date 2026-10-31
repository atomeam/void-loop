#!/usr/bin/env node
// The local TV table behind /local/ (owner, 2026-10-30: "Verse should pick up local tv and radio"). Reads the open iptv-org database
// (channels, their feeds and each feed's broadcast area down to a city) and its playlists of publicly posted streams, keeps the feeds that
// are local (a city or a state/region, never a whole country), and writes one file per country: void-live-deploy/local/tv/<CC>.json, plus
// tv/index.json (which countries have a file, how many stations, the commits read). A city gets its place from GeoNames (the cities.json
// package) so the page can sort stations by distance; a city it cannot place is still matched by name and region.
//
// A stream is kept only when the browser can play it straight from its own host: https on the standard port, a host name (never a bare IP
// address, the usual mark of a restream), and no faked referrer or user agent needed. A channel iptv-org blocks (nsfw, dmca), marks nsfw or
// closed is left out whole. Nothing is restreamed or proxied: the page plays a kept address from where it is, or links the station.
//
//   node tools/local-tv.mjs                       clone both repos shallow into a temp dir, write the files
//   node tools/local-tv.mjs --db <dir> --iptv <dir> --cities <cities.json>   use copies already on disk
//   node tools/local-tv.mjs --check               fail when a written file would change (nothing is written)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { playableStream, stationTitle } from '../void-live-deploy/lib/local-media.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'void-live-deploy/local/tv');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };

/** RFC 4180 rows of a CSV text: quoted fields, doubled quotes, commas and newlines inside quotes. Pure. */
export function csvRows(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
    if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; } else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.length > 1 || r[0]);
}
/** a CSV text as objects keyed by its header row. Pure. */
export const csvObjects = (text) => { const [head, ...rows] = csvRows(text); return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? '']))); };
/** the entries of an iptv-org playlist: { id, feed, url, referrer, ua }. Pure. */
export function m3uEntries(text) {
  const out = []; let cur = null;
  for (const line of String(text).split(/\r?\n/)) {
    if (line.startsWith('#EXTINF')) { const m = /tvg-id="([^"]*)"/.exec(line), [ch, feed] = String(m ? m[1] : '').split('@'); cur = { id: ch || '', feed: feed || '', referrer: /http-referrer="[^"]+"/.test(line), ua: /http-user-agent="[^"]+"/.test(line) }; }
    else if (cur && line.startsWith('#EXTVLCOPT:http-referrer')) cur.referrer = true;
    else if (cur && line.startsWith('#EXTVLCOPT:http-user-agent')) cur.ua = true;
    else if (cur && /^https?:\/\//.test(line.trim())) { out.push({ ...cur, url: line.trim() }); cur = null; }
  }
  return out;
}

function sources() {
  let db = arg('--db'), iptv = arg('--iptv'), cities = arg('--cities');
  if (!db || !iptv) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'local-tv-'));
    if (!db) { db = path.join(tmp, 'database'); execFileSync('git', ['clone', '-q', '--depth', '1', 'https://github.com/iptv-org/database.git', db], { timeout: 300e3 }); }
    if (!iptv) { iptv = path.join(tmp, 'iptv'); execFileSync('git', ['clone', '-q', '--depth', '1', 'https://github.com/iptv-org/iptv.git', iptv], { timeout: 300e3 }); }
  }
  if (!cities) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'local-cities-'));
    execFileSync('npm', ['pack', 'cities.json@1.1.65', '-q', '--pack-destination', tmp], { stdio: 'ignore' });
    execFileSync('tar', ['xzf', path.join(tmp, 'cities.json-1.1.65.tgz'), '-C', tmp]); cities = path.join(tmp, 'package/cities.json');
  }
  const head = (d) => { try { return execFileSync('git', ['-C', d, 'rev-parse', '--short=12', 'HEAD']).toString().trim(); } catch (_) { return ''; } };
  return { db, iptv, cities, commits: { database: head(db), iptv: head(iptv) } };
}

/** the tables, built from the parsed sources. Pure: { countries: { CC: file }, index }. */
export function build({ channels, feeds, cities, subdivisions, blocklist, entries, geo, commits = {} }) {
  const blocked = new Set(blocklist.map((b) => b.channel));
  const chan = new Map(channels.filter((c) => !blocked.has(c.id) && c.is_nsfw !== 'TRUE' && !c.closed).map((c) => [c.id, c]));
  const sub = new Map(subdivisions.map((s) => [s.code, s.name])), city = new Map(cities.map((c) => [c.code, c]));
  // GeoNames places for a city: same country, same name; in the US the state code settles a name used in several states
  const byName = new Map(); for (const g of geo) { const k = g.country + '|' + g.name.toLowerCase(); if (!byName.has(k)) byName.set(k, []); byName.get(k).push(g); }
  const placeOf = (c) => {
    const list = byName.get(c.country + '|' + c.name.toLowerCase()) || [], st = c.subdivision.split('-')[1] || '';
    const pick = list.filter((g) => g.admin1 === st); const g = pick.length === 1 ? pick[0] : list.length === 1 ? list[0] : pick[0] || null;
    return g ? [Math.round(+g.lat * 100) / 100, Math.round(+g.lng * 100) / 100] : null;
  };
  const streams = new Map();
  for (const e of entries) {
    if (!e.id || !chan.has(e.id) || e.referrer || e.ua || !playableStream(e.url)) continue;
    const k = e.id + '@' + (e.feed || ''); if (!streams.has(k)) streams.set(k, []); const l = streams.get(k); if (!l.includes(e.url) && l.length < 3) l.push(e.url);
  }
  const countries = {};
  for (const f of feeds) {
    const c = chan.get(f.channel); if (!c) continue;
    const areas = f.broadcast_area.split(';').map((a) => a.trim()).filter((a) => /^(?:ct|s)\//.test(a)); if (!areas.length) continue;
    const s = streams.get(f.channel + '@' + f.id) || (f.is_main === 'TRUE' ? streams.get(f.channel + '@') : null) || [];
    for (const a of areas) {
      const code = a.slice(a.indexOf('/') + 1), cc = a.startsWith('ct/') ? (city.get(code) || {}).country : code.split('-')[0];
      if (!cc) continue;
      const file = countries[cc] || (countries[cc] = { cc, regions: {}, cities: {}, stations: [] });
      if (a.startsWith('ct/')) { const ct = city.get(code); file.cities[code] = [ct.name, ct.subdivision, placeOf(ct)]; if (ct.subdivision && sub.has(ct.subdivision)) file.regions[ct.subdivision] = sub.get(ct.subdivision); }
      else if (sub.has(code)) file.regions[code] = sub.get(code);
      const id = f.channel + '@' + f.id; let st = file.stations.find((x) => x.id === id);
      if (!st) { const t = stationTitle(c, f); st = { id, t: t.title, n: t.network, a: [], w: c.website || '', s }; if (!st.n) delete st.n; if (!st.w) delete st.w; if (!s.length) delete st.s; file.stations.push(st); }
      if (!st.a.includes(a)) st.a.push(a);
    }
  }
  const index = { from: { iptv: 'https://github.com/iptv-org/iptv', database: 'https://github.com/iptv-org/database', places: 'GeoNames (CC BY 4.0) via the cities.json package', commits }, countries: {} };
  for (const [cc, f] of Object.entries(countries).sort(([a], [b]) => a.localeCompare(b))) {
    f.stations.sort((x, y) => (y.s ? 1 : 0) - (x.s ? 1 : 0) || x.t.localeCompare(y.t));
    for (const k of Object.keys(f.cities)) if (!f.cities[k][2]) f.cities[k].length = 2;
    index.countries[cc] = { stations: f.stations.length, playable: f.stations.filter((s) => s.s).length };
  }
  return { countries, index };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const src = sources(), read = (f) => fs.readFileSync(path.join(src.db, 'data', f), 'utf8');
  const entries = fs.readdirSync(path.join(src.iptv, 'streams')).filter((f) => f.endsWith('.m3u')).flatMap((f) => m3uEntries(fs.readFileSync(path.join(src.iptv, 'streams', f), 'utf8')));
  const { countries, index } = build({ channels: csvObjects(read('channels.csv')), feeds: csvObjects(read('feeds.csv')), cities: csvObjects(read('cities.csv')),
    subdivisions: csvObjects(read('subdivisions.csv')), blocklist: csvObjects(read('blocklist.csv')), entries, geo: JSON.parse(fs.readFileSync(src.cities, 'utf8')), commits: src.commits });
  const files = { 'index.json': JSON.stringify(index, null, 1) + '\n', ...Object.fromEntries(Object.entries(countries).map(([cc, f]) => [cc + '.json', JSON.stringify(f) + '\n'])) };
  if (process.argv.includes('--check')) {
    const stale = Object.entries(files).filter(([n, t]) => { try { return fs.readFileSync(path.join(OUT, n), 'utf8') !== t; } catch (_) { return true; } }).map(([n]) => n);
    if (stale.length) { console.error('local-tv: ' + stale.length + ' file(s) differ: ' + stale.slice(0, 5).join(', ')); process.exit(1); }
    console.log('local-tv: up to date'); process.exit(0);
  }
  fs.mkdirSync(OUT, { recursive: true });
  for (const n of fs.readdirSync(OUT)) if (!files[n] && fs.statSync(path.join(OUT, n)).isFile()) fs.unlinkSync(path.join(OUT, n)); // world/ is tools/world-tv.mjs's
  for (const [n, t] of Object.entries(files)) fs.writeFileSync(path.join(OUT, n), t);
  const total = Object.values(index.countries).reduce((a, c) => a + c.stations, 0), play = Object.values(index.countries).reduce((a, c) => a + c.playable, 0);
  console.log('local-tv: ' + Object.keys(countries).length + ' countries, ' + total + ' local stations, ' + play + ' with a stream that plays in the page');
}
