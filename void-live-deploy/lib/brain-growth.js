// brain-growth, Verse Brain's growth: diffusion-limited aggregation (DLA) that grows where the visitor points, with a growth rule found by an
// evolutionary search, from the DLA draft (atomeam/a-to-mind.com drafts/F603-webgpu-dla-evo-growth-mind). Owner, 2026-10-29: "combine all
// the builds into one entity", "dont fake it". The draft's idea as written: random walkers diffuse on a lattice until they stick to a cluster,
// with a stick probability; the pointer seeds the cluster and injects walkers; a local evolutionary strategy over a small genome (diffusion,
// stick probability, noise) selects for a fitness. The draft measured nothing against a fixed rule. Here:
//   1. the trail: each tick of the pointer over the brain marks its cell on an N x N lattice; the trail is the cells of the last TRAIL
//      ticks with a pointer (lib/brain.js stepBrain calls growthTick each tick, run or not, as it calls reflexTick).
//   2. the growth: a lattice with one seed cell (the oldest cell of the trail). K walkers are launched, one at a time. A walker starts on a
//      trail cell with probability `launch`, else on any cell. Each step it moves one cell toward a trail cell picked at its launch with
//      probability `drift`, else one cell in a random direction. Next to the aggregate, it sticks with probability `stick`, else walks on. A
//      walker that walks WALK steps without sticking is lost. This is DLA (walkers that diffuse and stick); stick 1, drift 0, launch 0 is
//      the classic rule.
//   3. the score of a growth: the share of trail cells that have an aggregate cell next to them or on them, after K walkers. So a rule
//      scores high when its K walkers cover where the visitor pointed, and walkers lost or stuck elsewhere are wasted.
//   4. the search: a (1+1) evolutionary strategy over the genome [stick, drift, launch]. Each round takes a snapshot of the trail and grows
//      three aggregates on it, each with its own random walkers: the elite, a mutant of the elite, and one of the 8 fixed rules (the corners
//      stick 0.25 or 1, drift 0 or 0.5, launch 0 or 1, the classic rule among them), in turn. The mutant takes the elite's place when it
//      scores at least as high in the same round. At most STEPS walker steps are spent each tick, so a round takes several ticks.
//   5. the gain is the elite's mean score over its last WINDOW rounds against the best fixed rule's mean over its last FIXED rounds. Only
//      while the gain is over 1 does the elite's aggregate show on the brain map and leave a little life in the input layer.
//   Measured (tools/brain-growth.test.mjs, 4 visitors, 3 seeds, 3000 ticks): see that file's header.
// The pointer stays on the visitor's device: only the evolved genome is kept, in the brain's own knowledge (lib/brain-mind.js).
// Pure: no DOM, no clock, no Math.random (a seeded generator).
import { clamp, rng } from './field-kit.js';
import { deposit } from './brain-workspace.js';

export const N = 32, K = 40, WALK = 150, STEPS = 600, TRAIL = 300, WINDOW = 20, FIXED = 8, SIGMA = 0.15, MIN_ROUNDS = 16;
export const FIXED_RULES = [0.25, 1].flatMap((s) => [0, 0.5].flatMap((d) => [0, 1].map((l) => [s, d, l]))); // [stick, drift, launch]
export const CLASSIC_RULE = 4; // FIXED_RULES[4] is stick 1, drift 0, launch 0: classic DLA
const r3 = (v) => Math.round(v * 1000) / 1000 || 0;
const mean = (v) => (v && v.length ? v.reduce((a, x) => a + x, 0) / v.length : null);
const keep = (arr, v, n) => { arr.push(v); if (arr.length > n) arr.shift(); };
const fit = (g) => [clamp(g[0], 0.05, 1), clamp(g[1], 0, 1), clamp(g[2], 0, 1)];
const cellOf = (x, y) => clamp(Math.floor(y * N), 0, N - 1) * N + clamp(Math.floor(x * N), 0, N - 1);

