// brain-mind — the layers that make Verse Brain's workspace a mind and not a set of engines (owner's spec, 2026-10-29: "sensory grounding
// and input fusion", "memory hierarchy beyond working memory", "valence and preference", "meta-cognition and resource arbitration",
// "language-field grounding", "temporal continuity"). Each layer reads and writes the one workspace (lib/brain-workspace.js) and the brain
// (lib/brain.js) uses it on every tick:
//   goals      an ask (on the stage or typed to the card) becomes concepts plus goals that pull the input layer where those ideas sit and
//              decay unless asked again or kept active
//   episodes   at each choice of the will: the workspace's key (its regions), the action, the gesture, and what the utility did after.
//              The will reads the nearest past episodes before it chooses (episodic control): what this action did in a state like this
//   procedures the genomes the arena found best, with the context they won in; a later generation in the same context starts from one
//   knowledge  the slow learners (Q-table, Hebbian links, gesture kinds, preferences) as plain numbers, kept on the device so the brain
//              is not born again on every visit; plus Verse's own priorities (self.json: the open asks and the site it is assimilating)
//              as standing ideas the visitor's ideas are compared with
//   valence    one preference: the workspace's own coherence, how far the goals are met, the visitor's approval (Good, and staying),
//              and how near the visitor's ideas are to Verse's priorities. The will and the arena are scored by it, in imagination too
//   monitor    which organs write each region, and whether its value swings back and forth while two of them write it: then the two
//              disagree there, the one that wants it less is slowed, and the card says where
//   history    a short record of the last minute (utility, focus, action, surprise), which the self reads to say what just happened
//   explain    "why did that form?", "what just happened?", "what are you doing?": answered from the state above, not from a script
//   asks       what the visitor asks Verse next after each ask (on this device): the brain guesses the next ask before it comes, the
//              way the ear guesses the next note, counts its own hits, and ranks the ask box's suggestions by it and by its goals
// Pure: no DOM, no clock, no Math.random. What is kept on the device (lib/brain-store.js) is numbers and the visitor's own words, never sent.
import { clamp } from './field-kit.js';
import { regionMeans, regionCenter, REGIONS_X, REGIONS_Y } from './brain-workspace.js';
import { hvSim, hypervector, cleanWords, ACTIONS } from './brain-organs.js';
import { loadMean } from './brain-creature.js';
import { countsOf, loadCounts } from './brain-hearing.js';
import { programsOf, loadPrograms } from './brain-painter.js';
import { gardenOf, loadGarden } from './brain-gardener.js';
import { grammarsOf, loadGrammars } from './brain-grower.js';
import { formulasOf, loadFormulas } from './brain-formula.js';
import { swimmersOf, loadSwimmers } from './brain-current.js';
import { genesOf, loadGenes } from './brain-grains.js';
import { networkOf, loadNetwork } from './brain-pool.js';
import { ruleOf, loadRule } from './brain-trace.js';
import { dialogueOf, loadDialogue } from './brain-dialogue.js';
import { createRoutes, routesOf, loadRoutes } from './brain-route.js';
import { createWatch, watchOf, loadWatch } from './brain-watch.js';

export const REGIONS = REGIONS_X * REGIONS_Y;
export const MAX_GOALS = 8, GOAL_DECAY = 0.997, GOAL_FLOOR = 0.05;
export const MAX_EPISODES = 160, EPISODE_K = 6;
export const MAX_PROCEDURES = 24;
export const HISTORY = 64, HISTORY_EVERY = 15; // a minute at 60 ticks a second
export const MONITOR_EVERY = 30, CONTEND_SHARE = 0.2, CONTEND_FLIPS = 8, THROTTLE = 0.35;

export function makeMind() {
  return { goals: [], episodes: [], open: null, asks: makeAsks(), procedures: [], semantic: [], history: [], approval: 0, dwell: 0,
    pref: new Float32Array(ACTIONS.length), conflicts: [], throttle: {}, monitor: { last: new Float32Array(REGIONS), dir: new Int8Array(REGIONS), flips: new Uint16Array(REGIONS), base: null, n: 0 } };
}

