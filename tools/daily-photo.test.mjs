// The daily picture helper, the photo half: lib/daily-photo.js (the licence filter, the attribution, the context filter, the embeds) and functions/api/daily-art.js (the
// order of the sources, the 429 rule, the caching, the takedown), with canned answers from the sources' real response shapes. Nothing leaves the machine; the real sources
// were NOT reachable when this was written (the sandbox's proxy refuses them), so the shapes follow their documentation. Run: node --test tools/daily-photo.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import * as P from '../void-live-deploy/lib/daily-photo.js';
import * as A from '../void-live-deploy/lib/daily-art.js';
import * as route from '../void-live-deploy/functions/api/daily-art.js';
import { resetGuard } from '../void-live-deploy/lib/guard.js';

const store = new Map();
globalThis.caches = { default: { match: async (req) => (store.has(req.url) ? new Response(store.get(req.url)) : undefined), put: async (req, res) => { store.set(req.url, await res.text()); }, delete: async (req) => store.delete(req.url) } };
function d1() { const db = new DatabaseSync(':memory:'); const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; }, first: async () => db.prepare(sql).get(...a) || null, all: async () => ({ results: db.prepare(sql).all(...a) }) }); return { prepare: (sql) => stmt(sql), raw: db }; }
const JPEG = '/9j/' + 'A'.repeat(12000), KEY = 'owner-key-for-tests-only'; // secret-scan: ok (made-up values for the test)
const today = new Date().toISOString().slice(0, 10);
const Q = 'Arsenal Chelsea Emirates Stadium';
// canned answers in the shapes the documentation gives
const commonsPage = (o = {}) => ({ title: 'File:' + (o.name || 'Arsenal v Chelsea.jpg'), imageinfo: [{ thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/x/1024px-' + (o.id || 'A') + '.jpg', thumbwidth: 1024, thumbheight: 683, mime: 'image/jpeg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:' + (o.id || 'A') + '.jpg',
  extmetadata: { LicenseShortName: { value: o.lic || 'CC BY-SA 4.0' }, Artist: { value: o.artist === undefined ? '<a href="//commons.wikimedia.org/wiki/User:Jane">Jane &amp; Co</a>' : o.artist }, ImageDescription: { value: o.desc || 'Arsenal against Chelsea, football match at the Emirates Stadium' }, DateTimeOriginal: { value: o.taken || '2026-10-25 15:02:11' }, Categories: { value: 'Arsenal F.C.|Football matches' }, ObjectName: { value: o.name || 'Arsenal v Chelsea' }, ...(o.nonfree ? { NonFree: { value: 'true' } } : {}) } }] });
const commons = (...pages) => ({ query: { pages: Object.fromEntries(pages.map((p, i) => [String(i + 1), p])) } });
const ovItem = (o = {}) => ({ id: o.id || 'ov1', title: o.title || 'Arsenal fans at the Emirates football stadium', creator: o.creator === undefined ? 'Sam Smith' : o.creator, creator_url: 'https://www.flickr.com/people/sam/', license: o.lic || 'by', license_version: o.ver || '2.0', license_url: 'https://creativecommons.org/licenses/by/2.0/', foreign_landing_url: 'https://www.flickr.com/photos/sam/' + (o.id || 'ov1'), thumbnail: 'https://api.openverse.org/v1/images/' + (o.id || 'ov1') + '/thumb/', source: 'flickr', width: 1024, height: 768, mature: !!o.mature, tags: [{ name: 'football' }, { name: 'arsenal' }] });
const flickr = (o = {}) => ({ photos: { photo: [{ id: '5551', owner: '12345@N01', ownername: 'Pat Photo', title: 'Chelsea at Arsenal football', license: String(o.license === undefined ? 4 : o.license), datetaken: '2026-10-25 16:00:00', tags: 'football arsenal chelsea', url_c: 'https://live.staticflickr.com/65535/5551_abc_c.jpg', width_c: 800, height_c: 533, description: { _content: 'match day at the Emirates' } }] } });
const sportsdb = { event: [{ idEvent: '2201', strEvent: 'Arsenal vs Chelsea', dateEvent: '2026-10-25', strThumb: 'https://r2.thesportsdb.com/images/media/event/thumb/abc.jpg' }] };
const jpegRes = () => new Response(Buffer.from(JPEG, 'base64'), { headers: { 'content-type': 'image/jpeg' } });
const J = (o, status = 200, h = {}) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', ...h } });
/** a fake internet: answers by host; `a` maps a host name to a function or a value; every address asked is recorded */
function net(a = {}) {
  const seen = []; const f = async (url) => { const u = new URL(url); seen.push(u.hostname + u.pathname); const h = a[u.hostname]; if (h === undefined) return new Response('no', { status: 503 }); const v = typeof h === 'function' ? await h(u) : h; return v instanceof Response ? v : J(v); };
  f.seen = seen; return f;
}
function world({ extra = {} } = {}) { store.clear(); resetGuard(); route.resetReady(); return { env: { DB: d1(), SALT: 'test-salt', READ_TOKEN: KEY, AI: { run: async () => ({ image: JPEG }) }, ...extra } }; } // secret-scan: ok
const get = (env, qs, f, { ip = '203.0.113.90', headers = {} } = {}) => route.onRequestGet({ env, request: new Request('https://x/api/daily-art?' + qs, { headers: { 'cf-connecting-ip': ip, ...headers } }) }, f);
const sq = (extra = '') => 'kind=sports&key=epl&day=' + today + '&photo=1&q=' + encodeURIComponent(Q) + '&date=2026-10-25' + extra;
const info = async (env, f, extra = '', ip) => (await get(env, sq('&json=1' + extra), f, { ip })).json();

