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

// Routing in general: a narrow bot claims an ask only when the ask carries the input it works on. These asks are not the Tower exam's.
import { isKnowledgeAsk, hasPayload, canTake, staysInLane } from '../void-live-deploy/lib/agent-answer.js';
const named = (ask) => botChoices(ask, registry).map((b) => b.name).filter((n) => n !== 'verse');
test('a question or a writing request with nothing to work on is the general answerer\'s, however many words it shares with a bot', () => {
  for (const ask of [
    'What is the difference between a stock and a bond?',
    'Why do cats purr when they are happy?',
    'Explain how a vaccine trains the immune system.',
    'How does a refrigerator keep food cold, and why does the back feel warm?',
    'Which is better for a beginner, a road bike or a mountain bike?',
    'Write a friendly note thanking a coworker for covering my shift.',
    'Is it okay to run every day, and what happens between runs?',
    'What are the days between solstices called, and why do they differ?',
    'Can you describe how a search engine finds a page?',
  ]) { assert.ok(isKnowledgeAsk(ask), ask); assert.deepEqual(named(ask), [], ask + ' went to ' + named(ask)); assert.equal(pick(ask, registry), 'verse', ask); }
});
test('a bot that needs input does not take an ask with none, and does take one that has it', () => {
  const days = { id: 'days-between', job: 'Days between two dates', probe: { in: '2026-11-04 to 2026-12-25', out: '51 days' }, status: 'live' };
  const coin = { id: 'coin-flip', job: 'Flip a coin and say heads or tails', status: 'live' };
  assert.equal(canTake('What is the difference between two stars?', days), false);
  assert.equal(canTake('how many days are there between the equinoxes?', days), false);
  assert.equal(canTake('how many days between 2026-03-01 and 2026-03-09', days), true);
  assert.equal(canTake('Should I flip a coin to decide?', coin), true);
  assert.equal(botChoices('how many days between 2026-03-01 and 2026-03-09', [days])[0].name, 'days-between');
});
test('what carries input: digits, quoted text, a link, a line after a colon', () => {
  for (const t of ['add 4 and 9', 'reverse "hello there"', 'shorten https://example.com/a/b', 'summarize: the council met on tuesday and agreed', 'fix this\nfoo bar']) assert.ok(hasPayload(t), t);
  for (const t of ['what is a prime number?', 'write a thank you note']) assert.ok(!hasPayload(t), t);
});
test('a short reply that says what the bot is for, or asks for other input, does not address the ask; a real answer that says "I cannot" does', () => {
  for (const r of [
    'I am a unit-conversion bot. I can only convert units. Please provide a length if you would like a conversion.',
    'I was designed solely to count words, so I cannot provide information regarding history.',
    'That is outside of my scope. Please provide two numbers and I will add them.',
  ]) { assert.ok(staysInLane(r), r); assert.equal(addressesAsk('What caused the fall of Rome and how long did it take?', r), false, r); }
  const real = 'The fall of Rome had many causes: economic trouble, overreach, and invasions. The western empire ended in 476, after about a century of decline. I cannot give one single cause, because historians weigh them differently, but most agree the slow loss of money and soldiers mattered most.';
  assert.ok(!staysInLane(real)); assert.equal(addressesAsk('What caused the fall of Rome and how long did it take?', real), true);
});
test('the old picks stay: a calculator, a percent, a word count, key words, a conversion', () => {
  assert.equal(pick('what percent is 45 of 60', registry), 'percent-bot');
  assert.equal(pick('count the words in this note', registry), 'word-counter');
  assert.equal(pick('find the key words in rain rain cloud sun', registry), 'keyword-finder');
});
