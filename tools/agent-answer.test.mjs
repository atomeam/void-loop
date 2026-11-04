// The agent's bot choice and result check (lib/agent-answer.js, functions/api/agent.js). An open ask is not a keyword
// job, and a reply that only repeats the ask is tried again. Run: node --test tools/agent-answer.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { botChoices, attemptsFor, addressesAsk } from '../void-live-deploy/lib/agent-answer.js';
import { run as runAgent } from '../void-live-deploy/functions/api/agent.js';

const registry = JSON.parse(readFileSync(new URL('../void-live-deploy/bots/registry.json', import.meta.url), 'utf8')).bots;
const pick = (ask, bots) => botChoices(ask, bots)[0].name;
const OPEN = [
  'List three free things to do in Savannah, Georgia.',
  'What are three rainy-day ideas for kids in Portland?',
  'Plan an easy weeknight dinner with eggs and spinach.',
  'What should I pack for a weekend in Lisbon?',
  'How do I apologize to a friend after missing their birthday?',
];

function fakeEnv(replies) {
  const rows = new Map(), calls = [];
  const DB = { prepare: (sql) => ({ bind: (...v) => ({
    first: async () => (/^SELECT steps/.test(sql) ? rows.get(v[0]) || { steps: '[]' } : null),
    run: async () => {
      if (/^UPDATE void_agent_tasks/.test(sql)) { const id = v[v.length - 1], cols = sql.slice(28, sql.indexOf(' WHERE')).split(', ').map((c) => c.split(' = ')[0]); const r = { ...(rows.get(id) || {}) }; cols.forEach((c, i) => { r[c] = v[i]; }); rows.set(id, r); }
      return {};
    } }), run: async () => ({}) }) };
  const AI = { run: async (model, o) => { calls.push({ model, o }); const r = replies.shift(); if (r instanceof Error) throw r; return r; } };
  return { env: { DB, AI }, rows, calls };
}

test('open asks go to the answer pipeline unless a bot\'s purpose matches', () => {
  for (const ask of OPEN) assert.equal(pick(ask, registry), 'verse', ask);
  assert.equal(pick('List three free things to do in Savannah, Georgia.', [{ id: 'keyword-finder', job: 'Top three key words in a text', status: 'live' }]), 'verse');
  assert.equal(pick('find the key words in rain rain cloud sun', registry), 'keyword-finder');
  assert.equal(pick('count the words in this note', registry), 'word-counter');
  assert.equal(pick('what percent is 45 of 60', registry), 'percent-bot');
  assert.equal(pick('convert 5 miles to km', [{ name: 'calculate', description: 'unit conversion', examples: ['5 miles in km'] }, { name: 'page', description: 'topics' }]), 'calculate');
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
  assert.equal(pick(ask, registry), 'question-maker');
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
