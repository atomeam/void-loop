// brain-reflex, Verse Brain's reflex: a tiny network that pushes three bodies after the visitor's pointer and learns how to push, online, from
// what each push did, from the tiny MLP drafts (atomeam/a-to-mind.com drafts/: F189, F221, F226, F461 and the other drafts whose own name
// says MLP). Owner, 2026-10-29: "combine all the builds into one entity", "dont fake it". The drafts' idea (F189 and F461 as written): a
// tiny multilayer perceptron (4 -> 6 -> 2 in F189, 6 -> 12 -> 3 in F461) reads the tilt, the gaze or the pointer and outputs a push on a
// body (a DOM card); F461 pulls its weights toward a reward when a card comes near the gaze; F189 keeps the weights, sealed. Nothing in the
// drafts measured whether the network pushed better than a plain spring. Here:
//   1. the bodies: NB bodies with a place and a speed. Each tick a body's speed takes its push and the tilt's gravity, loses DAMP of
//      itself, and moves the body; a wall stops it. The target is the visitor's pointer, while it is over the brain (lib/brain.js stepBrain
//      calls reflexTick each tick, run or not, as it calls sampleStroke). With no pointer over the brain the bodies stand still.
//   2. the network: IN = 6 senses (where the target is from the body, the body's speed less the target's, the tilt), HID = 10 hidden tanh
//      units, 2 outputs: the push, at most AMAX each way. It starts small and random (a seeded generator).
//   3. learning, through the body: after each push the network learns by one gradient step. Its loss: how far the body will be from where
//      the target will be AHEAD ticks on, if the body coasts from here and the target keeps its speed, plus NEXT times how far the body is
//      from where the target will be next tick. The body's next place and speed are linear in the push, so the gradient of that loss with
//      respect to the push is exact (the wall aside), and backpropagation takes it to every weight. No spring, no controller and no reward
//      table is given to it.
//   4. the rivals, run beside it on the same target from the same places: the same bodies with no push, the same bodies pushed by the
//      network as it started and never learning (the drafts' network as F189 runs it, random), and the same bodies pushed by a
//      damped spring (push = k (target - place) - c speed, capped like the network's) for each (k, c) of a 3 x 3 grid, and the same 9 again
//      as springs that also know the target's speed (push = k (target + its speed - place) - c (speed - its speed)). Each tick, before
//      anything moves, each set of bodies is scored by its mean distance to where the target is now, so each is scored on where last
//      tick's push took it; none of them is told where the target went.
//   5. the gain is the best of the 18 springs' distance over the network's, on the last WINDOW ticks with a pointer. Only while the gain is
//      over 1 do the network's bodies show on the brain map and leave a little life in the input layer where they are.
//   Measured (tools/brain-reflex.test.mjs, 4 visitors, 3 seeds, 4000 ticks, the last 200 scored): see that file's header.
// The pointer stays on the visitor's device: only the network's weights are kept, in the brain's own knowledge (lib/brain-mind.js).
// Pure: no DOM, no clock, no Math.random (a seeded generator).
import { clamp, rng } from './field-kit.js';
import { deposit } from './brain-workspace.js';

export const NB = 3, IN = 6, HID = 10, OUT = 2, AMAX = 0.004, DAMP = 0.9, GRAV = 0.0012, AHEAD = 6, LR = 0.01, NEXT = 3, WINDOW = 200, MIN_TICKS = 100;
export const GENES = HID * IN + HID + OUT * HID + OUT; // 92 numbers a network
export const SPRINGS = [0, 1].flatMap((m) => [0.05, 0.15, 0.4].flatMap((k) => [0.1, 0.3, 0.6].map((c) => [k, c, m]))); // m 1: it also knows the target's speed
const SX = 40, SV = 300, S2 = 0.05 * 0.05; // input scales: a place difference of 0.025 and a speed difference of 0.0033 read as 1; the loss's unit
const COAST = (() => { let c = 0, d = 1; for (let t = 0; t < AHEAD; t++) { d *= DAMP; c += d; } return c; })(); // how far a speed of 1 coasts in AHEAD ticks
const START = [[0.35, 0.5], [0.5, 0.35], [0.65, 0.6]];
const r3 = (v) => Math.round(v * 1000) / 1000 || 0, r4 = (v) => Math.round(v * 10000) / 10000 || 0; // never -0: it does not survive JSON
const mean = (v) => (v.length ? v.reduce((a, x) => a + x, 0) / v.length : null);
const keep = (arr, v) => { arr.push(v); if (arr.length > WINDOW) arr.shift(); };
const bodies = () => START.map(([x, y]) => ({ x, y, vx: 0, vy: 0 }));

