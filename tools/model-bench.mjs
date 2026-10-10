// Model bake-off: the same asks, the same system prompts Void's answer engine uses, sent live to Workers AI for the current
// default model and a few challengers. Scores each answer against fixed checks and times the first token, then says whether a
// switch is justified. tools/bench.mjs can't do this: it measures which skill answers an ask, with the answer engine stubbed.
//
//   node tools/model-bench.mjs --list                 the text-generation models in your Workers AI catalog, newest first
//   node tools/model-bench.mjs                        DEFAULT_MODEL vs the 3 newest catalog models (see --top)
//   node tools/model-bench.mjs --models a,b,c         DEFAULT_MODEL vs exactly these model ids
//   node tools/model-bench.mjs --top 5                DEFAULT_MODEL vs the 5 newest catalog models
//   node tools/model-bench.mjs --only self,page       only some kinds of ask (fact, howto, reason, self, page)
//   node tools/model-bench.mjs --via URL --models a,b  send the calls through tools/model-bench-worker (wrangler dev --remote --port 8799) under your wrangler
//                                                      login instead of the REST API: no API token needed. First token = total time there (no streaming).
//   node tools/model-bench.mjs --site https://a-to-mind.com   run inside the site (POST /api/bench, owner only): READ_TOKEN in the environment,
//                                                      no Workers AI token; the built-in asks only; the first token is the whole time there
//   node tools/model-bench.mjs --dry                  no network: canned answers, to check the harness and the scoring
//   node tools/model-bench.mjs --asks more.json       add the asks in a file (same shape as ASKS; patterns as "/re/flags" or a plain word;
//                                                      page: a page object, or "Q3" / "DRAFT" / "RECIPE")
//   node tools/model-bench.mjs --asks f --asks-literal  the same, for a file not written by hand (misses, other sessions): words only, no regex
//   node tools/model-bench.mjs --max-neurons 8000     the spend cap (default 8000 of the 10,000 free neurons a day): models run cheapest
//                                                      first by the catalog's price, and one that would pass the cap is not run
//   node tools/model-bench.mjs --check                one catalog call and one 1-token run: exit 0 when the token can bench, 3 (with the
//                                                      missing scope named) when it can't. The workflow runs this before it spends anything.
//   node tools/model-bench.mjs --md table.md          also write the table, the plan and the verdict as markdown (job summary, PR comment)
// Needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (a token with Workers AI read/run). Every call counts against the
// account's Workers AI neurons (40 asks x 4 models = 160 calls); nothing is written to D1, nothing is deployed.
// Results go to the terminal and to <tmp>/void-model-bench.json (--out <file> to choose).
//
// What the scores mean: each ask has plain checks (must say X, must not say Y). Fact asks get no sources, unlike the live
// engine, which adds Wikipedia extracts: this measures what the model knows on its own, the same for every model. Self asks
// get Void's real facts (self.json, skills/index.json, as /api/answer builds them); page asks get the page the extension
// would send. A check list is a floor, not a judge: an answer can pass and still be clumsy, so read the samples it prints.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { DEFAULT_MODEL, PAID_MODEL } from '../void-live-deploy/lib/router.js';
import { selfFacts } from '../void-live-deploy/lib/self-context.js';
import { buildAsks, messagesFor as messagesForLib, PAGES, esc } from '../void-live-deploy/lib/bench-asks.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dep = path.resolve(here, '..', 'void-live-deploy');
const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const opt = (f, d) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : d);
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID, TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const API = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai`;
const DRY = flag('--dry'), VIA = opt('--via', ''), SITE = opt('--site', '').replace(/\/+$/, '');
const SITE_KEY = process.env.READ_TOKEN || process.env.VOID_OWNER_TOKEN || '';
const TIMEOUT_MS = 60000, PAR = 4;

// ---- the asks ----
const self = JSON.parse(fs.readFileSync(path.join(dep, 'self.json'), 'utf8'));
const skills = JSON.parse(fs.readFileSync(path.join(dep, 'skills/index.json'), 'utf8'));
const FACTS = selfFacts({ self, skills, will: null, voice: null });
export const ASKS = buildAsks({ self, skills }); // lib/bench-asks.js: the same asks /api/bench runs on the site
const messagesFor = (a) => messagesForLib(a, FACTS);
export function score(a, text) {
  const t = String(text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const failed = [...(a.must || []).filter((r) => !r.test(t)).map((r) => 'missing ' + r), ...(a.mustNot || []).filter((r) => r.test(t)).map((r) => 'has ' + r)];
  return { ok: t.length > 0 && failed.length === 0, failed: t ? failed : ['empty answer'] };
}

// ---- Workers AI ----
const auth = { authorization: 'Bearer ' + TOKEN };
async function catalog() {
  const r = await fetch(`${API}/models/search?task=${encodeURIComponent('Text Generation')}&per_page=100`, { headers: auth });
  const j = await r.json();
  if (!j.success) throw new Error('model catalog: ' + JSON.stringify(j.errors || j).slice(0, 300));
  const prop = (m, k) => (m.properties || []).find((p) => p.property_id === k);
  return j.result.filter((m) => !prop(m, 'lora') && !prop(m, 'planned_deprecation_date') && !/lora/i.test(m.name))
    .map((m) => ({ id: m.name, created: m.created_at || '', beta: !!prop(m, 'beta'), ctx: (prop(m, 'context_window') || {}).value || '', price: priceOf((prop(m, 'price') || {}).value) }))
    .sort((x, y) => (x.created < y.created ? 1 : -1));
}


// ---- ask files, counts, spend ----
// A pattern from a file is data: ask files will come from the misses snapshot and other sessions, so a pattern is checked
// before it is ever compiled. "/re/flags" is a regex only when it is short (PATTERN_MAX) and has no nested quantifier (a
// quantified group with a quantifier inside: (a+)+, (x*)*, ([a-z]{1,9})+, the shapes that backtrack forever); anything
// else is that word or phrase, any case. literalOnly (--asks-literal, for files not written by hand) takes no regex at all.
export const PATTERN_MAX = 200;
const NESTED = /\((?:[^()]|\([^()]*\))*[*+}](?:[^()]|\([^()]*\))*\)\s*(?:[*+]|\{\d*,)/;
function toRe(p, literalOnly) {
  const m = /^\/(.*)\/([a-z]*)$/s.exec(String(p));
  if (!m) return new RegExp('(?:^|\\W)' + esc(String(p)) + '(?=\\W|$)', 'i');
  if (literalOnly) throw new Error('literal patterns only in this file: ' + String(p).slice(0, 40));
  if (m[1].length > PATTERN_MAX) throw new Error(`pattern too long (${m[1].length} > ${PATTERN_MAX})`);
  if (NESTED.test(m[1].replace(/\\./g, 'x'))) throw new Error('nested quantifier in ' + String(p).slice(0, 40));
  return new RegExp(m[1], m[2]); // void-review: ok (checked above: length cap, no nested quantifier; literal-only files never get here)
}
export function loadAsks(list, { literalOnly = false } = {}) {
  if (!Array.isArray(list)) throw new Error('an ask file is a JSON list of asks');
  return list.map((a, i) => {
    try {
      if (!a || typeof a.ask !== 'string' || !a.ask.trim() || typeof a.kind !== 'string') throw new Error('needs kind and ask');
      const page = typeof a.page === 'string' ? PAGES[a.page] : a.page;
      if (a.page && !page) throw new Error('no page named ' + a.page);
      return { kind: a.kind, ask: a.ask.trim(), must: (a.must || []).map((x) => toRe(x, literalOnly)), mustNot: (a.mustNot || []).map((x) => toRe(x, literalOnly)), ...(page ? { page } : {}) };
    } catch (e) { throw new Error(`ask ${i}: ${e.message}`); }
  });
}
export const kindCounts = (asks) => asks.reduce((c, a) => ((c[a.kind] = (c[a.kind] || 0) + 1), c), {});
const countLine = (asks) => Object.entries(kindCounts(asks)).map(([k, n]) => `${k} ${n}`).join(' · ');

// the catalog's price property: [{ unit: 'per M input tokens', price }, { unit: 'per M output tokens', price }]
function priceOf(v) {
  if (!Array.isArray(v)) return null;
  const at = (re) => { const x = v.find((p) => re.test(String(p.unit || ''))); return x && Number.isFinite(+x.price) ? +x.price : null; };
  const i = at(/input/i), o = at(/output/i);
  return i == null || o == null ? null : { in: i, out: o };
}
// Workers AI bills $0.011 per 1,000 neurons, so a model's price per million tokens converts to neurons. Input is the
// prompt as sent (about 4 characters a token); output is taken as OUT_TOKENS an answer, most are shorter, max_tokens is 1200.
const USD_PER_NEURON = 0.011 / 1000, OUT_TOKENS = 400;
export function estimateNeurons(model, asks, prices) {
  const p = prices && prices[model];
  if (!p) return null;
  const inTok = asks.reduce((s, a) => s + Math.ceil(JSON.stringify(messagesFor(a)).length / 4), 0), outTok = asks.length * OUT_TOKENS;
  return Math.round(((inTok * p.in + outTok * p.out) / 1e6) / USD_PER_NEURON);
}
// cheapest first; a model whose estimate would take the total past the cap is not run, nor is one with no price
// (unless allowUnpriced: --dry, --via, --allow-unpriced); the models in `keep` (the default, the baseline) always run
export function planRun(models, asks, prices, { cap = Infinity, keep = [], allowUnpriced = false } = {}) {
  const est = models.map((model) => ({ model, neurons: estimateNeurons(model, asks, prices) }));
  est.sort((x, y) => (x.neurons == null) - (y.neurons == null) || (x.neurons ?? 0) - (y.neurons ?? 0));
  let spent = 0;
  return est.map((e) => {
    if (keep.includes(e.model)) { spent += e.neurons || 0; return { ...e, run: true, why: 'the baseline' }; }
    if (e.neurons == null) return { ...e, run: allowUnpriced, why: allowUnpriced ? 'no catalog price: not counted' : 'no catalog price, so no estimate: not run (--allow-unpriced to run it)' };
    if (spent + e.neurons > cap) return { ...e, run: false, why: `would pass the cap of ${cap} neurons (${spent} already planned)` };
    spent += e.neurons; return { ...e, run: true, why: '' };
  });
}

export function markdown({ asks, rows, verdict: v, plan }) {
  const kinds = Object.keys(kindCounts(asks)), c = kindCounts(asks);
  const out = [`**Asks:** ${asks.length} (${countLine(asks)})`, ''];
  if (plan && plan.length) {
    out.push('| model | est. neurons | run |', '|:--|--:|:--|');
    for (const p of plan) out.push(`| \`${p.model}\` | ${p.neurons ?? '?'} | ${p.run ? 'yes' : 'no'}${p.why ? ' (' + p.why + ')' : ''} |`);
    out.push('');
  }
  if (rows.length) {
    out.push(`| model | right | ${kinds.map((k) => `${k} /${c[k]}`).join(' | ')} | first token p50 | p90 | errors |`, `|:--|--:|${kinds.map(() => '--:').join('|')}|--:|--:|--:|`);
    for (const r of rows) out.push(`| \`${r.model}\` | ${r.correct}/${r.total} | ${kinds.map((k) => r.byKind[k] || 0).join(' | ')} | ${r.ttft == null ? '-' : r.ttft + ' ms'} | ${r.ttft90 == null ? '-' : r.ttft90 + ' ms'} | ${r.errors} |`);
    out.push('');
  }
  out.push(`**Verdict:** ${v.switchTo ? 'switch to `' + v.switchTo + '`: ' : ''}${v.why}`);
  return out.join('\n') + '\n';
}

