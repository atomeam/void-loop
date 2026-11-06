// /api/answer's free-resource routing (lib/answer-free.js over lib/free-router.js and resources/free.json). Run: node --test tools/answer-free.test.mjs
// Several kinds of question each go to the right free resource, with fallback: Verse's own bots, OpenAlex, the free Workers AI model
// (still the default), the other free LLM tiers only when keyed, and the reply says which one answered.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planOf, runBot, routeFree, freeLlm, openalexAnswer, ADAPTERS, RESEARCH } from '../void-live-deploy/lib/answer-free.js';
import { fxPairs } from '../void-live-deploy/bots/fx-pairs.js';
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
    ['10 usd to eur', 'bot', 'fx-usd-to-eur'], ['50 euros to pounds', 'bot', 'fx-eur-to-gbp'], ['10 pounds to kg', 'bot', 'lb-to-kg'],
    ['is 2026-12-25 a holiday in the united states', 'bot', 'holiday-us'],
    ['papers on sea level rise', 'api', null], ['find recent research on CRISPR off-target effects', 'api', null],
    ['who wrote hamlet', 'llm', null], ['what is 404', 'llm', null], ['write me a python script that renames files', 'llm', null], ['3 bananas to apples', 'llm', null], ['x'.repeat(200) + ' 3 miles to km', 'llm', null],
  ];
  for (const [ask, kind, bot] of cases) { const p = planOf(ask); assert.equal(p.kind, kind, ask); if (bot) assert.equal(p.bot, bot, ask); if (kind === 'api') assert.deepEqual(p.ids, RESEARCH, ask); }
});

test('answer-free: bots answer correctly, only through their live gate, and a bad input falls through to the model', () => {
  const want = { '3 miles to km': '3 mi = 4.828032 km', 'convert 100 F to C': '100 °F = 37.77777778 °C', 'is 97 prime': '97 is prime', 'what percent is 45 of 60': '45 is 75% of 60',
    '255 in binary': '255 in binary = 11111111', 'what does http 429 mean': 'HTTP 429: Too many requests: slow down', '#ff8800 to rgb': '#ff8800 = rgb(255, 136, 0)', 'days between 2026-11-04 and 2026-12-25': 'From 2026-11-04 to 2026-12-25: 51 days',
    'is 2026-12-25 a holiday in the united states': '2026-12-25 in US: Christmas Day', 'is 2026-07-03 a holiday in us': '2026-07-03 in US: Independence Day' };
  for (const [ask, answer] of Object.entries(want)) assert.equal(runBot(planOf(ask)).answer, answer, ask);
  const usd = fxPairs().find((b) => b.id === 'fx-usd-to-eur');
  assert.equal(runBot(planOf('10 usd to eur')).answer, '10 USD = ' + usd.run('10'));
  assert.equal(runBot(planOf('what does http 418 mean')), null, 'a code the bot does not know: the model answers');
  assert.equal(runBot({ kind: 'bot', bot: 'no-such-bot', input: '1' }), null);
  assert.equal(runBot(planOf('who wrote hamlet')), null);
});

