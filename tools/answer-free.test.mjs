// /api/answer's free-resource routing (lib/answer-free.js over lib/free-router.js and resources/free.json). Run: node --test tools/answer-free.test.mjs
// Several kinds of question each go to the right free resource, with fallback: Verse's own bots, OpenAlex, the free Workers AI model
// (still the default), the other free LLM tiers only when keyed, and the reply says which one answered.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planOf, runBot, routeFree, freeLlm, openalexAnswer } from '../void-live-deploy/lib/answer-free.js';
import { onRequestPost } from '../void-live-deploy/functions/api/answer.js';

const registryText = readFileSync(new URL('../void-live-deploy/resources/free.json', import.meta.url), 'utf8');
const registry = JSON.parse(registryText);
// a D1 stand-in: lib/daily-cap.js counts (INSERT ... RETURNING n under a limit), everything else a harmless empty answer
function fakeDb() {
  const n = {};
  return { n, prepare: (sql) => ({ bind: (...a) => ({
    all: async () => { if (/void_daily_cap/.test(sql)) { const [, key, lim] = a; if ((n[key] || 0) >= lim) return { results: [] }; n[key] = (n[key] || 0) + 1; return { results: [{ n: n[key] }] }; } return { results: [] }; },
    first: async () => (/void_daily_cap/.test(sql) ? { n: n[a[1]] || 0 } : null), run: async () => ({}) }), run: async () => ({}), first: async () => null, all: async () => ({ results: [] }) }) };
}
const assets = { fetch: async (req) => (new URL(req.url).pathname === '/resources/free.json' ? new Response(registryText) : new Response('nope', { status: 404 })) };
const WORKS = { results: [{ id: 'https://openalex.org/W1', display_name: 'Sea-level rise from <i>ice sheets</i>', publication_year: 2021, doi: 'https://doi.org/10.1000/xyz', cited_by_count: 120, authorships: [{ author: { display_name: 'A. Researcher' } }, { author: { display_name: 'B. Other' } }] }] };

test('answer-free: each kind of question is planned to the right free resource', () => {
  const cases = [
    ['3 miles to km', 'bot', 'mi-to-km'], ['convert 100 F to C', 'bot', 'temp-F-to-C'], ['How many feet in 2 miles?', 'bot', 'mi-to-ft'], ['10 kg in pounds', 'bot', 'kg-to-lb'],
    ['255 in binary', 'bot', 'base10-to-base2'], ['convert ff from hex to decimal', 'bot', 'base16-to-base10'], ['is 97 prime?', 'bot', 'prime-checker'], ['2026 in roman numerals', 'bot', 'roman-numerals'],
    ['what percent is 45 of 60', 'bot', 'percent-bot'], ['what does http 429 mean', 'bot', 'status-code'], ['unix timestamp 1700000000', 'bot', 'unix-time'],
    ['days between 2026-11-04 and 2026-12-25', 'bot', 'days-between'], ['#ff8800 to rgb', 'bot', 'hex-color'],
    ['papers on sea level rise', 'api', null], ['find recent research on CRISPR off-target effects', 'api', null],
    ['who wrote hamlet', 'llm', null], ['what is 404', 'llm', null], ['write me a python script that renames files', 'llm', null], ['3 bananas to apples', 'llm', null], ['x'.repeat(200) + ' 3 miles to km', 'llm', null],
  ];
  for (const [ask, kind, bot] of cases) { const p = planOf(ask); assert.equal(p.kind, kind, ask); if (bot) assert.equal(p.bot, bot, ask); if (kind === 'api') assert.deepEqual(p.ids, ['openalex'], ask); }
});

test('answer-free: bots answer correctly, only through their live gate, and a bad input falls through to the model', () => {
  const want = { '3 miles to km': '3 mi = 4.828032 km', 'convert 100 F to C': '100 °F = 37.77777778 °C', 'is 97 prime': '97 is prime', 'what percent is 45 of 60': '45 is 75% of 60',
    '255 in binary': '255 in binary = 11111111', 'what does http 429 mean': 'HTTP 429: Too many requests: slow down', '#ff8800 to rgb': '#ff8800 = rgb(255, 136, 0)', 'days between 2026-11-04 and 2026-12-25': 'From 2026-11-04 to 2026-12-25: 51 days' };
  for (const [ask, answer] of Object.entries(want)) assert.equal(runBot(planOf(ask)).answer, answer, ask);
  assert.equal(runBot(planOf('what does http 418 mean')), null, 'a code the bot does not know: the model answers');
  assert.equal(runBot({ kind: 'bot', bot: 'no-such-bot', input: '1' }), null);
  assert.equal(runBot(planOf('who wrote hamlet')), null);
});

