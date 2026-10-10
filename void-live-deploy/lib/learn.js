// Void learns skills by itself (its own want, domains/void.will.md #1; frontier item 2): an ask people typed that Void
// could not answer becomes a job for the builders, with no one in between. Two doors into the same brain:
//   - at miss time: functions/api/miss.js calls learnFromMiss() after it records a miss; once the same ask has been
//     missed MIN_COUNT times across at least two different days, it is queued at once. Only what the server counted
//     is trusted here: /api/miss is open to anyone, and its `fallback` field is whatever the browser sent, so it never
//     queues a job by itself (one POST saying "not built yet" must not put a stranger's words in front of the builders).
//   - on a sweep: tools/learn.mjs reads the whole board and queues the top ones (plan()), for a daily run or by hand.
// A job is a row in void_queue with target `miss:<slug>`; builders claim it like any other (`python tools/void_queue.py
// claim`). At most OPEN_MAX miss jobs are open at once, so the queue never floods, and a target already queued, built
// or given up on is never queued twice. Asks stay short and redacted before they go anywhere: the queue is mirrored into
// the public repo (domains/void.queue.md), so a pasted transcript or a key never becomes a job.
import { track } from './actions.js';
import { isNoise } from './noise.js';

export const OPEN_MAX = 3; // open miss jobs at once
export const DAYS = 7; // how far back a sweep reads the board
export const MIN_COUNT = 3; // misses before an ask is queued at miss time, spread over two days at least
const MAX_WORDS = 12, MAX_CHARS = 80; // what a person types in Void's input; longer is pasted text, not an ask
const KEYLIKE = /(?=[A-Za-z0-9_-]{16,})(?=[A-Za-z_-]*\d)(?=[\d_-]*[A-Za-z])[A-Za-z0-9_-]{16,}/; // same as tools/misses.mjs

export const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 34);
export const targetOf = (ask) => 'miss:' + slug(ask);
export const unbuilt = (fallback) => /not built yet|^none$/i.test(String(fallback || ''));

// one row from the board -> a learnable ask, or null (noise, secrets, pasted transcripts, test traffic)
export function learnable(r) {
  const a = String((r && r.ask) || '').replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]').replace(/\d[\d\s().-]{7,}\d/g, '[number]').trim();
  if (!a || isNoise(a) || String(r.fallback || '') === 'test') return null;
  if (/^\s*unlock\b/i.test(a) || a.split(/\s+/).some((w) => KEYLIKE.test(w))) return null; // a key never becomes a job
  if (a.length > MAX_CHARS || a.split(/\s+/).length > MAX_WORDS) return null;
  if (/[⏎\n]|\bthought\s*[·:]|^\$ |https?:\/\//i.test(a)) return null; // agent chatter pasted into the input
  if (/\b(?:asdf|qwert|zxcv)\w*|\b[bcdfghjklmnpqrstvwxz]{6,}\b/i.test(a)) return null; // keyboard mash inside a longer line
  const count = +r.count || 1;
  return { ask: a, count, agent: Math.max(0, Math.min(Math.floor(+r.agent) || 0, count)), last: String(r.last || ''), fallback: String(r.fallback || ''), variants: (r.variants || []).map((v) => String(v || '').slice(0, MAX_CHARS)).filter(Boolean) };
}

// Where the misses of an ask came from. The page tags a miss `origin: 'agent'` when a visiting agent's WebMCP tool call
// caused it (void.html agentAsk); /api/miss counts those in void_misses.agent. The tag is the page's word, and /api/miss is
// open to anyone, so it is a label that only ever demotes: a stranger can leave it off, so it is no wall, and an ask is
// never trusted more for lacking it. People = misses not tagged agent (rows from before the column read as people).
export const peopleCount = (c) => Math.max(0, (+c.count || 0) - (+c.agent || 0));
export const originOf = (c) => (!(+c.agent > 0) ? 'people' : +c.agent >= (+c.count || 1) ? 'agent' : 'mixed');

// rank: asked more (by people), asked recently, and a game or a thing Void itself said it hasn't built yet
export function score(c, now = Date.now()) {
  const age = (now - Date.parse(c.last || 0)) / 864e5;
  return peopleCount(c) + (c.variants.length ? 1 : 0) + (age < 2 ? 2 : age < 4 ? 1 : 0) + (unbuilt(c.fallback) ? 2 : 0);
}

// rows: the board (GET /api/misses); queue: { items } (GET /api/queue); known: asks already beaten or benched
export function plan(rows, queue, { known = new Set(), now = Date.now(), days = DAYS, openMax = OPEN_MAX } = {}) {
  const since = new Date(now - days * 864e5).toISOString();
  const items = (queue && queue.items) || [];
  const open = items.filter((i) => /^miss:/.test(i.target) && /^(queued|building)$/.test(i.state)).length;
  const taken = new Set(items.map((i) => i.target));
  const asked = new Set(items.map((i) => String(i.ask || '').toLowerCase()));
  const cands = [], skipped = [], quarantined = [];
  for (const r of rows || []) {
    const c = learnable(r);
    if (!c) continue;
    if (c.last && c.last < since) continue;
    const t = targetOf(c.ask);
    if (known.has(c.ask.toLowerCase()) || taken.has(t) || asked.has(`learn to handle "${c.ask.toLowerCase()}"`)) { skipped.push({ ask: c.ask, why: taken.has(t) ? 'already a job' : 'already beaten or benched' }); continue; }
    if (originOf(c) === 'agent') { quarantined.push({ ask: c.ask, count: c.count }); continue; } // only visiting agents asked it: seen, never queued
    cands.push({ ...c, target: t, score: score(c, now) });
  }
  cands.sort((a, b) => b.score - a.score || (b.last > a.last ? 1 : -1));
  const room = Math.max(0, openMax - open);
  return { open, room, queue: cands.slice(0, room), later: cands.slice(room), skipped, quarantined };
}

