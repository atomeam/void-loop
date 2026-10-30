#!/usr/bin/env node
// The world TV table behind /local/ (owner, 2026-10-30: "also find all free channels worldwide and add", "keep local as the first options").
// The local table (tools/local-tv.mjs) keeps the feeds made for a city or a region; this one keeps every other channel in the open iptv-org
// database that has a stream a browser can play, under the same rule: https on the standard port, a host name, and no faked referrer or user
// agent. A channel iptv-org blocks, marks nsfw or closed is left out whole, and a local feed is left to the local table.
//
// It writes void-live-deploy/local/tv/world/<CC>.json (one file per country of the channel, read only when the page needs that country),
// world/topic/<category>.json (the same entries by iptv-org category), world/names.json (a small list for search across all of them) and
// world/index.json (countries, categories and counts, the commits read). Nothing is restreamed or proxied: the page plays a kept address
// from where it is, or links the channel's own site.
//
//   node tools/world-tv.mjs                       clone both repos shallow into a temp dir, write the files
//   node tools/world-tv.mjs --db <dir> --iptv <dir>   use copies already on disk
//   node tools/world-tv.mjs --check               fail when a written file would change (nothing is written)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { playableStream, stationTitle } from '../void-live-deploy/lib/local-media.js';
import { csvObjects, m3uEntries } from './local-tv.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'void-live-deploy/local/tv/world');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const LOCAL = /^(?:ct|s)\//;
const isoOf = (cc) => (cc === 'UK' ? 'GB' : /^[A-Z]{2}$/.test(cc) ? cc : 'INT'); // iptv-org writes the United Kingdom as UK; the page and the local table use GB
const hlsFirst = (a, b) => (/\.m3u8(?:$|\?)/i.test(b) ? 1 : 0) - (/\.m3u8(?:$|\?)/i.test(a) ? 1 : 0); // hls.js plays HLS; a DASH (.mpd) address goes last

/** the world tables, built from the parsed sources. Pure: { countries: { CC: file }, topics: { cat: file }, names, index }. */
export function buildWorld({ channels, feeds, blocklist, categories = [], countries: countryRows = [], entries, commits = {} }) {
  const blocked = new Set(blocklist.map((b) => b.channel));
  const chan = new Map(channels.filter((c) => !blocked.has(c.id) && c.is_nsfw !== 'TRUE' && !c.closed).map((c) => [c.id, c]));
  const feedOf = new Map(feeds.map((f) => [f.channel + '@' + f.id, f]));
  const mainOf = new Map(); for (const f of feeds) if (f.is_main === 'TRUE' && !mainOf.has(f.channel)) mainOf.set(f.channel, f);
  const isLocal = (f) => !!f && f.broadcast_area.split(';').some((a) => LOCAL.test(a.trim()));
  // one entry per channel@feed; a playlist line without a feed is the channel's main feed
  const byKey = new Map();
  for (const e of entries) {
    const c = chan.get(e.id); if (!c || e.referrer || e.ua || !playableStream(e.url)) continue;
    const f = e.feed ? feedOf.get(e.id + '@' + e.feed) : mainOf.get(e.id);
    if (isLocal(f)) continue;
    const key = e.id + '@' + (f ? f.id : e.feed || '');
    let x = byKey.get(key);
    if (!x) {
      const t = stationTitle(c, f || { name: e.feed || '' }), cats = c.categories.split(';').map((s) => s.trim()).filter(Boolean);
      const langs = f ? f.languages.split(';').map((s) => s.trim()).filter(Boolean) : [];
      x = { id: key, t: t.title, n: t.network, c: cats, l: langs, w: c.website || '', s: [], cc: c.country || '' };
      byKey.set(key, x);
    }
    if (!x.s.includes(e.url) && x.s.length < 3) x.s.push(e.url);
  }
  const slim = (x) => { const o = { id: x.id, t: x.t }; if (x.n) o.n = x.n; if (x.c.length) o.c = x.c; if (x.l.length) o.l = x.l; if (x.w) o.w = x.w; o.s = [...x.s].sort(hlsFirst); return o; };
  const order = (a, b) => a.t.localeCompare(b.t) || a.id.localeCompare(b.id);
  const all = [...byKey.values()].sort(order);
  const countries = {}, topics = {};
  for (const x of all) {
    const cc = isoOf(x.cc);
    (countries[cc] || (countries[cc] = { cc, channels: [] })).channels.push(slim(x));
    for (const k of x.c) (topics[k] || (topics[k] = { topic: k, channels: [] })).channels.push({ ...slim(x), cc });
  }
  const cname = new Map(countryRows.map((r) => [r.code, r.name])), tname = new Map(categories.map((r) => [r.id, r.name]));
  const index = { from: { iptv: 'https://github.com/iptv-org/iptv', database: 'https://github.com/iptv-org/database', commits }, total: all.length, countries: {}, topics: {} };
  for (const cc of Object.keys(countries).sort()) index.countries[cc] = { name: cc === 'INT' ? 'International' : cname.get(cc) || cname.get(cc === 'GB' ? 'UK' : cc) || cc, n: countries[cc].channels.length };
  for (const k of Object.keys(topics).sort()) index.topics[k] = { name: tname.get(k) || k, n: topics[k].channels.length };
  // search list: [id, title, network, country]; the page loads it only when someone searches
  const names = all.map((x) => [x.id, x.t, x.n || '', isoOf(x.cc)]);
  return { countries, topics, names, index };
}

