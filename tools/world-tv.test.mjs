// /local/'s world lists (owner, 2026-10-30: "also find all free channels worldwide and add"): the TV tables (tools/world-tv.mjs), the radio
// page of /api/local?world (functions/api/local.js) and the page module's pure parts (local/world.js)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildWorld, worldFiles } from './world-tv.mjs';
import { playableStream } from '../void-live-deploy/lib/local-media.js';
import { askIn, worldPath, lookWorld, onRequestGet, WORLD_PAGE } from '../void-live-deploy/functions/api/local.js';
import { pickTv, countryOrder } from '../void-live-deploy/local/world.js';

const ch = (id, country, more = {}) => ({ id, name: id.split('.')[0], alt_names: '', network: '', owners: '', country, categories: 'news', is_nsfw: 'FALSE', launched: '', closed: '', replaced_by: '', website: 'https://' + id.split('.')[0].toLowerCase() + '.example.com/', ...more });
const fd = (channel, id, area, more = {}) => ({ channel, id, name: id, alt_names: '', is_main: 'TRUE', broadcast_area: area, timezones: '', languages: 'eng', format: '', ...more });
const ent = (id, feed, url, more = {}) => ({ id, feed, url, referrer: false, ua: false, ...more });

test('the world table keeps every non-local channel with a stream that plays here, by country and by topic', () => {
  const channels = [ch('News1.us', 'US', { categories: 'news;weather' }), ch('Local.us', 'US'), ch('Brit.uk', 'UK', { categories: 'movies' }), ch('Blocked.fr', 'FR'),
    ch('Adult.de', 'DE', { is_nsfw: 'TRUE' }), ch('Gone.es', 'ES', { closed: '2020-01-01' }), ch('Ref.it', 'IT'), ch('Plain.it', 'IT', { website: '' }), ch('Sea.int', '')];
  const feeds = [fd('News1.us', 'SD', 'c/US'), fd('Local.us', 'KABC', 'ct/USLAX'), fd('Brit.uk', 'HD', 'c/UK'), fd('Ref.it', 'SD', 'c/IT'), fd('Plain.it', 'SD', 'c/IT', { languages: 'ita' }), fd('Sea.int', 'SD', 'r/INT')];
  const entries = [
    ent('News1.us', 'SD', 'https://a.example.com/x.mpd'), ent('News1.us', 'SD', 'https://a.example.com/news.m3u8'), ent('News1.us', '', 'https://b.example.com/news.m3u8'),
    ent('News1.us', 'SD', 'https://c.example.com/1.m3u8'), ent('News1.us', 'SD', 'https://d.example.com/2.m3u8'),
    ent('Local.us', 'KABC', 'https://e.example.com/kabc.m3u8'), ent('Local.us', '', 'https://e.example.com/main.m3u8'),
    ent('Brit.uk', 'HD', 'https://f.example.com/brit.m3u8'), ent('Blocked.fr', '', 'https://g.example.com/b.m3u8'), ent('Adult.de', '', 'https://h.example.com/a.m3u8'),
    ent('Gone.es', '', 'https://i.example.com/g.m3u8'), ent('Ref.it', 'SD', 'https://j.example.com/r.m3u8', { referrer: true }), ent('Plain.it', 'SD', 'http://k.example.com/p.m3u8'),
    ent('Plain.it', 'SD', 'https://10.0.0.1/p.m3u8'), ent('Sea.int', 'SD', 'https://l.example.com/s.m3u8'), ent('', '', 'https://m.example.com/nobody.m3u8'), ent('Unknown.zz', '', 'https://n.example.com/u.m3u8'),
  ];
  const w = buildWorld({ channels, feeds, blocklist: [{ channel: 'Blocked.fr' }], categories: [{ id: 'news', name: 'News' }, { id: 'movies', name: 'Movies' }],
    countries: [{ code: 'US', name: 'United States' }, { code: 'UK', name: 'United Kingdom' }], entries, commits: { database: 'abc', iptv: 'def' } });
  assert.deepEqual(Object.keys(w.countries).sort(), ['GB', 'INT', 'US'], 'UK is written as GB; a channel with no country is international; blocked, nsfw, closed, referrer-only and unplayable channels are out');
  const us = w.countries.US.channels;
  assert.deepEqual(us.map((c) => c.id), ['News1.us@SD'], 'the local feed is the local table\'s; a playlist line without a feed is the main feed');
  assert.equal(us[0].s.length, 3, 'at most three streams'); assert.match(us[0].s[0], /\.m3u8$/); assert.ok(!us[0].s.slice(0, 2).some((u) => /\.mpd$/.test(u)), 'HLS before DASH');
  assert.deepEqual(us[0].c, ['news', 'weather']); assert.deepEqual(us[0].l, ['eng']); assert.equal(us[0].w, 'https://news1.example.com/');
  assert.deepEqual(w.index.countries.GB, { name: 'United Kingdom', n: 1 }); assert.deepEqual(w.index.countries.INT, { name: 'International', n: 1 });
  assert.deepEqual(w.index.topics.news, { name: 'News', n: 2 }); assert.equal(w.index.topics.weather.name, 'weather', 'a topic without a name keeps its id');
  assert.equal(w.topics.news.channels.find((c) => c.id === 'News1.us@SD').cc, 'US', 'a topic row says its country');
  assert.deepEqual(w.names, [['Brit.uk@HD', 'Brit', '', 'GB'], ['News1.us@SD', 'News1', '', 'US'], ['Sea.int@SD', 'Sea', '', 'INT']]);
  assert.equal(w.index.total, 3); assert.deepEqual(w.index.from.commits, { database: 'abc', iptv: 'def' });
  const files = worldFiles(w);
  assert.deepEqual(Object.keys(files).sort(), ['GB.json', 'INT.json', 'US.json', 'index.json', 'names.json', 'topic/movies.json', 'topic/news.json', 'topic/weather.json']);
  for (const t of Object.values(files)) { JSON.parse(t); assert.ok(t.endsWith('\n')); }
});

