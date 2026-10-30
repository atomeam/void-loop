// brain — Verse Brain: one entity made of Grok's frontier drafts (owner, 2026-10-29: "combine all the builds into one entity"; "the grok
// builds combined can be verse brain"). Five layers, each a real part that runs, not a picture of one:
//   1. one working memory      lib/brain-workspace.js: layers, rhythm phases and one node table, with who wrote each cell and when
//   2. organs                  lib/brain-organs.js: senses, predictor, gestures, memory, concepts, tissue, rhythm, synapses (F217's spiking eye), creature
//                              (F304's Lenia creature), gardener (F215: tends the tissue to the edge of chaos), hearing (F299's
//                              hummed notes), swarm, membrane, painter
//                              (F322: the look is a program it rewrites), grower (F453: a plant from a grammar it rewrites, bent toward
//                              the attention), formula (F451: a formula it evolves for how its own tissue will change),
//                              current (F447: a lattice-Boltzmann flow your drag stirs, with swimmers evolved to ride it to life),
//                              grains (F456: grains thrown toward the focus that pass their genes on where they touch), will, arena
//   3. attention               scheduleTick() here: each tick a budget of organ runs goes to the organs that want it most, the starved
//                              ones catch up, and one spotlight (the focus layer) shows what the brain is thinking about
//   4. imagination             imagine() here: freeze the workspace, try an action or a genome for a few dozen ticks on the substrate
//                              organs only, score the future, put everything back exactly. The will and the arena decide by it.
//   5. the self                selfOf() here: goals, which organs are used and which are starved, who owns the workspace, the winning
//                              genome's seal, the surprise budget; what Verse can say about its own brain.
// workingOf() and loadWorking() carry the working memory and the attention across a page reload (through the shared field's kept record).
// embodiment() lists what becomes DOM (word orbs, the gesture, the expectation, the action); a drag on one writes back as 'you'.
// Pure: no DOM, no clock, no Math.random (the workspace's seeded rng). The card is skills/verse-brain.js; other pages reach a running
// brain through lib/brain-bridge.js.
import { clamp } from './field-kit.js';
import { createWorkspace, snapshot, restore, measure, ownership, regionMeans, regionCenter, deposit, nodesOf, sealSlice, GW, GH, CELLS, KIND, REGIONS_X, REGIONS_Y, LAYERS as LAYER_KEYS } from './brain-workspace.js';
import { ORGANS, ORGAN_IDS, STARTER, fixGenome, makeReservoir, makeGestures, makeMemory, makeConcepts, makeWill, makeArena, seedSwarm, seedMembrane, addPhrase, related, applyAction, ACTIONS, gestureName, LETTERS, hypervector } from './brain-organs.js';
import { sealSync } from './field-kit.js';
import * as Mind from './brain-mind.js';
import { makeSynapses, wiring as eyeWiring } from './brain-synapses.js';
import { makeCreature, dropCreature, progress as creatureProgress } from './brain-creature.js';
import { makeEar, hearFrame, earOf } from './brain-hearing.js';
import { makePainter, painterOf } from './brain-painter.js';
import { makeGardener, gardenerOf, TILES as GARDEN_TILES } from './brain-gardener.js';
import { makeGrower, growerOf } from './brain-grower.js';
import { makeFormula, formulaOf } from './brain-formula.js';
import { makeCurrent, currentOf } from './brain-current.js';
import { makeGrains, grainsOf } from './brain-grains.js';

export const VERSION = 1;
export const STARVE = 120; // ticks of waiting that add a whole 1 to an organ's want
export const USE_RATE = 1 / 256; // how fast an organ's recent share of ticks follows what it does now (about 4 seconds at 60 ticks a second)
export const BUDGET = 7, BUDGET_PHONE = 5; // organ runs a tick (senses always runs and is not counted)
export const GOALS = ['keep the tissue alive and varied', 'expect what you will do next', 'stay in step without freezing', 'attend where something new is happening'];

/** the brain's utility of a workspace: varied, alive (not empty, not full), in step but not frozen, and lit where it attends. 0..1. Pure. */
export function utilityOf(ws, focus) {
  const m = measure(ws), band = m.activity > 0.05 && m.activity < 0.8 ? 1 - Math.abs(m.activity - 0.35) * 1.4 : 0;
  const lit = clamp(regionMeans(ws, 'act')[regionIndex(focus)] * 4, 0, 1);
  return clamp(0.35 * m.entropy + 0.25 * band + 0.2 * (1 - Math.abs(m.order - 0.6) / 0.6) + 0.2 * lit, 0, 1);
}
const regionIndex = (f) => Math.min(2, Math.floor(clamp(f.y, 0, 0.999) * 3)) * REGIONS_X + Math.min(REGIONS_X - 1, Math.floor(clamp(f.x, 0, 0.999) * REGIONS_X));