// c.route (optional): what the router made of the ask, { route, skill, score } from void_routes (routeNote)
export const jobOf = (c) => ({
  ask: `learn to handle "${c.ask}"`,
  target: c.target || targetOf(c.ask),
  note: [
    `asked ${c.count}× (${c.variants.length + 1} phrasing${c.variants.length ? 's' : ''}), last ${String(c.last).slice(0, 10)}${c.fallback ? '; fallback ' + c.fallback : ''}`,
    routeNote(c.route),
    originOf(c) === 'people' ? '' : originOf(c) === 'agent' ? 'only agents asked it' : `${c.agent} of ${c.count} asks from agents`,
    'from the miss board',
  ].filter(Boolean).join('; ').slice(0, 300),
});

// "router skill:weather 0.78" (a skill should have caught it) · "router simple 0.41" · '' when the router never saw the ask.
// Only the router's own fixed words and a skill name from its table can get in here: the note is mirrored into the public repo.
export function routeNote(r) {
  if (!r || !/^(skill|simple|hard|fallback)$/.test(String(r.route))) return '';
  const sk = /^[a-z0-9_-]{1,24}$/.test(String(r.skill || '')) ? r.skill : '';
  const n = Number.isFinite(+r.score) && r.score !== null ? ' ' + (+r.score).toFixed(2) : '';
  return 'router ' + (r.route === 'skill' && sk ? 'skill:' + sk : r.route) + n;
}

// --- the D1 side (Pages Functions only) ---

// queue one learnable ask unless its target was ever queued or OPEN_MAX miss jobs are open; returns the new id or null
export async function queueMiss(env, c) {
  const job = jobOf({ ...c, route: c.route || (await routeOf(env, c.ask)) });
  const open = await env.DB.prepare("SELECT COUNT(*) AS n FROM void_queue WHERE target LIKE 'miss:%' AND state IN ('queued','building')").first('n');
  if (+open >= OPEN_MAX) return null;
  const seen = await env.DB.prepare('SELECT id FROM void_queue WHERE target = ? LIMIT 1').bind(job.target).first();
  if (seen) return null;
  const id = Date.now().toString(36), at = new Date().toISOString();
  // the execution record (lib/actions.js): written before the job is queued; no record, no job
  await track(env, { owner: 'void', kind: 'queue.add', ref: job.target }, async () => {
    await env.DB.prepare('INSERT INTO void_queue (id, ask, target, state, note, at, updated) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, job.ask, job.target, 'queued', job.note, at, at).run();
    return 'queued ' + id + ': ' + job.ask;
  });
  return id;
}

// What the router (lib/router.js, void_routes) made of this ask, or null. The router only names a skill when it decided a skill
// should have caught the ask, so "nearest skill" exists for exactly those. Best effort: no table, no row or no D1 is null.
export async function routeOf(env, ask) {
  try {
    const r = await env.DB.prepare('SELECT route, skill, score FROM void_routes WHERE ask = ? ORDER BY last DESC LIMIT 1').bind(String(ask || '').toLowerCase().slice(0, 200)).first();
    return r && r.route ? { route: r.route, skill: r.skill || '', score: r.score } : null;
  } catch (_) { return null; }
}

// void_misses.agent counts the misses the page tagged as a visiting agent's. Like void_queue.draft (functions/api/queue.js)
// the column is added when first needed, once per isolate, and an error ("duplicate column") means it is already there.
const agentColumnEnsured = new WeakSet();
export async function ensureAgentColumn(env) {
  if (!env || !env.DB || agentColumnEnsured.has(env.DB)) return;
  await env.DB.prepare('ALTER TABLE void_misses ADD COLUMN agent INTEGER').run().catch(() => {});
  agentColumnEnsured.add(env.DB);
}
export async function noteAgentMiss(env, id) {
  try {
    await ensureAgentColumn(env);
    await env.DB.prepare('UPDATE void_misses SET agent = COALESCE(agent, 0) + 1 WHERE id = ?').bind(id).run();
  } catch (_) {}
}
export async function agentCount(env, id) {
  try { return +(await env.DB.prepare('SELECT agent FROM void_misses WHERE id = ?').bind(id).first('agent')) || 0; } catch (_) { return 0; }
}

// the miss-time door: row is the void_misses row just written ({ ask, count, first, last, fallback })
const day = (t) => String(t || '').slice(0, 10);
export const spansDays = (row) => !!day(row && row.first) && !!day(row && row.last) && day(row.first) !== day(row.last);
export async function learnFromMiss(env, row) {
  const c = learnable(row);
  if (!c || peopleCount(c) < MIN_COUNT || !spansDays(row)) return null; // the browser-sent fallback is never trusted here; agents' misses do not count toward a job
  return queueMiss(env, c);
}
