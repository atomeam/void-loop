// The agent's allowance (lib/agent-cap.js, functions/api/agent.js): inside the free tasks, past them with the pot paying, past them with nothing to pay (a kind
// message with the UniVerse page), and the house lane's key skipping every count. Run: node --test tools/agent-cap.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { admit, capReply, potCents, billPot, resetsAt, LIMITS, OFFER } from '../void-live-deploy/lib/agent-cap.js';
import * as agent from '../void-live-deploy/functions/api/agent.js';
import { askLive } from './assistant-exam.mjs';
import fs from 'node:fs';

const d1 = () => { const db = new DatabaseSync(':memory:'); const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => { db.prepare(sql).run(...a); return {}; }, all: async () => ({ results: db.prepare(sql).all(...a) }), first: async () => db.prepare(sql).get(...a) || null }); return { prepare: (sql) => stmt(sql), exec: (s) => db.exec(s) }; };
const req = (token) => new Request('https://x.test/api/agent', { method: 'POST', headers: token ? { authorization: 'Bearer ' + token } : {} });
const fund = async (env, cents) => { await env.DB.prepare('CREATE TABLE IF NOT EXISTS void_treasury (id TEXT PRIMARY KEY, at TEXT NOT NULL, kind TEXT NOT NULL, bucket TEXT, cents INTEGER NOT NULL, purpose TEXT, expected TEXT, actual TEXT, status TEXT, needs TEXT, ref TEXT, data TEXT)').run(); await env.DB.prepare("INSERT INTO void_treasury (id, at, kind, bucket, cents) VALUES ('f', '2026-11-20', 'alloc', 'infrastructure', ?)").bind(cents).run(); };

test('inside the free tasks nothing is paid; the twenty-first of a visitor and the four-hundred-and-first of the day are the edges', async () => {
  const env = { DB: d1() };
  for (let i = 0; i < LIMITS.perIp; i++) assert.deepEqual(await admit(env, req(), 'ip1'), { ok: true, paid: false });
  assert.equal((await admit(env, req(), 'ip1')).ok, false, 'past twenty with an empty pot: no');
  assert.deepEqual(await admit(env, req(), 'ip2'), { ok: true, paid: false }, 'another visitor still has theirs');
});
test('past the free tasks the pot pays when it has money, inside a smaller paid overflow, and stops when it is empty again', async () => {
  const env = { DB: d1() }; await fund(env, 500);
  for (let i = 0; i < LIMITS.perIp; i++) await admit(env, req(), 'ip1');
  for (let i = 0; i < LIMITS.paidPerIp; i++) assert.deepEqual(await admit(env, req(), 'ip1'), { ok: true, paid: true });
  assert.equal((await admit(env, req(), 'ip1')).ok, false, 'ten paid a day for one visitor, then the kind message');
  assert.equal(await potCents(env), 500); assert.equal(await billPot(env, 0.2, 'm'), 1, 'the smallest bill is one cent'); assert.equal(await potCents(env), 499);
});
test('a pot under two cents cannot pay: capped, with the UniVerse page and when the tasks come back', async () => {
  const env = { DB: d1() }; await fund(env, 1);
  for (let i = 0; i < LIMITS.perIp; i++) await admit(env, req(), 'ip1');
  assert.equal((await admit(env, req(), 'ip1')).ok, false);
  const r = capReply(Date.UTC(2026, 10, 20, 15)); assert.equal(r.ok, false); assert.equal(r.capped, true); assert.deepEqual(r.offer, OFFER); assert.equal(r.resets, '2026-11-21T00:00:00.000Z'); assert.equal(resetsAt(Date.UTC(2026, 10, 20, 23, 59)), '2026-11-21T00:00:00.000Z');
  assert.match(r.say, /used today's free tasks/); assert.match(r.say, /Nothing is lost/); assert.match(r.say, /midnight UTC/); assert.match(r.say, /UniVerse/); assert.ok(!/error|fail|alert/i.test(r.say));
});
test('the owner key skips every count (and is checked, not just present); a wrong key is a visitor', async () => {
  const env = { DB: d1(), READ_TOKEN: 'owner-key-123456' };
  for (let i = 0; i < LIMITS.perIp + 5; i++) assert.deepEqual(await admit(env, req('owner-key-123456'), 'lane'), { ok: true, owner: true, paid: false });
  assert.equal(await (async () => { const rows = await env.DB.prepare("SELECT n FROM void_daily_cap WHERE key = 'agent-all'").all().catch(() => ({ results: [] })); return (rows.results || []).length; })(), 0, 'the lane took no place from the visitors');
  for (let i = 0; i < LIMITS.perIp; i++) await admit(env, req('wrong-key'), 'ip9');
  assert.equal((await admit(env, req('wrong-key'), 'ip9')).ok, false);
});
test('POST /api/agent past the cap answers 429 with the kind message and the offer, never a blank, and a lane key still gets a task', async () => {
  const env = { DB: d1(), AI: { run: async () => ({ response: 'ok' }) }, READ_TOKEN: 'owner-key-123456' }, waits = [];
  const post = (token, ip) => agent.onRequestPost({ env, waitUntil: (p) => waits.push(p), request: new Request('https://x.test/api/agent', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify({ thread: 'abcdefghijklmnop' + ip.replace(/\D/g, ''), ask: 'what is two plus two' }) }) });
  const realFetch = globalThis.fetch; globalThis.fetch = async () => new Response('{}', { status: 404 });
  try {
    for (let i = 0; i < LIMITS.perIp; i++) assert.equal((await post(null, '1.1.1.1')).status, 200);
    const capped = await post(null, '1.1.1.1'), j = await capped.json();
    assert.equal(capped.status, 429); assert.equal(j.capped, true); assert.equal(j.offer.url, '/gate'); assert.match(j.say, /Nothing is lost/);
    const lane = await post('owner-key-123456', '1.1.1.1'); assert.equal(lane.status, 200); assert.equal((await lane.json()).ok, true);
    await Promise.allSettled(waits);
  } finally { globalThis.fetch = realFetch; }
});
test('the exam sends the owner key to a-to-mind.com only, and sends nothing when there is no key', async () => {
  const seen = []; const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, o) => { seen.push({ url: String(url), auth: (o && o.headers && o.headers.authorization) || '' }); return new Response(JSON.stringify({ ok: false }), { status: 429 }); };
  try {
    await askLive('https://a-to-mind.com', 'q?', { VOID_OWNER_TOKEN: 'sekret' }); await askLive('https://evil.example', 'q?', { VOID_OWNER_TOKEN: 'sekret' }); await askLive('https://a-to-mind.com.evil.example', 'q?', { VOID_OWNER_TOKEN: 'sekret' }); await askLive('https://a-to-mind.com', 'q?', {});
  } finally { globalThis.fetch = realFetch; }
  assert.deepEqual(seen.map((x) => x.auth), ['Bearer sekret', '', '', '']);
});
test('the agent page shows a refusal as a note beside the box, keeps the words, and never uses an alert', () => {
  const html = fs.readFileSync(new URL('../void-live-deploy/agent/index.html', import.meta.url), 'utf8');
  assert.match(html, /id="capnote"/); assert.ok(!/alert\(j\.say/.test(html)); assert.match(html, /\.catch\(\(\) => \(\{ ok: false, say: 'I could not reach Verse just now/);
  assert.match(html, /if \(j\.ok\) \{ \$\('ask'\)\.value = ''; note\(null\); \} else note\(j\)/);
});