// ---- goals: an ask becomes ideas that pull ----------------------------------------------------------------------------------------------
/** an ask from the stage or the card: its words become concepts (tell) and goals of strength 1 (an old goal asked again is renewed). */
export function askGoal(b, text, tell) {
  const r = tell(b, text), M = b.mind;
  for (const w of r.words) {
    const i = b.concepts.words.indexOf(w); if (i < 0) continue;
    const g = M.goals.find((x) => x.word === w); if (g) { g.strength = 1; g.asked++; continue; }
    M.goals.push({ word: w, idx: i, strength: 1, asked: 1, since: b.ticks });
    if (M.goals.length > MAX_GOALS) { M.goals.sort((p, q) => q.strength - p.strength); M.goals.length = MAX_GOALS; }
  }
  return r;
}
/** a tick of the goals: each decays unless its idea is active; each pulls the input layer under its concept (the ask as a force). */
export function stepGoals(b, deposit) {
  const M = b.mind, N = b.ws.nodes;
  for (const g of M.goals) { const n = b.concepts.node[g.idx], a = n == null ? 0 : N.act[n]; g.strength = clamp(g.strength * GOAL_DECAY + (a > 0.6 ? 0.002 : 0), 0, 1); if (n != null && g.strength > 0.1) deposit(b.ws, 'input', N.x[n], N.y[n], 0.02 * g.strength, 3, 'concepts'); }
  M.goals = M.goals.filter((g) => g.strength > GOAL_FLOOR);
}
/** how far the goals are met: the strength-weighted activation of the goal ideas, more where the attention is. 0..1. Pure. */
export function goalMatch(b) {
  const M = b.mind, N = b.ws.nodes; let s = 0, w = 0;
  for (const g of M.goals) { const n = b.concepts.node[g.idx]; if (n == null) continue; const near = Math.exp(-Math.hypot(N.x[n] - b.focus.x, N.y[n] - b.focus.y) * 4); s += g.strength * N.act[n] * (0.5 + 0.5 * near); w += g.strength; }
  return w ? clamp(s / w, 0, 1) : 0;
}

// ---- knowledge from Verse itself: self.json's open asks and the site it is assimilating --------------------------------------------------
/** standing ideas from Verse's own record: [{ word, hv, from }]. self: the parsed /self.json. Pure. */
export function semanticFrom(self) {
  const out = [], seen = new Set(), add = (text, from) => { for (const w of cleanWords(text)) if (w.length > 3 && !seen.has(w) && out.length < 32) { seen.add(w); out.push({ word: w, hv: hypervector(w), from }); } };
  if (self && self.tower && self.tower.target) add(String(self.tower.target).replace(/\.[a-z]+$/, '').replace(/[^a-z]+/g, ' '), 'assimilating ' + self.tower.target);
  for (const o of (self && Array.isArray(self.open) ? self.open : []).slice(0, 6)) add(o.ask, 'an open ask');
  for (const t of (self && Array.isArray(self.tracks) ? self.tracks : []).slice(0, 6)) add(t.name, 'a track');
  return out;
}
/** how near the visitor's active ideas are to Verse's standing ideas: the best hypervector match, weighted by activation. 0..1. Pure. */
export function alignment(b) {
  const S = b.mind.semantic, C = b.concepts, N = b.ws.nodes; if (!S.length || !C.words.length) return 0;
  let best = 0, at = null; for (let i = 0; i < C.words.length; i++) { const a = N.act[C.node[i]]; if (a < 0.2) continue; for (const s of S) { const v = hvSim(C.hv[i], s.hv) * a; if (v > best) { best = v; at = { word: C.words[i], near: s.word, from: s.from }; } } }
  b.mind.aligned = at; return clamp(best, 0, 1);
}

// ---- valence: the one preference --------------------------------------------------------------------------------------------------------
/** the brain's preference for its state now: coherence (the workspace's own utility), goals met, the visitor's approval, alignment with
 *  Verse's priorities. With no goals and nobody there it is the coherence alone. 0..1. Pure on b (alignment records what matched). */
