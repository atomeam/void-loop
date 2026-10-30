// The video page: lib/video-gen.js (the rules) and functions/api/clip.js (the route, with a FAKE D1, a stand-in partner video model and a fake
// clip host; nothing leaves the machine). The page is off until a real test clip worked, and it never shows a clip the model did not make.
// Run: node --test tools/video-gen.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import * as V from '../void-live-deploy/lib/video-gen.js';
import * as clip from '../void-live-deploy/functions/api/clip.js';
import { resetReady as resetStudio } from '../void-live-deploy/functions/api/studio.js';
import { cacheReq } from '../void-live-deploy/functions/api/image.js';
import { resetGuard } from '../void-live-deploy/lib/guard.js';
import { routeAsk, TOOLS, relatedOf } from '../void-live-deploy/lib/toolkit.js';
import { PAGES } from '../void-live-deploy/lib/seo.js';

const store = new Map();
globalThis.caches = { default: { match: async (req) => (store.has(req.url) ? new Response(store.get(req.url)) : undefined), put: async (req, res) => { store.set(req.url, await res.text()); } } };
function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; }, first: async () => db.prepare(sql).get(...a) || null, all: async () => ({ results: db.prepare(sql).all(...a) }) });
  return { prepare: (sql) => stmt(sql), batch: async (list) => Promise.all(list.map((s) => s.run())), raw: db };
}
const CLIP = 'https://clips.example/a.mp4';
// the partner model: 'ok' answers like p-video does ({ state, result: { video } }); 'slow' does the same after 20 ms, so parallel asks overlap; 'credits' throws the live error of 2026-10-30
function world(ai = 'ok', extra = {}) {
  store.clear(); resetGuard(); clip.resetReady(); resetStudio(); const calls = [];
  const AI = { run: async (model, input) => { calls.push({ model, input }); if (ai === 'credits') throw new Error('2021: Insufficient AI Gateway credits'); if (ai === 'empty') return { state: 'Completed' }; if (ai === 'slow') await new Promise((r) => setTimeout(r, 20)); return { state: 'Completed', result: { video: CLIP } }; } };
  return { env: { DB: d1(), AI, SALT: 'test-salt', ...extra }, calls }; // secret-scan: ok (a made-up salt for the test)
}
const host = (type = 'video/mp4') => async () => new Response('x', { status: 200, headers: { 'content-type': type } });
const get = (env, q = '', fetchFn = host()) => clip.onRequestGet({ env, request: new Request('https://x/api/clip' + q) }, fetchFn).then((r) => r.json());
const post = (env, body, ip = '203.0.113.9') => clip.onRequestPost({ env, request: new Request('https://x/api/clip', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip }, body: JSON.stringify(body) }) }).then(async (r) => ({ status: r.status, ...(await r.json()) }));

test('the rules: closed lengths and shapes, a capped public budget, the credits error read from the model', () => {
  assert.equal(V.secondsOf(5), 5); assert.equal(V.secondsOf(60), 3); assert.equal(V.secondsOf('x'), 3);
  assert.equal(V.shapeOf('portrait'), 'portrait'); assert.equal(V.shapeOf('wide'), 'landscape'); assert.equal(V.shapeOf('__proto__'), 'landscape');
  assert.equal(V.publicCapOf({}), V.PUBLIC_DAILY_USD); assert.equal(V.publicCapOf({ PUBLIC_VIDEO_DAILY_USD: '50' }), V.MAX_PUBLIC_USD); assert.equal(V.publicCapOf({ PUBLIC_VIDEO_DAILY_USD: '0' }), 0);
  assert.ok(V.noCredits('2021: Insufficient AI Gateway credits')); assert.ok(!V.noCredits('timed out'));
  assert.equal(V.promptCheck('').why, 'empty'); assert.equal(V.promptCheck('a paper boat on a pond').prompt, 'a paper boat on a pond');
  assert.equal(V.promptCheck('waves', () => true).why, 'secret');
  for (const why of ['credits', 'unchecked', 'failed', 'cap', 'off', 'mine', 'slow', 'busy', 'gone', 'empty']) assert.ok(V.sayOf(why).length > 10, why);
});

