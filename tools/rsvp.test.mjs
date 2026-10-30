// Replies to an invite: lib/rsvp.js (the rules) and functions/api/rsvp.js (the route, with a FAKE D1). Run: node --test tools/rsvp.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import * as route from '../void-live-deploy/functions/api/rsvp.js';
import { RSVP, parseReply, withReply, tally, rsvpFromHash } from '../void-live-deploy/lib/rsvp.js';
import { inviteLink, normalize } from '../void-live-deploy/lib/calendar.js';
import { resetGuard } from '../void-live-deploy/lib/guard.js';

const mem = new Map();
globalThis.caches = { default: { match: async (q) => (mem.has(q.url) ? new Response(mem.get(q.url)) : undefined), put: async (q, r) => { mem.set(q.url, await r.text()); } } };
function d1() { const db = new DatabaseSync(':memory:'); const st = (sql, a = []) => ({ bind: (...b) => st(sql, b), run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...a).changes) } }), first: async () => db.prepare(sql).get(...a) || null, all: async () => ({ results: db.prepare(sql).all(...a) }) }); return { prepare: (sql) => st(sql) }; }
const world = () => { mem.clear(); resetGuard(); route.resetReady(); return { DB: d1(), SALT: 'test-salt' }; }; // secret-scan: ok (a made-up salt for the test)
const call = (env, method, { id = '', key = '', op = '', body, origin } = {}) => { resetGuard();
  const u = 'https://verse.test/api/rsvp' + (id || op ? '?' + new URLSearchParams({ ...(id ? { id } : {}), ...(op ? { op } : {}) }) : '');
  const request = new Request(u, { method, headers: { 'cf-connecting-ip': '203.0.113.4', ...(key ? { 'x-cal-key': key } : {}), ...(origin ? { origin } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return route['onRequest' + method[0] + method.slice(1).toLowerCase()]({ request, env }).then(async (r) => ({ status: r.status, j: await r.json() })); };

test('rules: a name and yes, maybe or no; one reply per name; the tally', () => {
  assert.deepEqual(parseReply({ name: '  Sam <b> ', answer: 'yes' }), { ok: true, name: 'Sam b', answer: 'yes' });
  for (const b of [{ name: '', answer: 'yes' }, { name: 'Sam', answer: 'sure' }, '{x']) assert.equal(parseReply(b).ok, false);
  let l = withReply([], { name: 'Sam', answer: 'maybe' }, 1); l = withReply(l, { name: 'Ana', answer: 'yes' }, 2); l = withReply(l, { name: 'sam', answer: 'yes' }, 3);
  assert.deepEqual(l.map((r) => r.name + ':' + r.answer), ['Ana:yes', 'sam:yes']); assert.equal(tally(l), '2 yes');
});
test('the invite link carries the reply key after #, never the organizer\'s', () => {
  const rsvp = { id: 'AAAAAAAAAAA', owner: 'o'.repeat(22), reply: 'r'.repeat(22) };
  const e = normalize({ title: 'Dinner', start: '2026-11-07T19:00', rsvp }); assert.deepEqual(e.rsvp, rsvp);
  const { url } = inviteLink(e, 'https://a-to-mind.com'); assert.ok(!url.includes('o'.repeat(22))); assert.deepEqual(rsvpFromHash(new URL(url).hash), { id: rsvp.id, key: rsvp.reply });
  assert.ok(!atob(new URL(url).searchParams.get('e').replace(/-/g, '+').replace(/_/g, '/')).includes('rsvp'));
});
test('the route: make an invite, reply with the link, see the replies, the organizer clears them; wrong keys are a 404', async () => {
  const env = world(); const m = await call(env, 'POST', {}); assert.equal(m.j.ok, true); const { id, owner, reply } = m.j;
  assert.equal((await call(env, 'POST', { id, key: reply, op: 'reply', body: { name: 'Sam', answer: 'yes' } })).j.replies.length, 1);
  await call(env, 'POST', { id, key: reply, op: 'reply', body: { name: 'Ana', answer: 'no' } }); await call(env, 'POST', { id, key: reply, op: 'reply', body: { name: 'ana', answer: 'maybe' } });
  const seen = await call(env, 'GET', { id, key: owner }); assert.equal(seen.j.role, 'owner'); assert.deepEqual(seen.j.replies.map((r) => r.answer), ['yes', 'maybe']);
  assert.equal((await call(env, 'GET', { id, key: reply })).j.role, 'reply');
  assert.equal((await call(env, 'DELETE', { id, key: reply })).status, 404, 'a guest cannot clear them'); assert.equal((await call(env, 'DELETE', { id, key: owner })).j.ok, true);
  assert.equal((await call(env, 'GET', { id, key: owner })).j.replies.length, 0);
  assert.equal((await call(env, 'GET', { id, key: 'x'.repeat(22) })).status, 404);
  assert.equal((await call(env, 'POST', { id, key: reply, op: 'reply', body: { name: 'Bo', answer: 'yes' }, origin: 'https://evil.example' })).status, 403);
  assert.equal((await call({ DB: env.DB }, 'POST', {})).status, 503);
});
test('bounded: 50 invites a day from one connection', async () => { const env = world(); let last; for (let i = 0; i < RSVP.createsPerDay + 1; i++) last = await call(env, 'POST', {}); assert.equal(last.status, 429); });
