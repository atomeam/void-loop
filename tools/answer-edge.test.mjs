// The edge cache in front of the answer engine (void-live-deploy/lib/answer-edge.js, asked by Verse: "Implement edge caching for answers.";
// the owner's review of 2026-10-29: only stable, non-personal answers, a build version in the key, a TTL per kind, a bypass, HIT/MISS and
// server-timing headers). A repeated cacheable answer comes from caches.default with no D1 read and no model call; nothing personal, signed
// in, keyed, about Verse, creative, paid, empty or failed is ever stored; a new deploy is a MISS; no caches global = the handler exactly as
// before. Run: node --test tools/answer-edge.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { edgeCache, edgeKeyUrl, edgeGate, keyedRequest, freshAsked, answerKind, storable, edgeTtl, edgeGet, edgePut, marked, timing, buildIdOf, buildId, resetBuild,
  EDGE_HEADER, EDGE_PATH, EDGE_SCHEMA, KINDS, HIT, MISS, BYPASS, REFRESH } from '../void-live-deploy/lib/answer-edge.js';

const ORIGIN = 'https://a-to-mind.com';
const KEY = 'a'.repeat(32), BUILD = '0123456789ab', BUILD2 = 'fedcba987654';
// a Map-backed stand-in for caches.default: { match, put }, keyed by URL like the real one, keeping the stored text and headers.
// The rate limiter's counters (/__void-answer/rl/) share caches.default; here they are not kept, so a dozen test asks are never "slow down".
function fakeCache() {
  const m = new Map();
  return { m,
    match: async (req) => { const e = m.get(new URL(req.url).href); return e ? new Response(e.text, { headers: e.headers }) : undefined; },
    put: async (req, res) => { if (/\/rl\//.test(req.url)) return; m.set(new URL(req.url).href, { text: await res.text(), headers: Object.fromEntries(res.headers) }); } };
}
const answerKeys = (c) => [...c.m.keys()].filter((u) => u.includes(EDGE_PATH));
const req = (headers = {}, path = '/api/answer', method = 'POST') => new Request(ORIGIN + path, { method, headers, body: method === 'POST' ? '{}' : undefined });
const gate = (over = {}) => edgeGate({ request: req(), body: { ask: 'what is the capital of france' }, ask: 'what is the capital of france', ...over });

// ---- the pure parts ----

test('the key is a same-origin GET under /__answer-cache/<schema>-<build>/<hash>; a new build is a new key; nothing but a hash is accepted', () => {
  assert.equal(edgeKeyUrl(ORIGIN, KEY, BUILD), ORIGIN + '/__answer-cache/' + EDGE_SCHEMA + '-' + BUILD + '/' + KEY);
  assert.notEqual(edgeKeyUrl(ORIGIN, KEY, BUILD2), edgeKeyUrl(ORIGIN, KEY, BUILD), 'a deploy changes every key');
  assert.notEqual(edgeKeyUrl(ORIGIN, KEY, BUILD, 'v2'), edgeKeyUrl(ORIGIN, KEY, BUILD), 'so does a schema bump');
  assert.equal(edgeKeyUrl(ORIGIN, KEY, ''), null, 'no build id: nothing is cached');
  for (const bad of ['what is the capital of france', 'A'.repeat(32), 'abc', '', null, '../' + KEY]) assert.equal(edgeKeyUrl(ORIGIN, bad, BUILD), null, String(bad));
  assert.equal(edgeKeyUrl('https://a-to-mind.com/x', KEY, BUILD), null, 'an origin, not a path');
  assert.equal(buildIdOf({ id: '3c9b69ea7d0e1f2a3b4c5d6e7f8091a2b3c4d5e6' }), '3c9b69ea7d0e');
  for (const b of [null, {}, { id: 'main' }, { id: 'x'.repeat(40) }, { id: 42 }]) assert.equal(buildIdOf(b), '', JSON.stringify(b));
});

test('the build id is read once from /build.json through ASSETS; a missing or broken one is no id', async () => {
  resetBuild();
  let reads = 0; const env = { ASSETS: { fetch: async (r) => { reads++; assert.equal(new URL(r.url).pathname, '/build.json'); return Response.json({ id: BUILD + 'cdef' }); } } };
  assert.equal(await buildId(env, ORIGIN), BUILD); assert.equal(await buildId(env, ORIGIN), BUILD); assert.equal(reads, 1, 'kept for the isolate');
  resetBuild();
  assert.equal(await buildId({}, ORIGIN), '');
  assert.equal(await buildId({ ASSETS: { fetch: async () => new Response('nope', { status: 404 }) } }, ORIGIN), '');
  assert.equal(await buildId({ ASSETS: { fetch: async () => { throw new Error('down'); } } }, ORIGIN), '');
  resetBuild();
});

test('the gate is an allow-list: a plain POST of { ask } only, no Authorization, Cookie or key header, no query field but fresh', () => {
  assert.deepEqual(gate(), { ok: true, why: '', kind: 'reference', fresh: false });
  for (const h of [{ authorization: 'Bearer abc' }, { cookie: 'session=abc' }, { 'x-void-hook': 's' }, { 'x-cal-key': 'k' }, { 'x-void-test': '1' }, { 'x-api-token': 't' }, { 'x-payment': '{}' }, { 'x-owner-key': 'k' }, { 'x-verse-user': 'sam' }])
    assert.equal(gate({ request: req(h) }).ok, false, Object.keys(h)[0]);
  assert.equal(keyedRequest(req({ 'content-type': 'application/json', 'cf-connecting-ip': '1.2.3.4', 'user-agent': 'x', origin: ORIGIN })), false, 'ordinary headers are not keys');
  assert.equal(gate({ request: req({}, '/api/answer?user=sam') }).ok, false, 'a query field that could name someone');
  assert.equal(gate({ request: req({}, '/api/answer?fresh=1') }).fresh, true);
  for (const body of [{ ask: 'x', user: 'sam' }, { ask: 'x', email: 'a@b.c' }, { ask: 'x', page: {} }, { ask: 'x', mode: 'story' }, null, []])
    assert.equal(gate({ body }).ok, false, JSON.stringify(body));
  assert.equal(gate({ request: req({}, '/api/answer', 'GET') }).ok, false, 'a GET is not the answer path');
});

test('the gate keeps the D1 rule and turns away personal asks; the kind sets the TTL', () => {
  for (const k of ['masked', 'self', 'told', 'paste']) assert.equal(gate({ [k]: k === 'told' ? ['a note'] : true }).ok, false, k);
  for (const a of ["what's my dog's name", 'tell me a fact', 'what should our team do', 'remind us of the plan', 'what do I owe myself'])
    { assert.equal(answerKind(a), null, a); assert.equal(gate({ ask: a, body: { ask: a } }).ok, false, a); }
  for (const a of ['who is the president of the US', 'how do I boil an egg', 'what is a coal mine', 'capital of France']) assert.equal(answerKind(a), 'reference', a);
  for (const a of ['price of bitcoin', 'weather in paris', 'who won the game last night', 'latest news about mars', 'what happened in 2026', 'is the louvre open now'])
    assert.equal(answerKind(a), 'timely', a);
  assert.deepEqual(KINDS, { reference: 86400, timely: 600 });
});

test('fresh: ?fresh=1, x-verse-fresh or cache-control: no-cache skip the edge copy', () => {
  assert.equal(freshAsked(req({}, '/api/answer?fresh=1')), true);
  assert.equal(freshAsked(req({ 'x-verse-fresh': '1' })), true);
  assert.equal(freshAsked(req({ 'cache-control': 'no-cache' })), true);
  assert.equal(freshAsked(req({}, '/api/answer?fresh=0')), false);
  assert.equal(freshAsked(req()), false);
});

test('only a real free answer with no field outside the allow-list is storable', () => {
  assert.equal(storable({ answer: 'Paris is the capital of France.', sources: [], at: 'x', route: 'simple' }), true);
  for (const b of [{ answer: '' }, { answer: '   ' }, { answer: null }, { answer: 'x', note: 'model busy, from the web' }, { answer: null, noAnswer: true }, { answer: 'x', self: true },
    { answer: 'x', told: 2 }, { answer: 'x', kept: 'secret' }, { answer: 'x', page: true }, { answer: 'x', guess: 'y' }, { answer: 'x', anythingNew: 1 }, null, 'text', ['x']])
    assert.equal(storable(b), false, JSON.stringify(b));
  assert.equal(storable({ answer: 'x' }, { paid: true }), false, 'a paid escalation');
  assert.equal(storable({ answer: 'x' }, { status: 429 }), false, 'an error status');
});

test('TTL per kind: a day for reference, ten minutes for timely, never past the D1 row', () => {
  const now = Date.parse('2026-10-29T12:00:00Z');
  assert.equal(edgeTtl('reference', '2026-10-29T12:00:00Z', now), 86400);
  assert.equal(edgeTtl('timely', '2026-10-29T12:00:00Z', now), 600);
  assert.equal(edgeTtl('reference', '2026-10-22T13:00:00Z', now), 3600, 'one hour left of the 7 days');
  assert.equal(edgeTtl('reference', '2026-10-20T12:00:00Z', now), 0, 'past the D1 TTL: not stored');
  assert.equal(edgeTtl('personal', '2026-10-29T12:00:00Z', now), 0, 'not a kind: not stored');
  assert.equal(edgeTtl('reference', 'not a date', now), 0);
});

test('a miss, then a HIT with the same answer; a damaged copy or a throwing cache is a miss', async () => {
  const c = fakeCache(), url = edgeKeyUrl(ORIGIN, KEY, BUILD), body = { answer: 'Paris.', sources: [{ title: 'Paris', url: 'https://en.wikipedia.org/wiki/Paris' }], at: '2026-10-29T12:00:00.000Z' };
  assert.equal(await edgeGet(c, url), null);
  assert.equal(await edgePut(c, url, body, 600), true);
  assert.match(c.m.get(url).headers['cache-control'], /max-age=600/);
  const hit = await edgeGet(c, url);
  assert.equal(hit.headers.get(EDGE_HEADER), HIT);
  assert.deepEqual(await hit.json(), { ...body, cached: true });
  assert.equal(await edgePut(c, url, { answer: '', sources: [] }, 600), false, 'an empty answer is never stored');
  assert.equal(await edgePut(c, url, body, 0), false, 'no TTL, no copy');
  c.m.set(url, { text: '{not json', headers: {} }); assert.equal(await edgeGet(c, url), null);
  const broken = { match: async () => { throw new Error('down'); }, put: () => { throw new Error('down'); } };
  assert.equal(await edgeGet(broken, url), null); assert.equal(await edgePut(broken, url, body, 600), false);
  assert.equal(await edgeGet(null, url), null); assert.equal(edgeCache({}), null);
});

test('marked sets x-verse-cache and server-timing, copying a response whose headers are immutable', async () => {
  const r = marked(Response.json({ a: 1 }), MISS, 812.4); assert.equal(r.headers.get(EDGE_HEADER), MISS); assert.equal(r.headers.get('server-timing'), 'verse-cache;desc="MISS";dur=812');
  assert.equal(timing(HIT), 'verse-cache;desc="HIT"');
  const frozen = new Response('x'); Object.defineProperty(frozen, 'headers', { value: { set() { throw new TypeError('immutable'); }, [Symbol.iterator]: function* () {} } });
  const copy = marked(frozen, BYPASS, 3); assert.equal(copy.headers.get(EDGE_HEADER), BYPASS); assert.match(copy.headers.get('server-timing'), /BYPASS/); assert.equal(await copy.text(), 'x');
});

// ---- the real handler, end to end: D1, Workers AI and the site's /build.json stubbed and counted, caches.default a Map ----

const realFetch = globalThis.fetch;
globalThis.fetch = async () => new Response(JSON.stringify({ query: { search: [] } }), { headers: { 'content-type': 'application/json' } }); // no Wikipedia in tests
const answerApi = await import('../void-live-deploy/functions/api/answer.js');
test.after(() => { globalThis.fetch = realFetch; delete globalThis.caches; resetBuild(); });

function d1() {
  const db = new DatabaseSync(':memory:'), seen = [];
  const stmt = (sql, a = []) => ({ sql, a, bind: (...b) => stmt(sql, b),
    run: async () => { seen.push(sql); db.prepare(sql).run(...a); return { meta: {} }; },
    all: async () => { seen.push(sql); return { results: db.prepare(sql).all(...a) }; }, first: async () => { seen.push(sql); return db.prepare(sql).get(...a) || null; } });
  db.exec('CREATE TABLE void_answers (id TEXT PRIMARY KEY, ask TEXT, answer TEXT, sources TEXT, at TEXT)');
  return { prepare: (sql) => stmt(sql), raw: db, seen };
}
function world(say = 'Paris is the capital of France.', build = BUILD + 'cdef0123456789abcdef01234567') {
  const ai = { calls: 0 }, site = { build };
  const env = { DB: d1(), AI: { run: async (_m, o) => { ai.calls++; return o && o.messages ? { response: typeof say === 'function' ? say(o) : say } : { data: [] }; } },
    ASSETS: { fetch: async (r) => (new URL(r.url).pathname === '/build.json' && site.build ? Response.json({ id: site.build }) : new Response('', { status: 404 })) } };
  return { env, ai, site, cacheReads: () => env.DB.seen.filter((q) => /FROM void_answers/.test(q)).length };
}
async function ask(env, body, headers = {}, path = '/api/answer') {
  const waits = [];
  const res = await answerApi.onRequestPost({ env, request: new Request(ORIGIN + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(typeof body === 'string' ? { ask: body } : body) }), waitUntil: (p) => waits.push(p) });
  await Promise.all(waits); // the edge and D1 writes finish after the reply, as waitUntil lets them
  await new Promise((r) => setTimeout(r, 30)); // and the router's own background embeddings (lib/router.js) settle, so the next ask's count is its own
  return { res, text: await res.text(), header: res.headers.get(EDGE_HEADER), timing: res.headers.get('server-timing') };
}
const strip = (t) => { const j = JSON.parse(t); delete j.at; return j; };
const fresh = () => { resetBuild(); const cache = fakeCache(); globalThis.caches = { default: cache }; return cache; };

test('end to end: a safe ask is a MISS, then a HIT with zero model calls and zero D1 answer-cache reads', async () => {
  const cache = fresh(); const { env, ai, cacheReads } = world();
  const one = await ask(env, 'What is the capital of France?');
  assert.equal(one.header, MISS); assert.match(one.timing, /^verse-cache;desc="MISS";dur=\d+$/); assert.ok(ai.calls >= 1, 'the model answered the first');
  assert.equal(answerKeys(cache).length, 1, 'the answer was stored at the edge');
  assert.match(cache.m.get(answerKeys(cache)[0]).headers['cache-control'], /max-age=86400/, 'a reference answer lives a day');
  const [aiBefore, readsBefore] = [ai.calls, cacheReads()];
  // the same ask, in other case and spacing: the D1 cache's own normalisation, so the same key
  const two = await ask(env, '   what is THE capital   of france?  ');
  assert.equal(two.header, HIT); assert.match(two.timing, /^verse-cache;desc="HIT";dur=\d+$/);
  assert.equal(ai.calls - aiBefore, 0, 'no model call'); assert.equal(cacheReads() - readsBefore, 0, 'no D1 answer-cache read');
  assert.deepEqual(JSON.parse(two.text), { ...JSON.parse(one.text), cached: true }, 'the same answer, marked cached like a D1 hit');
  // a different ask never shares the key
  const three = await ask(env, 'What is the capital of Spain?');
  assert.equal(three.header, MISS); assert.equal(answerKeys(cache).length, 2);
  for (const u of answerKeys(cache)) { assert.match(u, new RegExp('^https://a-to-mind\\.com/__answer-cache/v1-' + BUILD + '/[0-9a-f]{32}$')); assert.doesNotMatch(u, /capital|france|spain/i, 'the raw ask is never in the key'); }
});

test('end to end: a new build version is a MISS (a deploy never reads the last one\'s copies)', async () => {
  const cache = fresh(); const { env, site } = world();
  await ask(env, 'how tall is mount everest');
  assert.equal((await ask(env, 'how tall is mount everest')).header, HIT);
  resetBuild(); site.build = BUILD2 + '0'.repeat(28); // the next deploy: new isolates read a new /build.json
  const after = await ask(env, 'how tall is mount everest');
  assert.equal(after.header, MISS);
  assert.ok(answerKeys(cache).some((u) => u.includes('-' + BUILD2 + '/')), 'stored under the new build');
  assert.equal((await ask(env, 'how tall is mount everest')).header, HIT);
});

test('end to end: a timely ask lives ten minutes; ?fresh=1 skips the copy and replaces it', async () => {
  const cache = fresh(); const { env, ai } = world('Bitcoin was about 60,000 dollars.');
  await ask(env, 'price of bitcoin');
  assert.match(cache.m.get(answerKeys(cache)[0]).headers['cache-control'], /max-age=600/);
  const before = ai.calls;
  const f = await ask(env, 'price of bitcoin', {}, '/api/answer?fresh=1');
  assert.equal(f.header, REFRESH); assert.equal(ai.calls, before, 'the D1 cache still answers a fresh ask: fresh skips only the edge copy');
  assert.equal((await ask(env, 'price of bitcoin')).header, HIT);
});

test('end to end: a D1 hit fills the edge, so the next one costs no D1 read either', async () => {
  const cache = fresh(); const { env, ai, cacheReads } = world();
  await ask(env, 'how many moons does mars have');
  cache.m.clear(); // another colo: the edge is empty, D1 has the row
  const d1hit = await ask(env, 'how many moons does mars have');
  assert.equal(d1hit.header, MISS); assert.equal(JSON.parse(d1hit.text).cached, true); assert.equal(answerKeys(cache).length, 1);
  const [aiBefore, readsBefore] = [ai.calls, cacheReads()];
  const edgeHit = await ask(env, 'how many moons does mars have');
  assert.equal(edgeHit.header, HIT); assert.equal(ai.calls, aiBefore); assert.equal(cacheReads(), readsBefore);
  assert.equal(edgeHit.text, d1hit.text, 'byte for byte what the D1 hit said');
});

test('end to end: a personal or authed request is never cached, nor Verse, pastes, failures, refusals or the modes', async () => {
  const cache = fresh();
  const bypass = async (what, body, headers = {}, path, say) => { const { env } = world(say); const r = await ask(env, body, headers, path); assert.equal(r.header, BYPASS, what); return r; };
  await bypass('signed in (bearer)', 'what is the capital of peru', { authorization: 'Bearer owner-token-for-tests-123' });
  await bypass('a cookie', 'what is the capital of peru', { cookie: 'a2m_session=abc' });
  await bypass('an owner key header', 'what is the capital of peru', { 'x-owner-key': 'k' });
  await bypass('the browser suite', 'what is the capital of chile', { 'x-void-test': '1' });
  await bypass('a body field that names someone', { ask: 'what is the capital of peru', user: 'sam' });
  await bypass('a query field that names someone', 'what is the capital of peru', {}, '/api/answer?member=sam');
  await bypass('a personal ask', "what is my dog's name");
  await bypass('a personal detail is masked', 'email sam@example.com what is the capital of peru');
  const s = await bypass('about Verse itself', 'what are you building?', {}, undefined, 'I am building the edge cache.'); assert.equal(JSON.parse(s.text).self, true);
  await bypass('a long paste', ('This is the plan. It has steps. It has more steps. ').repeat(12), {}, undefined, 'It says three things.');
  // an empty answer from both free models, and a model that throws: the open-web fallback (a note), never stored
  { const { env } = world(''); const r = await ask(env, 'what is the capital of bolivia'); assert.equal(r.header, MISS); assert.ok(JSON.parse(r.text).note); }
  { const { env } = world(() => { throw new Error('3036: allowance'); }); const r = await ask(env, 'what is the capital of ecuador'); assert.equal(r.header, MISS); assert.ok(JSON.parse(r.text).note); }
  // a refusal is not an answer
  { const { env } = world('I do not have information about that.'); const r = await ask(env, 'what is the capital of zzyzx'); assert.equal(JSON.parse(r.text).answer, null); }
  // the modes (per person or creative: a repeat should differ) return before the answer path, unmarked
  for (const body of [{ mode: 'story', ask: 'a story about a fox' }, { mode: 'plan', goal: 'learn to juggle' }, { mode: 'draft', ask: 'reply to this', details: 'hi' }, { mode: 'character', ask: 'hello' }]) {
    const { env } = world('Once upon a time.'); const r = await ask(env, body); assert.equal(r.header, null, body.mode); assert.equal(r.timing, null, body.mode);
  }
  assert.deepEqual(answerKeys(cache), [], 'nothing was stored');
});

test('end to end: no build id is a BYPASS; no caches global is the handler exactly as before (no header, the same body)', async () => {
  const cache = fresh();
  const nb = world(); nb.site.build = '';
  const noBuild = await ask(nb.env, 'what is the capital of norway');
  assert.equal(noBuild.header, BYPASS); assert.deepEqual(answerKeys(cache), []);
  delete globalThis.caches; resetBuild();
  const without = await ask(world().env, 'what is the capital of norway');
  assert.equal(without.header, null); assert.equal(without.timing, null);
  assert.deepEqual(strip(without.text), strip(noBuild.text));
  // a cache that throws on every call is the same as none
  globalThis.caches = { default: { match: async () => { throw new Error('down'); }, put: async () => { throw new Error('down'); } } };
  const broken = await ask(world().env, 'what is the capital of norway');
  assert.deepEqual(strip(broken.text), strip(without.text));
  delete globalThis.caches;
});
