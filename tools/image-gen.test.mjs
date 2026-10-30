// The text-to-image page: lib/image-gen.js (the rules) and functions/api/image.js (the route, with a FAKE D1, a fake image model and a fake
// free painter; nothing leaves the machine). Run: node --test tools/image-gen.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import * as I from '../void-live-deploy/lib/image-gen.js';
import * as route from '../void-live-deploy/functions/api/image.js';
import { FREE_CAP } from '../void-live-deploy/functions/api/card-art.js';
import { resetGuard } from '../void-live-deploy/lib/guard.js';

const store = new Map();
globalThis.caches = { default: { match: async (req) => (store.has(req.url) ? new Response(store.get(req.url)) : undefined), put: async (req, res) => { store.set(req.url, await res.text()); } } };
function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; }, first: async () => db.prepare(sql).get(...a) || null, all: async () => ({ results: db.prepare(sql).all(...a) }) });
  return { prepare: (sql) => stmt(sql), raw: db };
}
const JPEG = '/9j/' + 'A'.repeat(12000); // a picture-shaped base64 (imageOf's size gate: more than 8,000 characters)
function world({ ai = true, extra = {} } = {}) {
  store.clear(); resetGuard(); route.resetReady(); const calls = [];
  const AI = ai ? { run: async (model, input) => { calls.push({ model, input }); if (ai === 'fail') throw new Error('down'); return { image: JPEG }; } } : undefined;
  return { env: { DB: d1(), SALT: 'test-salt', ...(AI ? { AI } : {}), ...extra }, calls }; // secret-scan: ok (a made-up salt for the test)
}
const freeOk = async () => new Response(Uint8Array.from(atob(JPEG), (c) => c.charCodeAt(0)), { headers: { 'content-type': 'image/jpeg' } });
const freeDown = async () => new Response('no', { status: 502, headers: { 'content-type': 'text/plain' } });
const post = (env, body, { ip = '203.0.113.9', free = freeOk, origin } = {}) => route.onRequestPost({ env, request: new Request('https://x/api/image', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, ...(origin ? { origin } : {}) }, body: JSON.stringify(body) }) }, free);
const today = new Date().toISOString().slice(0, 10);

