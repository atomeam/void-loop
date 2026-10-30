// A whole calendar shared by link: lib/calshare.js (the rules) and functions/api/calshare.js (the route, with a FAKE D1). Run: node --test tools/calshare.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import * as route from '../void-live-deploy/functions/api/calshare.js';
import * as S from '../void-live-deploy/lib/calshare.js';
import { resetGuard } from '../void-live-deploy/lib/guard.js';

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
const world = () => { store.clear(); resetGuard(); route.resetReady(); return { DB: d1(), SALT: 'test-salt' }; }; // secret-scan: ok (a made-up salt for the test)
let ipN = 0; const ip = () => '203.0.113.' + (++ipN % 250);
const call = (env, method, { id = '', key = '', op = '', body, origin, from = ip() } = {}) => {
  const u = 'https://verse.test/api/calshare' + (id || op ? '?' + new URLSearchParams({ ...(id ? { id } : {}), ...(op ? { op } : {}) }) : '');
  const headers = { 'cf-connecting-ip': from, ...(key ? { 'x-cal-key': key } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(origin ? { origin } : {}) };
  const request = new Request(u, { method, headers, ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) });
  return route['onRequest' + method[0] + method.slice(1).toLowerCase()]({ request, env }).then(async (r) => ({ status: r.status, j: await r.json() }));
};
const cal = { name: 'Family', color: '#1c7ed6', events: [{ title: 'Swim', start: '2026-11-02T17:00', end: '2026-11-02T18:00', rrule: { freq: 'WEEKLY' } }, { title: '<b>x</b>', start: '2026-11-03', allDay: true, cal: 'c-work', ro: true }] };

test('parseDoc: a name, a colour, events cut to the calendar\'s shape (no calendar of their own, nothing read only); fixed errors', () => {
  const p = S.parseDoc(cal); assert.equal(p.ok, true); assert.equal(p.doc.events.length, 2); assert.equal(p.doc.events[1].cal, undefined); assert.equal(p.doc.events[1].ro, undefined); assert.equal(p.doc.events[1].title, '<b>x</b>', 'kept as text; the page draws text');
  assert.equal(S.parseDoc({ ...cal, name: ' ' }).ok, false); assert.equal(S.parseDoc({ ...cal, events: 'x' }).ok, false); assert.equal(S.parseDoc('{no').status, 400);
  assert.equal(S.parseDoc({ ...cal, events: Array.from({ length: 1001 }, () => ({ title: 'a', start: '2026-01-01' })) }).status, 413);
  assert.equal(S.parseDoc('x'.repeat(S.LIMITS.body + 1)).status, 413);
  assert.equal(S.parseDoc({ ...cal, color: 'red' }).doc.color, '#1c7ed6');
});
test('links: the key rides after #, read back from the hash; ids and keys have one shape', () => {
  const id = S.newShareId(), key = S.newKey(); assert.ok(S.isId(id) && S.isKey(key));
  const link = S.linkOf('https://a-to-mind.com', id, key); assert.match(link, /^https:\/\/a-to-mind\.com\/calendar\/#share=/);
  assert.deepEqual(S.fromHash(new URL(link).hash), { id, key }); assert.equal(S.fromHash('#share=abc.def'), null);
});
test('share, open with each link, change with the edit link, refuse a stale change, reset the links, stop sharing', async () => {
  const env = world();
  const made = await call(env, 'POST', { body: cal }); assert.equal(made.status, 200); const { id, owner, edit, view, rev } = made.j; assert.equal(rev, 1);
  const row = await env.DB.prepare('SELECT * FROM void_calshare WHERE id = ?').bind(id).first();
  assert.ok(![owner, edit, view].some((k) => JSON.stringify(row).includes(k)), 'no key is stored, only hashes');
  for (const [k, role] of [[owner, 'owner'], [edit, 'edit'], [view, 'view']]) { const r = await call(env, 'GET', { id, key: k }); assert.equal(r.j.role, role); assert.equal(r.j.events.length, 2); assert.equal(r.j.name, 'Family'); }
  assert.equal((await call(env, 'GET', { id, key: S.newKey() })).status, 404); assert.equal((await call(env, 'GET', { id: S.newShareId(), key: view })).status, 404);
  const doc = { ...cal, events: [...cal.events, { title: 'Dentist', start: '2026-11-05T15:00' }] };
  assert.equal((await call(env, 'PUT', { id, key: view, body: { ...doc, rev: 1 } })).status, 403, 'a view link cannot change it');
  const put = await call(env, 'PUT', { id, key: edit, body: { ...doc, rev: 1 } }); assert.equal(put.j.rev, 2);
  const stale = await call(env, 'PUT', { id, key: edit, body: { ...cal, rev: 1 } }); assert.equal(stale.status, 409); assert.equal(stale.j.rev, 2); assert.equal(stale.j.events.length, 3, 'the current calendar comes back');
  assert.equal((await call(env, 'POST', { id, key: edit, op: 'reset' })).status, 404, 'only the owner resets');
  const reset = await call(env, 'POST', { id, key: owner, op: 'reset' }); assert.ok(S.isKey(reset.j.edit) && S.isKey(reset.j.view));
  assert.equal((await call(env, 'GET', { id, key: view })).status, 404, 'the old view link is dead'); assert.equal((await call(env, 'GET', { id, key: reset.j.view })).j.role, 'view');
  assert.equal((await call(env, 'DELETE', { id, key: reset.j.edit })).status, 404); assert.equal((await call(env, 'DELETE', { id, key: owner })).j.ok, true);
  assert.equal((await call(env, 'GET', { id, key: owner })).status, 404);
});
test('bounded: a foreign origin is refused, no D1 or SALT is off, 20 new calendars a day from one connection, JSON only', async () => {
  const env = world();
  assert.equal((await call(env, 'POST', { body: cal, origin: 'https://evil.example' })).status, 403);
  assert.equal((await call({ DB: env.DB }, 'POST', { body: cal })).status, 503);
  assert.equal((await call(env, 'POST', { body: 'name=x' })).status, 400);
  let last; for (let i = 0; i < S.LIMITS.createsPerDay + 1; i++) { resetGuard(); last = await call(env, 'POST', { body: cal, from: '198.51.100.9' }); }
  assert.equal(last.status, 429);
});
test('the page\'s calendar entry and events: drawn on that calendar, read only from a view link', () => {
  const e = S.calendarEntry('AAAAAAAAAAA', 'k'.repeat(22), 'view', { name: 'Family', color: '#1c7ed6' }); assert.equal(e.id, 'sh-AAAAAAAAAAA'); assert.equal(e.kind, 'shared');
  const ev = S.eventsOf(e.id, 'view', [{ id: 'a', title: 'Swim' }]); assert.equal(ev[0].cal, e.id); assert.equal(ev[0].ro, true); assert.equal(S.eventsOf(e.id, 'edit', [{ id: 'a' }])[0].ro, undefined);
});
