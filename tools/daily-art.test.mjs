// The daily picture helper, the illustration half: lib/daily-art.js (the closed lists, the prompt, the SVG, what pages call) and functions/api/daily-art.js (cache once,
// the budget, the lock, the fallback), with a FAKE D1, a fake image model and fake free painter. Nothing leaves the machine. Run: node --test tools/daily-art.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import * as A from '../void-live-deploy/lib/daily-art.js';
import * as route from '../void-live-deploy/functions/api/daily-art.js';
import { refusalOf } from '../void-live-deploy/lib/image-gen.js';
import { resetGuard } from '../void-live-deploy/lib/guard.js';

const store = new Map();
globalThis.caches = { default: { match: async (req) => (store.has(req.url) ? new Response(store.get(req.url)) : undefined), put: async (req, res) => { store.set(req.url, await res.text()); }, delete: async (req) => store.delete(req.url) } };
function d1() { const db = new DatabaseSync(':memory:'); const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; }, first: async () => db.prepare(sql).get(...a) || null, all: async () => ({ results: db.prepare(sql).all(...a) }) }); return { prepare: (sql) => stmt(sql), raw: db }; }
const JPEG = '/9j/' + 'A'.repeat(12000), KEY = 'owner-key-for-tests-only'; // secret-scan: ok (made-up values for the test)
const today = new Date().toISOString().slice(0, 10), yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
function world({ ai = true, extra = {} } = {}) {
  store.clear(); resetGuard(); route.resetReady(); const calls = [];
  const AI = ai ? { run: async (m, input) => { calls.push(input); if (ai === 'fail') throw new Error('down'); return { image: JPEG }; } } : undefined;
  return { env: { DB: d1(), SALT: 'test-salt', READ_TOKEN: KEY, ...(AI ? { AI } : {}), ...extra }, calls }; // secret-scan: ok
}
const poll = []; const freeOk = async (u) => { poll.push(u); return new Response(Buffer.from(JPEG, 'base64'), { headers: { 'content-type': 'image/jpeg' } }); };
const freeDown = async (u) => { poll.push(u); return new Response('no', { status: 503, headers: { 'content-type': 'text/plain' } }); };
const get = (env, qs, { ip = '203.0.113.80', free = freeDown, headers = {} } = {}) => route.onRequestGet({ env, request: new Request('https://x/api/daily-art?' + qs, { headers: { 'cf-connecting-ip': ip, ...headers } }) }, free);
const q = (kind, key, extra = '') => 'kind=' + kind + '&key=' + key + '&day=' + today + extra;

