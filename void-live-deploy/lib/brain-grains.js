// brain-grains, Verse Brain's grains: grains thrown toward where the brain's focus has been, that bounce and slide by their own genes
// and pass those genes on when they touch, from F456 (granular contact gene transfer, atomeam/a-to-mind.com drafts/). Owner, 2026-10-29:
// "combine all the builds into one entity", "dont fake it". F456's idea: a pile of grains (the discrete element method: discs with a
// spring and a damper where they overlap, and Coulomb friction along the contact) where each grain carries genes, and a gene passes
// from one grain to another where they touch. Here:
//   1. the bed: a side view of the field along the focus's row. NG discs of radius R fall under gravity, push on each other by a spring
//      and dashpot (the dashpot set by the pair's restitution) and slide on each other with Coulomb friction (the pair's grip).
//   2. the genes: each grain has two, its bounce (restitution e, 0..EMAX) and its grip (friction mu, 0..1). They decide how far a thrown
//      grain travels before it settles: a lively grain bounces on, a gripping grain stops.
//   3. a life: the aim is a slow average of the focus (it moves where you move the focus, slowly). One grain at a time (every GAP
//      steps) is poured at the wall farther from the aim and thrown toward it. It lives until it settles (still for STILL steps) or
//      ages out. Its fitness is its record: how near its recent lives settled to the aim they were thrown at (minus the distance).
//   4. the transfer: where two grains touch, now and then (TOUCH a contact step) the gene passes, nudged a little, from the grain with
//      the better record to the one with the worse record, and the receiver's record starts again. Nothing else selects: no grain
//      dies for its fitness.
//   5. the control: a second bed of the same grains, poured and thrown the same way, where the gene passes in a random direction on
//      touch. The two beds differ only in which way the gene goes, so the control's error over the organ's error is what fitness on
//      contact adds.
//   Grains that land near the aim, once the organ lands nearer than its control, leave a little life where they land, on the focus's
//   row (the input layer).
// Pure: no DOM, no clock, no Math.random (a seeded generator).
import { clamp, rng } from './field-kit.js';
import { deposit } from './brain-workspace.js';

export const NG = 60, SUB = 20, EVERY = 5, EMAX = 0.9, AIM = 0.002;
const H = 0.3, R = 0.012, DT = 0.004, G = 9.8 * 0.15, KN = 4000, THROW = 0.5, TOUCH = 0.2, NUDGE = 0.05, MARGIN = 0.02, STILL = 30, OLD = 3000, GAP = 40, FIT = 0.5, KEEP = 100, NEAR = 0.06;
const r3 = (v) => Math.round(v * 1000) / 1000;
const mean = (v) => (v.length ? v.reduce((a, x) => a + x, 0) / v.length : null);

/** a bed of NG grains with random genes, none poured yet. mode: 'fit' (the gene passes from the nearer lander), 'random' (either way)
 *  or 'none' (it never passes). */
export function makeBed(seed, mode = 'fit') {
  const r = rng(seed * 7919 + 17), g = [];
  for (let i = 0; i < NG; i++) g.push({ x: 0, y: 0, vx: 0, vy: 0, e: r() * EMAX, mu: r(), fit: -1, aim: 0.5, age: 0, still: 0, live: false });
  return { r, g, mode, t: 0, next: 0, lives: 0, errs: [], lands: [], transfers: 0 };
}
/** the same genes in a second bed with its own generator: the control is poured from the same start. */
export function twinBed(B, seed, mode) {
  const T = makeBed(seed * 31 + 5, mode);
  T.g.forEach((p, i) => { p.e = B.g[i].e; p.mu = B.g[i].mu; });
  return T;
}
const spawn = (B, p, pour, target) => { const r = B.r; p.x = clamp(pour + (r() - 0.5) * 0.02, R, 1 - R); p.y = H - 0.03; p.vx = Math.sign(target - pour || 1) * (THROW + (r() - 0.5) * 0.1); p.vy = 0; p.age = 0; p.still = 0; p.live = true; p.aim = target; };
const pass = (B, from, to) => { const r = B.r; to.e = clamp(from.e + (r() - 0.5) * NUDGE, 0, EMAX); to.mu = clamp(from.mu + (r() - 0.5) * NUDGE, 0, 1); to.fit = -1; B.transfers++; }; // new genes: no record yet

/** one step of a bed: pour any grain due, gravity, contacts (with the gene passing on touch), the floor and walls, then the settled grains
 *  end their lives. pour and target are x in 0..1. Returns the lives that ended this step, as { x, err }. */
