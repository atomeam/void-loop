// The agent's real capacity (lib/agent-providers.js, functions/api/agent.js): rotate on 429, park what is spent, never send a visitor to a prompt-training free tier
// unless switched on, log who answered and what it cost. Run: node --test tools/agent-providers.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { PROVIDERS, usable, kindOf, answerFree, exhausted, capacityOf, park, parked } from '../void-live-deploy/lib/agent-providers.js';
import { GEMINI_MODELS } from '../void-live-deploy/lib/models.js';
import * as agent from '../void-live-deploy/functions/api/agent.js';

const d1 = () => { const db = new DatabaseSync(':memory:'); const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => { db.prepare(sql).run(...a); return {}; }, all: async () => ({ results: db.prepare(sql).all(...a) }), first: async () => db.prepare(sql).get(...a) || null }); return { prepare: (sql) => stmt(sql) }; };
const ok = (text) => new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200 });
const msgs = [{ role: 'user', content: 'hi' }];

test('refusals are read by what they say: a daily quota parks the day, a rate limit a minute, an unknown model is skipped', () => {
  assert.equal(kindOf(429, 'Rate limit reached on tokens per day (TPD)'), 'day');
  assert.equal(kindOf(429, 'Rate limit reached on requests per minute (RPM)'), 'minute');
  assert.equal(kindOf(429, 'You exceeded your current quota, PerDay'), 'day');
  assert.equal(kindOf(200, '4006: you have used up your daily free allocation of 10,000 neurons'), 'day');
  assert.equal(kindOf(429, '', 7200), 'day'); assert.equal(kindOf(404, 'model not found'), 'model'); assert.equal(kindOf(500, 'boom'), 'error');
});
test('only providers with a key are used, and prompt-training free tiers only for the owner\'s traffic or when switched on', () => {
  const ids = (e, o) => usable(e, o).map((p) => p.id);
  assert.deepEqual(ids({}), []); assert.deepEqual(ids({ GROQ_API_KEY: 'k', GEMINI_API_KEY: 'k', OPENROUTER_API_KEY: 'k' }), ['groq']);
  assert.deepEqual(ids({ GROQ_API_KEY: 'k', GEMINI_API_KEY: 'k' }, { owner: true }), ['groq', 'gemini']);
  assert.deepEqual(ids({ GEMINI_API_KEY: 'k', AGENT_PRIVATE_FREE: 'on' }), ['gemini']);
});
test('every provider is a live entry in the free registry and Gemini takes its models from the one shared list', () => {
  const reg = JSON.parse(fs.readFileSync(new URL('../void-live-deploy/resources/free.json', import.meta.url), 'utf8')).resources;
  for (const p of PROVIDERS) { const r = reg.find((x) => x.id === p.registry); assert.ok(r, p.id + ' is in the registry'); assert.ok(!r.ended, p.id + ' has not ended'); assert.equal(r.access, 'key:' + p.key); assert.equal(Boolean(r.note), p.private, p.id + ': a registry note about prompts means private'); }
  assert.equal(PROVIDERS.find((p) => p.id === 'gemini').models, GEMINI_MODELS);
});
test('rotation: a 429 on one model moves to the next, a daily quota parks it for the day, and the next ask skips it', async () => {
  const env = { DB: d1(), GROQ_API_KEY: 'k' }, calls = [];
  const fetchFn = async (url, o) => { const model = JSON.parse(o.body).model; calls.push(model); return model === 'llama-3.3-70b-versatile' ? new Response('tokens per day (TPD)', { status: 429 }) : ok('hello there'); };
  const a = await answerFree(env, msgs, { fetchFn });
  assert.equal(a.text, 'hello there'); assert.equal(a.provider, 'groq'); assert.equal(a.model, 'openai/gpt-oss-120b'); assert.deepEqual(calls, ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b']);
  assert.equal(await parked(env, 'groq', 'llama-3.3-70b-versatile'), true);
  calls.length = 0; await answerFree(env, msgs, { fetchFn }); assert.deepEqual(calls, ['openai/gpt-oss-120b'], 'the spent model is not asked again today');
});
test('every provider out: nothing answers, the exhausted check says so, and an empty answer counts as a miss, not a reply', async () => {
  const env = { DB: d1(), GROQ_API_KEY: 'k' };
  const none = await answerFree(env, msgs, { fetchFn: async () => new Response('requests per day (RPD)', { status: 429 }) });
  assert.equal(none.text, ''); assert.equal(none.tried.length, 3);
  assert.equal(await exhausted(env), true);
  const e2 = { DB: d1(), GROQ_API_KEY: 'k' }; const blank = await answerFree(e2, msgs, { fetchFn: async () => ok('  ') }); assert.equal(blank.text, '');
});
test('capacity names each provider, whether it is usable, and what it adds, with no key in it', async () => {
  const rows = await capacityOf({ DB: d1(), AI: {}, GROQ_API_KEY: 'sekret-key' });
  assert.deepEqual(rows.map((r) => [r.id, r.reachable]), [['workers-ai', true], ['groq', true], ['gemini', false], ['openrouter', false]]);
  assert.equal(rows[1].answersAvailableToday, 3000); assert.ok(!JSON.stringify(rows).includes('sekret-key'));
});
test('a task is answered by the next provider when Workers AI says its day is spent, and the log says who and what it cost', async () => {
  const env = { DB: d1(), AI: { run: async () => { throw new Error('4006: you have used up your daily free allocation of 10,000 neurons'); } }, GROQ_API_KEY: 'k' }, waits = [];
  const realFetch = globalThis.fetch; globalThis.fetch = async (url) => (String(url).includes('groq') ? ok('Two plus two is four.') : new Response('{}', { status: 404 }));
  try {
    const id = 'taskabcdefgh1234';
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS void_agent_tasks (id TEXT PRIMARY KEY, thread TEXT NOT NULL, ask TEXT NOT NULL, status TEXT NOT NULL, bot TEXT, tier TEXT, steps TEXT NOT NULL, result TEXT, created INTEGER NOT NULL, done INTEGER, seen INTEGER NOT NULL DEFAULT 0)').run();
    await env.DB.prepare('INSERT INTO void_agent_tasks (id, thread, ask, status, steps, created) VALUES (?, ?, ?, ?, ?, ?)').bind(id, 'abcdefghijklmnop1', 'what is 2 plus 2', 'queued', '[]', Date.now()).run();
    await agent.run(env, 'https://x.test', id, 'what is 2 plus 2', 'abcdefghijklmnop1');
    const t = await env.DB.prepare('SELECT status, tier, steps FROM void_agent_tasks WHERE id = ?').bind(id).first();
    assert.equal(t.status, 'done'); assert.equal(t.tier, 'free via groq'); assert.match(t.steps, /Answered by Groq \(llama-3\.3-70b-versatile\): free, 0 cents/);
    assert.equal(await parked(env, 'workers-ai', ''), true, 'Workers AI is parked for the day');
    const cap = await capacityOf(env); assert.equal(cap.find((r) => r.id === 'groq').answeredToday, 1);
  } finally { globalThis.fetch = realFetch; }
});
test('the owner key may pin one provider (Workers AI is skipped); a visitor\'s "via" is ignored', async () => {
  const mk = () => ({ DB: d1(), AI: { run: async () => ({ response: 'from workers' }) }, GROQ_API_KEY: 'k', READ_TOKEN: 'owner-key-123456' });
  const realFetch = globalThis.fetch; globalThis.fetch = async (url) => (String(url).includes('groq') ? ok('The three primary colors are red, yellow and blue.') : new Response('{}', { status: 404 }));
  const go = async (env, token, i) => {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS void_agent_tasks (id TEXT PRIMARY KEY, thread TEXT NOT NULL, ask TEXT NOT NULL, status TEXT NOT NULL, bot TEXT, tier TEXT, steps TEXT NOT NULL, result TEXT, created INTEGER NOT NULL, done INTEGER, seen INTEGER NOT NULL DEFAULT 0)').run();
    const waits = [], res = await agent.onRequestPost({ env, waitUntil: (p) => waits.push(p), request: new Request('https://x.test/api/agent', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '9.9.9.9', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify({ thread: 'abcdefghijklmnop' + i, ask: 'name three primary colors', via: 'groq' }) }) });
    const j = await res.json(); await Promise.allSettled(waits);
    return env.DB.prepare('SELECT status, tier, result FROM void_agent_tasks WHERE id = ?').bind(j.id).first();
  };
  try {
    const owner = await go(mk(), 'owner-key-123456', 1); assert.equal(owner.tier, 'free via groq'); assert.match(owner.result, /red, yellow and blue/);
    const visitor = await go(mk(), '', 2); assert.equal(visitor.tier, 'free via workers-ai', 'no key, no pin');
  } finally { globalThis.fetch = realFetch; }
});