export function valenceOf(b, coherence) {
  const M = b.mind, g = M.goals.length ? goalMatch(b) : null, al = alignment(b), ap = clamp(M.approval, 0, 1);
  let v = coherence * 0.7, w = 0.7;
  if (g != null) { v += g * 0.15; w += 0.15; }
  if (ap > 0.01) { v += ap * 0.1; w += 0.1; }
  if (al > 0.05) { v += al * 0.05; w += 0.05; }
  return clamp(v / w, 0, 1);
}
/** approval: Good is a strong, lasting signal; staying (pointer over while it acts) a weak one; both fade. Records the preference for the action. */
export function approve(b, amt, action) { const M = b.mind; M.approval = clamp(M.approval + amt, 0, 1); if (action >= 0) M.pref[action] = clamp(M.pref[action] + amt * 0.5, -1, 1); }
export function stepValence(b) { const M = b.mind; M.approval *= 0.995; if (b.senses.over) { M.dwell++; if ((M.dwell & 63) === 0) approve(b, 0.02, b.will.action); } else M.dwell = 0; }

// ---- episodes: what an action did in a state like this --------------------------------------------------------------------------------------
/** the workspace's key: its tissue and surprise by region, where it attends, and the gesture (26 numbers). Pure. */
export function keyOf(b) {
  const a = regionMeans(b.ws, 'act'), s = regionMeans(b.ws, 'surprise'), k = new Float32Array(REGIONS * 2 + 2);
  for (let r = 0; r < REGIONS; r++) { k[r] = a[r]; k[REGIONS + r] = s[r] * 2; }
  k[REGIONS * 2] = b.focus.region / REGIONS; k[REGIONS * 2 + 1] = (b.gestures.sym + 1) / 8;
  return k;
}
const cos = (p, q) => { let d = 0, a = 0, c = 0; for (let i = 0; i < p.length; i++) { d += p[i] * q[i]; a += p[i] * p[i]; c += q[i] * q[i]; } return a && c ? d / Math.sqrt(a * c) : 0; };
/** at a choice: close the episode that was open (how the utility moved since) and open a new one for this action. */
export function recordEpisode(b, action, utility) {
  const M = b.mind;
  if (M.open) { M.open.after = Math.round(utility * 1000) / 1000; M.open.gain = Math.round((utility - M.open.before) * 1000) / 1000; M.episodes.push(M.open); if (M.episodes.length > MAX_EPISODES) M.episodes.shift(); }
  M.open = { t: b.ticks, key: Array.from(keyOf(b), (v) => Math.round(v * 1000) / 1000), action, gesture: b.gestures.sym, before: Math.round(utility * 1000) / 1000, goals: M.goals.map((g) => g.word) };
  return M.open;
}
/** the nearest closed episodes to now, most alike first: [{ episode, sim }]. Pure. */
export function nearestEpisodes(b, k = EPISODE_K, key = keyOf(b)) {
  return b.mind.episodes.map((e) => ({ episode: e, sim: cos(key, e.key) })).sort((p, q) => q.sim - p.sim).slice(0, k);
}
/** what each action did in states like this one, from memory: Float32Array of mean gain per action (0 where none is remembered), and how
 *  many episodes stood behind it. The will adds this to its Q-values before it imagines (episodic control). Pure. */
export function episodicPrior(b, key) {
  const near = nearestEpisodes(b, EPISODE_K * 2, key), sum = new Float32Array(ACTIONS.length), n = new Float32Array(ACTIONS.length);
  for (const { episode: e, sim } of near) if (sim > 0.8) { sum[e.action] += e.gain * sim; n[e.action] += sim; }
  for (let a = 0; a < sum.length; a++) sum[a] = n[a] ? sum[a] / n[a] : 0;
  return { gain: sum, count: Array.from(n, (v) => Math.round(v * 10) / 10) };
}

// ---- procedures: the genomes that won, and where ------------------------------------------------------------------------------------------
export const contextOf = (b) => (b.gestures.sym < 0 ? 'still' : 'g' + b.gestures.sym) + (b.mind.goals.length ? '+goal' : '') + (b.senses.feat[4] || b.senses.feat[5] ? '+tilt' : '');
/** keep a winning genome with its context and fitness (the best per context, at most MAX_PROCEDURES). */
export function recordProcedure(b, genome, fitness) {
  const M = b.mind, ctx = contextOf(b), at = M.procedures.findIndex((p) => p.ctx === ctx);
  const rec = { ctx, fitness: Math.round(fitness * 1000) / 1000, genome: Object.fromEntries(Object.entries(genome).map(([k, v]) => [k, Math.round(v * 10000) / 10000])), gen: b.arena.gen };
  if (at >= 0) { if (M.procedures[at].fitness <= rec.fitness) M.procedures[at] = rec; } else { M.procedures.push(rec); if (M.procedures.length > MAX_PROCEDURES) { M.procedures.sort((p, q) => q.fitness - p.fitness); M.procedures.length = MAX_PROCEDURES; } }
  return rec;
}
/** the genome that last won in this context, or null. Pure. */
export function bestProcedure(b, ctx = contextOf(b)) { const p = b.mind.procedures.find((x) => x.ctx === ctx); return p ? p : null; }