test('styles, shapes and seeds come from closed lists; the prompt carries the style, the leave-outs and the safe words', () => {
  assert.ok(Object.keys(I.STYLES).length >= 12); for (const k of ['photo', 'anime', 'painting', 'pixel', '3d']) assert.ok(I.STYLES[k], k);
  assert.equal(I.styleOf('constructor'), 'none'); assert.equal(I.shapeOf('__proto__'), 'square'); assert.deepEqual(I.SHAPES.portrait, [768, 1152]);
  assert.equal(I.seedOf('42'), 42); assert.equal(I.seedOf(-1), 0); assert.equal(I.seedOf('1e12'), 0);
  const p = I.promptOf('a red fox in snow <b>', 'pixel', 'blur, text, no watermark');
  assert.match(p, /^a red fox in snow b, 16-bit pixel art/); assert.match(p, /no blur, no text, no watermark/); assert.match(p, /safe for work/); assert.doesNotMatch(p, /[<>]/);
  assert.equal(I.cleanLine('x'.repeat(900)).length, I.PROMPT_MAX);
  assert.match(I.pollUrl('a fox', [768, 1152], 7), /width=768&height=1152&seed=7&nologo=true&safe=true/);
});
test('refusals: nothing, keys, NSFW and hate, a photo of a named real person; drawn characters and places are fine', () => {
  const r = (p, s = 'none') => I.refusalOf(p, '', s);
  assert.equal(r('   '), 'empty'); assert.equal(r('a cat ' + 'A1b2C3d4'.repeat(5)), 'secret');
  for (const p of ['a nude woman', 'NSFW art', 'a nazi parade', 'woman in lingerie']) assert.equal(r(p), 'unsuitable', p);
  assert.equal(r('photo of Taylor Swift at a cafe'), 'person'); assert.equal(r('Barack Obama riding a bike', 'photo'), 'person'); assert.equal(r('a celebrity on a red carpet'), 'person');
  for (const p of ['a cartoon of Santa Claus', 'photo of New York at night', 'Little Red Riding Hood in the woods', 'Sherlock Holmes as a pixel art cat', 'a golden retriever, photo']) assert.equal(r(p, /photo/.test(p) ? 'photo' : 'pixel'), '', p);
  assert.equal(r('a cozy cabin in a snowy forest', 'photo'), '');
});
test('the cap: the image page uses at most AI_SHARE of Workers AI a day, counted with the Art Forge, never more than its FREE_CAP', () => {
  assert.equal(I.AI_SHARE, 10); assert.ok(I.AI_SHARE <= FREE_CAP);
  assert.equal(I.aiShareOf({}), 10); assert.equal(I.aiShareOf({ IMAGE_AI_SHARE: '4' }), 4); assert.equal(I.aiShareOf({ IMAGE_AI_SHARE: '500' }), 10, 'no setting raises it'); assert.equal(I.aiShareOf({ IMAGE_AI_SHARE: '0' }), 0);
});
test('the route: a picture from Workers AI with the shape and the seed; the same ask again comes from the cache and counts nothing', async () => {
  const { env, calls } = world();
  const j = await (await post(env, { prompt: 'a lighthouse at dawn', style: 'painting', shape: 'landscape', seed: 99 })).json();
  assert.equal(j.state, 'art'); assert.match(j.img, /^data:image\/jpeg;base64,/); assert.equal(j.painter, 'workers-ai'); assert.equal(j.seed, 99); assert.deepEqual([j.w, j.h], [1152, 768]);
  assert.equal(calls.length, 1); assert.ok(calls[0].input.multipart, 'klein takes form data');
  const form = await new Response(calls[0].input.multipart.body, { headers: { 'content-type': calls[0].input.multipart.contentType } }).formData();
  assert.equal(form.get('width'), '1152'); assert.equal(form.get('seed'), '99'); assert.match(form.get('prompt'), /^a lighthouse at dawn, oil painting/);
  const again = await (await post(env, { prompt: 'a lighthouse at dawn', style: 'painting', shape: 'landscape', seed: 99 })).json();
  assert.equal(again.cached, true); assert.equal(again.img, j.img); assert.equal(calls.length, 1);
  const rows = env.DB.raw.prepare('SELECT * FROM void_image_days').all(); assert.ok(!JSON.stringify(rows).includes('lighthouse'), 'nothing typed is stored'); assert.ok(!JSON.stringify(rows).includes('203.0.113.9'), 'no address');
  assert.equal(rows.find((r) => r.k === 'ai').n, 1);
});
test('the route: refusals never reach a painter; a foreign origin is refused', async () => {
  const { env, calls } = world();
  for (const p of ['photo of Taylor Swift', 'a naked man']) { const j = await (await post(env, { prompt: p })).json(); assert.equal(j.state, 'refused'); assert.ok(j.say.length > 10); }
  assert.equal(calls.length, 0);
  assert.equal((await post(env, { prompt: 'a fox' }, { origin: 'https://evil.example' })).status, 403);
  const de = await (await post(env, { prompt: 'Angela Merkel photo', lang: 'de' })).json(); assert.match(de.say, /echten Menschen/);
});
test('the route: past the Workers AI share, or when it fails, the free painter; past both the painter rests', async () => {
  const { env, calls } = world({ extra: { IMAGE_AI_SHARE: '2' } });
  for (let i = 0; i < 2; i++) assert.equal((await (await post(env, { prompt: 'a fox ' + i }, { ip: '198.51.100.' + i })).json()).painter, 'workers-ai');
  assert.equal((await (await post(env, { prompt: 'a fox 3' }, { ip: '198.51.100.3' })).json()).painter, 'pollinations');
  assert.equal(calls.length, 2);
  const failing = world({ ai: 'fail' }); assert.equal((await (await post(failing.env, { prompt: 'an owl' })).json()).painter, 'pollinations');
  const none = world({ ai: 'fail' }); const j = await (await post(none.env, { prompt: 'an owl' }, { free: freeDown })).json(); assert.equal(j.state, 'resting'); assert.equal(j.why, 'busy'); assert.match(j.say, /resting/);
  const off = world(); delete off.env.SALT; assert.equal((await (await post(off.env, { prompt: 'an owl' })).json()).why, 'off');
});
test('the route: the image page keeps its own Workers AI share even when the Art Forge used its day; the forge counts the page\'s pictures', async () => {
  const { env, calls } = world({ extra: { IMAGE_AI_SHARE: '1' } });
  env.DB.raw.exec('CREATE TABLE void_art (subject TEXT PRIMARY KEY, img TEXT NOT NULL, day TEXT NOT NULL)');
  for (let i = 0; i < FREE_CAP; i++) env.DB.raw.prepare('INSERT INTO void_art VALUES (?, ?, ?)').run('s' + i, 'x', today);
  assert.equal((await (await post(env, { prompt: 'a fox' })).json()).painter, 'workers-ai', 'its own share, live 2026-10-25');
  assert.equal((await (await post(env, { prompt: 'a fox 2' })).json()).painter, 'pollinations', 'past its share: the free painter');
  assert.equal(calls.length, 1); assert.equal(await route.imageAiToday(env), 1);
});
test('the route: a model that refuses the seed paints without it; misses are counted for the owner\'s diag, never a prompt', async () => {
  const { env, calls } = world(); env.AI.run = async (m, input) => { calls.push(input); const f = await new Response(input.multipart.body, { headers: { 'content-type': input.multipart.contentType } }).formData(); if (f.has('seed')) throw new Error('unknown field seed'); return { image: JPEG }; };
  assert.equal((await (await post(env, { prompt: 'a secret lighthouse' })).json()).painter, 'workers-ai'); assert.equal(calls.length, 2);
  const KEY = 'owner-key-for-tests-only'; env.READ_TOKEN = KEY; // secret-scan: ok (a made-up key)
  assert.equal((await route.onRequestGet({ env, request: new Request('https://x/api/image?diag=1') })).status, 401);
  const d = await (await route.onRequestGet({ env, request: new Request('https://x/api/image?diag=1', { headers: { authorization: 'Bearer ' + KEY } }) })).json();
  assert.equal(d.aiBound, true); assert.equal(d.aiUsedToday, 1); assert.match(JSON.stringify(d.missesSinceYesterday), /workers-ai: unknown field seed/); assert.doesNotMatch(JSON.stringify(d), /lighthouse|test-salt/);
});
test('the route: per connection, a minute and a day', async () => {
  const { env } = world({ extra: { IMAGE_AI_SHARE: '0' } });
  for (let i = 0; i < I.PER_MINUTE; i++) assert.equal((await post(env, { prompt: 'a fox ' + i })).status, 200);
  const slow = await post(env, { prompt: 'a fox x' }); assert.equal(slow.status, 429); assert.equal((await slow.json()).why, 'slow');
  env.DB.raw.prepare("UPDATE void_image_days SET n = ? WHERE k LIKE 'c:%'").run(I.PER_CONN); resetGuard(); store.clear();
  const mine = await post(env, { prompt: 'a fox y' }); assert.equal(mine.status, 429); assert.equal((await mine.json()).why, 'mine');
  const left = await (await route.onRequestGet({ env })).json(); assert.equal(left.left, I.POLL_CAP - I.PER_MINUTE);
});
