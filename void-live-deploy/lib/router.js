// Void's router (the will's "tiered model stack" want, 2026-09-28). A tiny classifier in front of the answer engine.
// It runs whenever Workers AI is bound, unless the Pages env var VOID_ANSWER_MODELS=off (then /api/answer answers from the open web).
//
// Workers AI has no general intent classifier (its Text Classification models are sentiment, relevance and safety), so the
// router uses the small multilingual embedding model @cf/baai/bge-m3 (100+ languages, $0.012 per M tokens) as a
// nearest-neighbour classifier: the ask is embedded once and compared with labelled examples below (each skill's asks, its
// near-misses, simple questions, hard questions). The example vectors are embedded once, then kept in the isolate's memory
// and the colo's edge cache (int8), never re-embedded per request.
//
// It sorts every ask the answer engine gets into:
//   skill  - a skill should have caught it (the page's parsers missed this phrasing). Gemma still answers; the miss log gets
//            "the <skill> skill didn't catch this", which the will turns into "learn to handle ..." (never runs anything).
//   simple - Gemma 4 26B (the default), as before.
//   hard   - Atom's rule (STANDING.md): Void may pay for a stronger model, but only from money it has already earned (the
//            Gumroad earnings, lib/earnings.js) and only under a standing spend someone said yes to on the confirm line
//            (/api/approval, tool models.spend). So: earned budget > 0 AND an approved standing spend with room left = the paid
//            model (DeepSeek V4 Flash), each call's cost recorded against both. Otherwise Gemma answers (the one free model;
//            Atom: no second fallback stack) and the stronger model is recorded, not called: a 'would escalate' in
//            void_shortfalls (lib/shortfall.js, the same evidence ledger the will and /api/earnings read).
//            The same paid path (same two conditions) answers when Gemma itself fails; otherwise the open-web answer.
//   fallback - the classifier failed or ran out of time: exactly the old behaviour (Gemma), logged.
// The router runs while Wikipedia sources are fetched, and the answer waits for it at most BUDGET_MS from the start.
// Nothing here touches the page, the confirm line or any action: the router only picks a model and writes a log line.
import { redact } from './automation-fix.js';
import { readEarnings } from './earnings.js';

import { EMBED_MODEL, PAID_MODEL, models } from './models.js';
export { EMBED_MODEL, PAID_MODEL };
export const DEFAULT_MODEL = models('answer'); // kept for older imports; the name lives in lib/models.js
export const BUDGET_MS = 300; // the longest the router may hold an answer, counted from the start of the request
export const STRONG_TIMEOUT_MS = 20000; // a paid call that takes longer is dropped (and costs nothing); then Gemma answers
export const EXAMPLES_TIMEOUT_MS = 10000; // a stuck embedding call is dropped, so the next ask tries again
// Initial thresholds for bge-m3 cosine similarity; every routed ask logs its scores so these can be tuned from real traffic
// (Pages env VOID_ROUTER_TUNE = JSON, e.g. {"skillMin":0.72}) without a code change.
export const TUNING = { skillMin: 0.7, skillMargin: 0.04, hardMargin: 0.03, hardMin: 0.62, cue: 0.05, cueMax: 0.1 };