// ---- monitor: organs that disagree over a region ------------------------------------------------------------------------------------------
/** every MONITOR_EVERY ticks: for each region, which writers had a real share of its writes, and how often its value changed direction.
 *  Two or more writers with a swinging value are a disagreement: listed in b.mind.conflicts, and the writer that wants the region less is
 *  slowed (b.mind.throttle[id], taken off its want by the scheduler) until the next look. Returns the conflicts. */
export function stepMonitor(b, organs) {
  const M = b.mind, mon = M.monitor, ws = b.ws, W = ws.organs.length + 1;
  const v = regionMeans(ws, 'input'), a = regionMeans(ws, 'act');
  for (let r = 0; r < REGIONS; r++) { const x = v[r] + a[r], d = x - mon.last[r], dir = d > 1e-4 ? 1 : d < -1e-4 ? -1 : 0; if (dir && mon.dir[r] && dir !== mon.dir[r]) mon.flips[r]++; if (dir) mon.dir[r] = dir; mon.last[r] = x; }
  if (!mon.base) mon.base = ws.regionWrites.slice();
  if (++mon.n < MONITOR_EVERY) return M.conflicts;
  const out = [], throttle = {};
  for (let r = 0; r < REGIONS; r++) {
    let tot = 0; const per = []; for (let o = 0; o < W; o++) { const c = ws.regionWrites[r * W + o] - mon.base[r * W + o]; tot += c; per.push(c); }
    if (!tot) continue;
    const who = per.map((c, o) => ({ id: o < ws.organs.length ? ws.organs[o] : 'you', share: c / tot })).filter((x) => x.share >= CONTEND_SHARE).sort((p, q) => q.share - p.share);
    if (who.length >= 2 && mon.flips[r] >= CONTEND_FLIPS) {
      const ids = who.map((x) => x.id), org = (id) => organs.find((o) => o.id === id), wants = ids.map((id) => (org(id) ? org(id).want(b) : 2)); // the visitor is never slowed
      let lo = -1, lw = Infinity; ids.forEach((id, k) => { if (org(id) && id !== 'senses' && wants[k] < lw) { lw = wants[k]; lo = k; } });
      if (lo >= 0) throttle[ids[lo]] = THROTTLE;
      out.push({ region: r, organs: ids.slice(0, 3), flips: mon.flips[r], slowed: lo >= 0 ? ids[lo] : null });
    }
  }
  mon.prev = mon.base; mon.base = ws.regionWrites.slice(); mon.flips.fill(0); mon.n = 0; M.conflicts = out; M.throttle = throttle;
  return out;
}

// ---- history: the last minute -----------------------------------------------------------------------------------------------------------
export function stepHistory(b) {
  if (b.ticks % HISTORY_EVERY) return; const H = b.mind.history;
  H.push({ t: b.ticks, u: Math.round(b.utility * 1000) / 1000, focus: b.focus.region, action: b.board.action ? b.board.action.name : 'rest', surprise: Math.round(b.metrics.surprise * 100) / 100, activity: Math.round(b.metrics.activity * 100) / 100 });
  if (H.length > HISTORY) H.shift();
}
/** what just happened, from the history: { seconds, utility: [from, to], focusMoves, actions: { name: n }, surprisePeak }. Pure. */
export function recent(b) {
  const H = b.mind.history; if (H.length < 2) return null;
  const actions = {}; let moves = 0, peak = 0; for (let i = 0; i < H.length; i++) { actions[H[i].action] = (actions[H[i].action] || 0) + 1; if (i && H[i].focus !== H[i - 1].focus) moves++; peak = Math.max(peak, H[i].surprise); }
  return { seconds: Math.round((H[H.length - 1].t - H[0].t) / 60), utility: [H[0].u, H[H.length - 1].u], focusMoves: moves, actions, surprisePeak: peak };
}