test('the stored state: off and due with no test yet; on only after a real clip; due again six hours after an off test', () => {
  const now = 1e12;
  assert.deepEqual(V.stateOf(null, now), { on: false, why: 'unchecked', at: 0, due: true });
  assert.equal(V.stateOf({ on: 0, why: 'credits', at: now - 3600e3 }, now).due, false);
  assert.equal(V.stateOf({ on: 0, why: 'credits', at: now - 7 * 3600e3 }, now).due, true);
  assert.equal(V.stateOf({ on: 1, why: 'ok', at: 0 }, now).due, false, 'an on page is not re-tested on a timer');
  assert.equal(V.afterProbe({ state: 'video', url: CLIP }, now).on, 0, 'an address alone is not a clip');
  assert.equal(V.afterProbe({ state: 'video', url: CLIP, real: true }, now).on, 1);
  assert.equal(V.afterProbe({ state: 'failed', why: '2021: Insufficient AI Gateway credits' }, now).why, 'credits');
  assert.equal(V.afterProbe({ state: 'resting', why: 'cap' }, now).why, 'cap');
});

test('no credits: the first visit tests once, stays off with the plain words, and spends nothing', async () => {
  const { env, calls } = world('credits');
  const a = await get(env);
  assert.equal(a.on, false); assert.equal(a.checking, true);
  const b = await get(env);
  assert.equal(b.on, false); assert.equal(b.why, 'credits'); assert.match(b.say, /turns on when credits are added/); assert.equal(b.checking, false);
  assert.equal(calls.length, 1, 'one test clip, not one per visit'); assert.equal(calls[0].input.duration, 1); assert.equal(calls[0].input.draft, true);
  const spent = env.DB.raw.prepare('SELECT COALESCE(SUM(usd), 0) AS s FROM void_studio_spend').get();
  assert.equal(Number(spent.s), 0, 'a failed clip costs nothing');
  const p = await post(env, { prompt: 'a paper boat' });
  assert.equal(p.state, 'resting'); assert.equal(p.why, 'credits'); assert.equal(calls.length, 1, 'an off page asks the model nothing');
});

test('credits added: the next due test makes a real clip and turns the page on by itself', async () => {
  const { env, calls } = world('ok');
  await env.DB.raw.exec('CREATE TABLE IF NOT EXISTS void_clip_state (k TEXT PRIMARY KEY, on_ INTEGER NOT NULL, why TEXT NOT NULL, at INTEGER NOT NULL)');
  env.DB.raw.prepare('INSERT INTO void_clip_state VALUES (?, 0, ?, ?)').run('video', 'credits', Date.now() - 7 * 3600e3);
  await get(env);
  const s = await get(env);
  assert.equal(s.on, true); assert.equal(s.why, 'ok'); assert.ok(s.clipsLeft >= 1); assert.equal(calls.length, 1);
  const p = await post(env, { prompt: 'waves rolling onto a beach', seconds: 5, shape: 'portrait' });
  assert.equal(p.state, 'video'); assert.equal(p.url, CLIP); assert.equal(p.shape, 'portrait');
  assert.equal(calls[1].input.aspect_ratio, '9:16'); assert.equal(calls[1].input.duration, 5); assert.match(calls[1].input.prompt, /safe for work$/);
});

test('a clip address that is not a video does not turn the page on', async () => {
  const { env } = world('ok');
  await get(env, '', host('text/html'));
  const s = await get(env, '', host('text/html'));
  assert.equal(s.on, false); assert.equal(s.why, 'failed');
});

