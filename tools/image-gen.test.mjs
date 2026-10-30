// The text-to-image page: lib/image-gen.js (the rules) and functions/api/image.js (the route, with a FAKE D1, a fake image model and a fake
// free painter; nothing leaves the machine). Run: node --test tools/image-gen.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import * as I from '../void-live-deploy/lib/image-gen.js';
import * as route from '../void-live-deploy/functions/api/image.js';
import { ART_FALLBACK } from '../void-live-deploy/lib/models.js';
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
test('the route: the studio bench picks the painter inside klein-4b\'s cost; a square-only pick paints squares only; its miss falls back to klein', async () => {
  const studio = await import('../void-live-deploy/functions/api/studio.js');
  const { env, calls } = world(); studio.resetReady(); studio.resetPainter();
  env.DB.batch = async (stmts) => Promise.all(stmts.map((s) => s.run()));
  await studio.boardNow(env); // makes the studio's tables
  const ins = env.DB.raw.prepare('INSERT INTO void_studio_runs2 (day, model, bench, size, score, match, clean, look, w, h, ms, neurons, worst) VALUES (?, ?, ?, 1024, ?, 1, 9, 8, 1024, 1024, 900, 80, \'\')');
  for (const b of ['fox', 'hands', 'sign', 'robot']) { ins.run(today, 'schnell', b, 90); ins.run(today, 'klein-4b', b, 80); ins.run(today, 'lucid-origin', b, 99); }
  const sq = await (await post(env, { prompt: 'a red apple', shape: 'square', seed: 3 })).json();
  assert.equal(sq.state, 'art'); assert.equal(calls[0].model, ART_FALLBACK, 'the best model inside the cost (lucid scores more but costs more)');
  assert.equal(calls[0].input.seed, undefined);
  const wide = await (await post(env, { prompt: 'a red pear', shape: 'landscape', seed: 3 })).json();
  assert.equal(wide.state, 'art'); assert.ok(calls[1].input.multipart, 'schnell paints squares only, so klein paints the wide one');
  env.AI.run = async (model, input) => { calls.push({ model, input }); if (/schnell/.test(model)) throw new Error('down'); return { image: JPEG }; };
  const back = await (await post(env, { prompt: 'a green apple', shape: 'square', seed: 4 })).json();
  assert.equal(back.state, 'art'); assert.ok(calls.at(-1).input.multipart, 'klein paints when the pick fails');
  studio.resetPainter();
});