// ---- explain: answers from the state ------------------------------------------------------------------------------------------------------
const WHY = /^(?:why\b|how come\b)/i, WHAT_HAPPENED = /^what (?:just )?happened|what did you (?:just )?do/i, DOING = /^what are you doing|what is your brain doing|what are you thinking/i;
export const isQuestion = (t) => WHY.test(String(t).trim()) || WHAT_HAPPENED.test(String(t).trim()) || DOING.test(String(t).trim());
const regionName = (r) => ['top', 'middle', 'bottom'][Math.floor(r / REGIONS_X)] + ' ' + ['far left', 'left', 'right', 'far right'][r % REGIONS_X];
/** who wrote a region over the last look, by share: [{ id, share }]. Pure. */
export function writersOf(b, r) {
  const ws = b.ws, W = ws.organs.length + 1, base = b.mind.monitor.prev || b.mind.monitor.base; let tot = 0; const per = []; // the last full look and this one
  for (let o = 0; o < W; o++) { const c = ws.regionWrites[r * W + o] - (base ? base[r * W + o] : 0); tot += c; per.push({ id: o < ws.organs.length ? ws.organs[o] : 'you', c }); }
  return per.filter((x) => x.c).map((x) => ({ id: x.id, share: Math.round((x.c / tot) * 100) / 100 })).sort((p, q) => q.share - p.share);
}
/** an answer to a question about itself, in sentences, from what the workspace, the memory and the history hold. Pure. */
export function explain(b, text, names = {}) {
  const t = String(text || '').trim(), M = b.mind, nm = (id) => (id === 'you' ? 'you' : names[id] || id), out = [];
  if (WHAT_HAPPENED.test(t)) {
    const r = recent(b); if (!r) return ['Nothing yet: I have been running for under a second.'];
    const acts = Object.entries(r.actions).sort((p, q) => q[1] - p[1]).map(([k]) => k);
    out.push('In the last ' + r.seconds + ' seconds my utility went from ' + r.utility[0] + ' to ' + r.utility[1] + ', my attention moved ' + r.focusMoves + ' time' + (r.focusMoves === 1 ? '' : 's') + ', and I mostly chose ' + acts.slice(0, 2).join(' and ') + '.');
    if (r.surprisePeak > 0.2) out.push('The biggest surprise was ' + r.surprisePeak + ' (where I guessed your movement wrong).');
    return out;
  }
  if (DOING.test(t)) {
    out.push('I am attending to the ' + regionName(b.focus.region) + (b.board.thinking ? ', thinking about "' + b.board.thinking + '"' : '') + '.');
    if (b.board.action) out.push('I chose ' + b.board.action.name + (b.board.action.imagined && b.board.action.imagined.length > 1 ? ' after imagining ' + b.board.action.imagined.map((x) => x.action + ' (' + x.utility + ')').join(' and ') : '') + '.');
    if (M.goals.length) out.push('My goals: ' + M.goals.slice(0, 4).map((g) => g.word + ' ' + Math.round(g.strength * 100) + '%').join(', ') + '.');
    return out;
  }
  // why: the region in question is the one the attention is on, or the busiest tissue
  const act = regionMeans(b.ws, 'act'); let r = b.focus.region; if (/cluster|form|grow|bright|that/.test(t)) { let best = -1; for (let k = 0; k < REGIONS; k++) if (act[k] > best) { best = act[k]; r = k; } }
  const who = writersOf(b, r), sur = regionMeans(b.ws, 'surprise')[r], mem = regionMeans(b.ws, 'memory')[r];
  out.push('The ' + regionName(r) + ' is ' + (act[r] > 0.25 ? 'busy' : 'quiet') + ' (tissue ' + Math.round(act[r] * 100) + '%).');
  if (who.length) out.push('Lately it was written by ' + who.slice(0, 3).map((x) => nm(x.id) + ' ' + Math.round(x.share * 100) + '%').join(', ') + '.');
  if (sur > 0.05) out.push('I was surprised there: I guessed your movement wrong.');
  if (mem > 0.05) out.push('My memory expected something there after your last kind of gesture.');
  const c = M.conflicts.find((x) => x.region === r); if (c) out.push(c.organs.map(nm).join(' and ') + ' disagree there' + (c.slowed ? ', so I slowed ' + nm(c.slowed) : '') + '.');
  else if (M.conflicts.length) { const o = M.conflicts[0]; out.push('Elsewhere, ' + o.organs.map(nm).join(' and ') + ' disagree in the ' + regionName(o.region) + (o.slowed ? ', so I slowed ' + nm(o.slowed) : '') + '.'); }
  const near = nearestEpisodes(b, 1)[0]; if (near && near.sim > 0.85) out.push('It looks like a moment I remember: then I chose ' + ACTIONS[near.episode.action] + ' and my utility ' + (near.episode.gain >= 0 ? 'rose' : 'fell') + ' by ' + Math.abs(near.episode.gain) + '.');
  return out;
}