/** a growth organ with a random genome. */
export function makeGrowth(seed = 1) {
  const r = rng((seed * 2246822519) ^ 0x6d1a);
  const g = fit([0.05 + 0.95 * r(), r(), r()]);
  return { r, g, g0: g.slice(), trail: [], ticks: 0, rounds: 0, kept: 0, job: null, queue: [], snap: null, mine: [], fixedAt: 0,
    scores: { elite: [], fixed: FIXED_RULES.map(() => []) }, last: null, shown: null, posted: 0, fed: 0 };
}

// ---- one growth -----------------------------------------------------------------------------------------------------------------------
/** a fresh growth job of genome g on trail cells `cells` (oldest first). */
function startJob(who, g, cells, seed) {
  const grid = new Uint8Array(N * N); grid[cells[0]] = 1;
  return { who, g, grid, launched: 0, walker: null, stuck: 1, r: rng(seed) };
}
const near = (grid, i) => { const x = i % N, y = (i / N) | 0; return (x > 0 && grid[i - 1]) || (x < N - 1 && grid[i + 1]) || (y > 0 && grid[i - N]) || (y < N - 1 && grid[i + N]); };
/** spend up to `budget` walker steps on job J; returns the steps spent. Pure on J (and the generator r). */
export function growSteps(J, cells, r, budget) {
  let spent = 0; const [stick, drift, launch] = J.g;
  while (spent < budget && (J.walker || J.launched < K)) {
    if (!J.walker) {
      const at = r() < launch ? cells[r.int(cells.length)] : r.int(N * N); J.launched++;
      if (J.grid[at]) continue; // it starts inside the aggregate: lost
      J.walker = { i: at, to: cells[r.int(cells.length)], n: 0 };
    }
    const w = J.walker; spent++; w.n++;
    let x = w.i % N, y = (w.i / N) | 0;
    if (r() < drift) { const tx = w.to % N, ty = (w.to / N) | 0, dx = tx - x, dy = ty - y; if (Math.abs(dx) >= Math.abs(dy) && dx) x += Math.sign(dx); else if (dy) y += Math.sign(dy); }
    else { const k = r.int(4); if (k === 0) x++; else if (k === 1) x--; else if (k === 2) y++; else y--; }
    x = clamp(x, 0, N - 1); y = clamp(y, 0, N - 1); const i = y * N + x;
    if (J.grid[i]) { /* it walked into the aggregate: it stays where it was */ }
    else { w.i = i; if (near(J.grid, i) && r() < stick) { J.grid[i] = 1; J.stuck++; J.walker = null; continue; } }
    if (w.n >= WALK) J.walker = null;
  }
  return spent;
}
/** the share of trail cells with an aggregate cell on them or next to them (8 neighbours). Pure. */
export function coverOf(grid, cells) {
  let c = 0;
  for (const i of cells) {
    const x = i % N, y = (i / N) | 0; let hit = false;
    for (let dy = -1; dy <= 1 && !hit; dy++) for (let dx = -1; dx <= 1 && !hit; dx++) { const u = x + dx, v = y + dy; if (u >= 0 && v >= 0 && u < N && v < N && grid[v * N + u]) hit = true; }
    if (hit) c++;
  }
  return cells.length ? c / cells.length : 0;
}

// ---- the search -----------------------------------------------------------------------------------------------------------------------
const mutate = (g, r) => fit(g.map((v) => v + SIGMA * r.gauss()));
function finish(G, J) {
  const s = coverOf(J.grid, G.snap);
  if (J.who === 'elite') { G.round.elite = s; keep(G.scores.elite, s, WINDOW); G.last = J.grid; }
  else if (J.who === 'mutant') G.round.mutant = s;
  else keep(G.scores.fixed[J.who], s, FIXED);
  if (!G.queue.length) { // the round is over: the mutant takes the elite's place when it scored at least as high in the same round
    keep(G.mine, G.round.elite, WINDOW);
    if (G.round.mutant > mean(G.mine)) { G.g = G.round.m; G.kept++; G.mine = [G.round.mutant]; }
    G.rounds++; G.snap = null;
  }
}
/** each tick: mark the pointer's cell, and spend at most STEPS walker steps on the current round. Pure on G. */
export function growthTick(G, input = {}) {
  if (!input.over) return;
  keep(G.trail, cellOf(clamp(+input.x || 0, 0, 1), clamp(+input.y || 0, 0, 1)), TRAIL); G.ticks++;
  let budget = STEPS;
  while (budget > 0) {
    if (!G.snap) {
      G.snap = [...new Set(G.trail)]; const m = mutate(G.g, G.r), f = G.fixedAt++ % FIXED_RULES.length;
      G.round = { m, elite: 0, mutant: 0, seed: 1 + G.r.int(2147483646) }; G.queue = [['elite', G.g], ['mutant', m], [f, FIXED_RULES[f]]];
    }
    if (!G.job) { const [who, g] = G.queue.shift(); G.job = startJob(who, g, G.snap, G.round.seed); }
    budget -= growSteps(G.job, G.snap, G.job.r, budget);
    if (!G.job.walker && G.job.launched >= K) { const J = G.job; G.job = null; finish(G, J); }
  }
}

