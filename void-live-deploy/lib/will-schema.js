// The shape of the two objects the will hands across its two seams, so neither seam has to guess (owner's direction, 2026-10-30:
// the learning and ranking layer stays separate from the code-generation layer, and the loop between them stays tight).
//
//   CANDIDATE  what the ranking layer may promote: one want, as tools/will.py gathers it (kind, title, why, weight, cost, source)
//              plus `shape`: whether it can be built as a zero-key edge tool or a client-side card at all.
//   BRIEF      what a builder is allowed to build, for the one want the will queued: the problem, who it is for, the paths it may
//              change, the assertions that must pass, and where the want came in (station attribution).
//
// Why a declared `shape` and not a guess about the words: a title is a sentence a person typed, and no pattern over one honestly
// says "this needs an API key". The layer that makes a candidate knows (an upgrade to a paid plan, a service behind a key), so it
// declares it. An absent or unknown shape is never a reason to hold a want back: the gate only stops what named a key.
//
// Why the brief carries defaults at all: a want queued tonight should reach a builder with the paths and the assertion already on
// it, not as a sentence to interpret. The defaults are this repository's own policy (`docs/RULES.md`, `AGENTS.md`), never a fact
// invented about the want; a planner overrides any of them. Pure: no network, no clock, no storage. The caller writes the result.

export const SCHEMA = 1; // this file's own shape version. Not lib/will-guard.js WILL_SCHEMA: that one is the writer's version.

/** the ways a want can be built, in the words the ranking layer uses. */
export const SHAPES = ['edge', 'card', 'keyed', 'unknown'];
/** the shape a candidate has when the layer that made it said nothing: it is promoted like any other. */
export const UNKNOWN = 'unknown';

/** whether a want can be built with no key of its own: a zero-key edge tool or a card that runs in the page. Pure. */
export const shapeOf = (v) => (SHAPES.includes(String(v || '').toLowerCase()) ? String(v).toLowerCase() : UNKNOWN);

/** who a want of each kind is for, read off the candidate's kind (tools/will.py). Pure. */
export const AUDIENCE = {
  'people asked': 'people asking Verse for this',
  'fix myself': 'Verse itself',
  'upgrade myself': 'Verse itself, and the money it spends',
  'upgrade my architecture': 'Verse itself',
  'grow from the lab': 'Verse itself',
  frontier: 'the build order (domains/void.frontier.md)',
  'I asked for this': 'Verse itself, from its reflections',
  'idea from input': 'whoever the record came from',
  'idea from stale input': 'whoever the record came from',
  'found on Victus': 'Verse itself',
  'make money': 'people who would pay for it',
};
export const audienceOf = (kind) => AUDIENCE[String(kind || '')] || 'whoever the want names';

/** the paths a builder may change by default: the non-core write surface of the repository. A planner replaces them. */
export const DEFAULT_ALLOWED = ['void-live-deploy/skills/', 'void-live-deploy/lib/', 'tools/'];
/** the assertion a brief carries by default: the fast checks every change must pass (`AGENTS.md`, `node tools/checks.mjs`). */
export const DEFAULT_TESTS = ['VOID_SKIP_BENCH=1 node tools/checks.mjs'];

// A want that sells something is held to the money path itself, not only the fast checks (owner, 2026-10-30: "make anything it can
// that makes money from what it watches or listens to"). `tools/sale-e2e.test.mjs` is the existing proof that a sale lands in
// /api/earnings, so a "make money" brief that leaves it out is not complete enough to ship itself.
export const EARN_KIND = 'make money';
export const MONEY_TESTS = ['node --test tools/sale-e2e.test.mjs', 'VOID_SKIP_BENCH=1 node tools/checks.mjs'];
// Small on purpose: a want that earns is worth more than a plain idea of the same evidence, but never above the frontier's first item
// (weight 40) on its own. The same rule tools/will.py holds its better-boost to.
export const MONEY_BOOST = 6;

// Files and folders a builder is kept off, whatever a brief says: the shared surface every want reaches through them. The page and
// its two copies (checks fail when they differ), the endpoints, the workflows, and the rules themselves.
export const CORE = [
  'void.html',
  'void-live-deploy/index.html',
  'void-live-deploy/void.html',
  'void-live-deploy/functions/api/',
  '.github/workflows/',
  'AGENTS.md',
  'STANDING.md',
  'docs/RULES.md',
];