// ---- asks: what the visitor asks next (Verse's ask box, on this device) --------------------------------------------------------------------
export const MAX_ASK_KEYS = 64, MAX_NEXT = 8, ASK_LEN = 80;
export const makeAsks = () => ({ last: null, next: {}, guess: null, guessed: 0, hits: 0, heard: 0 });
/** an ask as the asks layer keys it: lower case, one space, no end punctuation, at most ASK_LEN characters. '' for nothing to keep (an
 *  owner key never reaches here: void.html sends the ask out only after the key is handled, and this drops one anyway). Pure. */
export const askKey = (t) => { const k = String(t == null ? '' : t).toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim().replace(/[?!.]+$/, '').trim(); return !k || /^(?:unlock\s*)+\S{16,}$/.test(k) ? '' : k.slice(0, ASK_LEN); };
/** the asks most often asked right after `key`, most first: [{ ask, n, share }]. Pure. */
export function nextAfter(b, key, top = MAX_NEXT) {
  const row = b.mind.asks.next[askKey(key)]; if (!row) return [];
  const tot = Object.values(row).reduce((s, n) => s + n, 0) || 1;
  return Object.entries(row).map((e, i) => [...e, i]).sort((p, q) => q[1] - p[1] || q[2] - p[2]).slice(0, top).map(([ask, n]) => ({ ask, n, share: Math.round((n / tot) * 1000) / 1000 })); // a tie goes to the one asked most lately
}
/** the visitor asked Verse `text`: score the guess made after the last ask, learn last -> this, and guess what comes next. Returns
 *  { hit: true | false | null (no guess was made), guess: the ask it now expects next or null }. Pure on b. */
export function heardAsk(b, text) {
  const A = b.mind.asks, k = askKey(text); if (!k) return { hit: null, guess: A.guess };
  let hit = null; if (A.guess) { hit = A.guess === k; A.guessed++; if (hit) A.hits++; }
  if (A.last && A.last !== k) {
    const row = A.next[A.last] || (A.next[A.last] = {}), n = (row[k] || 0) + 1; delete row[k]; row[k] = n; // kept last: the latest follower
    const ks = Object.keys(row); if (ks.length > MAX_NEXT) { ks.sort((p, q) => row[p] - row[q]); delete row[ks[0] === k ? ks[1] : ks[0]]; } // the rarest follower goes, never the one just learned
    const keys = Object.keys(A.next); if (keys.length > MAX_ASK_KEYS) { const lone = keys.filter((x) => x !== A.last).sort((p, q) => Object.values(A.next[p]).reduce((s, n) => s + n, 0) - Object.values(A.next[q]).reduce((s, n) => s + n, 0))[0]; delete A.next[lone]; }
  }
  A.last = k; A.heard++;
  const n = nextAfter(b, k, 1)[0]; A.guess = n ? n.ask : null;
  return { hit, guess: A.guess };
}
const hvCache = new Map(); const hvOf = (w) => { let v = hvCache.get(w); if (!v) { if (hvCache.size > 2000) hvCache.clear(); hvCache.set(w, (v = hypervector(w))); } return v; };
/** how often the visitor asked `line` right after their last ask: its share of what followed, 0..1. Pure on b. */
export function habitOf(b, line) {
  const A = b.mind.asks, row = A.last ? A.next[A.last] : null, k = askKey(line);
  return row && row[k] ? row[k] / (Object.values(row).reduce((t, n) => t + n, 0) || 1) : 0;
}
/** how much the brain wants to suggest a line now: its habit share (times 2) plus how near the line's words are to its goals (the
 *  visitor's own recent asks, by strength, at most 0.5). Pure on b. */
