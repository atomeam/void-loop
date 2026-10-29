// A published generator's shared data (functions/api/gen-data.js) with a FAKE D1. Run: node --test tools/gen-data.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import * as route from '../void-live-deploy/functions/api/gen-data.js';
import { resetGuard } from '../void-live-deploy/lib/guard.js';

const store = new Map();
globalThis.caches = { default: { match: async (req) => (store.has(req.url) ? new Response(store.get(req.url)) : undefined), put: async (req, res) => { store.set(req.url, await res.text()); } } };
function d1() { const db = new DatabaseSync(':memory:'); const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; }, first: async () => db.prepare(sql).get(...a) || null, all: async () => ({ results: db.prepare(sql).all(...a) }) }); return { prepare: (sql) => stmt(sql), raw: db }; }
const KEY = 'owner-key-for-tests-only'; // secret-scan: ok (a made-up key)
function world() { store.clear(); resetGuard(); route.resetReady(); const DB = d1(); DB.raw.exec('CREATE TABLE void_gens (id TEXT PRIMARY KEY, reports INTEGER DEFAULT 0)'); DB.raw.prepare('INSERT INTO void_gens (id) VALUES (?)').run('abcdefgh'); return { DB, SALT: 's', READ_TOKEN: KEY }; } // secret-scan: ok
const post = async (env, b, ip = '203.0.113.70') => (await route.onRequestPost({ env, request: new Request('https://x/api/gen-data', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip }, body: JSON.stringify(b) }) })).json();
const get = async (env, id) => (await route.onRequestGet({ env, request: new Request('https://x/api/gen-data?id=' + id) })).json();

test('applyWrites: add counts, set keeps a short text; keys, size, links and rude words refused', () => {
  assert.deepEqual(route.applyWrites({ a: 1 }, [{ op: 'add', key: 'a' }, { op: 'add', key: 'b' }, { op: 'set', key: 'c', value: '  hello  ' }]).data, { a: 2, b: 1, c: 'hello' });
  assert.match(route.applyWrites({}, [{ op: 'set', key: 'x', value: 'see https://spam.example' }]).error, /links/);
  assert.match(route.applyWrites({}, [{ op: 'set', key: '__proto__', value: 'x' }]).error, /key/);
  assert.match(route.applyWrites({}, [{ op: 'nuke', key: 'x' }]).error, /add or set/);
  const full = Object.fromEntries(Array.from({ length: 20 }, (_, i) => ['k' + i, 1])); assert.match(route.applyWrites(full, [{ op: 'add', key: 'new' }]).error, /at most 20/);
  const big = Object.fromEntries(Array.from({ length: 19 }, (_, i) => ['k' + i, 'abcdefghij'.repeat(20)])); assert.match(route.applyWrites(big, [{ op: 'set', key: 'z', value: 'klmnopqrst'.repeat(20) }]).error, /full/);
});
test('the route: only a published generator; writes add up for everyone; the owner clears; no address stored', async () => {
  const env = world();
  assert.equal((await post(env, { id: 'zzzzzzzz', writes: [{ op: 'add', key: 'v' }] })).ok, false);
  await post(env, { id: 'abcdefgh', writes: [{ op: 'add', key: 'visits' }] }); await post(env, { id: 'abcdefgh', writes: [{ op: 'add', key: 'visits' }, { op: 'set', key: 'last', value: 'soup' }] }, '203.0.113.71');
  assert.deepEqual((await get(env, 'abcdefgh')).data, { visits: 2, last: 'soup' });
  assert.ok(!JSON.stringify(env.DB.raw.prepare('SELECT * FROM void_gen_data_days').all()).includes('203.0.113.7'));
  for (let i = 0; i < 25; i++) await post(env, { id: 'abcdefgh', writes: [{ op: 'add', key: 'spam' }] }, '9.9.9.9');
  assert.equal((await get(env, 'abcdefgh')).data.spam, 20, 'the minute limit: 20 calls a minute per connection');
  const del = (k) => route.onRequestDelete({ env, request: new Request('https://x/api/gen-data?id=abcdefgh', { method: 'DELETE', headers: k ? { authorization: 'Bearer ' + k } : {} }) });
  assert.equal((await del('x')).status, 401); assert.equal((await del(KEY)).status, 200); assert.deepEqual((await get(env, 'abcdefgh')).data, {});
});