// Labelled examples. Skills: what the skill does (examples) and what only looks like it (near: answered, never a skill).
// "act" is the confirm line's ground (send, book, buy): logged as evidence only; the router never starts or answers an action.
export const SKILLS = {
  clock: { examples: ['make a clock', 'put a clock on the screen', 'show me the time', 'add a digital clock', 'pon un reloj'], near: ['who invented the clock', 'how does an atomic clock work', 'what is a biological clock'] },
  timer: { examples: ['make a 5 minute timer', 'set a timer for 30 seconds', 'start a one hour countdown', 'countdown from ten minutes', 'wake me in 20 minutes', 'minuteur de 5 minutes'], near: ['how do egg timers work', 'what is a timer in electronics', 'history of the hourglass'] },
  sticky: { examples: ['add a sticky that says buy milk', 'put a note saying call mom', 'post-it that says dentist at 3', 'jot down pick up the kids', 'nota adhesiva que diga comprar pan'], near: ['who invented the post-it note', 'why are sticky notes yellow', 'what glue is on sticky notes'] },
  notepad: { examples: ['open a notepad', 'give me somewhere to write', 'a blank page to type on', 'open a scratchpad'], near: ['what is notepad on windows', 'history of paper notebooks'] },
  list: { examples: ['make a list', 'start a shopping list', 'to-do list with eggs and bread', 'make a checklist for the trip'], near: ["what is schindler's list", 'what is a linked list'] },
  calc: { examples: ['15% of 80', '5 miles in km', '100 usd in eur', 'what is 23 times 19', 'square root of 144', 'convert 30 celsius to fahrenheit', 'how much is 250 pounds in kilograms'], near: ['what is calculus', 'history of the abacus', 'who invented the calculator'] },
  counter: { examples: ['make a counter', 'tally counter', 'count taps for me', 'a clicker to count people'], near: ['what is a geiger counter', 'what does counterintuitive mean'] },
  shape: { examples: ['draw a circle', 'make a red square', 'draw a triangle', 'put a star shape on the stage'], near: ['how many sides does a hexagon have', 'what shape is the earth'] },
  link: { examples: ['add a link to example.com', 'save this link', 'pin this url', 'bookmark wikipedia.org'], near: ['what is a hyperlink', 'what is a missing link in evolution'] },
  image: { examples: ['show me a picture of a cat', 'image of mountains at sunset', 'put a photo of the moon on the stage'], near: ['how do digital cameras work', 'who took the first photograph'] },
  look: { examples: ['make my void deep blue', 'add stars to my void', 'quieter font', 'dark background please', 'reset my void', 'make everything bigger'], near: ['why is the ocean blue', 'what is a font', 'why is space dark'] },
  weather: { examples: ['weather in Tokyo', 'will it rain tomorrow', 'temperature in London', 'do I need an umbrella today', 'is it cold in Oslo right now', 'quel temps fait-il à Paris'], near: ['what is the weather like on mars', 'how do meteorologists forecast weather', 'what causes rain'] },
  worldtime: { examples: ['world clock', 'time in Tokyo', '3pm London to Tokyo', 'sunset in Paris', 'when is sunrise in New York', 'what time is it in Sydney', 'what day is it in Auckland', 'time difference between London and Tokyo', 'what time is it in Lagos right now', 'hora en Madrid'], near: ['what is time', 'time zones explained', 'who invented time zones', 'why does the sun set'] }, // skills/worldtime.js examples + its nearMisses (its 'make a clock', 'make a 5 minute timer', 'set a timer for 3pm' are the clock and timer skills' asks)
  translate: { examples: ['translate hello to Spanish', 'how do you say thank you in Japanese', 'good morning in French', 'what is cat in German', 'say goodbye in Italian'], near: ['how many languages are there', 'what language do they speak in brazil'] },
  place: { examples: ['map of Lisbon', 'where is Kyoto', 'streets around Penn Station', 'show me Paris on a map', 'directions around Central Park'], near: ['history of cartography', 'who made the first world map'] },
  self: { examples: ['what can you do', 'menu', 'what do you want to be', 'help', 'show the board', 'what are you'], near: ['what is artificial intelligence', 'what is a search engine'] },
  act: { examples: ['email jane that I am running late', 'send a message to bob', 'book a table for two tonight', 'buy two bags of coffee', 'pay the electricity bill', 'schedule a meeting with sam on friday'], near: ['how does email work', 'who invented the credit card'] },
};
export const SIMPLE = ['what is a black hole', 'who wrote hamlet', 'capital of australia', 'how tall is mount everest', 'when did world war two end',
  'why is the sky blue', 'what does photosynthesis mean', 'how many legs does a spider have', '¿por qué el cielo es azul?', 'qui a peint la joconde', 'what is bitcoin', 'who is the president of france'];
export const HARD = ['compare keynesian and austrian economics and which explains the 2008 crisis better', 'prove that there are infinitely many prime numbers',
  'explain step by step how to derive the black-scholes equation', 'what are the tradeoffs between postgres and dynamodb for a multi-tenant saas',
  'design a database schema for a hotel booking system with overbooking', 'why did the roman empire fall and how does it compare to the united states today',
  'analyze the ethical implications of editing human embryos', 'write a python function for the longest palindromic substring and explain its complexity',
  'a train leaves at 3pm at 60 mph and another at 4pm at 80 mph, when does the second catch up', '¿cuáles son las ventajas y desventajas de la energía nuclear frente a la solar?',
  'how would quantum computers break rsa and what should replace it', 'should a small startup use microservices or a monolith and why'];

