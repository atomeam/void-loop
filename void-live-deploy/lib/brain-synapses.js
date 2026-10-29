// brain-synapses, Verse Brain's spiking eye, from F217 (audible synapse forager, atomeam/a-to-mind.com drafts/). Owner, 2026-10-29: "combine
// all the builds into one entity", "dont fake it". F217 was a forager alone in its own world; here the world is the brain's own tissue.
//   32 input neurons smell the tissue (the act layer) through two antennas, 16 on the left and 16 on the right, and fire as Bernoulli
//   trials at a rate set by the left/right contrast. They feed 32 Izhikevich regular-spiking motor neurons all to all (16 turn the eye
//   left, 16 turn it right). Learning is reward-modulated STDP: pre and post traces (20 ms) feed an eligibility trace per synapse, and
//   dopamine (more living tissue under the eye than a moment ago, less a slow baseline) gates the weight change. Synaptic scaling keeps
//   each motor neuron's total input fixed, so dopamine can only move weight between the left and right inputs. Nothing tells it which
//   wiring is right: same-side wiring (smell on the left turns left) is what the reward finds.
// The eye writes where it looks into the input layer as 'synapses', so attention (updateFocus) sees what it found. Its weights are slow
// knowledge: lib/brain-mind.js knowledgeOf keeps them between visits with the Q-table and the Hebbian links.
// Pure: no DOM, no clock, no Math.random (its own seeded stream, so it never shifts the other organs' random numbers).
import { clamp } from './field-kit.js';
import { GW, GH, deposit } from './brain-workspace.js';

export const G = 16, NI = 2 * G, NM = 2 * G, WMAX = 6, MS_PER_TICK = 60;
const TAU = Math.PI * 2, ANT = 0.6, REACH = 0.08, SPEED = 0.0004, TURN = 0.004, RK = 80, LR = 0.01, SMELL = 4;

function stream(seed) { let a = (seed * 2654435761 + 12345) >>> 0 || 1; return { get s() { return a; }, set s(v) { a = v >>> 0 || 1; }, next() { a ^= a << 13; a >>>= 0; a ^= a >>> 17; a ^= a << 5; a >>>= 0; return a / 4294967296; } }; }

/** a new eye: random weights in the middle of the range, so the wiring starts with no side preferred. */
export function makeSynapses(seed = 1) {
  const r = stream(seed), W = new Float32Array(NI * NM);
  for (let i = 0; i < W.length; i++) W[i] = WMAX * (0.35 + 0.3 * r.next());
  return { r, W, v: new Float32Array(NI + NM).fill(-65), u: new Float32Array(NI + NM).fill(-13), pre: new Float32Array(NI), post: new Float32Array(NM),
    elig: new Float32Array(NI * NM), fired: new Uint8Array(NI + NM), m: [0, 0], dopa: 0, base: 0, last: 0, ms: 0, learn: true,
    x: r.next(), y: r.next(), h: r.next() * TAU, spikes: 0, seen: 0, seenAvg: 0 };
}

const at = (g, x, y) => g[Math.floor((((y % 1) + 1) % 1) * GH) * GW + Math.floor((((x % 1) + 1) % 1) * GW)];
/** how much living tissue is near (x, y): a Gaussian-weighted mean of the act layer within SMELL cells. */
export function smell(g, x, y) {
  let s = 0, n = 0;
  for (let dy = -SMELL; dy <= SMELL; dy++) for (let dx = -SMELL; dx <= SMELL; dx++) { const w = Math.exp(-(dx * dx + dy * dy) / (SMELL * SMELL)); s += at(g, x + dx / GW, y + dy / GH) * w; n += w; }
  return s / n;
}