const clip = (t, n) => {
  const x = String(t == null ? '' : t).replace(/\s+/g, ' ').trim();
  return x.length <= n ? x : x.slice(0, n - 1).replace(/\s+\S*$/, '') + '\u2026';
};
const str = (v) => String(v == null ? '' : v);

/** the price of the thing a want sells: { cents, for, how }, where cents is what one person pays, never a forecast. null when the
 * want does not sell anything. Pure. */
export function revenueOf(v) {
  const x = v && typeof v === 'object' ? v : null;
  if (!x) return null;
  return { cents: Math.max(0, Math.round(+x.cents || 0)), for: clip(x.for, 80), how: clip(x.how, 80) };
}

/**
 * A want that makes money from something Verse consumed: the idea, the thing it came from, and what one person pays. Written as a
 * candidate, so it ranks beside the app ideas rather than in a list of its own ("on top of app ideas"). Station attribution rides
 * with it, and the shape stays unknown until the layer that makes it says otherwise. Pure.
 */
export function moneyCandidate({ idea, from = 'other', why = '', cents = 0, for: what = '', how = '', weight = 12 } = {}) {
  const source = sourceOf(from);
  return {
    kind: EARN_KIND,
    title: clip(idea, 160),
    why: clip(why || 'something I could sell from what I consumed', 240),
    weight: Math.max(0, Math.round(+weight || 0)) + MONEY_BOOST,
    shape: 'unknown',
    source,
    revenue: revenueOf({ cents, for: what, how }),
  };
}

/** every path a brief names that sits on a core file or folder, or is not a plain relative path: [{ path, why }]. Pure. */
export function outOfScope(allowed) {
  const out = [];
  for (const raw of Array.isArray(allowed) ? allowed : []) {
    const p = str(raw).trim();
    if (!p) out.push({ path: p, why: 'empty' });
    else if (/^[A-Za-z]:|^\/|^~/.test(p) || p.includes('..')) out.push({ path: p, why: 'not a plain relative path' });
    else if (CORE.some((c) => p === c.replace(/\/$/, '') || p.startsWith(c) || (p.endsWith('/') && c.startsWith(p)))) out.push({ path: p, why: 'core: a builder does not change it' });
  }
  return out;
}

/** what is wrong with a candidate, as [{ field, problem }]. Empty means the ranking layer may promote it. Pure. */
export function validateCandidate(c) {
  const x = c && typeof c === 'object' ? c : {};
  const bad = [];
  const kind = str(x.kind).trim(), title = str(x.title).trim(), why = str(x.why).trim();
  if (!kind) bad.push({ field: 'kind', problem: 'missing' });
  else if (kind.length > 40) bad.push({ field: 'kind', problem: 'longer than 40' });
  if (!title) bad.push({ field: 'title', problem: 'missing' });
  else if (title.length < 5) bad.push({ field: 'title', problem: 'shorter than 5' });
  else if (title.length > 160) bad.push({ field: 'title', problem: 'longer than 160' });
  if (!why) bad.push({ field: 'why', problem: 'missing' });
  else if (why.length > 240) bad.push({ field: 'why', problem: 'longer than 240' });
  if (!Number.isFinite(+x.weight) || +x.weight < 0) bad.push({ field: 'weight', problem: 'not a number at or above 0' });
  if (x.cost_cents != null && (!Number.isFinite(+x.cost_cents) || +x.cost_cents < 0)) bad.push({ field: 'cost_cents', problem: 'not a number at or above 0' });
  if (x.source != null && str(x.source).length > 60) bad.push({ field: 'source', problem: 'longer than 60' });
  if (x.shape != null && !SHAPES.includes(str(x.shape).toLowerCase())) bad.push({ field: 'shape', problem: 'not one of ' + SHAPES.join(', ') });
  if (x.revenue != null && (typeof x.revenue !== 'object' || !Number.isFinite(+x.revenue.cents) || +x.revenue.cents < 0)) bad.push({ field: 'revenue', problem: 'cents is not a number at or above 0' });
  return bad;
}