/** a new brain. opts: { phone, genome }. */
export function createBrain(seed = 1, opts = {}) {
  const ws = createWorkspace(seed, ORGAN_IDS.concat(['attention']));
  const b = { v: VERSION, seed, ws, genome: fixGenome(opts.genome || STARTER), budget: opts.phone ? BUDGET_PHONE : BUDGET,
    senses: { feat: new Float32Array(8), px: 0.5, py: 0.5, has: false, over: false, speed: 0, trail: [] },
    reservoir: makeReservoir(seed), synapses: makeSynapses(seed), creature: makeCreature(seed), ear: makeEar(), painter: makePainter(seed), gardener: makeGardener(seed), grower: makeGrower(seed), formula: makeFormula(seed), current: makeCurrent(seed), grains: makeGrains(seed), gestures: makeGestures(), memory: makeMemory(), concepts: makeConcepts(), will: makeWill(), arena: makeArena(seed),
    focus: { x: 0.5, y: 0.5, px: 0.5, py: 0.5, region: 5, held: 0 }, surprise: 0, utility: 0, metrics: measure(ws),
    runs: Object.fromEntries(ORGAN_IDS.map((id) => [id, 0])), lastRun: Object.fromEntries(ORGAN_IDS.map((id) => [id, 0])), recent: Object.fromEntries(ORGAN_IDS.map((id) => [id, 0])), granted: [], ticks: 0,
    board: { drive: 'rest', eye: null, creature: null, ear: null, paint: null, garden: null, grow: null, gesture: null, motif: null, expect: null, thinking: null, action: null, genome: null, membrane: null }, imagining: 0, imagined: 0, mind: Mind.makeMind() };
  seedSwarm(b); seedMembrane(b);
  b.swarmIds = nodesOf(ws, [0, 1, 2]); b.membraneIds = nodesOf(ws, [KIND.membrane]);
  // a few seeds so the tissue has somewhere to start
  for (let k = 0; k < 5; k++) deposit(ws, 'act', 0.2 + 0.6 * ws.rand(), 0.2 + 0.6 * ws.rand(), 0.6, 3, 'tissue');
  b.utility = utilityOf(ws, b.focus);
  return b;
}
/** the brain's preference for its state (lib/brain-mind.js valenceOf): coherence, goals met, approval, alignment with Verse. Pure on b. */
export const valence = (b) => Mind.valenceOf(b, utilityOf(b.ws, b.focus));

// ---- 3. attention --------------------------------------------------------------------------------------------------------------------
/** move the spotlight: the region with the most surprise and input (memory's expectation counts a little), held a while so it does not
 *  flicker; the focus layer gets a soft disc there, written as 'attention'. Pure on b. */
export function updateFocus(b) {
  const ws = b.ws, s = regionMeans(ws, 'surprise'), i = regionMeans(ws, 'input'), m = regionMeans(ws, 'memory');
  let best = b.focus.region, bs = -1; for (let r = 0; r < s.length; r++) { const v = s[r] * 2 + i[r] + m[r] * 0.5; if (v > bs) { bs = v; best = r; } }
  const cur = s[b.focus.region] * 2 + i[b.focus.region] + m[b.focus.region] * 0.5;
  if (best !== b.focus.region && (bs > cur * 1.3 + 0.01 || b.focus.held > 240)) { b.focus.region = best; b.focus.held = 0; } else b.focus.held++;
  const c = regionCenter(b.focus.region); let tx = c.x, ty = c.y;
  if (b.senses.over && regionIndex({ x: b.senses.px, y: b.senses.py }) === b.focus.region) { tx = b.senses.px; ty = b.senses.py; }
  b.focus.px = b.focus.x; b.focus.py = b.focus.y; b.focus.x += (tx - b.focus.x) * 0.06; b.focus.y += (ty - b.focus.y) * 0.06;
  const F = ws.layers.focus; for (let k = 0; k < CELLS; k++) F[k] *= 0.9;
  deposit(ws, 'focus', b.focus.x, b.focus.y, 0.12, 6, 'attention');
  return b.focus;
}
/** which organs run this tick: senses always; then the budget goes to the highest want plus starvation (ticks since it last ran / STARVE).
 *  Returns the ids, in the order they run (the order of ORGANS: senses before the predictor, tissue before the rhythm). Pure. */