/** the files to write under world/, keyed by path relative to it. Pure. */
export function worldFiles({ countries, topics, names, index }) {
  return {
    'index.json': JSON.stringify(index, null, 1) + '\n',
    'names.json': JSON.stringify(names) + '\n',
    ...Object.fromEntries(Object.entries(countries).map(([cc, f]) => [cc + '.json', JSON.stringify(f) + '\n'])),
    ...Object.fromEntries(Object.entries(topics).map(([k, f]) => ['topic/' + k + '.json', JSON.stringify(f) + '\n'])),
  };
}

function sources() {
  let db = arg('--db'), iptv = arg('--iptv');
  if (!db || !iptv) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'world-tv-'));
    if (!db) { db = path.join(tmp, 'database'); execFileSync('git', ['clone', '-q', '--depth', '1', 'https://github.com/iptv-org/database.git', db], { timeout: 300e3 }); }
    if (!iptv) { iptv = path.join(tmp, 'iptv'); execFileSync('git', ['clone', '-q', '--depth', '1', 'https://github.com/iptv-org/iptv.git', iptv], { timeout: 300e3 }); }
  }
  const head = (d) => { try { return execFileSync('git', ['-C', d, 'rev-parse', '--short=12', 'HEAD']).toString().trim(); } catch (_) { return ''; } };
  return { db, iptv, commits: { database: head(db), iptv: head(iptv) } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const src = sources(), read = (f) => fs.readFileSync(path.join(src.db, 'data', f), 'utf8');
  const entries = fs.readdirSync(path.join(src.iptv, 'streams')).filter((f) => f.endsWith('.m3u')).sort().flatMap((f) => m3uEntries(fs.readFileSync(path.join(src.iptv, 'streams', f), 'utf8')));
  const built = buildWorld({ channels: csvObjects(read('channels.csv')), feeds: csvObjects(read('feeds.csv')), blocklist: csvObjects(read('blocklist.csv')),
    categories: csvObjects(read('categories.csv')), countries: csvObjects(read('countries.csv')), entries, commits: src.commits });
  const files = worldFiles(built);
  if (process.argv.includes('--check')) {
    const stale = Object.entries(files).filter(([n, t]) => { try { return fs.readFileSync(path.join(OUT, n), 'utf8') !== t; } catch (_) { return true; } }).map(([n]) => n);
    if (stale.length) { console.error('world-tv: ' + stale.length + ' file(s) differ: ' + stale.slice(0, 5).join(', ')); process.exit(1); }
    console.log('world-tv: up to date'); process.exit(0);
  }
  fs.mkdirSync(path.join(OUT, 'topic'), { recursive: true });
  for (const dir of ['', 'topic']) for (const n of fs.readdirSync(path.join(OUT, dir))) { const rel = dir ? dir + '/' + n : n; if (!files[rel] && n.endsWith('.json')) fs.unlinkSync(path.join(OUT, rel)); }
  for (const [n, t] of Object.entries(files)) fs.writeFileSync(path.join(OUT, n), t);
  const bytes = Object.values(files).reduce((a, t) => a + Buffer.byteLength(t), 0);
  console.log('world-tv: ' + built.index.total + ' channels with a stream that plays in the page, ' + Object.keys(built.countries).length + ' countries, '
    + Object.keys(built.topics).length + ' topics, ' + Object.keys(files).length + ' files, ' + bytes + ' bytes');
}