/** a reflex with a fresh network. */
export function makeReflex(seed = 1) {
  const r = rng((seed * 2654435761) ^ 0x5eed);
  const w = Float64Array.from({ length: GENES }, (_, k) => (r() - 0.5) * (k < HID * IN ? 0.6 : k < HID * IN + HID ? 0 : k < GENES - OUT ? 0.2 : 0));
  return { w, w0: Float64Array.from(w), net: bodies(), none: bodies(), still: bodies(), springs: SPRINGS.map(() => bodies()), at: null, tv: [0, 0], ticks: 0, steps: 0, loss: 0,
    dist: { net: [], none: [], still: [], springs: SPRINGS.map(() => []) }, posted: 0, fed: 0 };
}

// ---- the network ----------------------------------------------------------------------------------------------------------------------
/** the senses of a body chasing target t (moving at tv), with tilt g. Pure. */
export const senseOf = (p, t, tv, g) => [(t[0] - p.x) * SX, (t[1] - p.y) * SX, (p.vx - tv[0]) * SV, (p.vy - tv[1]) * SV, g[0], g[1]];
/** the network's push for senses s, and what backpropagation needs: { a: [ax, ay], h, o }. Pure. */
export function think(w, s) {
  const h = new Array(HID), o = new Array(OUT), B1 = HID * IN, W2 = B1 + HID, B2 = W2 + OUT * HID;
  for (let j = 0; j < HID; j++) { let z = w[B1 + j]; for (let i = 0; i < IN; i++) z += w[j * IN + i] * s[i]; h[j] = Math.tanh(z); }
  for (let k = 0; k < OUT; k++) { let z = w[B2 + k]; for (let j = 0; j < HID; j++) z += w[W2 + k * HID + j] * h[j]; o[k] = Math.tanh(z); }
  return { a: [o[0] * AMAX, o[1] * AMAX], h, o };
}
/** one gradient step: dLa is the gradient of the loss with respect to the push. Pure on w. */
export function learn(w, s, f, dLa, lr = LR) {
  const B1 = HID * IN, W2 = B1 + HID, B2 = W2 + OUT * HID, dz = f.o.map((o, k) => dLa[k] * AMAX * (1 - o * o)), dh = new Array(HID).fill(0);
  for (let k = 0; k < OUT; k++) { w[B2 + k] -= lr * dz[k]; for (let j = 0; j < HID; j++) { dh[j] += dz[k] * w[W2 + k * HID + j]; w[W2 + k * HID + j] -= lr * dz[k] * f.h[j]; } }
  for (let j = 0; j < HID; j++) { const d = dh[j] * (1 - f.h[j] * f.h[j]); w[B1 + j] -= lr * d; for (let i = 0; i < IN; i++) w[j * IN + i] -= lr * d * s[i]; }
}

// ---- the bodies -----------------------------------------------------------------------------------------------------------------------
const cap = (a) => [clamp(a[0], -AMAX, AMAX), clamp(a[1], -AMAX, AMAX)];
/** one tick of a body under push a and gravity g. Pure on p. */
export function move(p, a, g) {
  p.vx = (p.vx + a[0] + g[0] * GRAV) * DAMP; p.vy = (p.vy + a[1] + g[1] * GRAV) * DAMP; p.x += p.vx; p.y += p.vy;
  if (p.x < 0 || p.x > 1) { p.x = clamp(p.x, 0, 1); p.vx = 0; } if (p.y < 0 || p.y > 1) { p.y = clamp(p.y, 0, 1); p.vy = 0; }
}
const distOf = (B, t) => mean(B.map((p) => Math.hypot(p.x - t[0], p.y - t[1])));
const springPush = (p, t, tv, k, c, m) => cap([k * (t[0] + m * tv[0] - p.x) - c * (p.vx - m * tv[0]), k * (t[1] + m * tv[1] - p.y) - c * (p.vy - m * tv[1])]);