/** the elite's mean score over the best fixed rule's, each on its last rounds; null before MIN_ROUNDS. Pure. */
export function gainOf(G) {
  if (G.rounds < MIN_ROUNDS || G.scores.fixed.some((s) => !s.length)) return null;
  const e = mean(G.scores.elite), best = Math.max(...G.scores.fixed.map(mean));
  return best > 0 ? r3(e / best) : null;
}
/** the numbers the self, the map and the tests read. Pure. */
export function growthOf(G) {
  const fx = G.scores.fixed.map(mean), ok = fx.every((v) => v != null), bi = ok ? fx.indexOf(Math.max(...fx)) : -1;
  return { ticks: G.ticks, rounds: G.rounds, kept: G.kept, genome: G.g.map(r3), elite: G.scores.elite.length ? r3(mean(G.scores.elite)) : null,
    fixed: bi >= 0 ? r3(fx[bi]) : null, rule: bi >= 0 ? FIXED_RULES[bi] : null, classic: fx[CLASSIC_RULE] != null ? r3(fx[CLASSIC_RULE]) : null, gain: gainOf(G),
    trail: new Set(G.trail).size, cells: G.last ? G.last.reduce((a, v) => a + v, 0) : 0, fed: G.fed };
}

// ---- kept knowledge -------------------------------------------------------------------------------------------------------------------
/** the genome to keep: only the evolved rule (the draft's seal), never the trail. Pure. */
export const genomeOf = (G) => ({ g: G.g.map(r3), rounds: G.rounds });
/** restore a kept genome; a wrong record changes nothing. Returns whether it loaded. Pure on G. */
export function loadGenome(G, k) {
  if (!k || !Array.isArray(k.g) || k.g.length !== 3 || !k.g.every((v) => Number.isFinite(v) && v >= 0 && v <= 1)) return false;
  G.g = fit(k.g); G.was = Math.max(0, Math.floor(+k.rounds || 0)); return true;
}

export const growth = {
  id: 'growth', name: 'Growth', job: 'diffusion-limited aggregation that grows where you point, with a growth rule found by evolution',
  // it grows and evolves every tick in growthTick whether it runs or not; it asks for a run only to act, while its rule beats the best
  // fixed rule and there is a new round: a rule a fixed one beats takes no tick from the other organs
  rests: (b) => b.growth.rounds === b.growth.posted || !(gainOf(b.growth) > 1) || !b.growth.last,
  want: () => 0.25,
  run(b) {
    const G = b.growth, g = gainOf(G); G.posted = G.rounds;
    let sx = 0, sy = 0, n = 0;
    for (let i = 0; i < G.last.length; i++) if (G.last[i]) { const x = ((i % N) + 0.5) / N, y = (((i / N) | 0) + 0.5) / N; sx += x; sy += y; n++; if (g > 1 && n % 4 === 1) deposit(b.ws, 'input', x, y, 0.015, 1, 'growth'); }
    if (g > 1) G.fed++;
    b.board.growth = { x: n ? sx / n : 0.5, y: n ? sy / n : 0.5, live: g > 1, gain: g, tick: b.ticks, cells: n };
    return 1;
  }
};
