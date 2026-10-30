// The public image gallery (functions/api/gallery.js) and a published generator's share card (functions/gen/[id].js), with a FAKE D1, a fake
// image model and a stand-in edge cache. Run: node --test tools/gallery.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import * as image from '../void-live-deploy/functions/api/image.js';
import * as gallery from '../void-live-deploy/functions/api/gallery.js';
import * as gen from '../void-live-deploy/functions/gen/[id].js';
import { resetGuard } from '../void-live-deploy/lib/guard.js';

const store = new Map();
globalThis.caches = { default: { match: async (req) => (store.has(req.url) ? new Response(store.get(req.url)) : undefined), put: async (req, res) => { store.set(req.url, await res.text()); } } };
function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; }, first: async () => db.prepare(sql).get(...a) || null, all: async () => ({ results: db.prepare(sql).all(...a) }) });
  return { prepare: (sql) => stmt(sql), raw: db };
}
const JPEG = '/9j/' + 'B'.repeat(12000);
const KEY = 'owner-key-for-tests-only'; // secret-scan: ok (a made-up key for the test)
function world() { store.clear(); resetGuard(); image.resetReady(); gallery.resetReady(); return { DB: d1(), SALT: 'test-salt', READ_TOKEN: KEY, AI: { run: async () => ({ image: JPEG }) } }; } // secret-scan: ok
const req = (path, body, ip = '203.0.113.30', extra = {}) => new Request('https://x' + path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, ...extra }, body: body ? JSON.stringify(body) : undefined });
const paint = (env, p) => image.onRequestPost({ env, request: req('/api/image', p) }, async () => new Response('', { status: 503 }));
const post = async (env, b, ip) => (await gallery.onRequestPost({ env, request: req('/api/gallery', b, ip) })).json();
const list = async (env, sort = 'new') => (await (await gallery.onRequestGet({ env, request: req('/api/gallery?sort=' + sort) })).json()).items;

