// Verse's coder on Verse's own model (functions/api/coder.js): owner only, a well-formed conversation only, the answer in the Workers AI
// shape the coder reads, and an hourly and daily call cap that fails closed. Run: node --test tools/coder-route.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { onRequestPost, cleanMessages, CODER_LIMITS } from '../void-live-deploy/functions/api/coder.js';
import { models } from '../void-live-deploy/lib/models.js';
import { LIMITS } from '../void-live-deploy/lib/guard.js';

const TOKEN = 'owner-token-for-tests-1234567890';
const d1 = () => { const db = new DatabaseSync(':memory:'); const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => { db.prepare(sql).run(...a); return {}; }, all: async () => ({ results: db.prepare(sql).all(...a) }), first: async () => db.prepare(sql).get(...a) || null }); return { prepare: (sql) => stmt(sql) }; };
const req = (body, auth = TOKEN) => new Request('https://a-to-mind.com/api/coder', { method: 'POST', headers: { ...(auth ? { authorization: 'Bearer ' + auth } : {}), 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const MSG = [{ role: 'system', content: 'You are Verse\'s coding agent.' }, { role: 'user', content: 'Task: fix add' }];

test('the owner gets the free model\'s answer in the Workers AI shape; nobody else gets a call', async () => {
  const calls = [];
  const env = { READ_TOKEN: TOKEN, DB: d1(), AI: { run: async (model, input) => { calls.push([model, input]); return { response: '{"tool":"finish","summary":"done"}', usage: { total_tokens: 12 } }; } } };
  const r = await onRequestPost({ request: req({ messages: MSG, max_tokens: 99999 }), env });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { result: { response: '{"tool":"finish","summary":"done"}', usage: { total_tokens: 12 } }, model: models('coder') });
  assert.equal(calls.length, 1); assert.equal(calls[0][0], models('coder')); assert.equal(calls[0][1].max_tokens, CODER_LIMITS.maxOut, 'max_tokens is clamped');
  assert.deepEqual(calls[0][1].messages, MSG);
  for (const auth of [null, 'wrong-token-wrong-token-wrong-token']) assert.equal((await onRequestPost({ request: req({ messages: MSG }, auth), env })).status, 401);
  assert.equal(calls.length, 1, 'a refused caller never reaches the model');
  assert.ok(LIMITS.coder && LIMITS.coder.body > CODER_LIMITS.chars, 'the guard lets the whole conversation through');
});

test('a malformed conversation is a 400 and no model call', async () => {
  let n = 0; const env = { READ_TOKEN: TOKEN, DB: d1(), AI: { run: async () => { n++; return { response: 'x' }; } } };
  for (const bad of ['not json', {}, { messages: [] }, { messages: [{ role: 'tool', content: 'x' }] }, { messages: [{ role: 'user', content: 5 }] },
    { messages: Array.from({ length: CODER_LIMITS.messages + 1 }, () => ({ role: 'user', content: 'x' })) }, { messages: [{ role: 'user', content: 'x'.repeat(CODER_LIMITS.chars + 1) }] }]) {
    assert.equal((await onRequestPost({ request: req(bad), env })).status, 400, JSON.stringify(bad).slice(0, 60));
  }
  assert.equal(n, 0);
  assert.deepEqual(cleanMessages([{ role: 'user', content: 'hi', extra: 1 }]), [{ role: 'user', content: 'hi' }], 'only role and content go to the model');
});

test('the hourly cap fails closed with a 429; no model, no database or a silent model is a 503', async () => {
  const env = { READ_TOKEN: TOKEN, DB: d1(), AI: { run: async () => ({ response: 'ok' }) } };
  for (let i = 0; i < CODER_LIMITS.perHour; i++) assert.equal((await onRequestPost({ request: req({ messages: MSG }), env })).status, 200);
  const full = await onRequestPost({ request: req({ messages: MSG }), env });
  assert.equal(full.status, 429); assert.match(await full.text(), /hour/);
  assert.ok(CODER_LIMITS.perDay > CODER_LIMITS.perHour);
  assert.equal((await onRequestPost({ request: req({ messages: MSG }), env: { READ_TOKEN: TOKEN, DB: d1() } })).status, 503, 'no model bound');
  assert.equal((await onRequestPost({ request: req({ messages: MSG }), env: { READ_TOKEN: TOKEN, AI: env.AI } })).status, 429, 'no database: refused, never uncounted');
  assert.equal((await onRequestPost({ request: req({ messages: MSG }), env: { READ_TOKEN: TOKEN, DB: d1(), AI: { run: async () => ({ response: '  ' }) } } })).status, 503);
  const down = await onRequestPost({ request: req({ messages: MSG }), env: { READ_TOKEN: TOKEN, DB: d1(), AI: { run: async () => { throw new Error('3040: capacity'); } } } });
  assert.equal(down.status, 503); assert.match(await down.text(), /busy/);
});