export function stepBed(B, pour, target) {
  const g = B.g, r = B.r, out = []; B.t++;
  if (B.t >= B.next) { const p = g.find((q) => !q.live); if (p) { spawn(B, p, pour, target); B.next = B.t + GAP; } } // one grain at a time from the spout
  const L = g.filter((p) => p.live);
  for (const p of L) p.vy -= G * DT;
  for (let a = 0; a < L.length; a++) for (let c = a + 1; c < L.length; c++) {
    const p = L[a], q = L[c], dx = q.x - p.x, dy = q.y - p.y, d2 = dx * dx + dy * dy;
    if (d2 >= 4 * R * R || d2 === 0) continue;
    const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, ov = 2 * R - d, rvx = q.vx - p.vx, rvy = q.vy - p.vy, vn = rvx * nx + rvy * ny, e = (p.e + q.e) / 2, mu = (p.mu + q.mu) / 2;
    const fn = Math.max(0, KN * ov - 2 * (1 - e) * Math.sqrt(KN) * vn), tx = -ny, ty = nx, vt = rvx * tx + rvy * ty, ft = -Math.sign(vt) * Math.min(mu * fn, (Math.abs(vt) / DT) * 0.5);
    const fx = -fn * nx + ft * tx, fy = -fn * ny + ft * ty; p.vx += fx * DT; p.vy += fy * DT; q.vx -= fx * DT; q.vy -= fy * DT;
    if (B.mode !== 'none' && fn > 0 && r() < TOUCH) { // they touch: the gene passes
      if (B.mode === 'fit') { if (p.fit > q.fit + MARGIN) pass(B, p, q); else if (q.fit > p.fit + MARGIN) pass(B, q, p); }
      else if (r() < 0.5) pass(B, p, q); else pass(B, q, p);
    }
  }
  for (const p of L) { // the floor and the walls, by the grain's own bounce and grip
    if (p.y < R) { p.y = R; if (p.vy < 0) p.vy = -p.vy * p.e; p.vx -= Math.sign(p.vx) * Math.min(Math.abs(p.vx), p.mu * G * DT); } // Coulomb: it slows by mu g
    if (p.x < R) { p.x = R; p.vx = Math.abs(p.vx) * p.e; }
    if (p.x > 1 - R) { p.x = 1 - R; p.vx = -Math.abs(p.vx) * p.e; }
    p.x += p.vx * DT; p.y += p.vy * DT; p.age++;
    p.still = Math.hypot(p.vx, p.vy) < 0.01 ? p.still + 1 : 0;
    if (p.still > STILL || p.age > OLD) {
      const err = Math.abs(p.x - p.aim); p.fit = p.fit === -1 ? -err : FIT * p.fit - (1 - FIT) * err; p.live = false; B.lives++; // its record: recent lives weigh most
      B.errs.push(err); if (B.errs.length > KEEP) B.errs.shift(); B.lands.push(p.x); if (B.lands.length > 10) B.lands.shift();
      out.push({ x: p.x, err });
    }
  }
  return out;
}
/** the mean distance from the aim where the last (up to KEEP) grains landed. Pure. */
export const errOf = (B) => mean(B.errs);

/** the organ's bed and its control. */
export function makeGrains(seed) {
  const bed = makeBed(seed, 'fit');
  return { bed, ctl: twinBed(bed, seed, 'random'), aim: 0.5, since: EVERY - 2, fed: 0, runs: 0 };
}
/** how many times nearer the aim the organ's grains land than the control's (the control's error over the organ's), null before both
 *  have KEEP lives. Pure. */
export function gainOf(S) {
  if (S.bed.errs.length < KEEP || S.ctl.errs.length < KEEP) return null;
  const a = errOf(S.bed), c = errOf(S.ctl);
  return a > 1e-6 ? c / a : 2;
}
/** the aim follows the focus's x slowly; returns where the grains are poured: by the wall farther from the aim. */
export function steer(S, fx) { S.aim += (clamp(fx, 0, 1) - S.aim) * AIM; return S.aim < 0.5 ? 0.95 : 0.05; }

/** the genes as plain numbers for slow knowledge (lib/brain-mind.js knowledgeOf). Pure. */
export const genesOf = (S) => ({ e: S.bed.g.map((p) => r3(p.e)), mu: S.bed.g.map((p) => r3(p.mu)), lives: S.bed.lives });
/** load kept genes into both beds (so the control starts where the organ starts); anything that is not NG bounces in 0..EMAX, NG grips in
 *  0..1 and a whole count of lives is refused and changes nothing. Returns true when loaded. */
export function loadGenes(S, k) {
  const ok = (v, hi) => Array.isArray(v) && v.length === NG && v.every((x) => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= hi);
  if (!k || !ok(k.e, EMAX) || !ok(k.mu, 1) || !(Number.isInteger(k.lives) && k.lives >= 0)) return false;
  for (const B of [S.bed, S.ctl]) B.g.forEach((p, i) => { p.e = k.e[i]; p.mu = k.mu[i]; });
  S.bed.lives = k.lives;
  return true;
}
/** the grains' numbers for the self. Pure. */
export function grainsOf(S) {
  const g = gainOf(S), a = errOf(S.bed), c = errOf(S.ctl);
  return { lives: S.bed.lives, aim: r3(S.aim), gain: g == null ? null : r3(g), err: a == null ? null : r3(a), control: c == null ? null : r3(c), transfers: S.bed.transfers, bounce: r3(mean(S.bed.g.map((p) => p.e))), grip: r3(mean(S.bed.g.map((p) => p.mu))), fed: S.fed };
}

export const grains = {
  id: 'grains', name: 'Grains', job: 'grains thrown toward where the focus has been, that pass their bounce and grip on where they touch, from the grain that lands nearer',
  want: (b) => (b.grains.since >= EVERY ? 0.45 : 0.02),
  run(b) {
    const S = b.grains; // S.since counts ticks in stepBrain (lib/brain.js)
    if (S.since < EVERY) return 0;
    S.since = 0; S.runs++;
    const pour = steer(S, b.focus.x), target = S.aim, ahead = gainOf(S) > 1;
    for (let n = 0; n < SUB; n++) {
      stepBed(S.ctl, pour, target);
      for (const l of stepBed(S.bed, pour, target)) if (ahead && l.err < NEAR) { deposit(b.ws, 'input', l.x, b.focus.y, 0.03, 1, 'grains'); S.fed++; }
    }
    const land = mean(S.bed.lands);
    b.board.grains = { x: land == null ? target : land, y: b.focus.y, gain: gainOf(S), lives: S.bed.lives, tick: b.ticks };
    return 1;
  }
};
