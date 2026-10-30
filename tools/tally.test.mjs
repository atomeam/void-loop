// Everyone's tally: lib/tally.js (the closed list and its rules) and functions/api/tally.js (the route, with a FAKE D1). Run: node --test tools/tally.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import * as route from '../void-live-deploy/functions/api/tally.js';
import { TALLIES, TALLY_IDS, LIMITS, parseTally, countsOf, coinLine, isValue } from '../void-live-deploy/lib/tally.js';
import { resetGuard } from '../void-live-deploy/lib/guard.js';
import { EMOJI_CHARS } from '../void-live-deploy/lib/emoji.js';

const store = new Map();
globalThis.caches = { default: { match: async (req) => (store.has(req.url) ? new Response(store.get(req.url)) : undefined), put: async (req, res) => { store.set(req.url, await res.text()); } } };
function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b),
    run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; },
    first: async () => db.prepare(sql).get(...a) || null,
    all: async () => ({ results: db.prepare(sql).all(...a) }) });
  return { prepare: (sql) => stmt(sql), raw: db };
}
function world(extra = {}) { store.clear(); resetGuard(); route.resetReady(); return { DB: d1(), SALT: 'test-salt', ...extra }; } // secret-scan: ok (a made-up salt for the test)
const IP = '203.0.113.7';
const post = (env, body, { ip = IP, type = 'application/json', headers = {} } = {}) => route.onRequestPost({ env, request: new Request('https://x/api/tally', { method: 'POST', headers: { 'content-type': type, 'cf-connecting-ip': ip, ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }) });
const get = (env, of) => route.onRequestGet({ env, request: new Request('https://x/api/tally?of=' + encodeURIComponent(of)) });
const today = new Date().toISOString().slice(0, 10);

test('the list is closed: the coin (two values) and the emoji wall (lib/emoji.js\'s list, owner 2026-10-26), and nothing else counts', () => {
  assert.deepEqual(TALLY_IDS, ['coin', 'emoji']); assert.deepEqual([...TALLIES.coin], ['heads', 'tails']); assert.ok(Object.isFrozen(TALLIES));
  for (const id of TALLY_IDS) assert.ok(Object.isFrozen(TALLIES[id]), id + ' values frozen');
  assert.equal(TALLIES.emoji, EMOJI_CHARS); assert.ok(EMOJI_CHARS.length > 0);
  for (const bad of ['', 'HEADS', 'constructor', '__proto__', 'toString', null, 5]) assert.equal(isValue('coin', bad), false, String(bad));
  assert.equal(isValue('emoji', EMOJI_CHARS[0]), true);
  for (const bad of ['', 'heads', 'hello', EMOJI_CHARS[0] + EMOJI_CHARS[0], '<script>', '__proto__', null]) assert.equal(isValue('emoji', bad), false, String(bad));
  assert.equal(isValue('__proto__', 'heads'), false);
});
test('parseTally: content type, size, shape, the count, unknown fields ignored, fixed errors that echo nothing', () => {
  assert.deepEqual(parseTally('application/json; charset=utf-8', JSON.stringify({ of: 'coin', v: 'tails', n: 5, extra: '<script>' })), { ok: true, of: 'coin', v: 'tails', n: 5 });
  assert.equal(parseTally('application/json', JSON.stringify({ of: 'coin', v: 'heads' })).n, 1);
  assert.equal(parseTally('text/plain', '{}').status, 415);
  assert.equal(parseTally('application/json', JSON.stringify({ of: 'coin', v: 'heads', pad: 'x'.repeat(300) })).status, 413);
  assert.equal(parseTally('application/json', '{not json').status, 400);
  for (const b of [{ of: 'dice', v: 'heads' }, { of: 'coin', v: 'edge' }, { of: 'coin', v: 'heads', n: 0 }, { of: 'coin', v: 'heads', n: 21 }, { of: 'coin', v: 'heads', n: 1.5 }, { of: 'coin', v: 'heads', n: '3' }]) {
    const r = parseTally('application/json', JSON.stringify(b)); assert.equal(r.ok, false, JSON.stringify(b)); assert.doesNotMatch(r.error, /dice|edge|script/);
  }
});
test('countsOf and the coin line: integers only, today split from all time', () => {
  const c = countsOf('coin', [{ v: 'heads', day: '2026-10-22', n: 7 }, { v: 'tails', day: '2026-10-22', n: 5 }, { v: 'heads', day: today, n: 3 }, { v: 'edge', day: today, n: 9 }, { v: 'tails', day: today, n: 'x' }], today);
  assert.deepEqual(c, { all: { heads: 10, tails: 5 }, today: { heads: 3, tails: 0 } });
  assert.equal(coinLine(c), 'Everyone today: 100% heads of 3 flips · all time 66.7% heads of 15');
  assert.equal(coinLine({ all: { heads: 0, tails: 0 }, today: { heads: 0, tails: 0 } }), '');
  assert.equal(coinLine({ all: { heads: 1, tails: 1 }, today: { heads: 0, tails: 0 } }), 'Everyone: 50.0% heads of 2');
});
test('the route: a flip counts, five coins count five, the counts come back, the address is never stored', async () => {
  const env = world();
  let r = await post(env, { of: 'coin', v: 'heads' }); assert.equal(r.status, 200);
  r = await post(env, { of: 'coin', v: 'tails', n: 5 }); const j = await r.json();
  assert.deepEqual(j.counts, { all: { heads: 1, tails: 5 }, today: { heads: 1, tails: 5 } });
  assert.deepEqual((await (await get(env, 'coin')).json()).counts.all, { heads: 1, tails: 5 });
  const everything = JSON.stringify([env.DB.raw.prepare('SELECT * FROM void_tally').all(), env.DB.raw.prepare('SELECT * FROM void_tally_days').all(), [...store.entries()]]) + JSON.stringify(j);
  assert.ok(!everything.includes(IP), 'the address never lands anywhere');
  assert.equal((await post(env, { of: 'coin', v: 'edge' })).status, 400);
  assert.equal((await get(env, 'dice')).status, 400);
});
test('limits: the minute, the day, everyone\'s day; a foreign origin; off without D1 or SALT', async () => {
  const env = world();
  for (let i = 0; i < LIMITS.perMinute; i++) assert.equal((await post(env, { of: 'coin', v: 'heads' })).status, 200);
  const r = await post(env, { of: 'coin', v: 'heads' }); assert.equal(r.status, 429); assert.equal(r.headers.get('retry-after'), '60');
  assert.equal((await post(env, { of: 'coin', v: 'heads' }, { headers: { origin: 'https://evil.example' } })).status, 403);
  assert.equal((await post(world({ DB: undefined }), { of: 'coin', v: 'heads' })).status, 503);
  assert.equal((await post(world({ SALT: '' }), { of: 'coin', v: 'heads' })).status, 503);
  const env2 = world(); env2.DB.raw.prepare("CREATE TABLE void_tally_days (k TEXT PRIMARY KEY, day TEXT NOT NULL, n INTEGER NOT NULL)").run();
  env2.DB.raw.prepare('INSERT INTO void_tally_days VALUES (?, ?, ?)').run('all', today, LIMITS.globalPerDay);
  const g = await post(env2, { of: 'coin', v: 'heads' }); assert.equal(g.status, 429); assert.ok(Number(g.headers.get('retry-after')) > 0);
});
