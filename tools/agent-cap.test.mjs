// The agent's allowance (lib/agent-cap.js, functions/api/agent.js): a generous per-visitor limit, no flat count for everyone, refusal only when every provider and the pot are out (a kind
// message with the UniVerse page), and the house lane's key skipping the visitor limit. Run: node --test tools/agent-cap.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { admit, capReply, potCents, billPot, resetsAt, LIMITS, OFFER } from '../void-live-deploy/lib/agent-cap.js';
import { park, exhausted, WORKERS } from '../void-live-deploy/lib/agent-providers.js';
import * as agent from '../void-live-deploy/functions/api/agent.js';
import { askLive } from './assistant-exam.mjs';
import fs from 'node:fs';

const d1 = () => { const db = new DatabaseSync(':memory:'); const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => { db.prepare(sql).run(...a); return {}; }, all: async () => ({ results: db.prepare(sql).all(...a) }), first: async () => db.prepare(sql).get(...a) || null }); return { prepare: (sql) => stmt(sql), exec: (s) => db.exec(s) }; };
const req = (token) => new Request('https://x.test/api/agent', { method: 'POST', headers: token ? { authorization: 'Bearer ' + token } : {} });
const fund = async (env, cents) => { await env.DB.prepare('CREATE TABLE IF NOT EXISTS void_treasury (id TEXT PRIMARY KEY, at TEXT NOT NULL, kind TEXT NOT NULL, bucket TEXT, cents INTEGER NOT NULL, purpose TEXT, expected TEXT, actual TEXT, status TEXT, needs TEXT, ref TEXT, data TEXT)').run(); await env.DB.prepare("INSERT INTO void_treasury (id, at, kind, bucket, cents) VALUES ('f', '2026-11-20', 'alloc', 'infrastructure', ?)").bind(cents).run(); };

test('a visitor has a generous day of their own; nobody is stopped by a flat count for everyone', async () => {
  const env = { DB: d1(), AI: {} };
  for (let i = 0; i < LIMITS.perIp; i++) assert.deepEqual(await admit(env, req(), 'ip1'), { ok: true });
  assert.deepEqual(await admit(env, req(), 'ip1'), { ok: false, reason: 'visitor' }, 'past their own day: refused with a reason');
  for (let v = 0; v < 30; v++) for (let i = 0; i < 20; i++) assert.equal((await admit(env, req(), 'v' + v)).ok, true, 'thirty visitors, six hundred tasks, no global stop');
  assert.ok(LIMITS.perIp >= 100 && !('all' in LIMITS));
});
test('everything out and an empty pot is the only way a visitor is refused for capacity; the pot paying, or any free provider left, lets them in', async () => {
  const day = { AI: {}, DB: d1() }, now = Date.now();
  assert.equal((await admit(day, req(), 'a')).ok, true, 'nothing parked');
  await park(day, WORKERS.id, '', 'day', now);
  assert.deepEqual(await admit(day, req(), 'a'), { ok: false, reason: 'exhausted' }, 'Workers AI out, no other key, empty pot');
  assert.equal(await exhausted({ ...day, GROQ_API_KEY: 'k' }, { now }), false, 'a free provider with a key is still open');
  await fund(day, 500); assert.equal((await admit(day, req(), 'a')).ok, true, 'the pot can pay');
  assert.equal(await potCents(day), 500); assert.equal(await billPot(day, 0.2, 'm'), 1, 'the smallest bill is one cent'); assert.equal(await potCents(day), 499);
  const e2 = { AI: {}, DB: d1() }; await fund(e2, 1); await park(e2, WORKERS.id, '', 'day', now);
  assert.equal((await admit(e2, req(), 'b')).ok, false, 'a pot under two cents cannot pay');
});
test('the refusals are kind and clear, with the UniVerse page and when it resets', () => {
  const r = capReply('exhausted', Date.UTC(2026, 10, 20, 15)); assert.equal(r.ok, false); assert.equal(r.capped, true); assert.deepEqual(r.offer, OFFER); assert.equal(r.resets, '2026-11-21T00:00:00.000Z'); assert.equal(resetsAt(Date.UTC(2026, 10, 20, 23, 59)), '2026-11-21T00:00:00.000Z');
  assert.match(r.say, /used up for today/); assert.match(r.say, /Nothing is lost/); assert.match(r.say, /midnight UTC/); assert.match(r.say, /UniVerse/); assert.ok(!/error|fail|alert/i.test(r.say));
  const v = capReply('visitor'); assert.match(v.say, /most one visitor/); assert.equal(v.reason, 'visitor');
});
test('the owner key skips the visitor limit (and is checked, not just present); a wrong key is a visitor', async () => {
  const env = { DB: d1(), READ_TOKEN: 'owner-key-123456' };
  for (let i = 0; i < LIMITS.perIp + 5; i++) assert.deepEqual(await admit(env, req('owner-key-123456'), 'lane'), { ok: true, owner: true });
  for (let i = 0; i < LIMITS.perIp; i++) await admit(env, req('wrong-key'), 'ip9');
  assert.equal((await admit(env, req('wrong-key'), 'ip9')).ok, false);
});
test('POST /api/agent: a visitor over their limit gets 429 with the kind message and the offer, never a blank; a lane key still gets a task', async () => {
  const env = { DB: d1(), AI: { run: async () => ({ response: 'ok' }) }, READ_TOKEN: 'owner-key-123456' }, waits = [];
  const post = (token, ip) => agent.onRequestPost({ env, waitUntil: (p) => waits.push(p), request: new Request('https://x.test/api/agent', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify({ thread: 'abcdefghijklmnop' + ip.replace(/\D/g, ''), ask: 'what is two plus two' }) }) });
  const realFetch = globalThis.fetch; globalThis.fetch = async () => new Response('{}', { status: 404 });
  try {
    for (let i = 0; i < LIMITS.perIp; i++) assert.equal((await post(null, '1.1.1.1')).status, 200);
    const capped = await post(null, '1.1.1.1'), j = await capped.json();
    assert.equal(capped.status, 429); assert.equal(j.capped, true); assert.equal(j.offer.url, '/gate'); assert.match(j.say, /most one visitor/);
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
