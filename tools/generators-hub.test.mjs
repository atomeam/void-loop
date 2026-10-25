// The generators hub (functions/api/generators.js) with a FAKE D1: publish, read, list newest and popular, play, report, owner delete,
// and what a stranger can and cannot make it do. Run: node --test tools/generators-hub.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import * as route from '../void-live-deploy/functions/api/generators.js';
import { resetGuard } from '../void-live-deploy/lib/guard.js';
import { STARTER } from '../void-live-deploy/lib/listgen.js';

const store = new Map();
globalThis.caches = { default: { match: async (req) => (store.has(req.url) ? new Response(store.get(req.url)) : undefined), put: async (req, res) => { store.set(req.url, await res.text()); } } };
function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; }, first: async () => db.prepare(sql).get(...a) || null, all: async () => ({ results: db.prepare(sql).all(...a) }) });
  return { prepare: (sql) => stmt(sql), raw: db };
}
const KEY = 'owner-key-for-tests-only'; // secret-scan: ok (a made-up key for the test)
function world() { store.clear(); resetGuard(); route.resetReady(); return { DB: d1(), SALT: 'test-salt', READ_TOKEN: KEY }; } // secret-scan: ok
const post = (env, body, ip = '203.0.113.5', origin) => route.onRequestPost({ env, request: new Request('https://x/api/generators', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, ...(origin ? { origin } : {}) }, body: JSON.stringify(body) }) });
const get = async (env, q) => (await route.onRequestGet({ env, request: new Request('https://x/api/generators' + q) })).json();

test('publish, then read it back by its id; the text is kept exactly, no address anywhere', async () => {
  const env = world();
  const r = await (await post(env, { title: '  Tavern  names\n', text: STARTER })).json(); assert.equal(r.ok, true); assert.match(r.id, route.ID_RE);
  const g = await get(env, '?id=' + r.id); assert.equal(g.title, 'Tavern names'); assert.equal(g.text, STARTER); assert.equal(g.plays, 0);
  assert.ok(!JSON.stringify(env.DB.raw.prepare('SELECT * FROM void_gens_days').all()).includes('203.0.113.5'));
  assert.equal((await get(env, '?id=nope')).ok, false); assert.equal((await get(env, '?id=abcdefgh')).ok, false);
});
test('what is refused: errors in the text, an empty text, a key, a rude title, a foreign origin, too big', async () => {
  const env = world(); let n = 0; const err = async (b) => (await (await post(env, b, '192.0.2.' + ++n)).json()).error || ''; // a new connection each: the minute limit counts refusals too
  assert.match(await err({ title: 'x', text: 'output\n  [nope]\n' }), /fix line 2 first: there is no list called nope/);
  assert.match(await err({ title: 'x', text: '  ' }), /empty/);
  assert.match(await err({ title: 'x', text: 'output\n  ghp_' + 'a1B2c3D4e5'.repeat(4) + '\n' }), /key or a password/); // secret-scan: ok (a made-up token shape)
  assert.match(await err({ title: 'porn names', text: 'a\nb' }), /another title/);
  assert.equal((await post(env, { title: 'x', text: 'a\nb' }, '1.2.3.4', 'https://evil.example')).status, 403);
  assert.match(await err({ title: 'x', text: 'a\n'.repeat(15000) }), /at most 20000/);
  assert.deepEqual(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM void_gens').get().n, 0);
});
test('limits: three a minute and ten a day per connection', async () => {
  const env = world();
  for (let i = 0; i < route.PUB_MINUTE; i++) assert.equal((await post(env, { title: 'g' + i, text: 'a\nb' })).status, 200);
  assert.equal((await post(env, { title: 'g', text: 'a\nb' })).status, 429);
  env.DB.raw.prepare("UPDATE void_gens_days SET n = ? WHERE k LIKE 'pub:%' AND k <> 'pub:all'").run(route.PUB_DAY); store.clear(); resetGuard();
  const r = await post(env, { title: 'g', text: 'a\nb' }); assert.equal(r.status, 429); assert.match((await r.json()).error, /enough publishing/);
});
test('newest and popular: a play counts once per connection a day; three reports from three connections hide it; the owner deletes', async () => {
  const env = world();
  const a = (await (await post(env, { title: 'First', text: 'a\nb' }, '10.0.0.1')).json()).id;
  const b = (await (await post(env, { title: 'Second', text: 'c\nd' }, '10.0.0.2')).json()).id;
  env.DB.raw.prepare('UPDATE void_gens SET made = made - 1000 WHERE id = ?').run(a);
  assert.deepEqual((await get(env, '?sort=new')).items.map((x) => x.title), ['Second', 'First']);
  for (const ip of ['10.0.1.1', '10.0.1.2', '10.0.1.1']) assert.equal((await (await post(env, { id: a, act: 'play' }, ip)).json()).ok, true);
  const pop = (await get(env, '?sort=popular')).items; assert.equal(pop[0].title, 'First'); assert.equal(pop[0].plays, 2, 'the same connection twice counts once'); assert.equal(pop[1].lines, 2);
  for (const ip of ['10.0.2.1', '10.0.2.1', '10.0.2.2']) await post(env, { id: b, act: 'report' }, ip);
  assert.equal((await get(env, '?sort=new')).items.length, 2, 'two connections are not enough');
  await post(env, { id: b, act: 'report' }, '10.0.2.3');
  assert.deepEqual((await get(env, '?sort=new')).items.map((x) => x.title), ['First']); assert.equal((await get(env, '?id=' + b)).ok, false);
  const del = (key) => route.onRequestDelete({ env, request: new Request('https://x/api/generators?id=' + a, { method: 'DELETE', headers: key ? { authorization: 'Bearer ' + key } : {} }) });
  assert.equal((await del('')).status, 401); assert.equal((await del('wrong')).status, 401);
  assert.equal((await del(KEY)).status, 200); assert.equal((await get(env, '?id=' + a)).ok, false);
  assert.equal((await post(env, { id: '../x', act: 'play' })).status, 404);
});
test('off without D1 or SALT, never unguarded', async () => {
  const env = world(); delete env.SALT; assert.equal((await post(env, { title: 'x', text: 'a\nb' })).status, 503);
  assert.equal((await route.onRequestGet({ env: {}, request: new Request('https://x/api/generators') })).status, 503);
});