test('the lists are closed, and a page gets an address only for what is on them', () => {
  assert.deepEqual([...A.KINDS], ['sports', 'news', 'finance']);
  assert.equal(A.dailyArt('sports', 'nfl', { day: '2026-10-26' }), '/api/daily-art?kind=sports&key=nfl&day=2026-10-26');
  for (const bad of [['sports', 'nope'], ['weather', 'nfl'], ['sports', '__proto__'], ['constructor', 'all'], ['news', 'nfl']]) assert.equal(A.dailyArt(...bad), '', bad.join('/'));
  assert.match(A.dailyArt('sports', 'epl', { photo: true, q: 'Arsenal Chelsea', date: '2026-10-25', video: 'dQw4w9WgXcQ', mood: 'tense' }), /&mood=tense&photo=1&q=Arsenal%20Chelsea&date=2026-10-25&video=dQw4w9WgXcQ$/);
  assert.doesNotMatch(A.dailyArt('news', 'top', { photo: true, q: 'x' }), /photo/, 'photos are for sports only');
  assert.doesNotMatch(A.dailyArt('sports', 'nfl', { mood: 'rude' }), /mood/);
  assert.equal(A.validDay('2026-02-30'), false); assert.equal(A.validDay('2026-10-26'), true); assert.equal(A.validDay("2026-10-26'; drop"), false);
  const box = A.dailyArtImg('finance', 'wrap'); assert.deepEqual([box.width, box.height, box.ratio], [1024, 576, '16 / 9']); assert.match(box.style, /aspect-ratio:16 \/ 9/); assert.match(box.alt, /^Illustration by Verse/);
});
test('the prompt is made only of our own words: no names, no capitals, no logos, and it passes the image page\'s refusals for every kind, key, mood and day', () => {
  let n = 0;
  for (const kind of A.KINDS) for (const key of A.KEYS[kind]) for (const mood of ['', ...Object.keys(A.MOODS)]) for (const day of ['2026-10-26', '2027-01-01', '2026-02-28']) {
    const p = A.promptFor(kind, key, day, mood); n++;
    assert.doesNotMatch(p.prompt, /[A-Z]/, kind + key); assert.match(p.prompt, /no text, no letters, no logos, no crests/); assert.equal(refusalOf(p.prompt, p.negative, 'none'), '', kind + '/' + key + '/' + mood);
    assert.ok(p.seed >= 0 && p.seed < 1e9);
  }
  assert.ok(n > 600);
  assert.notEqual(A.promptFor('sports', 'nfl', '2026-10-26').prompt, A.promptFor('sports', 'nfl', '2026-10-27').prompt, 'it changes with the day');
  assert.equal(A.promptFor('sports', 'nfl', '2026-10-26', 'tense').prompt.includes(A.MOODS.tense), true);
  assert.throws(() => A.promptFor('sports', 'Lionel Messi', '2026-10-26'));
});
test('the SVG fallback: the same bytes for the same day, a different one for another, no text, well formed', () => {
  const a = A.fallbackSvg('sports', 'nhl', '2026-10-26'); assert.equal(a, A.fallbackSvg('sports', 'nhl', '2026-10-26')); assert.notEqual(a, A.fallbackSvg('sports', 'nhl', '2026-10-27')); assert.notEqual(a, A.fallbackSvg('sports', 'nba', '2026-10-26'));
  for (const kind of A.KINDS) for (const key of A.KEYS[kind]) { const s = A.fallbackSvg(kind, key, '2026-10-26'); assert.match(s, /^<svg [^>]*viewBox="0 0 1024 576"/); assert.doesNotMatch(s, /<text|<script|href=|javascript:/i); assert.ok(s.length < 3000); assert.equal((s.match(/<g[ >]/g) || []).length, (s.match(/<\/g>/g) || []).length); }
});
test('the route: painted once per kind, key and day and kept for everyone; the label says Verse made it; other days are refused or sent to today', async () => {
  const { env, calls } = world();
  const r1 = await get(env, q('sports', 'nfl')); assert.equal(r1.status, 200); assert.equal(r1.headers.get('content-type'), 'image/jpeg'); assert.equal(r1.headers.get('x-illustration'), 'Illustration by Verse'); assert.equal(r1.headers.get('x-art-source'), 'workers-ai'); assert.ok((await r1.arrayBuffer()).byteLength > 8000);
  const form = await new Response(calls[0].multipart.body, { headers: { 'content-type': calls[0].multipart.contentType } }).formData();
  assert.equal(form.get('width'), '1024'); assert.equal(form.get('height'), '576'); assert.match(form.get('prompt'), /american football game under floodlights[\s\S]*safe for work/);
  for (const ip of ['1.1.1.1', '1.1.1.2', '1.1.1.3']) { const r = await get(env, q('sports', 'nfl'), { ip }); assert.equal(r.status, 200); }
  assert.equal(calls.length, 1, 'one painting for everyone');
  store.clear(); resetGuard(); const r2 = await get(env, q('sports', 'nfl'), { ip: '9.9.9.9' }); assert.equal(r2.status, 200); assert.equal(calls.length, 1, 'the database answers when the edge cache is cold');
  assert.equal((await get(env, 'kind=sports&key=nfl&day=' + yesterday)).status, 200); assert.equal(calls.length, 2, 'yesterday is its own picture');
  const old = await get(env, 'kind=sports&key=nfl&day=2020-01-01'); assert.equal(old.status, 302); assert.match(old.headers.get('location'), new RegExp('day=' + today)); assert.equal(calls.length, 2);
  assert.equal((await get(env, 'kind=sports&key=nfl&day=2999-01-01')).status, 302);
  for (const bad of ['kind=sports&key=nope&day=' + today, 'kind=x&key=nfl', 'kind=sports&key=nfl&day=soon', 'kind=sports&key=nfl&mood=rude&day=' + today]) assert.equal((await get(env, bad)).status, 400, bad);
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM void_daily_art WHERE state = 'done'").get().n, 2);
  assert.ok(!JSON.stringify(env.DB.raw.prepare('SELECT * FROM void_image_days').all()).includes('203.0.113'), 'no address');
});
test('the budget: a separate small one, a reserve for the primary keys, counted with the shared Workers AI total; spent means the SVG', async () => {
  assert.equal(route.budgetOf({}), 30); assert.equal(route.budgetOf({ DAILY_ART_BUDGET: '5' }), 5); assert.equal(route.budgetOf({ DAILY_ART_BUDGET: '500' }), 30, 'never raised from the environment'); assert.equal(route.budgetOf({ DAILY_ART_BUDGET: 'x' }), 30);
  assert.equal(route.allowedFor({}, 'sports', 'nfl'), 30); assert.equal(route.allowedFor({}, 'sports', 'cricket'), 24);
  const { env, calls } = world({ extra: { DAILY_ART_BUDGET: '2' } });
  for (const [k, ip] of [['nfl', '2.2.2.1'], ['nba', '2.2.2.2']]) assert.equal((await get(env, q('sports', k), { ip })).headers.get('x-art-source'), 'workers-ai');
  const third = await get(env, q('sports', 'epl'), { ip: '2.2.2.3' }); assert.equal(third.headers.get('content-type'), 'image/svg+xml'); assert.equal(third.headers.get('x-art-note'), 'budget'); assert.equal(third.headers.get('x-illustration'), 'Illustration by Verse'); assert.equal(calls.length, 2);
  assert.equal(await third.text(), A.fallbackSvg('sports', 'epl', today)); assert.equal((await get(env, q('sports', 'nfl'), { ip: '2.2.2.4' })).headers.get('x-art-source'), 'workers-ai', 'a kept picture is still served');
  const n = env.DB.raw.prepare("SELECT k, n FROM void_image_days WHERE k LIKE 'daily%'").all(); assert.deepEqual(Object.fromEntries(n.map((r) => [r.k, r.n])), { daily: 2, 'daily-ai': 2, 'daily-att': 2 });
  const w = world({ extra: { DAILY_ART_BUDGET: '5' } }); const keys = ['cricket', 'golf', 'tennis', 'rugby', 'ufc']; const got = [];
  for (const [i, k] of keys.entries()) got.push((await get(w.env, q('sports', k), { ip: '3.3.3.' + i })).headers.get('x-art-note') || 'ok');
  assert.deepEqual(got, ['ok', 'ok', 'ok', 'ok', 'budget'], 'non-primary keys take 80% of the day'); assert.equal((await get(w.env, q('sports', 'nfl'), { ip: '3.3.3.9' })).headers.get('x-art-source'), 'workers-ai', 'the reserve');
});
test('the shared Workers AI ceiling: past it the free painter paints and the neurons are not spent', async () => {
  const { env, calls } = world(); env.DB.raw.exec('CREATE TABLE void_art (subject TEXT PRIMARY KEY, img TEXT NOT NULL, day TEXT NOT NULL)');
  for (let i = 0; i < 70; i++) env.DB.raw.prepare('INSERT INTO void_art VALUES (?, ?, ?)').run('s' + i, 'x', today);
  const r = await get(env, q('news', 'top'), { free: freeOk }); assert.equal(r.headers.get('x-art-source'), 'pollinations'); assert.equal(calls.length, 0);
});
test('who paints: one connection starts three paintings a day, one is in flight per key, a stale lock is taken over', async () => {
  const { env, calls } = world();
  const codes = []; for (const k of ['nfl', 'nba', 'mlb', 'nhl']) codes.push((await get(env, q('sports', k), { ip: '4.4.4.4' })).headers.get('x-art-note') || 'ok');
  assert.deepEqual(codes, ['ok', 'ok', 'ok', 'limit']); assert.equal((await get(env, q('sports', 'nhl'), { ip: '4.4.4.5' })).headers.get('x-art-source'), 'workers-ai'); assert.equal(calls.length, 4);
  const w = world(); await get(w.env, q('sports', 'all')); w.env.DB.raw.exec("UPDATE void_daily_art SET state = 'pending', img = '', source = '', at = " + Date.now()); store.clear();
  assert.equal((await get(w.env, q('sports', 'all'), { ip: '5.5.5.5' })).headers.get('x-art-note'), 'pending'); assert.equal(w.calls.length, 1, 'no second painter while one is in flight');
  w.env.DB.raw.exec('UPDATE void_daily_art SET at = ' + (Date.now() - 120000)); assert.equal((await get(w.env, q('sports', 'all'), { ip: '5.5.5.6' })).headers.get('x-art-source'), 'workers-ai'); assert.equal(w.calls.length, 2);
});
test('a resting painter: the SVG now, a wait before trying again, three tries a day at most', async () => {
  const { env, calls } = world({ ai: 'fail' });
  const r = await get(env, q('finance', 'wrap')); assert.equal(r.headers.get('x-art-note'), 'resting'); assert.equal(poll.length > 0, true); const before = calls.length;
  assert.equal((await get(env, q('finance', 'wrap'), { ip: '6.6.6.1' })).headers.get('x-art-note'), 'retry-later'); assert.equal(calls.length, before, 'not hammered');
  for (let i = 0; i < 4; i++) { env.DB.raw.exec('UPDATE void_daily_art SET at = ' + (Date.now() - 11 * 60000)); await get(env, q('finance', 'wrap'), { ip: '6.6.7.' + i }); }
  assert.equal(env.DB.raw.prepare('SELECT attempts FROM void_daily_art').get().attempts, 3);
  const ok = world({ ai: false }); assert.equal((await get(ok.env, q('news', 'world'), { free: freeOk })).headers.get('x-art-source'), 'pollinations');
});
test('refresh: the owner paints today\'s again; anyone else is refused; no database means the SVG', async () => {
  const { env, calls } = world(); await get(env, q('news', 'tech')); assert.equal(calls.length, 1);
  assert.equal((await get(env, q('news', 'tech', '&refresh=1'))).status, 401);
  const r = await get(env, q('news', 'tech', '&refresh=1'), { headers: { authorization: 'Bearer ' + KEY } }); assert.equal(r.status, 200); assert.equal(calls.length, 2);
  const off = { SALT: 'x' }; const s = await get(off, q('news', 'tech')); assert.equal(s.headers.get('x-art-source'), 'fallback'); assert.equal(s.headers.get('x-art-note'), 'off');
});
test('the credit as JSON: an illustration says so, with the box a page needs', async () => {
  const { env } = world(); const j = await (await get(env, q('sports', 'nba', '&json=1'))).json();
  assert.equal(j.ok, true); assert.equal(j.source, 'illustration'); assert.equal(j.label, 'Illustration by Verse'); assert.deepEqual(j.credit, [{ t: 'Illustration by Verse' }]); assert.deepEqual([j.width, j.height], [1024, 576]); assert.match(j.src, /^\/api\/daily-art\?kind=sports&key=nba/);
  const { mountCredit } = A; const kids = []; const el = { ownerDocument: { createElement: (t) => ({ tag: t, set href(v) { this._h = v; }, get href() { return this._h; }, setAttribute() {} }), createTextNode: (t) => ({ text: t }) }, replaceChildren: (...c) => kids.push(...c), dataset: {} };
  mountCredit(el, { source: 'photo', credit: [{ t: 'Photo: ' }, { t: 'Ann', href: 'javascript:alert(1)' }, { t: ', ' }, { t: 'CC BY 4.0', href: 'https://creativecommons.org/licenses/by/4.0/' }, { t: 'x', href: 'mailto:evil@example.com' }] });
  assert.deepEqual(kids.map((k) => k.text || k.href || ''), ['Photo: ', 'Ann', ', ', 'https://creativecommons.org/licenses/by/4.0/', 'x'], 'only https links and our own report address become links');
});