export function scheduleTick(b) {
  const scored = ORGANS.filter((o) => o.id !== 'senses').map((o) => ({ id: o.id, p: clamp(o.want(b) - (b.mind.throttle[o.id] || 0), 0, 1) + Math.min(1, (b.ticks - b.lastRun[o.id]) / STARVE) })); // the monitor slows an organ that disagrees with another over a region
  scored.sort((p, q) => q.p - p.p);
  const pick = new Set(['senses', ...scored.slice(0, b.budget).filter((x) => x.p > 0.05).map((x) => x.id)]);
  return ORGANS.filter((o) => pick.has(o.id)).map((o) => o.id);
}

/** one tick of the whole brain. input: { x, y, over, down, tiltX, tiltY, sound, pitches: [[Hz, seconds], ...] }. Returns the organs that ran. */
export function stepBrain(b, input = {}) {
  const ws = b.ws; ws.tick++; b.ticks++; b.will.since++; b.arena.since++; b.painter.since++; b.gardener.since++; b.grower.since++; b.formula.since++; b.current.since++; b.grains.since++;
  if (Array.isArray(input.pitches)) for (const p of input.pitches.slice(-64)) if (Array.isArray(p)) hearFrame(b.ear, +p[0], +p[1]); // every pitch frame, run or not: the hearing organ learns the notes when it runs
  updateFocus(b);
  const ids = scheduleTick(b);
  for (const id of ids) { const o = ORGANS.find((x) => x.id === id); o.run(b, input, imagine); b.runs[id]++; b.lastRun[id] = b.ticks; }
  b.granted = ids;
  const ran = new Set(ids); for (const id of ORGAN_IDS) b.recent[id] += ((ran.has(id) ? 1 : 0) - b.recent[id]) * USE_RATE;
  Mind.stepGoals(b, deposit); Mind.stepValence(b); Mind.stepMonitor(b, ORGANS);
  if ((b.ticks & 7) === 0) { b.metrics = measure(ws); b.utility = valence(b); }
  Mind.stepHistory(b);
  return ids;
}

// ---- 4. imagination ------------------------------------------------------------------------------------------------------------------
/** imagine a future: from an exact copy of now, apply an action (the will's hand) or a genome, step only the substrate organs (the ones
 *  marked imagine: senses with a still visitor, concepts, tissue, rhythm, swarm, membrane) for `steps` ticks, and return the utility of
 *  where it ended. Everything is put back exactly; the learners never see an imagined tick. */
export function imagine(b, { action = null, genome = null, steps = 24 } = {}) {
  const snap = snapshot(b.ws), keep = { board: { ...b.board }, genome: b.genome, drive: b.board.drive, focus: { ...b.focus }, surprise: b.surprise, senses: { ...b.senses, feat: b.senses.feat.slice(), trail: b.senses.trail.slice() }, rand: b.ws.rand };
  const conceptAct = b.concepts.node.map((i) => b.ws.nodes.act[i]);
  let r = (b.seed * 7919 + b.imagined * 104729) >>> 0 || 1; b.ws.rand = () => { r ^= r << 13; r >>>= 0; r ^= r >>> 17; r ^= r << 5; r >>>= 0; return r / 4294967296; }; // imagined noise never moves the live rng
  if (genome) b.genome = genome;
  const sub = ORGANS.filter((o) => o.imagine), still = { x: b.focus.x, y: b.focus.y, over: false };
  b.imagining++;
  try {
    for (let t = 0; t < steps; t++) { b.ws.tick++; if (action != null) applyAction(b, action); for (const o of sub) o.run(b, still); }
    return valence(b);
  } finally {
    const aligned = b.mind.aligned; restore(b.ws, snap); b.mind.aligned = aligned; b.genome = keep.genome; b.board = keep.board; b.focus = keep.focus; b.surprise = keep.surprise; b.senses = keep.senses; b.ws.rand = keep.rand;
    b.concepts.node.forEach((i, k) => { b.ws.nodes.act[i] = conceptAct[k]; });
    b.imagining--; b.imagined++;
  }
}

// ---- what the visitor can do to it ------------------------------------------------------------------------------------------------------
/** type words to the brain: they become concepts. Returns what it made of them. */
export function tell(b, text) {
  const words = addPhrase(b, text), last = words[words.length - 1];
  return { words, related: last ? related(b.concepts, last) : [], surprise: b.concepts.lastBits };
}
/** the concepts nearest a word (spelling and use), rounded: [{ word, sim, linked }]. */
export function relatedOf(b, word, top = 3) { return related(b.concepts, word, top).map((r) => ({ word: r.word, sim: Math.round(r.sim * 100) / 100, linked: r.linked })); }
/** "good": a reward for whatever the brain did last. */
export function reward(b, amt = 1) { b.will.good += amt; Mind.approve(b, 0.5 * amt, b.will.action); return b.will.good; }
/** an ask (from the stage or the card): its words become ideas and goals that pull (lib/brain-mind.js askGoal). A question about itself
 *  ("why did that form?", "what just happened?", "what are you doing?") is answered from its state instead: { answer: [sentences] }. */