test('the licence filter: CC0, CC BY and CC BY-SA only; anything else is refused with its reason', () => {
  for (const [raw, name, url] of [['CC BY-SA 4.0', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'], ['CC BY 2.0', 'CC BY 2.0', 'https://creativecommons.org/licenses/by/2.0/'], ['cc by 3.0', 'CC BY 3.0', 'https://creativecommons.org/licenses/by/3.0/'], ['CC0', 'CC0 1.0', 'https://creativecommons.org/publicdomain/zero/1.0/'], ['CC0 1.0', 'CC0 1.0', 'https://creativecommons.org/publicdomain/zero/1.0/'], ['CC BY 2.5 AU', 'CC BY 2.5 AU', 'https://creativecommons.org/licenses/by/2.5/au/']]) {
    const l = P.licenceOf(raw); assert.equal(l.ok, true, raw); assert.equal(l.name, name); assert.equal(l.url, url);
  }
  for (const raw of ['CC BY-NC 2.0', 'CC BY-NC-SA 4.0', 'CC BY-ND 2.0', 'CC BY-NC-ND 4.0', 'Public domain', 'PDM', 'GFDL', 'All rights reserved', 'Fair use', '', 'CC BY', 'cc', 'by-nc']) assert.equal(P.licenceOf(raw).ok, false, raw || '(empty)');
  assert.equal(P.licenceOf('CC BY', '4.0').name, 'CC BY 4.0', 'a source that gives the version apart');
});
test('filterCandidates: a non-CC photo is rejected, and so is one with no author, a child or school, no sport, no match with the search, a mature mark, a non-free mark or a blocked page', () => {
  const base = { source: 'commons', title: 'Arsenal v Chelsea', thumb: 'https://upload.wikimedia.org/x.jpg', author: 'Jane', licenceRaw: 'CC BY-SA 4.0', sourcePage: 'https://commons.wikimedia.org/wiki/File:A.jpg', taken: '2026-10-25', text: 'Arsenal against Chelsea football match at the Emirates Stadium' };
  const kept = (c, o) => P.filterCandidates([{ ...base, ...c }], { q: Q, ...o });
  assert.equal(kept({}).ok.length, 1); assert.deepEqual(kept({}).ok[0].lic, { ok: true, code: 'by-sa', name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' });
  const no = (c, re, o) => { const r = kept(c, o); assert.equal(r.ok.length, 0, JSON.stringify(c)); assert.match(r.rejected[0].why, re, JSON.stringify(c)); };
  no({ licenceRaw: 'CC BY-NC 2.0' }, /non-commercial/); no({ licenceRaw: 'All rights reserved' }, /not CC0/); no({ licenceRaw: 'Public domain' }, /not CC0/); no({ licenceRaw: '' }, /no licence/);
  no({ author: '' }, /no author/); no({ sourcePage: '' }, /no author, licence or source/);
  no({ text: 'Arsenal youth academy under-12 football match' }, /children/); no({ text: 'school football match Arsenal Chelsea' }, /children/); no({ text: 'Arsenal Chelsea dinner menu' }, /not about sport/); no({ text: 'a football match in Madrid' }, /matches the search/);
  no({ rejected: 'marked non-free or with personality rights' }, /non-free/); no({ mature: true }, /mature/); no({}, /taken down/, { blocked: new Set([A.hash('https://commons.wikimedia.org/wiki/File:A.jpg')]) });
  assert.equal(kept({ author: '', licenceRaw: 'CC0' }).ok.length, 1, 'CC0 asks for no author');
  const two = P.filterCandidates([{ ...base, taken: '2020-01-01', sourcePage: 'https://x/1' }, { ...base, taken: '2026-10-25', sourcePage: 'https://x/2' }], { q: Q, date: '2026-10-25' }); assert.equal(two.ok[0].sourcePage, 'https://x/2', 'a photo from the game\'s day wins');
});
test('parsers: Commons, Openverse, Flickr and TheSportsDB answers become candidates; only the sources\' own hosts and ids pass', () => {
  const c = P.parseCommons(commons(commonsPage(), commonsPage({ nonfree: true, id: 'B' }), { title: 'File:x.svg', imageinfo: [{ mime: 'image/svg+xml', thumburl: 'https://upload.wikimedia.org/x.png' }] }));
  assert.equal(c.length, 2); assert.equal(c[0].author, 'Jane & Co'); assert.equal(c[0].authorUrl, 'https://commons.wikimedia.org/wiki/User:Jane'); assert.equal(c[0].taken, '2026-10-25'); assert.match(c[1].rejected, /non-free/);
  assert.equal(P.parseCommons(commons({ ...commonsPage(), imageinfo: [{ ...commonsPage().imageinfo[0], thumburl: 'https://evil.example/x.jpg' }] })).length, 0, 'a thumbnail from another host is dropped');
  const o = P.parseOpenverse({ results: [ovItem(), ovItem({ id: 'ov2', lic: 'by-nc' }), { ...ovItem({ id: 'ov3' }), thumbnail: 'https://evil.example/t.jpg' }] }); assert.equal(o.length, 2); assert.equal(o[0].licenceRaw, 'CC BY 2.0'); assert.equal(o[1].licenceRaw, 'CC BY-NC'); assert.equal(o[0].provider, 'Flickr');
  assert.equal(P.filterCandidates(o, { q: Q }).ok.length, 1, 'by-nc is refused');
  const f = P.parseFlickr(flickr()); assert.equal(f[0].licenceRaw, 'CC BY 2.0'); assert.equal(f[0].sourcePage, 'https://www.flickr.com/photos/12345@N01/5551'); assert.equal(P.filterCandidates(f, { q: Q }).ok.length, 1);
  for (const id of [0, 1, 2, 3, 6, 7, 8, 10, 13, 14]) assert.equal(P.filterCandidates(P.parseFlickr(flickr({ license: id })), { q: Q }).ok.length, 0, 'flickr licence id ' + id);
  assert.equal(P.parseFlickr({ photos: { photo: [{ ...flickr().photos.photo[0], url_c: 'https://evil.example/a.jpg' }] } }).length, 0);
  assert.equal(P.parseSportsDb(sportsdb).length, 1); assert.equal(P.parseSportsDb({ event: [{ ...sportsdb.event[0], strThumb: 'https://evil.example/a.jpg' }] }).length, 0);
});
test('attribution is always there: author, licence with its link, the source page, when it was taken, whether it is from this game, and a report link; without them there is no photo', () => {
  const c = P.filterCandidates(P.parseCommons(commons(commonsPage())), { q: Q }).ok[0];
  const credit = P.creditFor(c, { date: '2026-10-25', id: 'abcdef012345' }), text = credit.map((s) => s.t).join('');
  assert.equal(text.split(' · ')[0], 'Photo: Jane & Co, CC BY-SA 4.0, via Wikimedia Commons'); assert.match(text, /taken 2026-10-25 \(this game\)/); assert.match(text, /Report or request removal$/);
  assert.deepEqual(credit.filter((s) => s.href).map((s) => s.href), ['https://commons.wikimedia.org/wiki/User:Jane', 'https://creativecommons.org/licenses/by-sa/4.0/', 'https://commons.wikimedia.org/wiki/File:A.jpg', 'mailto:atom@a-to-mind.com?subject=Photo%20report%20abcdef012345']);
  assert.match(P.creditFor(c, { date: '2026-10-20' }).map((s) => s.t).join(''), /archive photo, not necessarily from this game/);
  assert.doesNotMatch(text, /Verse photo/i);
  assert.throws(() => P.creditFor({ ...c, author: '' }), /author, licence and source page/); assert.throws(() => P.creditFor({ ...c, sourcePage: '' })); assert.throws(() => P.creditFor({ ...c, lic: null }));
  assert.equal(P.creditFor({ ...c, author: '', lic: P.licenceOf('CC0') }).map((s) => s.t).join('').startsWith('Photo: author not stated, CC0 1.0, via Wikimedia Commons'), true);
  assert.equal(P.creditFor({ source: 'thesportsdb' }).map((s) => s.t).join('').startsWith('Image: TheSportsDB'), true);
  assert.equal(P.photoId('https://x/y').length, 12);
});
test('the query: cut to letters and digits, rude or real-person words refused', () => {
  assert.equal(P.cleanQuery("  Arsenal <b>v</b> Chelsea; DROP TABLE  "), 'Arsenal b v b Chelsea DROP TABLE'); assert.equal(P.cleanQuery('x'.repeat(200)).length, 80);
  assert.equal(P.queryProblem(Q), ''); assert.equal(P.queryProblem('ab'), 'too short'); assert.equal(P.queryProblem('nude arsenal fans'), 'unsuitable'); assert.equal(P.queryProblem('photo of a celebrity at the match'), 'person');
});
test('the route, in order: Commons first; a non-CC Commons answer falls to Openverse; the next source after a 429; then the illustration', async () => {
  const { env } = world(); const f = net({ 'commons.wikimedia.org': commons(commonsPage()), 'upload.wikimedia.org': jpegRes });
  const r = await get(env, sq(), f); assert.equal(r.headers.get('content-type'), 'image/jpeg'); assert.equal(r.headers.get('x-art-source'), 'photo'); assert.deepEqual(f.seen.filter((x) => !x.startsWith('upload')), ['commons.wikimedia.org/w/api.php'], 'Openverse is not asked when Commons has one');
  const j = await info(env, f); assert.equal(j.source, 'photo'); assert.equal(j.label, 'Photo: Jane & Co, CC BY-SA 4.0, via Wikimedia Commons'); assert.equal(j.photoSource, 'commons'); assert.equal(j.archive, false); assert.match(j.id, /^[a-f0-9]{12}$/);
  const w = world(); const f2 = net({ 'commons.wikimedia.org': commons(commonsPage({ lic: 'CC BY-NC 2.0' })), 'api.openverse.org': (u) => (/thumb/.test(u.pathname) ? jpegRes() : { results: [ovItem()] }) });
  const j2 = await info(w.env, f2); assert.equal(j2.source, 'photo'); assert.equal(j2.photoSource, 'openverse'); assert.match(j2.label, /^Photo: Sam Smith, CC BY 2\.0, via Openverse \(Flickr\)$/); assert.deepEqual(f2.seen.filter((x) => !/thumb/.test(x)), ['commons.wikimedia.org/w/api.php', 'api.openverse.org/v1/images/']);
  const x = world(); const f3 = net({ 'commons.wikimedia.org': () => new Response('slow down', { status: 429, headers: { 'retry-after': '120' } }), 'api.openverse.org': (u) => (/thumb/.test(u.pathname) ? jpegRes() : { results: [ovItem()] }) });
  assert.equal((await info(x.env, f3)).photoSource, 'openverse'); assert.equal(x.env.DB.raw.prepare("SELECT src FROM void_daily_src WHERE src = 'commons'").all().length, 1, 'Commons is left alone');
  const y = world(); const f4 = net({ 'commons.wikimedia.org': commons(), 'api.openverse.org': { results: [] } }); const j4 = await info(y.env, f4); assert.equal(j4.source, 'illustration'); assert.equal(j4.label, 'Illustration by Verse');
  assert.equal((await get(y.env, sq(), net({}))).headers.get('x-art-source'), 'workers-ai', 'the picture itself is the illustration');
});
test('429 handling: a source that says 429 is not asked again until its wait is over, and a lookup that failed that way is retried soon, not for hours', async () => {
  const { env } = world(); let n = 0; const f = net({ 'commons.wikimedia.org': () => { n++; return new Response('', { status: 429, headers: { 'retry-after': '3600' } }); }, 'api.openverse.org': () => new Response('', { status: 429 }) });
  const j = await info(env, f); assert.equal(j.source, 'illustration'); assert.equal(n, 1);
  const again = await info(env, f, '', '8.8.8.8'); assert.equal(n, 1, 'cached: not asked again'); assert.equal(again.source, 'illustration');
  const row = env.DB.raw.prepare("SELECT meta FROM void_daily_photo WHERE state = 'none'").get(); assert.equal(JSON.parse(row.meta).limited, true);
  env.DB.raw.exec("UPDATE void_daily_photo SET at = at - " + (40 * 60000)); store.clear(); await info(env, f, '', '8.8.8.9'); assert.equal(n, 1, 'still inside the source\'s wait');
  env.DB.raw.exec('UPDATE void_daily_src SET until = 1'); env.DB.raw.exec('UPDATE void_daily_photo SET at = at - 3600000'); store.clear(); await info(env, net({ 'commons.wikimedia.org': commons(commonsPage()), 'upload.wikimedia.org': jpegRes }), '', '8.8.8.7'); assert.equal(env.DB.raw.prepare("SELECT state FROM void_daily_photo").get().state, 'done');
});
test('caching: the same question the same day costs nothing, a miss too; the lookups and the connection are limited', async () => {
  const { env } = world(); const f = net({ 'commons.wikimedia.org': commons(commonsPage()), 'upload.wikimedia.org': jpegRes });
  await get(env, sq(), f); const n = f.seen.length; store.clear(); resetGuard(); await get(env, sq(), f, { ip: '7.7.7.7' }); await info(env, f, '', '7.7.7.8'); assert.equal(f.seen.length, n, 'kept in the database for everyone');
  const m = world(); const miss = net({ 'commons.wikimedia.org': commons(), 'api.openverse.org': { results: [] } }); await info(m.env, miss); const k = miss.seen.length; await info(m.env, miss, '', '7.7.7.9'); assert.equal(miss.seen.length, k, 'a miss is kept too');
  const c = world(); const g = net({ 'commons.wikimedia.org': commons(), 'api.openverse.org': { results: [] } });
  for (let i = 0; i < route.PHOTO_CONN_DAY + 2; i++) await get(c.env, 'kind=sports&key=epl&day=' + today + '&photo=1&q=' + encodeURIComponent('Arsenal team number ' + 'abcdefgh'[i]), g, { ip: '6.6.6.6' });
  assert.equal(c.env.DB.raw.prepare("SELECT n FROM void_image_days WHERE k LIKE 'pl:%'").get().n, route.PHOTO_CONN_DAY, 'one connection may start 6 lookups a day');
  const e = world(); assert.equal((await info(e.env, net({}), '&q=ab')).source, 'illustration'); assert.equal((await get(e.env, 'kind=sports&key=epl&day=' + today + '&photo=1&q=nude%20arsenal%20fans', net({}))).headers.get('x-art-source'), 'workers-ai');
});
test('hosts: only the fixed ones are asked, whatever the query; Flickr and TheSportsDB are not asked until their keys are set', async () => {
  (await import('../void-live-deploy/lib/free-pics.js')).resetState(); // an earlier test may have rested a registry source
  const { env } = world(); const f = net({ 'commons.wikimedia.org': commons(), 'api.openverse.org': { results: [] } }); await get(env, 'kind=sports&key=epl&day=' + today + '&photo=1&q=' + encodeURIComponent('https://evil.example/x?y=1 Arsenal Chelsea'), f);
  const hosts = new Set(f.seen.map((x) => x.split('/')[0])); assert.deepEqual([...hosts].sort(), ['api.openverse.org', 'archive.org', 'commons.wikimedia.org', 'www.loc.gov'], 'the three sources, then the open-pictures registry (lib/free-pics.js: the keyless ones), nothing the query names');
  const w = world({ extra: { FLICKR_API_KEY: 'k-flickr', THESPORTSDB_KEY: 'k-sdb' } }); const g = net({ 'commons.wikimedia.org': commons(), 'api.openverse.org': { results: [] }, 'api.flickr.com': flickr(), 'www.thesportsdb.com': sportsdb });
  const j = await info(w.env, g); assert.equal(j.source, 'photo'); assert.equal(j.photoSource, 'flickr'); assert.equal(j.label, 'Photo: Pat Photo, CC BY 2.0, via Flickr'); assert.ok(!JSON.stringify(j).includes('k-flickr'), 'the key never leaves');
  const r = await get(w.env, sq(), g); assert.equal(r.status, 302); assert.match(r.headers.get('location'), /^https:\/\/live\.staticflickr\.com\//); assert.equal(g.seen.includes('www.thesportsdb.com/api/v1/json/k-sdb/searchevents.php'), false, 'flickr answered first');
  const s = world({ extra: { THESPORTSDB_KEY: 'k-sdb' } }); const h = net({ 'commons.wikimedia.org': commons(), 'api.openverse.org': { results: [] }, 'www.thesportsdb.com': sportsdb });
  const js = await info(s.env, h); assert.equal(js.source, 'thesportsdb'); assert.equal(js.credit.map((x) => x.t).join('').startsWith('Image: TheSportsDB'), true); assert.equal((await get(s.env, sq(), h)).status, 302);
});
test('official embeds: only a video of an official channel, checked by the video host itself; its credit says whose it is', async () => {
  const ok = { title: 'Arsenal v Chelsea | Highlights', author_name: 'Premier League', author_url: 'https://www.youtube.com/@premierleague', html: '<iframe src="https://evil.example"></iframe>' };
  const { env } = world(); const f = net({ 'www.youtube.com': ok, 'commons.wikimedia.org': commons(), 'api.openverse.org': { results: [] } });
  const j = await info(env, f, '&video=dQw4w9WgXcQ'); assert.equal(j.embed.src, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'); assert.match(j.embed.credit.map((x) => x.t).join(''), /Video: Arsenal v Chelsea \| Highlights · Premier League on YouTube/); assert.ok(!JSON.stringify(j).includes('evil.example'));
  const w = world(); const bad = net({ 'www.youtube.com': { ...ok, author_url: 'https://www.youtube.com/@somefanchannel' }, 'commons.wikimedia.org': commons(), 'api.openverse.org': { results: [] } }); assert.equal((await info(w.env, bad, '&video=dQw4w9WgXcQ')).embed, undefined);
  assert.equal(P.officialChannel('https://www.youtube.com/@premierleague/', 'epl'), true); assert.equal(P.officialChannel('https://www.youtube.com/@premierleague', 'nfl'), false); assert.equal(P.officialChannel('https://www.youtube.com/@fan', 'epl', '/@fan'), true); assert.equal(P.officialChannel('https://evil.example/@premierleague', 'epl'), false); assert.equal(P.embedOf(ok, 'short', 'epl').ok, false);
  assert.equal((await get(w.env, 'kind=sports&key=epl&day=' + today + '&photo=1&q=ab&video=not-an-id', net({}))).status, 400);
});
test('the owner: diag shows what each source answered and why a candidate was refused; a delete takes a photo down and keeps it down', async () => {
  const { env } = world(); const f = net({ 'commons.wikimedia.org': commons(commonsPage(), commonsPage({ id: 'N', lic: 'CC BY-NC 2.0' })), 'upload.wikimedia.org': jpegRes, 'api.openverse.org': { results: [] } });
  assert.equal((await get(env, 'diag=1&q=' + encodeURIComponent(Q), f)).status, 401);
  const d = await (await get(env, 'diag=1&try=1&q=' + encodeURIComponent(Q), f, { headers: { authorization: 'Bearer ' + KEY } })).json();
  assert.equal(d.ok, true); assert.equal(d.report[0].source, 'commons'); assert.equal(d.report[0].found, 2); assert.equal(d.report[0].kept, 1); assert.match(d.report[0].rejected[0].why, /non-commercial/); assert.equal(d.found.licence, 'CC BY-SA 4.0'); assert.deepEqual(d.sources, { commons: true, openverse: true, flickr: false, thesportsdb: false });
  assert.ok(!JSON.stringify(d).includes(KEY));
  const j = await info(env, f); const del = (id, k) => route.onRequestDelete({ env, request: new Request('https://x/api/daily-art?photo=' + id, { method: 'DELETE', headers: k ? { authorization: 'Bearer ' + k } : {} }) });
  assert.equal((await del(j.id, '')).status, 401); assert.equal((await del('nothex', KEY)).status, 404); const r = await (await del(j.id, KEY)).json(); assert.equal(r.removed, 1);
  store.clear(); const again = await info(env, f, '', '5.5.5.5'); assert.notEqual(again.source, 'photo', 'the same photo does not come back: ' + again.source);
});