test('answer-free: each absorbed bot (bots/salvaged.js) has one narrow ask that reaches it, and near asks still go to the model', () => {
  const want = {
    'check this glassbox claim: tool_capability: Workers AI runs Llama 3.1 8B on its free daily allowance.': 'Glassbox claim: candidate claim · tool_capability · 56/280 characters · UNVERIFIED until a human merges it',
    'promote glassbox batch {"target":"github:atomeam/glassbox","promote":true,"claims":[]}': 'Glassbox batch: refused: promote is true (a batch never promotes itself; only a human merge does)',
    'velo endpoint for post_lead': 'POST /_functions/lead · anyone can call it (permissions.json covers .jsw web modules, not HTTP functions) · /_functions-dev/lead runs the saved, unpublished code',
    'check this link: <a href="/tools/">Tools</a>': 'Link: passes · same tab (the default)',
    'check breadcrumbs: Docs /docs/ > Guides /docs/guides/ > Install': 'Breadcrumbs: passes · 3 crumbs · current: Install (a span with aria-current="page", not a link)',
    'check canonical https://a-to-mind.com/tools/ http://www.a-to-mind.com/tools': 'Canonical: fails · use https · www is denied · points at /tools, not /tools/: a canonical names its own page',
    'copy receipt for hello world': 'Copy receipt: 11 bytes UTF-8 · sha256 b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
    'voice plan: watch competitor pricing for a price drop': 'Voice plan: plan#pricing · Competitor pricing watch · tools http.read, model.call · writes deny · budget 5000 tokens · run: hold (a transcript is data, not a run)',
    'check run graph: nodes: plan, read, write | edges: plan>read, write>plan': 'Run graph: fails · edge write>plan goes back in time (z 2 to 0)',
    'are 09:12 and 09:20 in the same bin': '09:12 and 09:20: separate-bins at 15 min · width-sensitive: 5 separate, 15 separate, 60 shared · 3 min from a bin edge · arrow denied: a shared bin is not a cause',
    'recall gap: Berenstein Bears | Berenstain Bears': 'Recall gap: only in A: berenstein · only in B: berenstain · the gap is not a score, and a difference is not a timeline proof',
    'check answer block: definition | What is A-to-Mind? | It is a table.': 'Answer block: not quoteable · starts with "It": a block must stand alone · names nothing from the question (A-to-Mind)',
    'replay run: plan, file.read 612, deny slack.notify, model.call 2280 1c, hold artifact.write': 'Run replay: 5 events · 2 steps, 2892 tok, 1¢ ledger fact · denied: slack.notify · held: artifact.write (waits for a human seal) · writes: none · replay only, nothing runs',
  };
  for (const [ask, answer] of Object.entries(want)) { const r = runBot(planOf(ask)); assert.ok(r, ask); assert.equal(r.answer, answer, ask); }
  for (const ask of ['check this claim: the earth is flat', 'copy this text', 'check this link', 'replay the game', 'what is a breadcrumb', 'are we in the same bin']) assert.equal(planOf(ask).kind, 'llm', ask);
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

test('answer-free: research fails over OpenAlex key -> OpenAlex keyless -> Crossref, each through its real adapter', async () => {
  const realFetch = globalThis.fetch; const urls = [];
  const CROSSREF = { message: { items: [{ DOI: '10.5555/abc', title: ['Coastal flooding and sea level'], issued: { 'date-parts': [[2019, 5]] }, author: [{ given: 'C.', family: 'Author' }], 'is-referenced-by-count': 42 }] } };
  globalThis.fetch = async (u) => { urls.push(String(u)); if (/api\.openalex\.org/.test(String(u))) return new Response('{"error":"budget"}', { status: 429 }); if (/api\.crossref\.org/.test(String(u))) return new Response(JSON.stringify(CROSSREF)); return new Response('{}', { status: 404 }); };
  try {
    const env = { DB: fakeDb(), OPENALEX_API_KEY: 'k123' };
    const out = await routeFree('papers on sea level rise', { env, registry });
    assert.equal(out.source, 'free:crossref'); assert.deepEqual(out.tried.map((t) => t.id + ':' + t.why), ['openalex-key:provider quota', 'openalex:provider quota']);
    assert.match(out.answer, /from Crossref/); assert.match(out.answer, /Coastal flooding and sea level \(2019\), C\. Author, cited 42 times \[1\]/);
    assert.deepEqual(out.sources, [{ title: 'Coastal flooding and sea level', url: 'https://doi.org/10.5555/abc' }]);
    assert.ok(/api_key=k123/.test(urls[0]) && !/api_key/.test(urls[1]), 'the key goes only to the keyed OpenAlex entry');
    assert.equal(typeof ADAPTERS.crossref, 'function');
  } finally { globalThis.fetch = realFetch; }
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