export function exemplars() {
  const out = [];
  for (const [name, s] of Object.entries(SKILLS)) {
    for (const t of s.examples) out.push({ text: t, kind: 'skill', skill: name });
    for (const t of s.near) out.push({ text: t, kind: 'near', skill: name });
  }
  for (const t of SIMPLE) out.push({ text: t, kind: 'simple' });
  for (const t of HARD) out.push({ text: t, kind: 'hard' });
  return out;
}

// Structural signs of a hard ask, in a few languages: comparison, proof, step-by-step, design, code, several questions, length.
const HARD_WORDS = /\b(compare|comparison|versus|vs\.?|trade-?offs?|pros and cons|advantages and disadvantages|step[- ]by[- ]step|prove|proof|derive|derivation|analy[sz]e|implications|evaluate|critique|in depth|design an?|architecture|optimi[sz]e|ventajas y desventajas|compara|avantages et inconv[ée]nients|d[ée]montre[rz]?|vergleiche?)\b/i;
export function cues(ask) {
  const a = String(ask || '');
  let n = 0;
  if (HARD_WORDS.test(a)) n += 1;
  if ((a.match(/\?/g) || []).length >= 2 || /\b(and why|and how|and what)\b/i.test(a)) n += 1;
  if (/```|[{};]\s*$|\bfunction\s*\(|\bdef\s+\w+\(|=>|\bSELECT\b.+\bFROM\b/.test(a)) n += 1;
  if (a.split(/\s+/).filter(Boolean).length >= 25) n += 1;
  return n;
}

const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
function unit(v) { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) || 1; const o = new Float32Array(v.length); for (let i = 0; i < v.length; i++) o[i] = v[i] / s; return o; }
const r3 = (x) => Math.round(x * 1000) / 1000;

// The decision, from the ask's vector and the example vectors. Pure: the tests call it directly.
export function decide(askVec, ex, vecs, ask, tune = TUNING) {
  const t = { ...TUNING, ...(tune || {}) };
  const best = { skill: -1, skillName: null, near: -1, simple: -1, hard: -1 };
  for (let i = 0; i < ex.length; i++) {
    const s = dot(askVec, vecs[i]), e = ex[i];
    if (e.kind === 'skill') { if (s > best.skill) { best.skill = s; best.skillName = e.skill; } }
    else if (s > best[e.kind]) best[e.kind] = s;
  }
  const other = Math.max(best.near, best.simple, best.hard);
  const c = cues(ask), lift = Math.min(t.cueMax, c * t.cue);
  const scores = { skill: r3(best.skill), near: r3(best.near), simple: r3(best.simple), hard: r3(best.hard), cues: c };
  // a skill: close to one of its asks and clearly closer than to anything that only looks like it; an ask with signs of a hard
  // question (compare, prove, step by step, several questions, code, 25+ words) is never a skill ask
  if (c === 0 && best.skill >= t.skillMin && best.skill - other >= t.skillMargin) return { kind: 'skill', skill: best.skillName, score: r3(best.skill), scores };
  // hard: closer to the hard asks than to simple ones (plus the structural signs), and either a sign or a close hard neighbour
  const hardness = best.hard - Math.max(best.simple, best.near) + lift;
  scores.hardness = r3(hardness);
  return hardness >= t.hardMargin && (c > 0 || best.hard >= t.hardMin) ? { kind: 'hard', score: r3(hardness), scores } : { kind: 'simple', score: r3(hardness), scores };
}

// --- example vectors: memory -> edge cache -> embed once (in the background when the request can't wait) ---
const mem = new Map();
const enc = new TextEncoder();
async function hash(s) { const b = await crypto.subtle.digest('SHA-256', enc.encode(s)); return [...new Uint8Array(b)].slice(0, 12).map((x) => x.toString(16).padStart(2, '0')).join(''); }
function vectorsOf(r) {
  const d = r && (Array.isArray(r.data) ? r.data : Array.isArray(r.response) ? r.response : Array.isArray(r) ? r : null);
  if (!d || !d.length || !Array.isArray(d[0]) && !(d[0] instanceof Float32Array)) throw new Error('no vectors');
  return d.map(unit);
}
export async function embed(env, texts) {
  const out = [];
  for (let i = 0; i < texts.length; i += 50) out.push(env.AI.run(EMBED_MODEL, { text: texts.slice(i, i + 50) }).then(vectorsOf));
  return (await Promise.all(out)).flat();
}
// int8 + one scale per vector: ~1 KB per example in the edge cache, cosine error far below the thresholds
export function pack(vecs) {
  return JSON.stringify(vecs.map((v) => { let m = 0; for (const x of v) m = Math.max(m, Math.abs(x)); const s = m / 127 || 1; const q = new Int8Array(v.length); for (let i = 0; i < v.length; i++) q[i] = Math.round(v[i] / s); return [s, btoa(String.fromCharCode(...new Uint8Array(q.buffer)))]; }));
}
export function unpack(txt) {
  return JSON.parse(txt).map(([s, b]) => { const raw = atob(b), q = new Int8Array(raw.length); for (let i = 0; i < raw.length; i++) q[i] = (raw.charCodeAt(i) << 24) >> 24; const v = new Float32Array(q.length); for (let i = 0; i < q.length; i++) v[i] = q[i] * s; return unit(v); });
}
export function exampleVectors(env, ex, { origin = 'https://a-to-mind.com', waitUntil } = {}) {
  const texts = ex.map((e) => e.text);
  const keyP = hash(EMBED_MODEL + '\n' + texts.join('\n'));
  return keyP.then((key) => {
    const hit = mem.get(key);
    if (hit) return hit;
    const p = (async () => {
      const req = new Request(origin + '/__void-router/vectors/' + key);
      try { const c = typeof caches !== 'undefined' && caches.default && await caches.default.match(req); if (c) return unpack(await c.text()); } catch (_) {}
      let t;
      const vecs = await Promise.race([embed(env, texts), new Promise((_, rej) => { t = setTimeout(() => rej(new Error('examples timeout')), EXAMPLES_TIMEOUT_MS); })]).finally(() => clearTimeout(t));
      if (vecs.length !== texts.length) throw new Error('vector count');
      try { if (typeof caches !== 'undefined' && caches.default) await caches.default.put(req, new Response(pack(vecs), { headers: { 'cache-control': 'max-age=2592000' } })); } catch (_) {}
      return vecs;
    })();
    mem.set(key, p);
    p.catch(() => mem.delete(key));
    if (waitUntil) try { waitUntil(p.catch(() => {})); } catch (_) {} // finishes (and fills the caches) even when this request moved on
    return p;
  });
}
export function resetRouter() { mem.clear(); } // tests only

export function tuning(env) {
  try { return { ...TUNING, ...(env && env.VOID_ROUTER_TUNE ? JSON.parse(env.VOID_ROUTER_TUNE) : {}) }; } catch (_) { return TUNING; }
}

// Classify one ask. Never throws: a failure is { kind: 'fallback', why }.
export async function classify(env, ask, opts = {}) {
  const t0 = Date.now();
  if (!env || !env.AI) return { kind: 'fallback', why: 'no model', ms: 0 };
  try {
    const ex = exemplars();
    const [vecs, [askVec]] = await Promise.all([exampleVectors(env, ex, opts), embed(env, [String(ask).slice(0, 300)])]);
    return { ...decide(askVec, ex, vecs, ask, tuning(env)), ms: Date.now() - t0 };
  } catch (e) {
    return { kind: 'fallback', why: 'classifier error', ms: Date.now() - t0 };
  }
}

// Waits for the router until `deadline` (ms since epoch), then gives up: fallback, current behaviour.
export function settle(routeP, deadline) {
  const left = Math.max(0, deadline - Date.now());
  let timer;
  const late = new Promise((res) => { timer = setTimeout(() => res({ kind: 'fallback', why: 'timeout', ms: null }), left); });
  return Promise.race([routeP.catch(() => ({ kind: 'fallback', why: 'classifier error' })), late]).finally(() => clearTimeout(timer));
}

// --- the routing log (D1, made on first use): the miss log's routing column, read by the will (GET /api/routes) ---
const TABLES = [
  'CREATE TABLE IF NOT EXISTS void_routes (id TEXT PRIMARY KEY, ask TEXT NOT NULL, route TEXT NOT NULL, skill TEXT, model TEXT, outcome TEXT, would TEXT, score REAL, scores TEXT, ms INTEGER, waited INTEGER, count INTEGER NOT NULL, first TEXT NOT NULL, last TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS void_kv (k TEXT PRIMARY KEY, v TEXT)',
  'CREATE TABLE IF NOT EXISTS void_spends (id TEXT PRIMARY KEY, approval_id TEXT, model TEXT NOT NULL, cap_cents INTEGER NOT NULL, per TEXT NOT NULL, at TEXT NOT NULL)',
];
const made = new WeakMap();
export function ensureRouteTables(env) {
  if (!env || !env.DB) return Promise.reject(new Error('no DB binding'));
  let p = made.get(env.DB);
  if (!p) { p = env.DB.batch(TABLES.map((q) => env.DB.prepare(q))).catch((e) => { made.delete(env.DB); throw e; }); made.set(env.DB, p); }
  return p;
}

// --- paying for a stronger model: only from what Void earned, only under a standing spend said yes to on the confirm line ---
export const PAID_MODELS = [PAID_MODEL]; // a standing spend can only name these
export const PAID_PRICE = { [PAID_MODEL]: { in: 0.44, out: 1.32 } }; // $ per M tokens (developers.cloudflare.com/workers-ai/platform/pricing)
export const PAID_MIN_CENTS = 1; // never start a paid call with less than this left (one call costs well under half a cent)
export const periodKey = (per, d = new Date()) => (per === 'day' ? d.toISOString().slice(0, 10) : per === 'week' ? d.toISOString().slice(0, 4) + '-w' + String(Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 6048e5)).padStart(2, '0') : d.toISOString().slice(0, 7));
async function kvNum(env, k) { const r = await env.DB.prepare('SELECT v FROM void_kv WHERE k = ?').bind(k).first(); return r ? Number(r.v) || 0 : 0; }

// The confirm line's executor for tool models.spend (functions/api/approval.js): runs only inside an in-time yes whose
// fingerprint still matches, once. Records the standing spend; the newest one wins, so "$0 a month" stops paying.
export async function grantStandingSpend(args, env, rec) {
  const model = String((args && args.model) || '');
  if (!PAID_MODELS.includes(model)) throw new Error('not a model Void may pay for');
  const c = args.cost || {};
  if (c.currency !== 'USD' || !(c.amount >= 0) || c.amount > 1000) throw new Error('cap must be 0-1000 USD');
  const per = ['day', 'week', 'month'].includes(args.per) ? args.per : 'month';
  await ensureRouteTables(env);
  const id = crypto.randomUUID(), cap = Math.round(c.amount * 100);
  await env.DB.prepare('INSERT INTO void_spends (id, approval_id, model, cap_cents, per, at) VALUES (?, ?, ?, ?, ?, ?)').bind(id, (rec && rec.approvalId) || null, model, cap, per, new Date().toISOString()).run();
  return { standing: id, model, cap_cents: cap, per };
}

// { model, spend, left } = Void may pay for this call; { why } = it may not (then Gemma, and a 'would escalate' shortfall).
export async function paidAccess(env, now = new Date()) {
  let budget = 0;
  try { budget = (await readEarnings(env)).budget_cents; } catch (_) { return { why: 'no earned budget (no sales recorded)' }; }
  if (!(budget > 0)) return { why: 'no earned budget' };
  let s = null;
  try { await ensureRouteTables(env); s = await env.DB.prepare('SELECT id, approval_id, model, cap_cents, per, at FROM void_spends ORDER BY at DESC LIMIT 1').first(); } catch (_) { return { why: 'no approved standing spend (unreadable)' }; }
  if (!s || !(s.cap_cents > 0) || !PAID_MODELS.includes(s.model)) return { why: 'no approved standing spend' };
  let inPeriod = 0, total = 0;
  try { [inPeriod, total] = await Promise.all([kvNum(env, 'router:paid:' + s.id + ':' + periodKey(s.per, now)), kvNum(env, 'router:paid:total')]); } catch (_) { return { why: 'spend counter unreadable' }; }
  const byCap = s.cap_cents - inPeriod, byBudget = budget - total;
  if (byBudget < PAID_MIN_CENTS) return { why: 'earned budget used up' };
  if (byCap < PAID_MIN_CENTS) return { why: 'standing spend used up this ' + s.per };
  return { model: s.model, spend: s, left: Math.min(byCap, byBudget), period: periodKey(s.per, now) };
}
export function costCents(model, r, promptChars, outChars) {
  const p = PAID_PRICE[model] || { in: 5, out: 15 }; // unknown = priced high on purpose
  const u = (r && r.usage) || {};
  const tin = Number(u.prompt_tokens) || Math.ceil(promptChars / 3), tout = Number(u.completion_tokens) || Math.ceil(outChars / 2);
  return Math.round(((tin * p.in + tout * p.out) / 1e6) * 100 * 10000) / 10000;
}
// Records a paid call against the standing spend and the earned budget, and in the confirm line's ledger (kind 'spent').
export async function recordSpend(env, access, cents, detail = {}) {
  const at = new Date().toISOString();
  const bump = (k) => env.DB.prepare("INSERT INTO void_kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = CAST(CAST(v AS REAL) + CAST(excluded.v AS REAL) AS TEXT)").bind(k, String(cents));
  try { await env.DB.batch([bump('router:paid:' + access.spend.id + ':' + access.period), bump('router:paid:total')]); } catch (_) {}
  try {
    await env.DB.prepare('INSERT INTO void_ledger (id, approval_id, kind, at, entry) VALUES (?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), access.spend.approval_id || access.spend.id, 'spent', at, JSON.stringify({ toolName: 'models.spend', model: access.model, cents, standing: access.spend.id, ...detail })).run();
  } catch (_) {}
}

const idOf = (ask) => hash('route\n' + ask);
export async function logRoute(env, rec, now = new Date().toISOString()) {
  try {
    await ensureRouteTables(env);
    const ask = String(rec.masked ? '(masked ask)' : redact(String(rec.ask || ''))).toLowerCase().slice(0, 200);
    await env.DB.prepare(`INSERT INTO void_routes (id, ask, route, skill, model, outcome, would, score, scores, ms, waited, count, first, last) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET route = excluded.route, skill = excluded.skill, model = excluded.model, outcome = excluded.outcome, would = excluded.would, score = excluded.score, scores = excluded.scores, ms = excluded.ms, waited = excluded.waited, count = count + 1, last = excluded.last`)
      .bind(await idOf(ask), ask, String(rec.route || 'fallback'), rec.skill || null, rec.model || null, String(rec.outcome || '').slice(0, 200), rec.would || null, Number.isFinite(rec.score) ? rec.score : null, rec.scores ? JSON.stringify(rec.scores).slice(0, 300) : null, Number.isFinite(rec.ms) ? rec.ms : null, Number.isFinite(rec.waited) ? rec.waited : null, now, now).run();
    return true;
  } catch (_) { return false; }
}

// For the will (and Atom): what the router decided, rolled up. Asks are already masked; no connection data is stored.
export async function readRoutes(env, limit = 500) {
  await ensureRouteTables(env);
  const rows = ((await env.DB.prepare('SELECT ask, route, skill, model, outcome, would, score, scores, ms, waited, count, first, last FROM void_routes ORDER BY last DESC LIMIT ?').bind(limit).all()).results) || [];
  const sum = (f) => rows.filter(f).reduce((n, r) => n + (r.count || 1), 0);
  const waits = rows.map((r) => r.waited).filter(Number.isFinite).sort((a, b) => a - b);
  const pct = (p) => (waits.length ? waits[Math.min(waits.length - 1, Math.floor(p * waits.length))] : null);
  const skills = {};
  for (const r of rows.filter((x) => x.route === 'skill')) (skills[r.skill] = skills[r.skill] || []).push({ ask: r.ask, count: r.count, score: r.score });
  return {
    total: sum(() => true),
    skill: sum((r) => r.route === 'skill'), simple: sum((r) => r.route === 'simple'), hard: sum((r) => r.route === 'hard'), fallback: sum((r) => r.route === 'fallback'),
    paid: sum((r) => /paid from earnings/.test(r.outcome || '')),
    would_escalate: sum((r) => r.route === 'hard' && !!r.would),
    would_models: [...new Set(rows.filter((r) => r.would).map((r) => r.would))],
    fallback_why: rows.filter((r) => r.route === 'fallback').reduce((o, r) => ({ ...o, [r.outcome || '?']: (o[r.outcome || '?'] || 0) + (r.count || 1) }), {}),
    waited_ms: { p50: pct(0.5), p95: pct(0.95), max: waits.length ? waits[waits.length - 1] : null },
    skills,
    hard_asks: rows.filter((r) => r.route === 'hard').slice(0, 20).map((r) => ({ ask: r.ask, count: r.count, outcome: r.outcome, would: r.would })),
    rows: rows.slice(0, 100),
  };
}
