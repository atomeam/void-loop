import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { tierFor, needsYes, pickBot, brief, addressesAsk, attemptsFor } from '../void-live-deploy/lib/agent-core.js';
import { run as runAgent, textOf } from '../void-live-deploy/functions/api/agent.js';
const registry = JSON.parse(readFileSync(new URL('../void-live-deploy/bots/registry.json', import.meta.url), 'utf8')).bots;
test('tier is free until a realized month is in the pot', () => { assert.equal(tierFor(0).name, 'free'); assert.equal(tierFor(499).name, 'free'); assert.equal(tierFor(500).name, 'strong'); });
test('sends, pays and deletes wait for a yes', () => { assert.ok(needsYes('send an email to Bob')); assert.ok(needsYes('pay the bill')); assert.ok(!needsYes('plan a trip to Savannah')); });
test('picks the matching bot', () => { assert.equal(pickBot('convert 5 miles to km', [{ name: 'calculate', description: 'unit conversion', examples: ['5 miles in km'] }, { name: 'page', description: 'topics' }]).name, 'calculate'); assert.equal(pickBot('zzz', []).name, 'verse'); });
test('brief counts the last day', () => { const now = 1e12; const b = brief([{ status: 'done', created: now - 1 }, { status: 'needs_yes', created: now - 1 }, { status: 'done', created: now - 9e7 }], now); assert.equal(b.made, 1); assert.equal(b.waiting, 1); });
test('reads the bot factory registry', () => { assert.equal(pickBot('count the words in this', [{ id: 'word-counter', cat: 'writing', job: 'Counts words', status: 'live' }, { id: 'x', job: 'words words', status: 'failed' }]).name, 'word-counter'); });

// functions/api/agent.js run(): thinking is off, an empty first reply goes to the second free model, and a dead pair fails with its reason
function fakeEnv(replies) {
  const rows = new Map(), calls = [], short = [];
  const DB = { prepare: (sql) => ({ bind: (...v) => ({
    first: async () => (/^SELECT steps/.test(sql) ? rows.get(v[0]) || { steps: '[]' } : null),
    run: async () => {
      if (/^UPDATE void_agent_tasks/.test(sql)) { const id = v[v.length - 1], cols = sql.slice(28, sql.indexOf(' WHERE')).split(', ').map((c) => c.split(' = ')[0]); const r = { ...(rows.get(id) || {}) }; cols.forEach((c, i) => { r[c] = v[i]; }); rows.set(id, r); }
      if (/shortfall/i.test(sql)) short.push(v);
      return {};
    } }), run: async () => ({}) }) };
  const AI = { run: async (model, o) => { calls.push({ model, o }); const r = replies.shift(); if (r instanceof Error) throw r; return r; } };
  return { env: { DB, AI }, rows, calls };
}
test('the agent answers with thinking off, and an empty reply asks the second free model', async () => {
  const realFetch = globalThis.fetch; globalThis.fetch = async () => new Response('{}');
  try {
    const { env, rows, calls } = fakeEnv([{ choices: [{ message: { content: null, reasoning_content: 'hmm' } }] }, { response: 'Forsyth Park, the riverfront walk and Bonaventure Cemetery are all free to visit.' }]);
    env.ASSETS = { fetch: async () => new Response(JSON.stringify({ bots: [{ name: 'trip-planner', description: 'plans trips' }] })) };
    await runAgent(env, 'https://example.test', 't1', 'List three free things to do in Savannah, Georgia.');
    assert.equal(calls.length, 2);
    for (const c of calls) assert.deepEqual(c.o.chat_template_kwargs, { enable_thinking: false });
    assert.notEqual(calls[0].model, calls[1].model);
    assert.equal(rows.get('t1').status, 'done');
    assert.match(rows.get('t1').result, /Forsyth Park/);
    const { env: env2, rows: rows2 } = fakeEnv([new Error('3040: capacity'), new Error('3040: capacity')]);
    env2.ASSETS = env.ASSETS;
    await runAgent(env2, 'https://example.test', 't2', 'List three free things to do in Savannah, Georgia.');
    assert.equal(rows2.get('t2').status, 'failed');
    assert.ok(JSON.parse(rows2.get('t2').steps).some((s) => /did not answer \(busy\)/.test(s.line)), 'the step says why the first model failed');
  } finally { globalThis.fetch = realFetch; }
});
test('textOf reads both reply shapes and drops a thinking block', () => {
  assert.equal(textOf({ response: ' hi ' }), 'hi');
  assert.equal(textOf({ choices: [{ message: { content: '<think>x</think>ok' } }] }), 'ok');
  assert.equal(textOf(null), '');
});