export function ask(b, text) {
  if (Mind.isQuestion(text)) return { answer: Mind.explain(b, text, Object.fromEntries(ORGANS.map((o) => [o.id, o.name.toLowerCase()]))) };
  return Mind.askGoal(b, text, tell);
}
/** Verse's own priorities (the parsed /self.json) as standing ideas the visitor's are compared with. Returns how many. */
export function knowVerse(b, self) { b.mind.semantic = Mind.semanticFrom(self); return b.mind.semantic.length; }
export const knowledgeOf = Mind.knowledgeOf, loadKnowledge = Mind.loadKnowledge;
/** Verse's own asks (the ask box, every page): the brain learns what the visitor asks next, guesses it before it comes and counts its hits
 *  (lib/brain-mind.js heardAsk), and ranks the ask box's suggestions by that and by its goals (suggestAsks). */
export const heardAsk = Mind.heardAsk, suggestAsks = Mind.suggestAsks, askScore = Mind.askScore, habitOf = Mind.habitOf, nextAfter = Mind.nextAfter, isQuestion = Mind.isQuestion;

// ---- the working memory across a reload ------------------------------------------------------------------------------------------------
// knowledgeOf keeps what the brain learned (slow); this keeps what it is thinking now: the whole workspace (layers, rhythm, nodes with the
// ideas' words, who wrote what), the ideas and their links, the character model, the spotlight, the goals and the last minute. The card
// gives it to the shared field (lib/shared-field.js hold), which keeps it on this device and gives it back after a reload.
/** a brain with nothing of its own to think about yet: no ideas and no goals (a new card, or one just reset). Pure. */
export const isCold = (b) => !b.concepts.words.length && !b.mind.goals.length;
// a record kept before the spiking eye joined (2026-10-29) has no organ list: these were its writers, in order
const BEFORE_SYNAPSES = ['senses', 'predictor', 'gestures', 'memory', 'concepts', 'tissue', 'rhythm', 'swarm', 'membrane', 'will', 'arena', 'attention'];
/** a kept workspace snapshot whose writers were `from`, re-indexed for writers `to` by name (a writer that is gone becomes nobody). Pure. */
export function byName(s, from, to) {
  if (!s || !Array.isArray(from) || from.length === to.length && from.every((x, i) => x === to[i])) return s;
  const map = (o) => (o >= 254 || o >= from.length ? o : (to.indexOf(from[o]) >= 0 ? to.indexOf(from[o]) : 255));
  const remap = (a) => (a && typeof a.length === 'number' ? Uint8Array.from(a, map) : a);
  const writes = new Uint32Array(Math.max(1, to.length)), R = REGIONS_X * REGIONS_Y, Wf = from.length + 1, Wt = to.length + 1, regionWrites = new Uint32Array(R * Wt);
  if (s.writes && s.writes.length === Math.max(1, from.length)) from.forEach((id, i) => { const k = to.indexOf(id); if (k >= 0) writes[k] = s.writes[i]; });
  else return { ...s, writes: null };
  if (s.regionWrites && s.regionWrites.length === R * Wf) for (let r = 0; r < R; r++) { for (let i = 0; i < from.length; i++) { const k = to.indexOf(from[i]); if (k >= 0) regionWrites[r * Wt + k] = s.regionWrites[r * Wf + i]; } regionWrites[r * Wt + Wt - 1] = s.regionWrites[r * Wf + Wf - 1]; }
  else return { ...s, regionWrites: null };
  return { ...s, owner: remap(s.owner), writes, regionWrites, nodes: s.nodes ? { ...s.nodes, owner: remap(s.nodes.owner) } : s.nodes };
}
/** what the brain is thinking now, as one plain record. Pure. */
export function workingOf(b) {
  const C = b.concepts, M = b.mind;
  return { v: VERSION, organs: b.ws.organs.slice(), ws: snapshot(b.ws),
    concepts: { words: C.words.slice(), node: C.node.slice(), edges: [...C.edges], ppm: { seen: C.ppm.seen, counts: [...C.ppm.counts].map(([k, m]) => [k, [...m]]) }, lastBits: C.lastBits },
    focus: { ...b.focus }, surprise: b.surprise, ticks: b.ticks, runs: { ...b.runs }, lastRun: { ...b.lastRun }, recent: { ...b.recent },
    mind: { goals: M.goals.map((g) => ({ ...g })), history: M.history.map((h) => ({ ...h })), approval: M.approval, dwell: M.dwell } };
}
/** put a kept working memory into a brain. A record of the wrong shape changes nothing (an old record never breaks a new brain).
 *  Returns what was restored: [] or ['workspace', 'ideas', 'attention', 'goals']. */
