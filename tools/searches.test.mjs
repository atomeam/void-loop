// The owner's Searches log (lib/searches.js, functions/api/searches.js): every ask is kept, the minors / illegal block flags its asks, strikes slow
// and lock, the Ban button works, and nobody but the owner can read the list. Text only. Run: node --test tools/searches.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { record, view, memoryStore, visitorId, blockedOf, SLOW_AT, LOCK_AT } from '../void-live-deploy/lib/searches.js';
import * as api from '../void-live-deploy/functions/api/searches.js';
import { ownerOnlyPath } from '../void-live-deploy/lib/owner-gate.js';

test('a blocked ask is logged and flagged; a normal ask is logged unflagged', async () => {
  const s = memoryStore();
  const a = await record(s, { ask: 'naked children', who: 'v-a' });
  const b = await record(s, { ask: 'the matrix', who: 'v-b' });
  assert.equal(a.blocked, 'minor'); assert.equal(b.blocked, '');
  const rows = await view(s);
  assert.equal(rows.length, 2);
  assert.equal(rows.find((r) => r.who === 'v-a').blocked, 'minor');
  assert.equal(rows.find((r) => r.who === 'v-b').blocked, '');
  assert.equal(blockedOf('Slipknot'), '');
});
test('strikes: 3 blocked asks in a day slows, 5 locks until the owner lifts it', async () => {
  const s = memoryStore(); let last;
  for (let i = 1; i <= LOCK_AT; i++) { last = await record(s, { ask: 'underage nude ' + i, who: 'v-x', now: 1e12 + i }); if (i === SLOW_AT) assert.equal(last.state, 'slow'); }
  assert.equal(last.state, 'locked');
  assert.equal((await record(s, { ask: 'cats', who: 'v-x', now: 1e12 + 99 })).state, 'locked');
  await s.setBan('v-x', '', '');
  assert.equal((await record(s, { ask: 'cats', who: 'v-x', now: 1e12 + 100 })).state, '');
});
test('a non-owner gets 404 on the list and on the Ban button; the ask beacon still works', async () => {
  api.resetMem();
  const r = await api.onRequestGet({ request: new Request('https://a-to-mind.com/api/searches'), env: {} });
  assert.equal(r.status, 404);
  const b = await api.onRequestPost({ request: new Request('https://a-to-mind.com/api/searches', { method: 'POST', body: JSON.stringify({ ban: 'v-1', state: 'banned' }) }), env: {} });
  assert.equal(b.status, 404);
  const ok = await api.onRequestPost({ request: new Request('https://a-to-mind.com/api/searches', { method: 'POST', body: JSON.stringify({ ask: 'the matrix' }) }), env: {} });
  assert.equal((await ok.json()).ok, true);
  assert.match(r.headers.get('x-robots-tag') || '', /noindex/);
});
test('the visitor ID is a salted hash, never the IP', async () => {
  const req = new Request('https://a-to-mind.com/', { headers: { 'cf-connecting-ip': '203.0.113.9', 'user-agent': 'x' } });
  const id = await visitorId(req, { SALT: 's' });
  assert.match(id, /^v-[0-9a-f]{12}$/); assert.ok(!id.includes('203'));
  assert.notEqual(id, await visitorId(req, { SALT: 't' }));
});
test('the Tower page is owner-only and noindex; the page logs asks; privacy says 90 days', () => {
  assert.equal(ownerOnlyPath('/tower.searches/'), true);
  assert.match(readFileSync(new URL('../void-live-deploy/tower.searches/index.html', import.meta.url), 'utf8'), /noindex/);
  assert.match(readFileSync(new URL('../void-live-deploy/index.html', import.meta.url), 'utf8'), /logAsk\(currentAsk, el\)/);
  assert.match(readFileSync(new URL('../void-live-deploy/privacy/index.html', import.meta.url), 'utf8'), /90 days/);
});

test('a signed-in account is logged from its server-checked session, never from the body; a ban on it follows it', async () => {
  const { report } = await import('../void-live-deploy/lib/searches.js');
  const fakeDb = { prepare: () => ({ bind: () => ({ first: async () => ({ user_id: 'USERHANDLE123', expires: Date.now() + 1e6 }) }) }) };
  const tok = 'x'.repeat(43);
  const signed = new Request('https://a-to-mind.com/api/searches', { method: 'POST', headers: { authorization: 'Bearer ' + tok } });
  assert.equal(await api.accountOf(signed, { DB: fakeDb }), 'a-USERHANDLE123');
  assert.equal(await api.accountOf(new Request('https://a-to-mind.com/api/searches'), {}), '');
  const s = memoryStore();
  await record(s, { ask: 'cats', who: 'v-1', acct: 'a-u1' });
  assert.equal(s.rows[0].acct, 'a-u1');
  await s.setBan('a-u1', 'banned', 'owner');
  assert.equal((await record(s, { ask: 'dogs', who: 'v-2', acct: 'a-u1' })).state, 'banned');
  assert.equal((await view(s, { who: 'a-u1' })).length, 2);
  const r = await report(s, { who: 'v-1', reason: 'bad picture', ask: 'nude beach', title: 'Nude beach', pic: 'https://upload.wikimedia.org/x.jpg' });
  assert.equal(r.reason, 'bad picture'); assert.equal(s.reports.length, 1);
  assert.equal((await report(s, { who: 'v-1', reason: 'spam<script>' })).reason, 'other');
});
test('every card gets the Report button, and it is never in a saved card', () => {
  const page = readFileSync(new URL('../void-live-deploy/index.html', import.meta.url), 'utf8');
  assert.match(page, /addReport\(el\)/); assert.match(page, /box\.dataset\.nosave = '1'/);
});