// before anything is spent: can this token list the catalog (Workers AI Read) and run a model (Workers AI Edit)?
export async function checkAccess({ fetch: get = fetch, runFetch = fetch, token = TOKEN, account = ACCOUNT } = {}) {
  // which secret the workflow handed in (model-bench.yml sets BENCH_TOKEN_NAME); an empty one is said as such, not as a scope
  const secret = process.env.BENCH_TOKEN_NAME || 'CLOUDFLARE_API_TOKEN';
  if (!token || !account) return { ok: false, why: `${!token ? secret : 'CLOUDFLARE_ACCOUNT_ID'} is empty: set the repository secret` };
  const why = async (r, scope) => {
    let j = null; try { j = await r.json(); } catch (_) {}
    const codes = ((j && j.errors) || []).map((e) => e.code);
    if (codes.includes(7003) || r.status === 404) return { ok: false, why: 'the account id is wrong or missing: check the CLOUDFLARE_ACCOUNT_ID secret' };
    if (r.status === 401 || r.status === 403 || codes.includes(10000)) return { ok: false, why: `${secret} lacks the "Account > Workers AI > ${scope}" permission (it needs Workers AI Read and Workers AI Edit): add both to that token${secret === 'CLOUDFLARE_API_TOKEN' ? ', or run with token2' : ''}` };
    return { ok: false, why: `HTTP ${r.status}: ${JSON.stringify((j && j.errors) || j).slice(0, 200)}` };
  };
  try {
    const r = await get(`${API}/models/search?task=${encodeURIComponent('Text Generation')}&per_page=1`, { headers: auth });
    if (!r.ok) return why(r, 'Read');
    const x = await runFetch(`${API}/run/${DEFAULT_MODEL}`, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 }) });
    if (!x.ok) return why(x, 'Edit');
    return { ok: true };
  } catch (e) { return { ok: false, why: 'Cloudflare could not be reached: ' + (e.message || e) }; }
}