export function askScore(b, line) {
  const s = 2 * habitOf(b, line), G = b.mind.goals; if (!G.length) return s;
  let best = 0; for (const w of cleanWords(askKey(line))) { if (w.length < 3) continue; const hv = hvOf(w); for (const g of G) { const c = b.concepts.hv[g.idx]; if (!c) continue; const v = hvSim(hv, c) * g.strength; if (v > best) best = v; } }
  return s + Math.max(0, best) * 0.5;
}
/** the empty ask box's suggestions, ranked by the brain: the asks it expects next, most likely first (even ones that fell out of the
 *  recent list), then the candidates in the page's own order. candidates: lines in the order the page shows them (newest first). Pure. */
export function suggestAsks(b, candidates, top = 5) {
  const seen = new Set(), out = [];
  for (const line of nextAfter(b, b.mind.asks.last || '').map((x) => x.ask).concat((candidates || []).map(String))) { const k = askKey(line); if (!k || seen.has(k)) continue; seen.add(k); out.push(line); if (out.length >= top) break; }
  return out;
}
/** the asks layer to keep on the device (the visitor's own asks, never sent). Pure. */
export const asksOf = (b) => ({ last: b.mind.asks.last, next: b.mind.asks.next, guessed: b.mind.asks.guessed, hits: b.mind.asks.hits, heard: b.mind.asks.heard });
/** put kept asks back (wrong shapes are ignored). Returns true when they were. */
export function loadAsks(b, k) {
  if (!k || typeof k !== 'object' || !k.next || typeof k.next !== 'object') return false;
  const next = {}; for (const [a, row] of Object.entries(k.next).slice(0, MAX_ASK_KEYS)) { const ka = askKey(a); if (!ka || !row || typeof row !== 'object') continue; const r = {}; for (const [c, n] of Object.entries(row).slice(0, MAX_NEXT)) { const kc = askKey(c); if (kc && Number.isFinite(n) && n > 0) r[kc] = Math.min(1e6, Math.round(n)); } if (Object.keys(r).length) next[ka] = r; }
  const A = b.mind.asks; A.next = next; A.last = askKey(k.last) || null; const num = (x) => (Number.isFinite(x) && x >= 0 ? Math.round(x) : 0);
  A.guessed = num(k.guessed); A.hits = Math.min(num(k.hits), A.guessed); A.heard = num(k.heard);
  const n = A.last ? nextAfter(b, A.last, 1)[0] : null; A.guess = n ? n.ask : null; return true;
}