// "Change it": a picture painted here, changed by one typed line with the page's shrunk copy as klein's reference picture
const pngOf = (w, h) => { const b = new Uint8Array(400); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]); b.set([w >>> 24, (w >> 16) & 255, (w >> 8) & 255, w & 255, h >>> 24, (h >> 16) & 255, (h >> 8) & 255, h & 255], 16); return b; };
const jpegOf = (w, h) => Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, ...Array(14).fill(0), 0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255, 3, ...Array(30).fill(0)]);
const b64 = (u) => btoa(String.fromCharCode(...u));
test('a change\'s reference copy: its size read from a PNG or a JPEG header, smaller than 512x512 and in the picture\'s proportions', () => {
  assert.deepEqual(I.imageSizeOf(pngOf(504, 336)), { type: 'image/png', w: 504, h: 336 });
  assert.deepEqual(I.imageSizeOf(jpegOf(336, 504)), { type: 'image/jpeg', w: 336, h: 504 });
  assert.equal(I.imageSizeOf(Uint8Array.from('GIF89a' + 'x'.repeat(40), (c) => c.charCodeAt(0))), null); assert.equal(I.imageSizeOf(null), null);
  assert.deepEqual(I.editSizeOf(I.SHAPES.landscape), [504, 336]); assert.deepEqual(I.editSizeOf(I.SHAPES.square), [504, 504]); assert.deepEqual(I.editSizeOf(I.SHAPES.wide), [504, 288]);
  assert.equal(I.fitsEdit({ w: 504, h: 336 }, I.SHAPES.landscape), true);
  assert.equal(I.fitsEdit({ w: 1152, h: 768 }, I.SHAPES.landscape), false, 'the model takes smaller than 512x512 only');
  assert.equal(I.fitsEdit({ w: 504, h: 504 }, I.SHAPES.landscape), false, 'another picture\'s proportions');
  assert.equal(I.fitsEdit({ w: 120, h: 80 }, I.SHAPES.landscape), false, 'too small to stand for the picture');
  assert.match(I.changePromptOf('make the sky purple <b>'), /^make the sky purple b, keep everything else in image 0 the same.*safe for work/);
});
test('the route: "Change it" changes a picture painted here at its own size and seed, and counts one Workers AI picture', async () => {
  const { env, calls } = world();
  const first = await (await post(env, { prompt: 'a lighthouse at dawn', style: 'painting', shape: 'landscape', seed: 99 })).json();
  assert.match(first.ref, /^[0-9a-f]{64}$/, 'a picture carries its reference');
  const ch = await (await post(env, { act: 'change', ref: first.ref, change: 'make the sky purple', src: 'data:image/png;base64,' + b64(pngOf(504, 336)) })).json();
  assert.equal(ch.state, 'art'); assert.equal(ch.change, 'make the sky purple'); assert.equal(ch.seed, 99); assert.deepEqual([ch.w, ch.h], [1152, 768]); assert.notEqual(ch.ref, first.ref);
  assert.equal(calls.length, 2);
  const form = await new Response(calls[1].input.multipart.body, { headers: { 'content-type': calls[1].input.multipart.contentType } }).formData();
  assert.match(form.get('prompt'), /^make the sky purple, keep everything else in image 0 the same/); assert.equal(form.get('width'), '1152'); assert.equal(form.get('seed'), '99');
  const ref0 = form.get('input_image_0'); assert.ok(ref0 && typeof ref0 === 'object', 'the copy goes in as a file'); assert.equal(ref0.type, 'image/png'); assert.equal(ref0.size, 400);
  assert.equal(env.DB.raw.prepare("SELECT n FROM void_image_days WHERE k = 'ai'").get().n, 2, 'a change is one Workers AI picture');
  const again = await (await post(env, { act: 'change', ref: first.ref, change: 'make the sky purple', src: 'data:image/png;base64,' + b64(pngOf(504, 336)) })).json();
  assert.equal(again.cached, true); assert.equal(calls.length, 2);
  const twice = await (await post(env, { act: 'change', ref: ch.ref, change: 'add a boat', src: b64(jpegOf(504, 336)) })).json();
  assert.equal(twice.state, 'art', 'a change can be changed again'); assert.equal(calls.length, 3);
});
test('the route: a change needs a picture still kept here, a readable small copy, an allowed line and a Workers AI picture left', async () => {
  const { env, calls } = world();
  const first = await (await post(env, { prompt: 'a red fox in snow', shape: 'square', seed: 5 })).json();
  const sq = 'data:image/png;base64,' + b64(pngOf(504, 504));
  const gone = await (await post(env, { act: 'change', ref: 'a'.repeat(64), change: 'add a hat', src: sq })).json();
  assert.equal(gone.why, 'gone'); assert.match(gone.say, /no longer kept/);
  assert.equal((await post(env, { act: 'change', ref: 'not-a-ref', change: 'add a hat', src: sq })).status, 400);
  const big = await post(env, { act: 'change', ref: first.ref, change: 'add a hat', src: b64(pngOf(1024, 1024)) });
  assert.equal(big.status, 400); assert.equal((await big.json()).why, 'badpic');
  assert.equal((await (await post(env, { act: 'change', ref: first.ref, change: 'add a hat', src: b64(pngOf(504, 336)) })).json()).why, 'badpic', 'another shape');
  assert.equal((await (await post(env, { act: 'change', ref: first.ref, change: 'add a hat', src: 'not base64 !!' })).json()).why, 'badpic');
  assert.equal((await (await post(env, { act: 'change', ref: first.ref, change: 'make her topless', src: sq })).json()).why, 'unsuitable');
  assert.equal((await (await post(env, { act: 'change', ref: first.ref, change: '  ', src: sq })).json()).why, 'empty');
  assert.equal(calls.length, 1, 'no painter call for any of those');
  env.IMAGE_AI_SHARE = '1';
  const cap = await (await post(env, { act: 'change', ref: first.ref, change: 'add a hat', src: sq })).json();
  assert.equal(cap.why, 'cap', 'no free-painter fallback for a change'); assert.equal(calls.length, 1);
  assert.equal((await post(env, { prompt: 'a fox ' + ' '.repeat(2100) })).status, 400, 'only a change carries a big body');
});