test('only a picture Verse painted today can be shared, never bytes from the caller; the picture is served by its id', async () => {
  const env = world(), P = { prompt: 'a lighthouse at dawn', style: 'painting', shape: 'square', seed: 5 };
  assert.match((await post(env, { act: 'share', ...P })).error, /about a day[\s\S]*Same seed again/, 'nothing painted: said plainly, with the way back');
  assert.equal((await post(env, { act: 'share', ...P, img: 'data:image/png;base64,AAAA' })).ok, false, 'an image sent along is ignored');
  await paint(env, P);
  const r = await post(env, { act: 'share', ...P }); assert.equal(r.ok, true); assert.match(r.id, gallery.ID_RE);
  assert.equal((await post(env, { act: 'share', ...P })).already, true, 'the same picture twice is one row');
  const items = await list(env); assert.equal(items.length, 1); assert.equal(items[0].prompt, 'a lighthouse at dawn'); assert.equal(items[0].img, undefined, 'the list carries no pictures');
  const pic = await gallery.onRequestGet({ env, request: req('/api/gallery?img=' + r.id) }); assert.equal(pic.headers.get('content-type'), 'image/jpeg'); assert.equal((await pic.arrayBuffer()).byteLength > 8000, true);
  assert.ok(!JSON.stringify(env.DB.raw.prepare('SELECT * FROM void_gallery_days').all()).includes('203.0.113.30'), 'no address stored');
});
test('a refused prompt cannot be shared even when a picture exists for it; a foreign origin is refused', async () => {
  const env = world(); const P = { prompt: 'photo of Taylor Swift', style: 'photo', shape: 'square', seed: 1 };
  assert.equal((await post(env, { act: 'share', ...P })).ok, false);
  const r = await gallery.onRequestPost({ env, request: req('/api/gallery', { act: 'vote', id: 'abcdefgh' }, '1.1.1.1', { origin: 'https://evil.example' }) }); assert.equal(r.status, 403);
});
test('votes once per connection a day, top order, three reports hide it, the owner deletes', async () => {
  const env = world();
  const ids = [];
  for (const p of ['a fox', 'an owl']) { await paint(env, { prompt: p, seed: 2 }); ids.push((await post(env, { act: 'share', prompt: p, seed: 2 })).id); }
  for (const ip of ['10.1.0.1', '10.1.0.2', '10.1.0.1']) await post(env, { act: 'vote', id: ids[0] }, ip);
  const top = await list(env, 'top'); assert.equal(top[0].prompt, 'a fox'); assert.equal(top[0].votes, 2);
  for (const ip of ['10.2.0.1', '10.2.0.2', '10.2.0.3']) await post(env, { act: 'report', id: ids[1] }, ip);
  assert.deepEqual((await list(env)).map((x) => x.prompt), ['a fox']);
  assert.equal((await gallery.onRequestGet({ env, request: req('/api/gallery?img=' + ids[1]) })).status, 404);
  const del = (k) => gallery.onRequestDelete({ env, request: new Request('https://x/api/gallery?id=' + ids[0], { method: 'DELETE', headers: k ? { authorization: 'Bearer ' + k } : {} }) });
  assert.equal((await del('nope')).status, 401); assert.equal((await del(KEY)).status, 200); assert.equal((await list(env)).length, 0);
});
test('limits: a few shares a minute; a full gallery makes room from old pictures with few votes', async () => {
  const env = world();
  for (let i = 0; i < gallery.SHARE_MINUTE + 1; i++) { await paint(env, { prompt: 'a cat ' + i, seed: i }); }
  for (let i = 0; i < gallery.SHARE_MINUTE; i++) assert.equal((await post(env, { act: 'share', prompt: 'a cat ' + i, seed: i })).ok, true);
  assert.match((await post(env, { act: 'share', prompt: 'a cat 5', seed: 5 })).error, /slow down/);
  env.DB.raw.exec("UPDATE void_gallery SET made = 1 WHERE prompt = 'a cat 0'");
  for (let i = 0; i < gallery.ROWS_MAX; i++) env.DB.raw.prepare('INSERT INTO void_gallery (id, prompt, style, shape, seed, img, day, made, votes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run('fill' + String(i).padStart(4, '0').replace(/\d/g, (d) => 'abcdefghij'[d]), 'x', 'none', 'square', i, 'x', '2026-01-01', 1000 + i, 9);
  resetGuard(); store.delete([...store.keys()].find((k) => /gallery/.test(k)));
  const r = await post(env, { act: 'share', prompt: 'a cat 5', seed: 5 }, '10.9.9.9'); assert.equal(r.ok, true);
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM void_gallery WHERE prompt = 'a cat 0'").get().n, 0, 'the oldest with few votes made room');
});
test('a published generator\'s link carries its share card from $meta; the text is never in the html', async () => {
  const html = '<title>x</title><meta name="description" content="d"><meta property="og:title" content="t"><meta property="og:description" content="d"><meta property="og:url" content="u"><meta property="og:image" content="i"><link rel="canonical" href="c">';
  const out = gen.withCard(html, { id: 'abcdefgh', title: 'Hero <maker>', description: 'Heroes "by" gender', image: 'bcdefghi' });
  assert.match(out, /<title>Hero &lt;maker&gt; · Verse<\/title>/); assert.match(out, /og:description" content="Heroes &quot;by&quot; gender"/);
  assert.match(out, /og:image" content="https:\/\/a-to-mind.com\/api\/gallery\?img=bcdefghi"/); assert.match(out, /canonical" href="https:\/\/a-to-mind.com\/gen\/abcdefgh"/);
  const DB = d1(); DB.raw.exec("CREATE TABLE void_gens (id TEXT PRIMARY KEY, title TEXT, text TEXT, reports INTEGER DEFAULT 0)");
  DB.raw.prepare('INSERT INTO void_gens (id, title, text) VALUES (?, ?, ?)').run('abcdefgh', 'Pets', '$meta\n  description = Secret pets\noutput\n  hidden-entry-text\n');
  const env = { DB, ASSETS: { fetch: async () => new Response(html) } };
  const r = await gen.onRequestGet({ env, params: { id: 'abcdefgh' }, request: new Request('https://a-to-mind.com/gen/abcdefgh') }); const t = await r.text();
  assert.equal(r.status, 200); assert.match(t, /Secret pets/); assert.doesNotMatch(t, /hidden-entry-text/);
  assert.equal((await gen.onRequestGet({ env, params: { id: 'zzzzzzzz' }, request: new Request('https://a-to-mind.com/gen/zzzzzzzz') })).status, 404);
});
test('a picture made yesterday can still be shared while the cache keeps it; older is said plainly', async () => {
  const env = world(), y = new Date(Date.now() - 864e5).toISOString().slice(0, 10), old = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
  const put = async (d, prompt) => store.set((await image.cacheReq('https://x', [d, prompt, '', 'none', 'square', 3])).url, JSON.stringify({ state: 'art', img: 'data:image/jpeg;base64,' + JPEG }));
  await put(y, 'a moon'); await put(old, 'a sun');
  assert.equal((await post(env, { act: 'share', prompt: 'a moon', seed: 3 })).ok, true);
  const r = await post(env, { act: 'share', prompt: 'a sun', seed: 3 }); assert.equal(r.ok, false); assert.equal(r.why, 'gone');
});
