// node --test tools/bench-route.test.mjs: the model bake-off runs inside the site (functions/api/bench.js). The owner (READ_TOKEN)
// asks for a model and a range of the built-in asks; the route builds the same messages /api/answer sends (lib/bench-asks.js)
// and runs them through the site's own Workers AI binding, so CI needs no Workers AI token. A stranger gets nothing, the paid
// model is never run, and one call runs at most CHUNK asks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { onRequestPost as bench, CHUNK } from '../void-live-deploy/functions/api/bench.js';
import { buildAsks } from '../void-live-deploy/lib/bench-asks.js';
import { PAID_MODEL, FREE_MODEL } from '../void-live-deploy/lib/models.js';
import { ANSWER_RUN } from '../void-live-deploy/functions/api/answer.js';

const KEY = 'k'.repeat(40);
const self = JSON.parse(fs.readFileSync(new URL('../void-live-deploy/self.json', import.meta.url), 'utf8'));
const skills = JSON.parse(fs.readFileSync(new URL('../void-live-deploy/skills/index.json', import.meta.url), 'utf8'));
const ASSETS = { fetch: async (req) => { const p = new URL(req.url).pathname; return new Response(JSON.stringify(p === '/self.json' ? self : skills)); } };
function env(calls = []) {
  return { READ_TOKEN: KEY, ASSETS, AI: { run: async (model, input) => { calls.push({ model, input }); return { response: 'answer from ' + model + ' to ' + input.messages.at(-1).content.slice(0, 40) }; } } };
}
const post = (body, key = KEY) => new Request('https://a-to-mind.com/api/bench', { method: 'POST', headers: { 'content-type': 'application/json', ...(key ? { authorization: 'Bearer ' + key } : {}) }, body: JSON.stringify(body) });

test('a stranger, a wrong key, the paid model, a bad range or an unknown ask file get nothing run', async () => {
  const calls = [], e = env(calls);
  assert.equal((await bench({ request: post({ model: FREE_MODEL, from: 0, to: 2 }, null), env: e })).status, 401);
  assert.equal((await bench({ request: post({ model: FREE_MODEL, from: 0, to: 2 }, 'x'.repeat(40)), env: e })).status, 401);
  for (const body of [{ model: PAID_MODEL, from: 0, to: 2 }, { model: 'gpt-4', from: 0, to: 2 }, { model: FREE_MODEL, from: 0, to: CHUNK + 1 },
    { model: FREE_MODEL, from: 5, to: 3 }, { model: FREE_MODEL, from: -1, to: 2 }, { model: FREE_MODEL, from: 0, to: 2, file: '../secrets' }])
    assert.equal((await bench({ request: post(body), env: e })).status, 400, JSON.stringify(body));
  assert.equal(calls.length, 0, 'no model was called');
  assert.equal((await bench({ request: post({ model: FREE_MODEL, from: 0, to: 2 }), env: { READ_TOKEN: KEY, ASSETS } })).status, 503, 'no binding: said so');
});

test('the owner gets the answers for a range of the built-in asks, run with the answer engine\'s messages', async () => {
  const calls = [], asks = buildAsks({ self, skills });
  const res = await bench({ request: post({ model: FREE_MODEL, from: 0, to: 3 }), env: env(calls) });
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.equal(j.model, FREE_MODEL); assert.equal(j.total, asks.length);
  assert.deepEqual(j.results.map((r) => r.i), [0, 1, 2]);
  assert.ok(j.results.every((r) => /^answer from /.test(r.text) && Number.isFinite(r.ms)));
  assert.equal(calls.length, 3);
  assert.match(calls[0].input.messages[0].content, /^You are Void/, 'the answer engine\'s own system prompt');
  const page = asks.findIndex((a) => a.page && /api_key/.test(a.page.field || ''));
  const pr = await bench({ request: post({ model: FREE_MODEL, from: page, to: page + 1 }), env: env(calls) });
  assert.equal(pr.status, 200);
  assert.doesNotMatch(calls.at(-1).input.messages[1].content, /sk-live-abcdefghijklmnop1234/, 'a page is masked before any model sees it');
  const last = await (await bench({ request: post({ model: FREE_MODEL, from: asks.length - 1, to: asks.length + 5 }), env: env(calls) })).json();
  assert.deepEqual(last.results.map((r) => r.i), [asks.length - 1], 'a range past the end stops at the end');
});

test('a model that fails is an error on that ask, not a failed call; a probe says the route is there', async () => {
  const e = env(); e.AI.run = async () => { throw new Error('5007: no such model'); };
  const j = await (await bench({ request: post({ model: '@cf/x/nope', from: 0, to: 2 }), env: e })).json();
  assert.equal(j.results.length, 2); assert.ok(j.results.every((r) => /no such model/.test(r.error)));
  const p = await (await bench({ request: post({ probe: true }), env: env() })).json();
  assert.equal(p.ok, true); assert.equal(p.asks, buildAsks({ self, skills }).length); assert.equal(p.chunk, CHUNK);
});

test('each ask runs with the answer engine\'s own options (thinking off, its token budget), and a think block is stripped', async () => {
  const calls = [], e = env(calls);
  e.AI.run = async (model, input) => { calls.push(input); return { response: '<think>long private reasoning</think>Canberra.' }; };
  const j = await (await bench({ request: post({ model: FREE_MODEL, from: 1, to: 2 }), env: e })).json();
  assert.equal(j.results[0].text, 'Canberra.', 'the reasoning is not scored as the answer');
  for (const [k, v] of Object.entries(ANSWER_RUN)) assert.deepEqual(calls[0][k], v, k + ' as /api/answer sends it');
  assert.equal(ANSWER_RUN.chat_template_kwargs.enable_thinking, false);
});