// ---- knowledge kept between visits: numbers and the visitor's own words, on their device ----------------------------------------------
/** the slow learners as plain arrays (for lib/brain-store.js). Pure. */
export function knowledgeOf(b) {
  const r2 = (v) => Math.round(v * 1000) / 1000;
  return { v: 1, q: Array.from(b.will.q, r2), hebb: Array.from(b.memory.w, r2), centroids: b.gestures.c.map((c) => c.map(r2)), counts: b.gestures.n.slice(), pref: Array.from(b.mind.pref, r2),
    synapses: b.synapses ? Array.from(b.synapses.W, r2) : undefined, creature: b.creature ? b.creature.mean.map(r2) : undefined, hearing: b.ear ? countsOf(b.ear) : undefined, painter: b.painter ? programsOf(b.painter) : undefined, garden: b.gardener ? gardenOf(b.gardener) : undefined, grower: b.grower ? grammarsOf(b.grower) : undefined, formula: b.formula ? formulasOf(b.formula) : undefined, current: b.current ? swimmersOf(b.current) : undefined, grains: b.grains ? genesOf(b.grains) : undefined, pool: b.pool ? networkOf(b.pool) : undefined, trace: b.trace ? ruleOf(b.trace) : undefined, dialogue: b.dialogue && b.dialogue.log.length ? dialogueOf(b.dialogue) : undefined, routes: b.routes ? routesOf(b.routes) : undefined, watch: b.watch ? watchOf(b.watch) : undefined, procedures: b.mind.procedures, episodes: b.mind.episodes.slice(-MAX_EPISODES), asks: asksOf(b) };
}
/** put kept knowledge back into a new brain (wrong shapes are ignored, so an old record never breaks a new brain). Returns what was restored. */
export function loadKnowledge(b, k) {
  const done = [];
  if (!k || k.v !== 1) return done;
  const fit = (dst, src) => Array.isArray(src) && src.length === dst.length && src.every(Number.isFinite);
  if (fit(b.will.q, k.q)) { b.will.q.set(k.q); done.push('q'); }
  if (fit(b.memory.w, k.hebb)) { b.memory.w.set(k.hebb); done.push('memory'); }
  if (Array.isArray(k.centroids) && k.centroids.length === b.gestures.c.length && k.centroids.every((c, i) => fit(b.gestures.c[i], c))) { k.centroids.forEach((c, i) => { b.gestures.c[i] = c.slice(); }); if (Array.isArray(k.counts)) b.gestures.n = k.counts.slice(0, b.gestures.n.length).map((x) => +x || 0); done.push('gestures'); }
  if (fit(b.mind.pref, k.pref)) { b.mind.pref.set(k.pref); done.push('preferences'); }
  if (b.synapses && fit(b.synapses.W, k.synapses) && k.synapses.every((x) => x >= 0 && x <= 6)) { b.synapses.W.set(k.synapses); done.push('synapses'); } // the spiking eye's learned wiring (lib/brain-synapses.js)
  if (b.creature && loadMean(b.creature, k.creature)) done.push('creature'); // the Lenia creature's evolved physics (lib/brain-creature.js)
  if (b.ear && loadCounts(b.ear, k.hearing)) done.push('hearing'); // the ear's melody counts, intervals and lengths only (lib/brain-hearing.js)
  if (b.painter && loadPrograms(b.painter, k.painter)) done.push('painter'); // the programs that paint its look, numbers only (lib/brain-painter.js)
  if (b.gardener && loadGarden(b.gardener, k.garden)) done.push('gardener'); // how it tends each patch of tissue, numbers only (lib/brain-gardener.js)
  if (b.grower && loadGrammars(b.grower, k.grower)) done.push('grower'); // the grammars its plant grows from, numbers only (lib/brain-grower.js)
  if (b.formula && loadFormulas(b.formula, k.formula)) done.push('formula'); // the formulas it says its tissue with, numbers only (lib/brain-formula.js)
  if (b.current && loadSwimmers(b.current, k.current)) done.push('current'); // the swimmers' networks, numbers only (lib/brain-current.js)
  if (k.routes && loadRoutes(b.routes || (b.routes = createRoutes()), k.routes)) done.push('routes'); // which skill it picks for which words, and its log (lib/brain-route.js)
  if (k.watch && loadWatch(b.watch || (b.watch = createWatch()), k.watch)) done.push('watch'); // what it saw of Verse's own health, and its log (lib/brain-watch.js)
  if (b.grains && loadGenes(b.grains, k.grains)) done.push('grains'); // the grains' bounce and grip, numbers only (lib/brain-grains.js)
  if (b.pool && loadNetwork(b.pool, k.pool)) done.push('pool'); // the pool's network, numbers only (lib/brain-pool.js)
  if (b.trace && loadRule(b.trace, k.trace)) done.push('trace');
  if (b.dialogue && loadDialogue(b.dialogue, k.dialogue)) done.push('dialogue'); // the conversation orb: the visitor's asks and Verse's answers, on their own device (lib/brain-dialogue.js) // the trace's rule, five numbers (lib/brain-trace.js)
  if (loadAsks(b, k.asks)) done.push('asks'); // what the visitor asks next, their own asks on their own device
  if (Array.isArray(k.procedures)) { const p = k.procedures.filter((x) => x && typeof x.ctx === 'string' && x.genome && typeof x.genome === 'object' && Number.isFinite(x.fitness)).slice(0, MAX_PROCEDURES); if (p.length || !k.procedures.length) { b.mind.procedures = p; done.push('procedures'); } }
  if (Array.isArray(k.episodes)) { b.mind.episodes = k.episodes.filter((e) => e && Array.isArray(e.key) && e.key.length === REGIONS * 2 + 2 && Number.isInteger(e.action) && e.action >= 0 && e.action < ACTIONS.length && Number.isFinite(e.gain)).slice(-MAX_EPISODES); if (!b.mind.episodes.length && k.episodes.length) b.mind.episodes = []; else done.push('episodes'); }
  return done;
}
export { regionCenter, regionName };