export function loadWorking(b, w) {
  if (!w || w.v !== VERSION || !w.ws || !w.concepts || !w.focus) return [];
  const ws = b.ws, s = byName(w.ws, Array.isArray(w.organs) ? w.organs : BEFORE_SYNAPSES, ws.organs), Nn = ws.nodes, C = w.concepts, n = s.nodes && s.nodes.n;
  const same = (dst, src) => src != null && typeof src.length === 'number' && src.length === dst.length;
  const fine = LAYER_KEYS.every((k) => s.layers && same(ws.layers[k], s.layers[k])) && ['phase', 'omega', 'owner', 'wroteAt', 'writes', 'regionWrites'].every((k) => same(ws[k], s[k]))
    && Number.isInteger(n) && n >= 0 && n <= Nn.x.length && ['x', 'y', 'vx', 'vy', 'kind', 'act', 'emb', 'owner'].every((k) => same(Nn[k], s.nodes[k])) && Array.isArray(s.nodes.label) && s.nodes.label.length === Nn.label.length;
  const words = Array.isArray(C.words) && Array.isArray(C.node) && C.words.length === C.node.length && C.words.every((x, k) => typeof x === 'string' && x && Number.isInteger(C.node[k]) && C.node[k] >= 0 && C.node[k] < n && s.nodes.kind[C.node[k]] === KIND.concept);
  if (!fine || !words || !Number.isFinite(+w.ticks)) return [];
  restore(ws, s);
  b.swarmIds = nodesOf(ws, [0, 1, 2]); b.membraneIds = nodesOf(ws, [KIND.membrane]);
  const cs = b.concepts; cs.words = C.words.slice(); cs.node = C.node.slice(); cs.hv = cs.words.map(hypervector); cs.lastBits = +C.lastBits || 0;
  cs.edges = new Map((Array.isArray(C.edges) ? C.edges : []).filter((e) => Array.isArray(e) && typeof e[0] === 'string' && Number.isFinite(e[1])));
  cs.ppm.counts = new Map(); cs.ppm.seen = C.ppm && Number.isFinite(C.ppm.seen) ? C.ppm.seen : 0;
  for (const [k, m] of (C.ppm && Array.isArray(C.ppm.counts) ? C.ppm.counts : [])) if (typeof k === 'string' && Array.isArray(m)) cs.ppm.counts.set(k, new Map(m.filter((e) => Array.isArray(e) && typeof e[0] === 'string' && Number.isFinite(e[1]))));
  const done = ['workspace', 'ideas'];
  const f = w.focus; if (['x', 'y', 'px', 'py', 'held'].every((k) => Number.isFinite(f[k])) && Number.isInteger(f.region) && f.region >= 0 && f.region < REGIONS_X * REGIONS_Y) { b.focus = { x: f.x, y: f.y, px: f.px, py: f.py, region: f.region, held: f.held }; done.push('attention'); }
  b.ticks = Math.max(0, Math.floor(+w.ticks)); b.surprise = Number.isFinite(w.surprise) ? w.surprise : 0;
  for (const id of ORGAN_IDS) {
    if (w.runs && Number.isFinite(w.runs[id])) b.runs[id] = w.runs[id];
    if (w.lastRun && Number.isFinite(w.lastRun[id])) b.lastRun[id] = w.lastRun[id];
    // a record from before the recent share starts from the lifetime share, then follows what the organ does now
    const r = w.recent && w.recent[id]; b.recent[id] = Number.isFinite(r) && r >= 0 && r <= 1 ? r : clamp(b.runs[id] / Math.max(1, b.ticks), 0, 1);
  }
  const M = w.mind || {};
  if (Array.isArray(M.goals)) { b.mind.goals = M.goals.filter((g) => g && typeof g.word === 'string' && Number.isInteger(g.idx) && cs.words[g.idx] === g.word && Number.isFinite(g.strength)).map((g) => ({ ...g })); if (b.mind.goals.length) done.push('goals'); }
  if (Array.isArray(M.history)) b.mind.history = M.history.filter((h) => h && Number.isFinite(h.t)).map((h) => ({ ...h }));
  if (Number.isFinite(M.approval)) b.mind.approval = M.approval; if (Number.isFinite(M.dwell)) b.mind.dwell = M.dwell;
  let best = -1, ba = 0; cs.node.forEach((i, a) => { if (Nn.act[i] > ba) { ba = Nn.act[i]; best = a; } }); b.board.thinking = best >= 0 && ba > 0.15 ? cs.words[best] : null;
  b.metrics = measure(ws); b.utility = valence(b);
  return done;
}
/** a drag of an embodied thing to (x, y): a concept moves; anything else deposits there as 'you'. */
export function dragTo(b, ref, x, y) {
  const N = b.ws.nodes;
  if (ref && ref.node >= 0 && ref.node < N.n) { N.x[ref.node] = clamp(x, 0.02, 0.98); N.y[ref.node] = clamp(y, 0.02, 0.98); N.act[ref.node] = 1; }
  if (ref && ref.key === 'eye' && b.synapses) { b.synapses.x = clamp(x, 0, 1); b.synapses.y = clamp(y, 0, 1); } // the eye goes where it is put, and learns from there
  if (ref && ref.key === 'creature' && b.creature) dropCreature(b.creature, clamp(x, 0, 1) * GW, clamp(y, 0, 1) * GH); // a creature put down walks back to the focus
  deposit(b.ws, 'input', x, y, 0.25, 3, 'you');
}

