// node --test tools/agent-brain.test.mjs: the agent's brain on the site's binding (functions/api/agent-brain.js) and its ticket (lib/agent-ticket.js).
// What a stranger can make it do (nothing), what a ticket opens (one free model, capped), and that a ticket is never the owner key.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mintTicket, ticketOk, MAX_TICKET_MS } from '../void-live-deploy/lib/agent-ticket.js';
import { onRequestPost, bodyOf, optionsFor, DAY_CALLS } from '../void-live-deploy/functions/api/agent-brain.js';
import { ownerOk } from '../void-live-deploy/lib/guard.js';
import { AGENT_MODELS, FREE_MODEL } from '../void-live-deploy/lib/models.js';

const d1 = () => { const db = new DatabaseSync(':memory:'); const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => { db.prepare(sql).run(...a); return {}; }, all: async () => ({ results: db.prepare(sql).all(...a) }) }); return { prepare: (sql) => stmt(sql) }; };
const KEY = 'owner-key-for-tests-only'; // secret-scan: ok (a made-up owner key)
const asked = [];
const envOf = (over = {}) => ({ READ_TOKEN: KEY, DB: d1(), AI: { run: async (model, input) => { asked.push({ model, input }); return { response: '{"tool":"read_file","args":{"path":"x"}}', usage: { prompt_tokens: 120, completion_tokens: 30 } }; } }, ...over });
const post = (env, auth, body) => onRequestPost({ env, request: new Request('https://x/api/agent-brain', { method: 'POST', headers: auth ? { authorization: 'Bearer ' + auth } : {}, body: JSON.stringify(body) }) });
const MODEL = AGENT_MODELS.fast[0], msgs = [{ role: 'system', content: 'you are the agent' }, { role: 'user', content: 'task' }, { role: 'assistant', content: '{}' }, { role: 'user', content: 'ok' }];

test('a ticket is good for its run and its time, made only from the owner key', async () => {
  const now = Date.UTC(2026, 9, 26, 8), t = await mintTicket(KEY, '12345', now);
  assert.match(t, /^vt1\.\d+\.12345\.[\w-]+$/);
  assert.deepEqual(await ticketOk(t, KEY, now + 60e3), { ok: true, run: '12345' });
  assert.equal((await ticketOk(t, KEY, now + 3 * 3600e3)).ok, false, 'expired after two hours');
  assert.equal((await ticketOk(t, 'another key', now)).ok, false);
  assert.equal((await ticketOk(t.replace('.12345.', '.12346.'), KEY, now)).ok, false, 'the run is signed');
  assert.equal((await ticketOk(t.slice(0, -2) + 'AA', KEY, now)).ok, false);
  const long = await mintTicket(KEY, 'r', now, 99 * 3600e3); assert.ok(+long.split('.')[1] * 1000 <= now + MAX_TICKET_MS, 'never longer than three hours');
  for (const bad of ['', 'vt1.', 'vt1.x.y.z', KEY, null]) assert.equal((await ticketOk(bad, KEY, now)).ok, false);
});
test('a ticket is not the owner: ownerOk refuses it', async () => {
  const t = await mintTicket(KEY, 'r');
  assert.equal(await ownerOk(new Request('https://x', { headers: { authorization: 'Bearer ' + t } }), { READ_TOKEN: KEY }), false);
});
test('a stranger gets 401 and no model runs', async () => {
  asked.length = 0;
  for (const auth of [null, 'guess', 'vt1.9999999999.r.' + 'A'.repeat(43)]) assert.equal((await post(envOf(), auth, { model: MODEL, messages: msgs })).status, 401);
  assert.equal(asked.length, 0);
});
test('a ticket runs one of the agent\'s free models and says what it used', async () => {
  asked.length = 0; const env = envOf(), t = await mintTicket(KEY, 'r');
  const r = await post(env, t, { model: MODEL, messages: msgs, max_tokens: 99999 });
  assert.equal(r.status, 200); const j = await r.json();
  assert.match(j.text, /read_file/); assert.deepEqual(j.usage, { prompt_tokens: 120, completion_tokens: 30 });
  assert.equal(asked[0].model, MODEL); assert.equal(asked[0].input.max_tokens, 3000, 'output capped'); assert.equal(asked[0].input.messages.length, 4);
  assert.equal((await post(env, KEY, { model: AGENT_MODELS.strong[0], messages: msgs })).status, 200, 'the owner key works too');
});
test('only the agent\'s models, sane messages, and a daily cap', async () => {
  const t = await mintTicket(KEY, 'r');
  assert.equal(bodyOf({ model: FREE_MODEL === MODEL ? '@cf/x/y' : FREE_MODEL, messages: msgs }), null, 'a model outside the agent\'s list');
  assert.equal(bodyOf({ model: MODEL, messages: [{ role: 'tool', content: 'x' }] }), null);
  assert.equal(bodyOf({ model: MODEL, messages: Array.from({ length: 41 }, () => ({ role: 'user', content: 'x' })) }), null);
  assert.equal(bodyOf({ model: MODEL, messages: [{ role: 'user', content: 'x'.repeat(60001) }] }), null);
  assert.equal((await post(envOf(), t, { model: '@cf/moonshotai/kimi-k2.7-code', messages: msgs })).status, 400, 'a paid model is never run');
  const env = envOf(); let last = 0;
  for (let i = 0; i <= DAY_CALLS; i++) last = (await post(env, t, { model: MODEL, messages: msgs })).status;
  assert.equal(last, 429, 'the day\'s calls are capped');
  assert.equal((await post(envOf({ DB: undefined }), t, { model: MODEL, messages: msgs })).status, 429, 'no database, no call (fail closed)');
  assert.equal((await post(envOf({ AI: undefined }), t, { model: MODEL, messages: msgs })).status, 503);
});
test('a reasoning model thinks briefly, the others not at all; a model that refuses the option gets the plain call', async () => {
  assert.deepEqual(optionsFor('@cf/openai/gpt-oss-120b'), { reasoning_effort: 'low' });
  assert.deepEqual(optionsFor(MODEL), { chat_template_kwargs: { enable_thinking: false } });
  let n = 0; const env = envOf({ AI: { run: async (m, input) => { n++; if (input.chat_template_kwargs || input.reasoning_effort) throw new Error('unknown option'); return { response: 'ok' }; } } });
  const r = await post(env, KEY, { model: MODEL, messages: msgs }); assert.equal((await r.json()).text, 'ok'); assert.equal(n, 2);
});
