// Spectator reactions: lib/reactions.js (the closed list and its rules), functions/api/react.js (the route, with a FAKE D1 and a FAKE ledger) and
// lib/reaction-bar.js's pure helpers. Run: node --test tools/react.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import * as route from '../void-live-deploy/functions/api/react.js';
import { REACTIONS, REACTION_IDS, LIMITS, parseReaction, countsOf, targetOf, targetOk, glyphOf, clientKey, secondsToMidnight } from '../void-live-deploy/lib/reactions.js';
import { cleanCounts, restFor, short } from '../void-live-deploy/lib/reaction-bar.js';
import { resetGuard } from '../void-live-deploy/lib/guard.js';

const store = new Map();
globalThis.caches = { default: { match: async (req) => (store.has(req.url) ? new Response(store.get(req.url)) : undefined), put: async (req, res) => { store.set(req.url, await res.text()); } } };
const LEDGER = [{ at: '2026-10-18T01:40:53Z' }, { at: '2026-10-18T01:33:08Z' }, { at: 'garbage' }];
const T1 = '2026-10-18t01-40-53z', T2 = '2026-10-18t01-33-08z';

function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b),
    run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; },
    first: async () => db.prepare(sql).get(...a) || null,
    all: async () => ({ results: db.prepare(sql).all(...a) }) });
  return { prepare: (sql) => stmt(sql), raw: db };
}
function world(extra = {}) {
  store.clear(); resetGuard(); route.resetReady(); route.resetKnown();
  return { DB: d1(), SALT: 'test-salt', ASSETS: { fetch: async () => Response.json(LEDGER) }, ...extra }; // secret-scan: ok (a made-up salt for the test)
}
const post = (env, body, { ip = '203.0.113.7', type = 'application/json', headers = {} } = {}) => route.onRequestPost({ env, request: new Request('https://x/api/react', { method: 'POST', headers: { 'content-type': type, 'cf-connecting-ip': ip, ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }) });
const get = (env, target) => route.onRequestGet({ env, request: new Request('https://x/api/react?target=' + encodeURIComponent(target)) });
const dump = (env) => JSON.stringify([env.DB.raw.prepare('SELECT * FROM void_reactions').all(), env.DB.raw.prepare('SELECT * FROM void_reaction_days').all()]);

test('the list is closed: six ids, each with a glyph held in code, and nothing else has one', () => {
  assert.deepEqual(REACTION_IDS, ['clap', 'fire', 'wow', 'laugh', 'heart', 'eyes']);
  for (const id of REACTION_IDS) assert.ok(glyphOf(id).length > 0);
  for (const bad of ['', 'CLAP', 'constructor', '__proto__', 'toString', 'hasOwnProperty', '<b>', 'clap ', null, undefined, 5, {}]) assert.equal(glyphOf(bad), '');
  assert.ok(Object.isFrozen(REACTIONS));
});

test('targets are short slugs; a ledger time becomes one', () => {
  assert.equal(targetOf('2026-10-18T01:40:53Z'), T1);
  for (const ok of ['a', 'a-b-1', 'x'.repeat(40)]) assert.ok(targetOk(ok));
  for (const bad of ['', 'x'.repeat(41), 'A', 'a b', 'a_b', '../x', 'a/b', 'a\n', '<b>', null, 4]) assert.ok(!targetOk(bad), String(bad));
  assert.equal(targetOf('!!!'), '');
});

test('parseReaction: content type, size, shape, unknown fields ignored, fixed errors that echo nothing', () => {
  const ok = parseReaction('application/json; charset=utf-8', JSON.stringify({ target: T1, reaction: 'fire', extra: '<script>', n: 99 }));
  assert.deepEqual(ok, { ok: true, target: T1, reaction: 'fire' });
  assert.equal(parseReaction('text/plain', '{}').status, 415);
  assert.equal(parseReaction('', '{}').status, 415);
  assert.equal(parseReaction('application/json', JSON.stringify({ target: T1, reaction: 'clap', pad: 'x'.repeat(400) })).status, 413);
  assert.equal(parseReaction('application/json', '{not json').status, 400);
  assert.equal(parseReaction('application/json', '[]').status, 400);
  assert.equal(parseReaction('application/json', 'null').status, 400);
  for (const r of ['party', 'CLAP', '__proto__', 'constructor', '', 7, null, ['clap']]) { const p = parseReaction('application/json', JSON.stringify({ target: T1, reaction: r })); assert.equal(p.status, 400); assert.equal(p.error, 'not a reaction'); }
  const evil = parseReaction('application/json', JSON.stringify({ target: '<img src=x onerror=alert(1)>', reaction: 'clap' }));
  assert.equal(evil.status, 400); assert.ok(!/img|alert/.test(JSON.stringify(evil)), 'the error never repeats the input');
});

test('countsOf gives every id an integer and ignores rows off the list', () => {
  assert.deepEqual(countsOf([]), { clap: 0, fire: 0, wow: 0, laugh: 0, heart: 0, eyes: 0 });
  const c = countsOf([{ reaction: 'fire', n: 3 }, { reaction: 'evil', n: 9 }, { reaction: 'clap', n: -4 }, { reaction: 'wow', n: 'x' }, { reaction: 'heart', n: 10 ** 9 }]);
  assert.deepEqual(c, { clap: 0, fire: 3, wow: 0, laugh: 0, heart: LIMITS.countCap, eyes: 0 });
});

test('a valid reaction is counted and read back; counts are only ids and integers', async () => {
  const env = world();
  assert.deepEqual(await (await get(env, T1)).json(), { ok: true, counts: { clap: 0, fire: 0, wow: 0, laugh: 0, heart: 0, eyes: 0 } });
  const r = await post(env, { target: T1, reaction: 'clap' }); assert.equal(r.status, 200);
  const j = await r.json(); assert.deepEqual(Object.keys(j).sort(), ['counts', 'ok']); assert.equal(j.counts.clap, 1);
  await post(env, { target: T1, reaction: 'clap' }, { ip: '198.51.100.2' });
  await post(env, { target: T1, reaction: 'eyes' });
  assert.deepEqual((await (await get(env, T1)).json()).counts, { clap: 2, fire: 0, wow: 0, laugh: 0, heart: 0, eyes: 1 });
  assert.deepEqual((await (await get(env, T2)).json()).counts.clap, 0, 'another item is its own count');
  assert.ok(!r.headers.get('access-control-allow-origin'), 'no CORS header');
  assert.equal(r.headers.get('cache-control'), 'no-store');
});

test('rejections: unknown reaction, oversized body, wrong content type, bad slug, unknown target, foreign origin; none changes a count', async () => {
  const env = world();
  assert.equal((await post(env, { target: T1, reaction: 'party' })).status, 400);
  assert.equal((await post(env, { target: T1, reaction: 'clap', pad: 'x'.repeat(500) })).status, 413);
  assert.equal((await post(env, { target: T1, reaction: 'clap' }, { type: 'text/plain' })).status, 415);
  assert.equal((await post(env, { target: 'Bad Slug!', reaction: 'clap' })).status, 400);
  assert.equal((await post(env, { target: 'not-in-the-ledger', reaction: 'clap' })).status, 404);
  assert.equal((await post(env, { target: T1, reaction: 'clap' }, { headers: { origin: 'https://evil.example' } })).status, 403);
  assert.equal((await get(env, '../etc')).status, 400);
  const sent = await post(env, { target: 'zz<script>alert(1)</script>', reaction: 'clap' });
  assert.ok(!/script|alert/.test(await sent.text()), 'nothing sent is echoed');
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name LIKE 'void_react%'").get().n, 0, 'every refusal came before any storage was touched');
});

test('the route is closed, not open, when D1, the salt or the ledger is missing', async () => {
  for (const extra of [{ DB: undefined }, { SALT: undefined }, { ASSETS: undefined }, { ASSETS: { fetch: async () => new Response('no', { status: 500 }) } }]) {
    const env = world(extra); const r = await post(env, { target: T1, reaction: 'clap' });
    assert.equal(r.status, 503); assert.deepEqual(await r.json(), { ok: false, error: 'reactions are off for now' });
  }
  assert.equal((await get({}, T1)).status, 503);
});

test('the per-client minute limit trips at 20 and answers 429 with Retry-After; another client is unaffected', async () => {
  const env = world();
  for (let i = 0; i < LIMITS.perMinute; i++) assert.equal((await post(env, { target: T1, reaction: 'clap' })).status, 200, 'reaction ' + i);
  const r = await post(env, { target: T1, reaction: 'clap' });
  assert.equal(r.status, 429); assert.equal(r.headers.get('retry-after'), '60');
  assert.equal((await get(env, T1).then((x) => x.json())).counts.clap, LIMITS.perMinute, 'the refused one was not counted');
  assert.equal((await post(env, { target: T1, reaction: 'clap' }, { ip: '198.51.100.9' })).status, 200);
});

test('the per-target ceiling trips for many different clients', async () => {
  const env = world(); let n = 0, last;
  for (let i = 0; i < LIMITS.targetPerMinute + 5; i++) { last = await post(env, { target: T2, reaction: 'wow' }, { ip: '10.0.' + (i >> 8) + '.' + (i & 255) }); if (last.status === 200) n++; }
  assert.equal(n, LIMITS.targetPerMinute); assert.equal(last.status, 429); assert.ok(Number(last.headers.get('retry-after')) > 0);
});

test('the daily limit trips at 200 per client with a Retry-After to midnight, and the day total trips too', async () => {
  const env = world();
  const key = await clientKey('203.0.113.7', new Date().toISOString().slice(0, 10), 'test-salt'); // secret-scan: ok
  await post(env, { target: T1, reaction: 'clap' });
  env.DB.raw.prepare('UPDATE void_reaction_days SET n = ? WHERE k = ?').run(LIMITS.perDay, 'c:' + key);
  const r = await post(env, { target: T1, reaction: 'clap' });
  assert.equal(r.status, 429); const ra = Number(r.headers.get('retry-after')); assert.ok(ra >= 1 && ra <= 86400);
  const env2 = world(); await post(env2, { target: T1, reaction: 'clap' });
  env2.DB.raw.prepare("UPDATE void_reaction_days SET n = ? WHERE k = 'all'").run(LIMITS.globalPerDay);
  assert.equal((await post(env2, { target: T1, reaction: 'fire' }, { ip: '198.51.100.50' })).status, 429);
});

test('a count stops at its cap', async () => {
  const env = world(); await post(env, { target: T1, reaction: 'heart' });
  env.DB.raw.prepare("UPDATE void_reactions SET n = ? WHERE reaction = 'heart'").run(LIMITS.countCap);
  const j = await (await post(env, { target: T1, reaction: 'heart' }, { ip: '198.51.100.3' })).json();
  assert.equal(j.counts.heart, LIMITS.countCap);
});

test('the raw address is never in storage, in a response, or in the cache; the key is salted and changes every day', async () => {
  const env = world(); const ip = '203.0.113.77';
  const r = await post(env, { target: T1, reaction: 'fire' }, { ip });
  assert.ok(!(await r.clone().text()).includes(ip));
  assert.ok(!dump(env).includes(ip) && !dump(env).includes('203.0.113'));
  assert.ok(![...store.keys(), ...store.values()].join('|').includes(ip));
  const k1 = await clientKey(ip, '2026-10-18', 'salt-a'), k2 = await clientKey(ip, '2026-10-19', 'salt-a'), k3 = await clientKey(ip, '2026-10-18', 'salt-b'); // secret-scan: ok
  assert.match(k1, /^[0-9a-f]{16}$/); assert.notEqual(k1, k2); assert.notEqual(k1, k3);
  assert.equal(await clientKey(ip, '2026-10-18', ''), '', 'no salt, no key');
  assert.ok(secondsToMidnight(Date.UTC(2026, 9, 18, 23, 59, 0)) === 60);
});

test('yesterday\'s counters are cleared by the next day\'s first reaction', async () => {
  const env = world(); await post(env, { target: T1, reaction: 'clap' });
  env.DB.raw.prepare("UPDATE void_reaction_days SET day = '2000-01-01', n = 0 WHERE k = 'all'").run();
  env.DB.raw.prepare("INSERT INTO void_reaction_days (k, day, n) VALUES ('c:old', '2000-01-01', 5)").run();
  await post(env, { target: T1, reaction: 'clap' }, { ip: '198.51.100.4' });
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM void_reaction_days WHERE day = '2000-01-01'").get().n, 0);
});

test('the bar\'s pure helpers: counts from a response are integers for the list only; Retry-After is bounded', () => {
  assert.equal(cleanCounts({ ok: false }), null); assert.equal(cleanCounts(null), null); assert.equal(cleanCounts({ ok: true }), null);
  assert.deepEqual(cleanCounts({ ok: true, counts: { clap: '4', fire: '<b>', evil: 9, wow: 1e9 } }), { clap: 4, fire: 0, wow: 99999, laugh: 0, heart: 0, eyes: 0 });
  assert.equal(restFor('30'), 30000); assert.equal(restFor('999999'), 120000); assert.equal(restFor(null), 60000); assert.equal(restFor('x'), 60000);
  assert.deepEqual([short(7), short(1200), short(12000), short(99999)], ['7', '1.2k', '12k', '100k']);
});