// ---- embodiment registry -------------------------------------------------------------------------------------------------------------
/** what becomes DOM this frame: [{ key, organ, x, y, label, size 0..1, hue, node? }]. Each organ that has a body declares it here. */
export function embodiment(b) {
  const out = [], N = b.ws.nodes, C = b.concepts;
  C.node.forEach((i, k) => out.push({ key: 'w:' + C.words[k], organ: 'concepts', x: N.x[i], y: N.y[i], label: C.words[k], size: N.act[i], hue: 190 + N.act[i] * 120, node: i }));
  if (b.board.gesture && b.senses.over) out.push({ key: 'gesture', organ: 'gestures', x: b.senses.px, y: b.senses.py, label: b.board.gesture + (b.board.motif && b.board.motif.seen > 1 ? ' x' + b.board.motif.seen : ''), size: 0.4, hue: 40 });
  if (b.board.expect) { const c = regionCenter(b.board.expect.region); out.push({ key: 'expect', organ: 'memory', x: c.x, y: c.y, label: 'expects here', size: b.board.expect.strength, hue: 280 }); }
  if (b.board.eye) out.push({ key: 'eye', organ: 'synapses', x: b.board.eye.x, y: b.board.eye.y, label: 'eye', size: 0.3, hue: 330 });
  if (b.board.ear && b.ticks - b.board.ear.tick < 600) out.push({ key: 'ear', organ: 'hearing', x: b.board.ear.x, y: b.board.ear.y, label: b.board.ear.note + (b.board.ear.next ? ', next ' + b.board.ear.next + '?' : ''), size: 0.3, hue: 50 });
  if (b.board.garden && b.board.garden.focus >= 0 && b.ticks - b.board.garden.tick < 60) out.push({ key: 'garden', organ: 'gardener', x: b.board.garden.x, y: b.board.garden.y, label: 'tending: ' + b.board.garden.cls, size: 0.22, hue: 120 });
  if (b.board.paint && b.board.paint.changed && b.ticks - b.board.paint.tick < 300) out.push({ key: 'paint', organ: 'painter', x: b.board.paint.x, y: b.board.paint.y, label: 'new look, gen ' + b.board.paint.gen, size: 0.3, hue: 300 });
  if (b.board.grow && b.board.grow.reach > 0 && b.ticks - b.board.grow.tick < 120) out.push({ key: 'grow', organ: 'grower', x: b.board.grow.x, y: b.board.grow.y, label: 'reaching light', size: 0.2, hue: 95 });
  if (b.board.formula && b.board.formula.rising && b.ticks - b.board.formula.tick < 60) out.push({ key: 'formula', organ: 'formula', x: b.board.formula.x, y: b.board.formula.y, label: 'expected life', size: 0.2, hue: 200 });
  if (b.board.current && b.board.current.gain > 1 && b.ticks - b.board.current.tick < 60) out.push({ key: 'current', organ: 'current', x: b.board.current.x, y: b.board.current.y, label: 'riding the current', size: 0.18, hue: 185 });
  if (b.board.grains && b.board.grains.gain > 1 && b.ticks - b.board.grains.tick < 60) out.push({ key: 'grains', organ: 'grains', x: b.board.grains.x, y: b.board.grains.y, label: 'grains landing', size: 0.16, hue: 35 });
  if (b.board.creature) out.push({ key: 'creature', organ: 'creature', x: b.board.creature.x, y: b.board.creature.y, label: 'creature', size: 0.35, hue: 20 });
  if (b.board.action && b.board.action.name !== 'rest') out.push({ key: 'will', organ: 'will', x: b.focus.x, y: clamp(b.focus.y - 0.12, 0.04, 0.96), label: b.board.action.name, size: 0.5, hue: 140 });
  return out;
}