test('the committed world table is whole: every country and topic in its index has its file, every stream plays here, and it stays small', () => {
  const dir = new URL('../void-live-deploy/local/tv/world/', import.meta.url), index = JSON.parse(fs.readFileSync(new URL('index.json', dir), 'utf8'));
  assert.ok(index.total > 1000, 'thousands of channels'); assert.ok(Object.keys(index.countries).length > 100); assert.ok(!index.countries.UK, 'the United Kingdom is GB');
  let bytes = 0, n = 0; const local = new Set();
  for (const f of fs.readdirSync(new URL('../void-live-deploy/local/tv/', import.meta.url))) if (/^[A-Z]{2}\.json$/.test(f)) for (const s of JSON.parse(fs.readFileSync(new URL('../void-live-deploy/local/tv/' + f, import.meta.url), 'utf8')).stations) local.add(s.id);
  for (const cc of Object.keys(index.countries)) {
    const t = fs.readFileSync(new URL(cc + '.json', dir), 'utf8'); bytes += t.length; const f = JSON.parse(t);
    assert.equal(f.channels.length, index.countries[cc].n, cc);
    for (const c of f.channels) { n++; assert.ok(c.s.length >= 1 && c.s.length <= 3, c.id); for (const u of c.s) assert.ok(playableStream(u), c.id + ' ' + u); assert.ok(!local.has(c.id), 'a local station is listed once, locally: ' + c.id); }
  }
  assert.equal(n, index.total);
  for (const k of Object.keys(index.topics)) assert.equal(JSON.parse(fs.readFileSync(new URL('topic/' + k + '.json', dir), 'utf8')).channels.length, index.topics[k].n, k);
  assert.equal(JSON.parse(fs.readFileSync(new URL('names.json', dir), 'utf8')).length, index.total);
  assert.ok(bytes < 15e6, 'the country files stay under 15 MB');
});