// open asks stay off a bot whose job only shares a filler word ("three" is not "key words")
const OPEN = [
  'List three free things to do in Savannah, Georgia.',
  'What are three rainy-day ideas for kids in Portland?',
  'Plan an easy weeknight dinner with eggs and spinach.',
  'What should I pack for a weekend in Lisbon?',
  'How do I apologize to a friend after missing their birthday?',
];
test('open asks go to the answer pipeline unless a bot\'s purpose matches', () => {
  for (const ask of OPEN) assert.equal(pickBot(ask, registry).name, 'verse', ask);
  assert.equal(pickBot('List three free things to do in Savannah, Georgia.', [{ id: 'keyword-finder', job: 'Top three key words in a text', status: 'live' }]).name, 'verse');
  assert.equal(pickBot('find the key words in rain rain cloud sun', registry).name, 'keyword-finder');
  assert.equal(pickBot('count the words in this note', registry).name, 'word-counter');
  assert.equal(pickBot('what percent is 45 of 60', registry).name, 'percent-bot');
});
test('a result that only echoes the ask does not address it', () => {
  const ask = 'List three free things to do in Savannah, Georgia.';
  assert.equal(addressesAsk(ask, 'Savannah / Free / Georgia'), false);
  assert.equal(addressesAsk(ask, 'savannah, free, georgia'), false);
  assert.equal(addressesAsk(ask, ''), false);
  assert.equal(addressesAsk(ask, 'Walk the squares.'), false);
  assert.equal(addressesAsk(ask, 'Walk Forsyth Park, wander the riverfront, and sit in a historic square.'), true);
  assert.equal(addressesAsk('what percent is 45 of 60', '75%'), true);
  assert.equal(addressesAsk('find the key words in rain cloud sun', 'rain, cloud, sun'), true);
});
test('a bot that misses the ask is retried on the answer pipeline', async () => {
  const ask = 'List study questions about Savannah';
  assert.equal(pickBot(ask, registry).name, 'question-maker');
  assert.equal(attemptsFor(ask, registry).at(-1).repair, true);
  const realFetch = globalThis.fetch; globalThis.fetch = async () => new Response('{}');
  try {
    const { env, rows, calls } = fakeEnv([
      { response: 'Savannah' },
      { response: 'Walk Forsyth Park, wander the riverfront, and sit in a historic square for free.' },
    ]);
    env.ASSETS = { fetch: async () => new Response(JSON.stringify({ bots: registry })) };
    await runAgent(env, 'https://example.test', 't3', ask);
    assert.equal(calls.length, 2);
    assert.match(calls[0].o.messages[0].content, /question-maker/);
    assert.match(calls[1].o.messages[0].content, /Answer the task directly/);
    assert.equal(rows.get('t3').status, 'done');
    assert.equal(rows.get('t3').bot, 'verse');
    assert.match(rows.get('t3').result, /Forsyth Park/);
    assert.ok(JSON.parse(rows.get('t3').steps).some((s) => /did not address the ask/.test(s.line)));
  } finally { globalThis.fetch = realFetch; }
});
test('the Savannah keyword line is not kept; the next try has to answer the ask', async () => {
  const ask = 'List three free things to do in Savannah, Georgia.';
  const realFetch = globalThis.fetch; globalThis.fetch = async () => new Response('{}');
  try {
    const { env, rows, calls } = fakeEnv([
      { response: 'Savannah / Free / Georgia' },
      { response: 'Walk Forsyth Park, wander the riverfront, and sit in a historic square.' },
    ]);
    env.ASSETS = { fetch: async () => new Response(JSON.stringify({ bots: registry })) };
    await runAgent(env, 'https://example.test', 't4', ask);
    assert.equal(calls.length, 2);
    assert.match(calls[1].o.messages[0].content, /last answer did not do the task/);
    assert.equal(rows.get('t4').bot, 'verse');
    assert.equal(rows.get('t4').status, 'done');
    assert.match(rows.get('t4').result, /Forsyth Park/);
    assert.doesNotMatch(rows.get('t4').result, /Savannah \/ Free/);
  } finally { globalThis.fetch = realFetch; }
});