test('the public limits: words checked first, two a minute per connection, the money cap, and the credits running out turns it off', async () => {
  const { env, calls } = world('ok');
  await get(env); assert.equal((await get(env)).on, true);
  assert.equal((await post(env, { prompt: '' })).why, 'empty');
  const before = calls.length;
  for (let i = 0; i < 2; i++) assert.equal((await post(env, { prompt: 'a cat ' + i }, '198.51.100.' + i)).state, 'video');
  // one connection: the per-minute bucket (2); the day's three per connection are counted the same way in D1
  const ip = '192.0.2.1'; assert.equal((await post(env, { prompt: 'one' }, ip)).state, 'video'); assert.equal((await post(env, { prompt: 'two' }, ip)).state, 'video');
  assert.equal((await post(env, { prompt: 'three' }, ip)).why, 'slow');
  assert.equal(calls.length, before + 4);
  // the day's public dollars: $0.25 is ten 5 second drafts; the eleventh rests
  const capped = world('ok', { PUBLIC_VIDEO_DAILY_USD: '0.02' }); await get(capped.env); await get(capped.env);
  assert.equal((await post(capped.env, { prompt: 'a cat', seconds: 5 })).why, 'cap');
  const gone = world('credits'); gone.env.DB.raw.exec('CREATE TABLE IF NOT EXISTS void_clip_state (k TEXT PRIMARY KEY, on_ INTEGER NOT NULL, why TEXT NOT NULL, at INTEGER NOT NULL)');
  gone.env.DB.raw.prepare('INSERT INTO void_clip_state VALUES (?, 1, ?, ?)').run('video', 'ok', Date.now());
  assert.equal((await post(gone.env, { prompt: 'a cat' })).why, 'credits');
  assert.equal((await get(gone.env)).on, false, 'credits running out turns the page off until the next test');
});

test('parallel asks cannot pass the day\'s dollars together: one statement checks and books them', async () => {
  // $0.03 fits one 5 second draft ($0.025) and not two; five asks at once from five connections get one clip
  const { env, calls } = world('slow', { PUBLIC_VIDEO_DAILY_USD: '0.03' }); await get(env); await get(env);
  const before = calls.length;
  const rs = await Promise.all([0, 1, 2, 3, 4].map((i) => post(env, { prompt: 'a cat ' + i, seconds: 5 }, '198.51.100.' + (20 + i))));
  assert.equal(rs.filter((r) => r.state === 'video').length, 1); assert.equal(rs.filter((r) => r.why === 'cap').length, 4);
  assert.equal(calls.length, before + 1, 'the model is asked once, not five times');
  const row = env.DB.raw.prepare("SELECT usd FROM void_studio_spend WHERE who = 'public'").get();
  assert.ok(Number(row.usd) <= 0.03 + 1e-9, 'the booked dollars stay inside the cap');
});

test('the first frame is only a picture /api/image made today or yesterday, found by its words and seed', async () => {
  const { env, calls } = world('ok');
  await get(env); await get(env);
  const pic = { prompt: 'a red fox in the snow', negative: '', style: 'watercolor', shape: 'portrait', seed: 42 };
  assert.equal((await post(env, { prompt: 'the fox wakes up', from: pic })).why, 'gone');
  const day = new Date().toISOString().slice(0, 10), img = 'data:image/jpeg;base64,' + '/9j/' + 'A'.repeat(100);
  await caches.default.put(await cacheReq('https://x', [day, pic.prompt, pic.negative, pic.style, pic.shape, pic.seed]), new Response(JSON.stringify({ state: 'art', img })));
  const p = await post(env, { prompt: 'the fox wakes up', shape: 'landscape', from: pic });
  assert.equal(p.state, 'video'); assert.equal(p.shape, 'portrait', 'the clip keeps the picture\'s shape');
  assert.equal(calls.at(-1).input.image, img); assert.equal(calls.at(-1).input.aspect_ratio, '9:16');
});

test('owner probe: owner only', async () => {
  const { env } = world('ok');
  const r = await clip.onRequestGet({ env, request: new Request('https://x/api/clip?probe=1') }, host());
  assert.equal(r.status, 401);
});