// ---- --site: the bench inside the site (functions/api/bench.js), no Workers AI token, only READ_TOKEN ----
export async function siteProbe(site, key, get = fetch) {
  if (!key) return { ok: false, why: 'READ_TOKEN is empty: set the repository secret' };
  try {
    const r = await get(site + '/api/bench', { method: 'POST', headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' }, body: JSON.stringify({ probe: true }) });
    if (r.status === 401 || r.status === 403) return { ok: false, why: 'the site rejected READ_TOKEN (owner only): check the repository secret matches the Pages READ_TOKEN' };
    if (r.status === 404 || r.status === 405) return { ok: false, why: '/api/bench is not deployed on ' + site + ' yet' };
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || !j.ok) return { ok: false, why: `HTTP ${r.status}: ${JSON.stringify(j && j.error || j).slice(0, 200)}` };
    return { ok: true, asks: j.asks, chunk: j.chunk || 8, catalog: (j.catalog || []).map((m) => ({ id: m.id, created: m.created || '', price: priceOf(m.price) })) };
  } catch (e) { return { ok: false, why: site + ' could not be reached: ' + (e.message || e) }; }
}
// one model over asks 0..n-1, chunk by chunk; each answer's time is its whole time (the site does not stream)
export async function siteRun(site, key, model, n, chunk, get = fetch) {
  const out = new Array(n);
  for (let from = 0; from < n; from += chunk) {
    const to = Math.min(n, from + chunk);
    let rows = null, err = '';
    try {
      const r = await get(site + '/api/bench', { method: 'POST', signal: AbortSignal.timeout(TIMEOUT_MS * 2), headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' }, body: JSON.stringify({ model, from, to }) });
      if (r.ok) rows = (await r.json()).results; else err = 'HTTP ' + r.status + ' ' + (await r.text()).slice(0, 120);
    } catch (e) { err = String(e.message || e); }
    for (let i = from; i < to; i++) {
      const x = rows && rows.find((y) => y.i === i);
      out[i] = !x ? { error: err || 'no answer', ms: 0 } : x.error ? { error: x.error, ms: x.ms } : { text: x.text, ttft: x.ms, ms: x.ms };
    }
  }
  return out;
}

// streams one answer; ttft = ms until the first non-empty text, total = ms until done
async function run(model, messages) {
  const t0 = Date.now();
  if (VIA) { // through the wrangler-dev Worker: one reply, so the first-token time is the total time
    try {
      const j = await (await fetch(VIA, { method: 'POST', signal: AbortSignal.timeout(TIMEOUT_MS), body: JSON.stringify({ model, messages, max_tokens: 1200 }) })).json();
      if (!j.ok) return { error: String(j.error || 'no reply').slice(0, 200), ms: Date.now() - t0 };
      const r = j.result || {}, text = String(r.response ?? r.choices?.[0]?.message?.content ?? r.result?.response ?? '');
      return { text, ttft: Date.now() - t0, ms: Date.now() - t0 };
    } catch (e) { return { error: String(e.message || e), ms: Date.now() - t0 }; }
  }
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${API}/run/${model}`, { method: 'POST', signal: ctl.signal, headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ messages, max_tokens: 1200, stream: true }) });
    if (!r.ok || !r.body) return { error: 'HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200), ms: Date.now() - t0 };
    const dec = new TextDecoder(); let buf = '', text = '', ttft = null;
    for await (const chunk of r.body) {
      buf += dec.decode(chunk, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        let j; try { j = JSON.parse(data); } catch (_) { continue; }
        const piece = j.response ?? j.choices?.[0]?.delta?.content ?? j.choices?.[0]?.text ?? '';
        if (piece) { if (ttft === null && piece.trim()) ttft = Date.now() - t0; text += piece; }
      }
    }
    return { text, ttft, ms: Date.now() - t0 };
  } catch (e) { return { error: e.name === 'AbortError' ? 'timeout' : String(e.message || e), ms: Date.now() - t0 }; }
  finally { clearTimeout(timer); }
}

// --dry: canned answers that pass every check, except deliberate misses for the "weak" model, so the scoring can be seen working
function dryRun(model, a) {
  const good = { fact: 'Shakespeare Canberra 212 Au 1945 Jupiter Leonardo da Vinci 206 Orwell Everest carbon dioxide' };
  const pass = {
    'Who wrote Hamlet?': 'William Shakespeare.', 'What is the capital of Australia?': 'Canberra.', 'At what temperature does water boil at sea level in Fahrenheit?': '212 °F.',
    'What is the chemical symbol for gold?': 'Au.', 'In what year did World War II end?': '1945.', 'What is the largest planet in the solar system?': 'Jupiter.',
    'Who painted the Mona Lisa?': 'Leonardo da Vinci.', 'How many bones are in the adult human body?': '206.', 'Who wrote the novel 1984?': 'George Orwell.',
    'What is the tallest mountain above sea level?': 'Mount Everest.', 'What gas do plants take in for photosynthesis?': 'Carbon dioxide (CO2).',
  }[a.ask];
  const text = pass || {
    howto: '```python\ndef rev(s):\n    return s[::-1]\n```\nwc -l file\n```js\nfunction debounce(f,ms){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>f(...a),ms)}}\n```\ngit reset --soft HEAD~1\ndisplay:flex; place-items:center; justify-content:center\nSELECT * FROM orders ORDER BY created_at DESC LIMIT 5;\n37.8 °C',
    reason: 'The ball costs $0.05. There are three r letters, so 3. 17 x 23 = 391. Yes. They weigh the same.',
    self: 'I can play ' + (self.games || []).join(', ') + '. My skills include ' + skills.slice(0, 5).join(', ') + ', and weather. Nothing is open in my growth inbox right now. A-to-Mind made me, Void.',
    page: 'The launch is October 14. Ads are $12,000 of the budget. This page is the Q3 plan. The page does not say who the CEO is. Hi team, the launch moves to Friday because the vendor is late. You need spaghetti, a lemon and parmesan. The recipe does not say how long it takes.',
  }[a.kind] || good.fact;
  const weak = /weak/.test(model) && ['reason', 'page'].includes(a.kind);
  return { text: weak ? 'It depends on your goals.' : text, ttft: weak ? 900 : 300 + (a.ask.length % 7) * 20, ms: 800 };
}

async function pool(items, n, fn) {
  const out = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); } }));
  return out;
}
const median = (xs) => { const s = xs.filter((x) => x != null).sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const p90 = (xs) => { const s = xs.filter((x) => x != null).sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.ceil(s.length * 0.9) - 1)] : null; };

// a challenger replaces the default only when it is clearly better: at least 2 more asks right (and no kind worse by more
// than 1), with a median first token no more than 1.5x slower; or the same asks right and a median first token 30% faster
export function verdict(rows) {
  const base = rows.find((r) => r.model === DEFAULT_MODEL);
  if (!base) return { switchTo: null, why: 'the default model did not run' };
  if (rows.every((r) => r.errors === r.total)) return { switchTo: null, why: 'no verdict: every call failed (check the credentials or the --via Worker)' };
  const better = rows.filter((r) => r !== base && r.errors < r.total / 4).map((r) => {
    const more = r.correct - base.correct;
    const noKindWorse = Object.keys(base.byKind).every((k) => (r.byKind[k] || 0) >= base.byKind[k] - 1);
    const speed = base.ttft && r.ttft ? r.ttft / base.ttft : Infinity;
    const wins = (more >= 2 && noKindWorse && speed <= 1.5) || (more >= 0 && noKindWorse && speed <= 0.7);
    return { r, more, speed, wins };
  }).filter((x) => x.wins).sort((x, y) => y.more - x.more || x.speed - y.speed);
  if (!better.length) return { switchTo: null, why: `keep ${DEFAULT_MODEL}: no challenger was right on at least 2 more asks without being much slower, or as right and 30% faster` };
  const w = better[0];
  return { switchTo: w.r.model, why: `${w.r.model}: ${w.more >= 0 ? '+' : ''}${w.more} asks right vs ${DEFAULT_MODEL}, median first token ${(w.speed * 100).toFixed(0)}% of its time` };
}

async function main() {
  if (!DRY && !VIA && !SITE && (!ACCOUNT || !TOKEN)) { console.error('set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (or use --dry, or --via a wrangler-dev Worker)'); process.exit(2); }
  if (VIA && !opt('--models', '')) { console.error('--via needs --models a,b,c (the catalog listing needs the REST API)'); process.exit(2); }
  if (flag('--check') && SITE) { const c = await siteProbe(SITE, SITE_KEY); console.log(c.ok ? `access ok: ${SITE}/api/bench runs ${c.asks} asks, ${c.chunk} a call` : 'cannot bench: ' + c.why); process.exit(c.ok ? 0 : 3); }
  if (flag('--check')) { const c = await checkAccess(); console.log(c.ok ? 'access ok: the token can list and run Workers AI models' : 'cannot bench: ' + c.why); process.exit(c.ok ? 0 : 3); }
  if (flag('--list')) {
    for (const m of await catalog()) console.log(`${m.id.padEnd(52)} ${String(m.created).slice(0, 10)}${m.beta ? '  beta' : ''}${m.ctx ? '  ctx ' + m.ctx : ''}`);
    return;
  }
  let challengers = (opt('--models', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const probe = SITE ? await siteProbe(SITE, SITE_KEY) : null;
  if (probe && !probe.ok) { console.error('cannot bench: ' + probe.why); process.exit(3); }
  if (SITE && opt('--asks', '')) { console.error('--site runs the built-in asks only (the site has no ask files yet)'); process.exit(2); }
  const cat = DRY || VIA ? [] : SITE ? probe.catalog : await catalog(), prices = Object.fromEntries(cat.filter((m) => m.price).map((m) => [m.id, m.price]));
  if (!challengers.length) {
    const top = parseInt(opt('--top', '3'), 10) || 3;
    challengers = DRY ? ['@cf/dry/strong', '@cf/dry/weak'] : cat.map((m) => m.id).filter((id) => id !== DEFAULT_MODEL && id !== PAID_MODEL).slice(0, top);
  }
  const only = (opt('--only', '') || '').split(',').filter(Boolean);
  const file = opt('--asks', '');
  const asks = ASKS.concat(file ? loadAsks(JSON.parse(fs.readFileSync(file, 'utf8')), { literalOnly: flag('--asks-literal') }) : []).filter((a) => !only.length || only.includes(a.kind));
  const cap = Number(opt('--max-neurons', '8000'));
  const plan = planRun([DEFAULT_MODEL, ...challengers.filter((m) => m !== DEFAULT_MODEL)], asks, prices, { cap: Number.isFinite(cap) ? cap : 8000, keep: [DEFAULT_MODEL], allowUnpriced: DRY || !!VIA || flag('--allow-unpriced') });
  console.log(`asks: ${asks.length} (${countLine(asks)})`);
  for (const p of plan) console.log(`  ${p.model.padEnd(50)} est. ${String(p.neurons ?? '?').padStart(6)} neurons  ${p.run ? 'run' : 'not run'}${p.why ? ': ' + p.why : ''}`);
  const models = plan.filter((p) => p.run).map((p) => p.model);
  console.log(`${asks.length} asks x ${models.length} models = ${asks.length * models.length} calls${DRY ? ' (dry run, no network)' : ''}\n`);

  const rows = [];
  for (const model of models) {
    process.stdout.write(model.padEnd(52));
    const site = SITE ? await siteRun(SITE, SITE_KEY, model, asks.length, probe.chunk) : null;
    const res = await pool(asks, PAR, async (a, i) => { const r = DRY ? dryRun(model, a) : site ? site[i] : await run(model, messagesFor(a)); return { ...a, ...r, ...(r.error ? { ok: false, failed: [r.error] } : score(a, r.text)) }; });
    const byKind = {}; for (const r of res) byKind[r.kind] = (byKind[r.kind] || 0) + (r.ok ? 1 : 0);
    const row = { model, total: res.length, correct: res.filter((r) => r.ok).length, errors: res.filter((r) => r.error).length, byKind,
      ttft: median(res.map((r) => r.ttft)), ttft90: p90(res.map((r) => r.ttft)), ms: median(res.map((r) => r.ms)), results: res };
    rows.push(row);
    console.log(`${row.correct}/${row.total} right, first token ${row.ttft ?? '-'} ms median${row.errors ? `, ${row.errors} errors` : ''}`);
  }

  const kinds = [...new Set(asks.map((a) => a.kind))], count = (k) => asks.filter((a) => a.kind === k).length;
  console.log('\n' + ['model'.padEnd(52), 'right'.padStart(7), ...kinds.map((k) => (k + ' /' + count(k)).padStart(Math.max(10, k.length + 5))), 'TTFT p50'.padStart(10), 'TTFT p90'.padStart(10), 'errors'.padStart(7)].join(''));
  for (const r of rows) console.log([r.model.padEnd(52), `${r.correct}/${r.total}`.padStart(7), ...kinds.map((k) => String(r.byKind[k] || 0).padStart(Math.max(10, k.length + 5))),
    (r.ttft == null ? '-' : r.ttft + ' ms').padStart(10), (r.ttft90 == null ? '-' : r.ttft90 + ' ms').padStart(10), String(r.errors).padStart(7)].join(''));

  console.log('\nmisses (first 2 per model):');
  for (const r of rows) for (const m of r.results.filter((x) => !x.ok).slice(0, 2)) console.log(`  ${r.model}  "${m.ask}"  ${m.failed.join('; ')}${m.text ? '\n      ' + String(m.text).replace(/\s+/g, ' ').slice(0, 160) : ''}`);

  const v = verdict(rows);
  console.log('\nverdict: ' + (v.switchTo ? 'switch to ' : '') + v.why);
  if (v.switchTo) console.log(`to switch: DEFAULT_MODEL in void-live-deploy/lib/router.js (and MODEL in functions/api/will.js), then run the suite.`);
  if (opt('--md', '')) fs.writeFileSync(opt('--md', ''), markdown({ asks, rows, verdict: v, plan }));
  const out = opt('--out', path.join(os.tmpdir(), 'void-model-bench.json'));
  fs.writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), dry: DRY, verdict: v, asks: kindCounts(asks), plan, rows: rows.map(({ results, ...r }) => ({ ...r, results: results.map(({ must, mustNot, page, ...x }) => x) })) }, null, 1));
  console.log('full results: ' + out);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e.message || e); process.exit(1); });