test('/api/local?world asks Radio Browser for one page of stations by country, topic or name, and keeps only the ones that play here', async () => {
  const u = (q) => 'https://a-to-mind.com/api/local' + q;
  assert.deepEqual(askIn(u('?world')), { kind: 'world', country: '', tag: '', q: '', offset: 0 });
  assert.deepEqual(askIn(u('?world&country=fr&tag=News&q=Inter&offset=50')), { kind: 'world', country: 'FR', tag: 'news', q: 'Inter', offset: 50 });
  for (const bad of ['?world&country=FRA', '?world&tag=<b>', '?world&q=' + 'a'.repeat(61), '?world&offset=7', '?world&offset=-50', '?world&offset=99999']) assert.equal(askIn(u(bad)), null, bad);
  assert.equal(worldPath({ country: 'FR', tag: 'hip hop', q: 'Inter', offset: 50 }), '/json/stations/search?hidebroken=true&order=votes&reverse=true&limit=' + WORLD_PAGE + '&offset=50&countrycode=FR&tag=hip%20hop&tagExact=true&name=Inter');
  assert.equal(worldPath({ country: '', tag: '', q: '', offset: 0 }), '/json/stations/search?hidebroken=true&order=votes&reverse=true&limit=' + WORLD_PAGE + '&offset=0');
  const row = (i, url) => ({ stationuuid: 'id-' + i, name: 'Station ' + i, url_resolved: url, homepage: 'https://s' + i + '.example.com/', votes: 100 - i });
  const full = Array.from({ length: WORLD_PAGE }, (_, i) => row(i, i % 10 === 0 ? 'http://1.2.3.4:8000/live' : 'https://s' + i + '.example.com/live'));
  let asked = ''; const out = await lookWorld({ country: 'FR', tag: '', q: '', offset: 0 }, async (url) => { asked = url; return Response.json(full); });
  assert.match(asked, /^https:\/\/de1\.api\.radio-browser\.info\/json\/stations\/search\?/);
  assert.equal(out.ok, true); assert.equal(out.stations.length, WORLD_PAGE - 5, 'a stream that cannot play here is left out'); assert.equal(out.next, WORLD_PAGE);
  const last = await lookWorld({ country: '', tag: 'jazz', q: '', offset: 100 }, async () => Response.json(full.slice(0, 3)));
  assert.equal(last.next, null, 'a short page is the last');
  assert.deepEqual(await lookWorld({ country: '', tag: '', q: '', offset: 0 }, async () => new Response('x', { status: 500 })), { ok: false, kind: 'away' });
  const res = await onRequestGet({ request: new Request(u('?world&country=FR')), env: {}, fetchFn: async () => Response.json(full.slice(1, 3)) });
  assert.equal(res.status, 200); const j = await res.json(); assert.equal(j.stations.length, 2); assert.equal(j.next, null);
});

test('the page module narrows a TV list by topic and name, and lists the visitor\'s own country first', () => {
  const rows = [{ t: 'Euronews', c: ['news'] }, { t: 'France 24', n: 'France Médias', c: ['news'] }, { t: 'Cartoon', c: ['kids'] }];
  assert.deepEqual(pickTv({ rows, topic: 'news' }).map((r) => r.t), ['Euronews', 'France 24']);
  assert.deepEqual(pickTv({ rows, q: 'france médias' }).map((r) => r.t), ['France 24'], 'the name or the network');
  assert.deepEqual(pickTv({ rows, topic: 'kids', q: 'euro' }), []);
  assert.deepEqual(countryOrder({ AR: { name: 'Argentina', n: 2 }, US: { name: 'United States', n: 9 }, BE: { name: 'Belgium', n: 1 } }, 'US').map((c) => c.cc), ['US', 'AR', 'BE']);
  assert.deepEqual(countryOrder({ AR: { name: 'Argentina', n: 2 }, BE: { name: 'Belgium', n: 1 } }, '').map((c) => c.cc), ['AR', 'BE']);
});