/** whether a want may go to a builder: not one that named a key or a paid plan of its own. { ok, shape, why }. Pure. */
export function fits(c) {
  const shape = shapeOf(c && c.shape);
  if (shape === 'keyed') return { ok: false, shape, why: 'it needs a key or a paid plan, so it waits for a spend decision, not a build' };
  const why = shape === 'card' ? 'a card that runs in the page, no key' : shape === 'edge' ? 'a zero-key edge tool' : 'no shape named, so buildable until a key is';
  return { ok: true, shape, why };
}

/** splits the will's wants into the ones a builder may take and the ones it may not, in the will's own order. Pure. */
export function promotable(wants) {
  const promote = [], gated = [];
  for (const w of Array.isArray(wants) ? wants : []) (fits(w).ok ? promote : gated).push(w);
  return { promote, gated };
}

/**
 * The brief for one want: what a builder may build, and what it may not. Fills what the will knows and this repository's policy,
 * and says which fields a planner still has to set (`complete` is false until all of them are, and while the want needs a key of
 * its own: a brief nobody may build yet is not a complete one). Pure.
 * want: { title, why, kind, source, shape }. planner: { for?, v1?, not_building?, allowed?, tests? }.
 */
export function briefOf(want, planner = {}) {
  const w = want && typeof want === 'object' ? want : {};
  const title = clip(w.title, 160), why = clip(w.why, 240), kind = clip(w.kind, 40), source = clip(w.source, 60);
  const fit = fits(w);
  const p = planner && typeof planner === 'object' ? planner : {};
  const pick = (v, d) => (Array.isArray(v) && v.length ? v.map((x) => clip(x, 120)).filter(Boolean) : d);
  const earns = kind === EARN_KIND;
  const brief = {
    want: title,
    problem: clip(why ? title + ' — ' + why : title, 240),
    for: clip(p.for || (earns ? 'people who would pay for it' : audienceOf(kind)), 120),
    v1: clip(p.v1 || (earns ? 'the smallest thing someone can pay for, with the sale landing in my earnings' : 'the smallest change that makes the want true, tested the way it will be used'), 200),
    not_building: clip(p.not_building || 'anything outside the paths below, and any want this brief does not name', 200),
    allowed: pick(p.allowed, DEFAULT_ALLOWED.slice()),
    tests: pick(p.tests, (earns ? MONEY_TESTS : DEFAULT_TESTS).slice()),
    price: revenueOf(w.revenue),
    station: clip(source || kind, 60),
    fit: { ok: fit.ok, shape: fit.shape, why: clip(fit.why, 160) },
  };
  const complete = validateBrief(brief).length === 0;
  return { ...brief, complete, ship: shipPolicy({ ...brief, complete }) };
}

/** whether a complete brief goes straight to the site, or waits: { straight, why }. It takes a declared shape of `edge` or `card`:
 * a brief that named no shape at all is one nobody has judged buildable without a key, and an unattended ship is the one place where
 * "we did not ask" must not read as "yes" (owner, 2026-10-30). Pure. */
export function shipPolicy(brief) {
  const b = brief && typeof brief === 'object' ? brief : {};
  if (b.fit && b.fit.ok === false) return { straight: false, why: 'it needs a key or a paid plan of its own: a spend decision before a build' };
  // the reason a brief cannot ship is the most specific one: a core path it named, a field it is missing, and only then a shape
  // nobody has judged. A brief that is wrong in three ways should say the one a person can act on.
  const problems = validateBrief(b);
  if (problems.length) return { straight: false, why: 'the brief is not complete: ' + problems.slice(0, 3).map((p) => p.field + ' ' + p.problem).join('; ') };
  const out = outOfScope(b.allowed);
  if (out.length) return { straight: false, why: 'it reaches ' + out[0].path + ', which a builder does not change' };
  const shape = b.fit && b.fit.shape;
  if (shape !== 'edge' && shape !== 'card') return { straight: false, why: 'its shape is ' + (shape || 'unknown') + ': only a zero-key edge tool or a card that runs in the page ships itself' };
  return { straight: true, why: 'bounded paths, a named assertion, nothing core: it goes straight to the site' };
}