/** each tick of the pointer, run or not: push every set of bodies after it, score them, and let the network learn. Pure on R. */
export function reflexTick(R, input = {}) {
  if (!input.over) { R.at = null; return; }
  const t = [clamp(+input.x || 0, 0, 1), clamp(+input.y || 0, 0, 1)], g = [clamp(+input.tiltX || 0, -1, 1), clamp(+input.tiltY || 0, -1, 1)];
  const tv = R.at ? [t[0] - R.at[0], t[1] - R.at[1]] : [0, 0];
  // the score first: where each set of bodies got to with last tick's push, against where the target is now (none was told where it went)
  if (R.at) { keep(R.dist.net, distOf(R.net, t)); keep(R.dist.none, distOf(R.none, t)); keep(R.dist.still, distOf(R.still, t)); R.springs.forEach((B, i) => keep(R.dist.springs[i], distOf(B, t))); }
  R.at = t; R.tv = tv; R.ticks++;
  const ahead = [t[0] + tv[0] * AHEAD, t[1] + tv[1] * AHEAD]; let loss = 0;
  for (const p of R.net) {
    const s = senseOf(p, t, tv, g), f = think(R.w, s); move(p, f.a, g);
    // where the body will be AHEAD ticks on if it coasts from here: place + speed COAST; both are linear in the push, with slope DAMP (1 + COAST)
    // and where it is next tick against where the target will be then: both linear in the push (slopes DAMP (1 + COAST) and DAMP)
    const ex = p.x + p.vx * COAST - ahead[0], ey = p.y + p.vy * COAST - ahead[1], slope = DAMP * (1 + COAST);
    const nx = p.x - t[0] - tv[0], ny = p.y - t[1] - tv[1];
    loss += (ex * ex + ey * ey + NEXT * (nx * nx + ny * ny)) / S2;
    learn(R.w, s, f, [(2 * (ex * slope + NEXT * nx * DAMP)) / S2, (2 * (ey * slope + NEXT * ny * DAMP)) / S2]);
  }
  for (const p of R.none) move(p, [0, 0], g);
  for (const p of R.still) move(p, think(R.w0, senseOf(p, t, tv, g)).a, g); // the drafts' network as F189 runs it: random, never learning
  R.springs.forEach((B, i) => { for (const p of B) move(p, springPush(p, t, tv, SPRINGS[i][0], SPRINGS[i][1], SPRINGS[i][2]), g); });
  R.loss = loss / NB; R.steps++;
}

/** the best spring's mean distance over the network's, on the last WINDOW ticks; null before MIN_TICKS. Pure. */
export function gainOf(R) {
  if (R.dist.net.length < Math.min(WINDOW, MIN_TICKS)) return null;
  const net = mean(R.dist.net), best = Math.min(...R.dist.springs.map(mean));
  return net > 0 ? r3(best / net) : null;
}
/** the numbers the self, the map and the tests read. Pure. */
export function reflexOf(R) {
  const sp = R.dist.springs.map(mean), bi = sp.length && sp[0] != null ? sp.indexOf(Math.min(...sp)) : -1;
  return { ticks: R.ticks, steps: R.steps, net: R.dist.net.length ? r4(mean(R.dist.net)) : null, none: R.dist.none.length ? r4(mean(R.dist.none)) : null, unlearned: R.dist.still.length ? r4(mean(R.dist.still)) : null,
    spring: bi >= 0 ? r4(sp[bi]) : null, k: bi >= 0 ? SPRINGS[bi][0] : null, c: bi >= 0 ? SPRINGS[bi][1] : null, lead: bi >= 0 ? SPRINGS[bi][2] === 1 : null, gain: gainOf(R), loss: r3(R.loss),
    bodies: R.net.map((p) => [r3(p.x), r3(p.y)]), fed: R.fed };
}

// ---- kept knowledge -------------------------------------------------------------------------------------------------------------------
/** the network to keep: only its weights (the drafts' seal), never the pointer. Pure. */
export const netOf = (R) => ({ w: Array.from(R.w, r4), steps: R.steps });
/** restore a kept network; a wrong record changes nothing. Returns whether it loaded. Pure on R. */
export function loadNet(R, k) {
  if (!k || !Array.isArray(k.w) || k.w.length !== GENES || !k.w.every((v) => Number.isFinite(v) && Math.abs(v) < 100)) return false;
  R.w = Float64Array.from(k.w); R.steps = Math.max(0, Math.floor(+k.steps || 0)); return true;
}

export const reflex = {
  id: 'reflex', name: 'Reflex', job: 'a tiny network that pushes three bodies after your pointer and learns how to push from what each push did',
  // it learns every tick in reflexTick whether it runs or not; it asks for a run only to act, while it is closer than the best spring and
  // there is a new tick of the pointer: a network a spring beats takes no tick from the other organs (scheduleTick skips one that rests)
  rests: (b) => b.reflex.ticks === b.reflex.posted || !(gainOf(b.reflex) > 1),
  want: () => 0.3,
  run(b) {
    const R = b.reflex, g = gainOf(R); R.posted = R.ticks; // fed every tick by reflexTick in stepBrain (lib/brain.js)
    const lead = R.net[0];
    if (g > 1) { for (const p of R.net) deposit(b.ws, 'input', p.x, p.y, 0.02, 1.2, 'reflex'); R.fed++; }
    b.board.reflex = { x: lead.x, y: lead.y, live: g > 1, gain: g, tick: b.ticks, bodies: R.net.map((p) => [r3(p.x), r3(p.y)]) };
    return 1;
  }
};