test('off on a deploy with no model or no database, and the page is wired in: toolkit, asks, SEO, image page, hand-off tag', async () => {
  assert.equal((await get({ DB: d1() })).why, 'off'); assert.equal((await get({ DB: d1(), AI: {}, STUDIO_OFF: '1' })).why, 'off');
  assert.equal(TOOLS['/video/'], 'AI video generator'); assert.ok(relatedOf('/image/').some((r) => r.href === '/video/')); assert.ok(relatedOf('/video/').some((r) => r.href === '/image/'));
  assert.equal(routeAsk('ai video generator'), '/video/'); assert.equal(routeAsk('image to video'), '/video/');
  assert.equal(routeAsk('make a video of waves on a beach'), '/video/?prompt=waves+on+a+beach');
  assert.equal(routeAsk('video to mp3'), '/converter/?q=video%20to%20mp3', 'the converter keeps its ask');
  const row = PAGES.find((p) => p.path === '/video/'); assert.ok(row); assert.ok(!row.links.some(([, u]) => /go=1/.test(u)), 'a common ask fills the words; it never makes a clip on its own');
  const html = readFileSync(new URL('../void-live-deploy/video/index.html', import.meta.url), 'utf8');
  assert.match(html, /<meta name="verse-handoff" content="in: text, image; out: video">/); assert.match(html, /id="make" disabled/, 'the button starts off');
  assert.match(html, /--bg: #0b0a10/); assert.doesNotMatch(html, /--bg: #f7f6fb/);
  const app = readFileSync(new URL('../void-live-deploy/image/app.js', import.meta.url), 'utf8');
  assert.match(app, /\/video\/\?/); assert.match(app, /a2m\.void\.video\.from/);
  assert.match(readFileSync(new URL('../void-live-deploy/video/app.js', import.meta.url), 'utf8'), /a2m\.void\.video\.from/);
});

test('the stage card: "animate <words>" is the video card with the words, a picture or photo alone opens the page instead, and the card links to /video/', async () => {
  const { clipWords, default: sk } = await import('../void-live-deploy/skills/video-gen.js');
  assert.equal(clipWords('animate a cat chasing yarn'), 'a cat chasing yarn');
  assert.equal(clipWords('Animate waves on a beach!'), 'waves on a beach');
  for (const no of ['animate a picture', 'animate my photo', 'animate this image', 'animate', 'play a video of a cat']) assert.equal(sk.match(no.toLowerCase(), no), false, no);
  const { PAGE_OF, pageOfCard } = await import('../void-live-deploy/lib/card-frame.js');
  assert.deepEqual(PAGE_OF['video-gen'], ['/video/', 'AI video generator']);
  assert.deepEqual(pageOfCard('video-gen', '/video/?prompt=a%20cat'), ['/video/?prompt=a%20cat', 'AI video generator'], 'the card opens the page with its words');
});

test('the stage card says when Verse last tested the video model, beside the route\'s own words', async () => {
  const { stateLine, agoWords } = await import('../void-live-deploy/skills/video-gen.js');
  const now = Date.parse('2026-10-30T18:00:00Z');
  assert.equal(agoWords('2026-10-30T17:59:30Z', now), 'just now'); assert.equal(agoWords('2026-10-30T17:15:00Z', now), '45 minutes ago');
  assert.equal(agoWords('2026-10-30T12:10:00Z', now), '6 hours ago'); assert.equal(agoWords('', now), ''); assert.equal(agoWords('2026-10-30T19:00:00Z', now), '');
  assert.equal(stateLine({ on: false, say: 'Video is off: no credits.', checkedAt: '2026-10-30T15:00:00Z' }, now), 'Video is off: no credits. Verse last tested the video model 3 hours ago.');
  assert.equal(stateLine({ on: true, clipsLeft: 4, checkedAt: '2026-10-30T17:50:00Z' }, now), 'Video is on. 4 short clips left today for everyone. Verse last tested the video model 10 minutes ago.');
  assert.equal(stateLine({ on: false, say: 'Video is off.' }, now), 'Video is off.', 'no test time, no claim');
  assert.equal(stateLine(null, now), 'Video is off right now.');
});