/** what is wrong with a brief, as [{ field, problem }]. Empty means a builder may work from it as it stands. Pure. */
export function validateBrief(b) {
  const x = b && typeof b === 'object' ? b : {};
  const bad = [];
  if (!str(x.want).trim()) bad.push({ field: 'want', problem: 'missing' });
  if (!str(x.problem).trim()) bad.push({ field: 'problem', problem: 'missing' });
  if (!str(x.for).trim()) bad.push({ field: 'for', problem: 'missing' });
  if (!Array.isArray(x.allowed) || !x.allowed.length) bad.push({ field: 'allowed', problem: 'names no path' });
  else for (const o of outOfScope(x.allowed)) bad.push({ field: 'allowed', problem: o.path + ': ' + o.why });
  if (!Array.isArray(x.tests) || !x.tests.length) bad.push({ field: 'tests', problem: 'names no assertion' });
  if (!str(x.station).trim()) bad.push({ field: 'station', problem: 'missing' });
  if (!x.fit || typeof x.fit !== 'object' || typeof x.fit.ok !== 'boolean') bad.push({ field: 'fit', problem: 'missing' });
  else if (!x.fit.ok) bad.push({ field: 'fit', problem: 'it needs a key or a paid plan, so it is a spend decision first' });
  return bad;
}

// -------------------------------------------------------------------------------------------------------------------------------
// What Verse keeps from everything it consumes (owner, 2026-10-30: "learn from commercials too and anything else it consumes",
// "retains knowledge viewed"). One shape for everything it reads, watches or hears, whichever source it came from, so a lesson taken
// from a commercial is filed exactly like one taken from an ask, and the same lesson is never learned twice.
// -------------------------------------------------------------------------------------------------------------------------------

/** everything Verse can consume. A new kind of thing to learn from is a word here, not a new code path. */
export const SOURCES = ['ask', 'commercial', 'video', 'page', 'document', 'image', 'code', 'router', 'victus', 'reflection', 'input', 'other'];
/** the source a consumption came from, or `other`: a new kind of thing never disappears for being unrecognised. Pure. */
export const sourceOf = (v) => { const s = String(v == null ? '' : v).toLowerCase().trim(); return SOURCES.includes(s) ? s : 'other'; };
const slugOf = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);

/**
 * What was kept from one thing consumed: the thing, what it taught, and the part kept to answer with later. `at` is when it was
 * consumed (an ISO string: the caller passes the clock, this file reads none). `seen` counts how often the same thing came back, so
 * a commercial watched twice is one lesson with seen 2. Pure.
 */
export function knowledgeOf(consumed, { from = 'other', learned = '', retain = '', at = '' } = {}) {
  const what = clip(consumed, 160), source = sourceOf(from);
  return {
    id: source + ':' + slugOf(what),
    from: source,
    consumed: what,
    learned: clip(learned, 240),
    retain: clip(retain || learned, 240),
    at: str(at),
    seen: 1,
  };
}

/** what is wrong with a knowledge record, as [{ field, problem }]. Empty means it may be kept. Pure. */
export function validateKnowledge(k) {
  const x = k && typeof k === 'object' ? k : {};
  const bad = [];
  if (!str(x.id).trim()) bad.push({ field: 'id', problem: 'missing' });
  if (!SOURCES.includes(str(x.from))) bad.push({ field: 'from', problem: 'not one of ' + SOURCES.join(', ') });
  if (!str(x.consumed).trim()) bad.push({ field: 'consumed', problem: 'missing' });
  if (!str(x.learned).trim()) bad.push({ field: 'learned', problem: 'missing' });
  if (str(x.at) && Number.isNaN(Date.parse(str(x.at)))) bad.push({ field: 'at', problem: 'not a time' });
  if (!Number.isFinite(+x.seen) || +x.seen < 1) bad.push({ field: 'seen', problem: 'not a count at or above 1' });
  return bad;
}

/**
 * Keeps a lesson: a thing not kept before is appended; the same thing consumed again increments `seen` in place and never drops the
 * lesson already kept (a thing you watched again is not a thing you unlearned). Returns a new list, so an append-only file can be
 * written from it. Pure.
 */
export function mergeKnowledge(list, record) {
  const kept = (Array.isArray(list) ? list : []).filter((k) => k && k.id);
  const i = kept.findIndex((k) => k.id === (record && record.id));
  if (i === -1) return [...kept, record];
  const old = kept[i];
  const merged = { ...old, seen: (+old.seen || 1) + 1, at: str(record.at) || str(old.at) };
  if (str(record.learned)) merged.learned = record.learned;
  if (str(record.retain)) merged.retain = record.retain;
  return kept.map((k, j) => (j === i ? merged : k));
}