// ---- 5. the self -------------------------------------------------------------------------------------------------------------------
/** each organ's share of recent ticks, 0..1 to 2 places: what it does now, not its share of a life that began before it existed. Pure. */
export function useOf(b) { return Object.fromEntries(ORGAN_IDS.map((id) => [id, Math.round(clamp(b.recent[id], 0, 1) * 100) / 100])); }
/** what Verse can say about its own brain right now. Pure. */
export function selfOf(b) {
  const use = useOf(b);
  const wants = Object.fromEntries(ORGANS.map((o) => [o.id, clamp(o.want(b), 0, 1)]));
  let starved = null, gap = 0; for (const o of ORGANS) { if (o.id === 'senses') continue; const d = wants[o.id] - use[o.id]; if (d > gap) { gap = d; starved = o.id; } }
  const own = ownership(b.ws); let top = null, tv = 0; for (const [k, v] of Object.entries(own)) if (v > tv) { tv = v; top = k; }
  const seal = sealSync('verse-brain', b.genome, { utility: Math.round(b.utility * 1000) / 1000 });
  return { goals: GOALS, utility: Math.round(b.utility * 1000) / 1000, use, starved, owner: { top, share: Math.round(tv * 100) / 100, all: own },
    genome: { gen: b.arena.gen, seal: seal.short, fitness: b.arena.last ? b.arena.last.fitness : null }, imagined: b.imagined,
    surpriseBudget: Math.round(clamp(1 - b.reservoir.errAvg * 2, 0, 1) * 100) / 100, concepts: b.concepts.words.length, motifs: b.gestures.motifs.length,
    q: b.will.chosen, action: b.board.action ? b.board.action.name : 'rest',
    wants: b.mind.goals.map((g) => ({ word: g.word, strength: Math.round(g.strength * 100) / 100 })), episodes: b.mind.episodes.length, procedures: b.mind.procedures.length,
    eye: { wiring: Math.round(eyeWiring(b.synapses.W) * 100) / 100, seen: Math.round(b.synapses.seenAvg * 1000) / 1000, spikes: b.synapses.spikes },
    creature: { generations: b.creature.gens, trials: b.creature.trials, deaths: b.creature.deaths, reverts: b.creature.reverts, progress: creatureProgress(b.creature) }, hearing: earOf(b.ear), painter: painterOf(b.painter), gardener: gardenerOf(b.gardener), grower: growerOf(b.grower), formula: formulaOf(b.formula), current: currentOf(b.current), grains: grainsOf(b.grains),
    conflicts: b.mind.conflicts, aligned: b.mind.aligned || null, approval: Math.round(b.mind.approval * 100) / 100, recent: Mind.recent(b) };
}
/** plain sentences from the self, for the card and for "what is your brain doing". Pure. */
export function selfSays(b) {
  const s = selfOf(b), out = [];
  out.push('Focus: region ' + (b.focus.region + 1) + ' of 12' + (b.board.thinking ? ', thinking about "' + b.board.thinking + '"' : '') + '.');
  if (b.board.action) out.push('Will: ' + b.board.action.name + (b.board.action.imagined && b.board.action.imagined.length > 1 ? ' (imagined ' + b.board.action.imagined.map((x) => x.action + ' ' + x.utility).join(' vs ') + ')' : '') + '.');
  if (s.wants.length) out.push('Asked for: ' + s.wants.slice(0, 3).map((g) => g.word).join(', ') + '.');
  if (s.conflicts.length) { const c = s.conflicts[0]; out.push(c.organs.join(' and ') + ' disagree in region ' + (c.region + 1) + (c.slowed ? '; ' + c.slowed + ' slowed' : '') + '.'); }
  if (s.aligned) out.push('"' + s.aligned.word + '" is near "' + s.aligned.near + '" (' + s.aligned.from + ').');
  if (!b.creature.trials) out.push('Creature: generation 0, its first trial is under way (' + b.creature.steps + ' steps lived; it walks when the focus moves away).');
  else { const c = s.creature, p = c.progress; out.push('Creature: generation ' + c.generations + ', ' + c.trials + ' trial' + (c.trials === 1 ? '' : 's') + ' and ' + c.deaths + ' death' + (c.deaths === 1 ? '' : 's') + (p ? '; its generations scored ' + p.early + ' earlier and ' + p.late + ' lately (cells toward the focus per 10 steps, a death is -1)' : '') + '.'); }
  if (b.ear.guessed) { const h = s.hearing; out.push('Hearing: ' + h.notes + ' hummed note' + (h.notes === 1 ? '' : 's') + '; it guessed the next one right ' + Math.round(h.hit * 100) + '% of the time (' + h.bits + ' bits a note, ' + h.bits0 + ' with no context).'); }
  else if (b.ear.notes) out.push('Hearing: ' + b.ear.notes + ' hummed note' + (b.ear.notes === 1 ? '' : 's') + ' so far; it guesses from the second one on.');
  if (b.painter.last) { const p = s.painter; out.push('Painter: its look is a program it rewrote ' + p.gen + ' time' + (p.gen === 1 ? '' : 's') + ', now ' + p.program + ' (' + p.tokens + ' tokens); it paints ' + p.score + ' (the first scored ' + p.first + ').'); }
  if (b.grower.last) { const g = s.grower; out.push('Grower: its plant grows from a grammar it rewrote ' + g.gen + ' time' + (g.gen === 1 ? '' : 's') + ', now ' + g.grammar + '; ' + g.stems + ' stems bend toward the focus and reach ' + Math.round(g.reach * 100) + '% of the brightest light (it scores ' + g.score + ', the first scored ' + g.first + ').'); }
  if (b.formula.last) { const f = s.formula; out.push('Formula: it evolved ' + f.gen + ' generation' + (f.gen === 1 ? '' : 's') + ' of formulas for how its own tissue changes, now ' + f.rule + ' (n is the life around a place, s its food); on changes it had not seen it ' + (f.said > 0 ? 'beat "nothing changes" by ' + Math.round(f.said * 100) + '%.' : 'did not yet beat "nothing changes".')); }
  if (b.current.lives) { const c = s.current; out.push('Current: ' + c.lives + ' li' + (c.lives === 1 ? 'fe' : 'ves') + ' of swimmers whose tiny networks evolve to ride a lattice-Boltzmann flow your drag stirs; ' + (c.gain == null ? 'not yet enough lives to compare with drifters in the same flow' : c.gain > 1 ? 'they gather ' + c.gain.toFixed(1) + ' times the life of drifters in the same flow' : 'they do not yet gather more life than drifters in the same flow') + (c.growth == null ? '.' : c.growth > 1 ? ', and ' + Math.round((c.growth - 1) * 100) + '% more than their first lives.' : ', and not yet more than their first lives.')); }
  if (b.grains.bed.lives) { const g = s.grains; out.push('Grains: ' + g.lives + ' li' + (g.lives === 1 ? 'fe' : 'ves') + ' of grains thrown toward where the focus has been, that pass their bounce and grip on where they touch, from the grain that lands nearer; ' + (g.gain == null ? 'not yet enough lives to compare with grains that pass them at random.' : g.gain > 1 ? 'they land ' + g.gain.toFixed(1) + ' times nearer than grains that pass them at random.' : 'they do not yet land nearer than grains that pass them at random.')); }
  if (b.gardener.blinks) { const g = s.gardener; out.push('Gardener: ' + g.inBand + ' of ' + GARDEN_TILES + ' patches at the edge of chaos (' + g.classes.dead + ' too still, ' + g.classes.noise + ' too wild); it tended them ' + g.thoughts + ' time' + (g.thoughts === 1 ? '' : 's') + '.'); }
  if (b.synapses.spikes) out.push('Eye: ' + s.eye.spikes + ' spikes; its same-side wiring is ' + Math.round(s.eye.wiring * 100) + '% (it starts at 0 and grows as dopamine finds living tissue).');
  if (b.senses.felt) out.push('Feels ' + b.senses.felt + ' memor' + (b.senses.felt === 1 ? 'y' : 'ies') + ' from other cards in the shared field.');
  out.push('Remembers ' + s.episodes + ' moment' + (s.episodes === 1 ? '' : 's') + ' and ' + s.procedures + ' winning genome' + (s.procedures === 1 ? '' : 's') + '.');
  if (s.starved) out.push('Under-used: ' + s.starved + '.');
  if (s.owner.top) out.push('Most of the workspace was last written by ' + s.owner.top + ' (' + Math.round(s.owner.share * 100) + '%).');
  out.push('Genome ' + s.genome.seal + ', generation ' + s.genome.gen + '.');
  return out;
}

/** the card's settings and numbers for a seal (numbers only, never the visitor's path or words). */
export function params(b) { return { v: VERSION, genome: Object.fromEntries(Object.entries(b.genome).map(([k, v]) => [k, Math.round(v * 10000) / 10000])), gen: b.arena.gen, concepts: b.concepts.words.length, motifs: b.gestures.motifs.length, q: Array.from(b.will.q, (v) => Math.round(v * 100) / 100), episodes: b.mind.episodes.length, procedures: b.mind.procedures.length, paint: b.painter.pop[b.painter.champ].slice(), pref: Array.from(b.mind.pref, (v) => Math.round(v * 100) / 100) }; }
export { ACTIONS, LETTERS, gestureName, sealSlice, GW, GH, ORGANS, ORGAN_IDS };