/** one millisecond of the eye: sense, spike, learn, turn, move. g is the act layer. */
export function stepMs(S, g) {
  const { W, v, u, pre, post, elig, fired, r } = S;
  const sl = smell(g, S.x + REACH * Math.cos(S.h + ANT), S.y + REACH * Math.sin(S.h + ANT)), sr = smell(g, S.x + REACH * Math.cos(S.h - ANT), S.y + REACH * Math.sin(S.h - ANT));
  const t = sl + sr + 1e-6, dl = sl / t, dr = sr / t;
  for (let i = 0; i < NI; i++) { const p = i < G ? dl : dr; fired[i] = r.next() < 0.096 * p * p ? 1 : 0; }
  for (let j = 0; j < NM; j++) {
    let I = r.next() < 0.012 ? 14 : 0; for (let i = 0; i < NI; i++) if (fired[i]) I += W[i * NM + j];
    const n = NI + j; let vv = v[n], uu = u[n];
    vv += 0.5 * (0.04 * vv * vv + 5 * vv + 140 - uu + I); vv += 0.5 * (0.04 * vv * vv + 5 * vv + 140 - uu + I); uu += 0.02 * (0.2 * vv - uu); // Izhikevich RS, two half steps
    fired[n] = 0; if (vv >= 30) { vv = -65; uu += 8; fired[n] = 1; S.spikes++; } v[n] = vv; u[n] = uu;
  }
  for (let i = 0; i < NI; i++) { pre[i] *= 0.951; if (fired[i]) pre[i] += 1; }
  for (let j = 0; j < NM; j++) { post[j] *= 0.951; if (fired[NI + j]) post[j] += 1; }
  for (let i = 0; i < NI; i++) { const fi = fired[i], row = i * NM; for (let j = 0; j < NM; j++) { let c = elig[row + j] * 0.995; if (fired[NI + j]) c += pre[i]; if (fi) c -= 0.8 * post[j]; elig[row + j] = c; } }
  let ml = 0, mr = 0; for (let j = 0; j < G; j++) { ml += fired[NI + j]; mr += fired[NI + G + j]; }
  S.m[0] = S.m[0] * 0.95 + ml; S.m[1] = S.m[1] * 0.95 + mr; S.h += TURN * (S.m[0] - S.m[1]);
  S.x = (S.x + SPEED * Math.cos(S.h) + 1) % 1; S.y = (S.y + SPEED * Math.sin(S.h) + 1) % 1;
  const s = smell(g, S.x, S.y); S.dopa = (s - S.last) * RK; S.last = s; S.seen = s; S.base = S.base * 0.9995 + 0.0005 * S.dopa;
  if (S.learn) {
    const d = (S.dopa - S.base) * LR; if (d) for (let k = 0; k < W.length; k++) { const x = W[k] + d * elig[k]; W[k] = x < 0 ? 0 : x > WMAX ? WMAX : x; }
    if (S.ms % 10 === 0) { const tg = WMAX * 0.5 * NI; for (let j = 0; j < NM; j++) { let tot = 0; for (let i = 0; i < NI; i++) tot += W[i * NM + j]; const f = tg / (tot || 1); for (let i = 0; i < NI; i++) { const x = W[i * NM + j] * f; W[i * NM + j] = x > WMAX ? WMAX : x; } } }
  }
  S.ms++;
}

/** how right the wiring is: (same-side weight - cross-side weight) / all weight. 0: no side preferred, 1: every weight on its own side. Pure. */
export function wiring(W) {
  let same = 0, cross = 0; for (let i = 0; i < NI; i++) for (let j = 0; j < NM; j++) ((i < G) === (j < G) ? (same += W[i * NM + j]) : (cross += W[i * NM + j]));
  return (same - cross) / (same + cross || 1);
}

export const synapses = {
  id: 'synapses', name: 'Synapses', job: 'a spiking eye that learns by dopamine to look where the tissue is alive, and shows attention what it found',
  want: (b) => 0.3 + 0.4 * clamp(b.metrics.activity * 2, 0, 1),
  run(b) {
    const S = b.synapses, g = b.ws.layers.act; let seen = 0;
    for (let k = 0; k < MS_PER_TICK; k++) { stepMs(S, g); seen += S.seen; }
    seen /= MS_PER_TICK; S.seenAvg = S.seenAvg * 0.98 + seen * 0.02;
    deposit(b.ws, 'input', S.x, S.y, clamp(seen * 0.25, 0, 0.08), 2, 'synapses');
    b.board.eye = { x: S.x, y: S.y, wiring: Math.round(wiring(S.W) * 100) / 100, seen: Math.round(S.seenAvg * 1000) / 1000 };
    return 1;
  }
};