test('answer-free: a research ask goes to OpenAlex through the router, and falls back to the model when it is out', async () => {
  const db = fakeDb(); const env = { DB: db };
  const adapters = { openalex: async (job) => { assert.equal(job.query, 'sea level rise'); return WORKS.results; } };
  const out = await routeFree('papers on sea level rise', { env, registry, adapters });
  assert.equal(out.source, 'free:openalex'); assert.equal(out.route, 'api');
  assert.match(out.answer, /Sea-level rise from ice sheets \(2021\), A\. Researcher et al\., cited 120 times \[1\]/);
  assert.deepEqual(out.sources, [{ title: 'Sea-level rise from ice sheets', url: 'https://doi.org/10.1000/xyz' }]);
  assert.equal(db.n['free:openalex'], 1, 'the call took one place of its daily share');
  const quota = { openalex: async () => { const e = new Error('rate limited'); e.status = 429; throw e; } };
  assert.equal(await routeFree('papers on sea level rise', { env, registry, adapters: quota }), null, 'quota out: the model answers');
  db.n['free:openalex'] = 1e9; assert.equal(await routeFree('papers on sea level rise', { env, registry, adapters }), null, 'daily share used: the model answers');
  assert.equal(await routeFree('papers on sea level rise', { env: {}, registry, adapters }), null, 'no counter: fail closed, nothing called');
  assert.equal(await routeFree('who wrote hamlet', { env, registry, adapters }), null, 'a general ask is the model\'s');
  assert.equal(openalexAnswer('x', [{ id: 'https://openalex.org/W9', display_name: 'T' }]).sources[0].url, 'https://openalex.org/W9');
});

test('answer-free: LLM failover only reaches keyed free tiers, in registry order, and never Gemini', async () => {
  const db = fakeDb(); const calls = [];
  const adapters = { 'groq-free': async () => { calls.push('groq'); const e = new Error('quota'); e.status = 429; throw e; }, 'cerebras-free': async (job) => { calls.push('cerebras'); return 'cerebras says ' + job.messages[0].content; }, 'gemini-free': async () => { calls.push('gemini'); return 'no'; } };
  assert.equal(await freeLlm([{ role: 'user', content: 'hi' }], { env: { DB: db }, registry, adapters }), null, 'no keys: nothing to fail over to');
  const out = await freeLlm([{ role: 'user', content: 'hi' }], { env: { DB: db, GROQ_API_KEY: 'k', CEREBRAS_API_KEY: 'k', GEMINI_API_KEY: 'k' }, registry, adapters });
  assert.equal(out.source, 'free:cerebras-free'); assert.equal(out.answer, 'cerebras says hi'); assert.deepEqual(calls, ['groq', 'cerebras']);
  assert.equal(out.tried[0].why, 'provider quota');
});

test('answer-free: /api/answer end to end routes a bot ask, a research ask and a general ask, each reply naming its source', async () => {
  const realFetch = globalThis.fetch; const fetched = [];
  globalThis.fetch = async (u) => { fetched.push(String(u)); return /api\.openalex\.org/.test(String(u)) ? new Response(JSON.stringify(WORKS), { headers: { 'content-type': 'application/json' } }) : new Response('{}', { status: 404 }); };
  try {
    const post = async (ask, env) => (await onRequestPost({ request: new Request('https://a-to-mind.com/api/answer', { method: 'POST', body: JSON.stringify({ ask }) }), env, waitUntil: () => {} })).json();
    const bot = await post('How many feet in 2 miles?', { DB: fakeDb(), ASSETS: assets });
    assert.equal(bot.source, 'bot:mi-to-ft'); assert.equal(bot.route, 'bot'); assert.equal(bot.answer, '2 mi = 10560 ft'); assert.equal(bot.bot.family, 'units/length');
    const paper = await post('papers on sea level rise', { DB: fakeDb(), ASSETS: assets });
    assert.equal(paper.source, 'free:openalex'); assert.match(paper.answer, /OpenAlex/); assert.ok(fetched.some((u) => /api\.openalex\.org\/works\?.*search=sea%20level%20rise/.test(u)));
    // a general ask: the free Workers AI model is still the default and the reply says so
    const ran = []; const AI = { run: async (model, opts) => { ran.push(model); return { response: 'Hamlet was written by William Shakespeare around 1600.' }; } };
    const general = await post('who wrote the play hamlet', { DB: fakeDb(), ASSETS: assets, AI });
    assert.equal(general.source, 'workers-ai-chat', JSON.stringify(general)); assert.match(general.answer, /Shakespeare/);
    const { FREE_MODEL } = await import('../void-live-deploy/lib/models.js'); assert.ok(ran.includes(FREE_MODEL), 'the free Workers AI model answered');
  } finally { globalThis.fetch = realFetch; }
});
