// Routines that spread between Voids (frontier #13, its second piece): "offer my morning as Sam" sends that routine's asks
// (only them, short, secrets masked) with the name Sam chose to a list the owner reviews; "routines from others" shows the
// approved ones with their author. Run: node --test tools/shared-routines.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { cleanOffer, offerAsk, othersAsk, takeAsk, findShared, takeName, pendingAsk } from '../void-live-deploy/lib/shared-routines.js';
import * as api from '../void-live-deploy/functions/api/routines.js';

const TOKEN = 'owner-token-for-tests-1234567890';
function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ sql, a, bind: (...b) => stmt(sql, b),
    run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; },
    all: async () => ({ results: db.prepare(sql).all(...a) }), first: async (col) => { const r = db.prepare(sql).get(...a) || null; return col ? (r ? r[col] : null) : r; } });
  return { prepare: (sql) => stmt(sql), raw: db };
}
const req = (method, body, owner = false, q = '') => new Request('https://a-to-mind.com/api/routines' + q, { method, headers: { 'content-type': 'application/json', ...(owner ? { authorization: 'Bearer ' + TOKEN } : {}) }, body: body ? JSON.stringify(body) : undefined });
const call = async (fn, env, r) => { const res = await fn({ request: r, env }); let j = null; try { j = await res.json(); } catch (_) {} return { status: res.status, j }; };

test('an offer is only the routine: a name, a chosen author, at most four short asks, secrets masked, nothing else', () => {
  assert.deepEqual(cleanOffer({ name: 'morning', author: 'Sam', asks: ['weather here', 'my calendar', 'a 25 minute timer'], extra: 'x' }),
    { name: 'morning', author: 'Sam', asks: ['weather here', 'my calendar', 'a 25 minute timer'] });
  assert.match(cleanOffer({ name: 'morning', author: 'Sam', asks: ['email me at sk-live-abcdefghijklmnopqrstuvwx'] }).error, /secret/);
  for (const bad of [{ name: '', author: 'Sam', asks: ['a b'] }, { name: 'morning', author: '', asks: ['a b'] }, { name: 'morning', author: 'Sam', asks: [] },
    { name: 'morning', author: 'Sam', asks: ['a b', 'c d', 'e f', 'g h', 'i j'] }, { name: 'morning', author: 'Sam', asks: ['x'.repeat(121)] },
    { name: 'morning', author: '<b>Sam</b>', asks: ['a b'] }, { name: 'morning', author: 'Verse', asks: ['a b'] }, null]) assert.ok(cleanOffer(bad).error, JSON.stringify(bad));
});

test('the asks: "offer my morning as Sam" (a display name is required), "routines from others"', () => {
  assert.deepEqual(offerAsk('offer my morning as Sam', { morning: {} }), { name: 'morning', author: 'Sam' });
  assert.deepEqual(offerAsk('share my morning routine as Sam Lee', { morning: {} }), { name: 'morning', author: 'Sam Lee' });
  assert.deepEqual(offerAsk('offer my morning', { morning: {} }), { name: 'morning', author: null }, 'no name yet: Verse asks for one');
  assert.equal(offerAsk('offer my evening as Sam', { morning: {} }), null, 'only a routine that exists');
  for (const q of ['routines from others', "other people's routines", 'shared routines']) assert.ok(othersAsk(q), q);
  for (const q of ['offer my condolences', 'share my screen', 'my routines']) assert.ok(!offerAsk(q, { morning: {} }) && !othersAsk(q), q);
});

test('the route: an offer waits for the owner; only approved ones are shown; only the owner sees or decides what waits', async () => {
  const env = { DB: d1(), READ_TOKEN: TOKEN };
  const o = await call(api.onRequestPost, env, req('POST', { name: 'morning', author: 'Sam', asks: ['weather here', 'my calendar'] }));
  assert.deepEqual([o.status, o.j.state], [202, 'pending']);
  assert.equal((await call(api.onRequestPost, env, req('POST', { name: 'morning', author: 'Sam', asks: ['weather here', 'my calendar'] }))).j.state, 'pending', 'the same offer twice is one');
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM void_routines').get().n, 1);
  assert.deepEqual((await call(api.onRequestGet, env, req('GET'))).j, [], 'nothing shown before the owner approves');
  assert.equal((await call(api.onRequestGet, env, req('GET', null, false, '?pending=1'))).status, 401, 'what waits is the owner\'s');
  const waiting = (await call(api.onRequestGet, env, req('GET', null, true, '?pending=1'))).j;
  assert.equal(waiting.length, 1);
  assert.equal((await call(api.onRequestPost, env, req('POST', { approve: waiting[0].id }))).status, 401, 'only the owner approves');
  assert.equal((await call(api.onRequestPost, env, req('POST', { approve: waiting[0].id }, true))).status, 200);
  assert.deepEqual((await call(api.onRequestGet, env, req('GET'))).j, [{ id: waiting[0].id, name: 'morning', author: 'Sam', asks: ['weather here', 'my calendar'] }]);
  assert.equal((await call(api.onRequestPost, env, req('POST', { name: 'x', author: '<i>', asks: ['a b'] }))).status, 400);
});

test('taking one: "take Sam\'s morning" (always with "routine"; without it, only a pair the list of others showed)', () => {
  const seen = [{ id: 'a', name: 'morning', author: 'Sam Lee', asks: ['weather here'] }, { id: 'b', name: 'study', author: 'Ana', asks: ['a 25 minute timer'] }];
  assert.deepEqual(takeAsk("take Sam Lee's morning routine"), { author: 'Sam Lee', name: 'morning' });
  assert.deepEqual(takeAsk("copy Ana’s study routine"), { author: 'Ana', name: 'study' });
  assert.deepEqual(takeAsk("take Sam Lee's morning", seen), { author: 'Sam Lee', name: 'morning' });
  assert.deepEqual(takeAsk("use ana's study", seen), { author: 'ana', name: 'study' });
  for (const q of ["take Sam's advice", "take Ana's morning", 'take a picture', "take my morning", "what's Ana's study"]) assert.equal(takeAsk(q, seen), null, q);
  assert.equal(findShared(seen, { author: 'sam lee', name: 'morning' }).id, 'a', 'the author matches in any case');
  assert.equal(findShared(seen, { author: 'Sam', name: 'morning' }), null);
});

test('taking one never replaces a routine of your own: a free name is kept, a taken one gets the author\'s name in front', () => {
  const r = { name: 'morning', author: 'Sam Lee', asks: ['weather here'] };
  assert.equal(takeName({}, r), 'morning');
  assert.equal(takeName({ morning: { asks: ['flip a coin'] } }, r), "sam lee's morning");
  assert.equal(takeName({ morning: { asks: ['weather here'] } }, r), null, 'already yours, the same asks');
  assert.equal(takeName({ morning: { asks: ['flip a coin'] }, "sam lee's morning": { asks: ['weather here'] } }, r), null);
});

test('the owner\'s ask: "offered routines" (what waits for a yes)', () => {
  for (const q of ['offered routines', 'routines waiting', 'review offered routines', 'pending routines', 'routine offers', 'approve routines']) assert.ok(pendingAsk(q), q);
  for (const q of ['routines from others', 'my routines', 'pending orders', 'offered jobs']) assert.ok(!pendingAsk(q), q);
});
