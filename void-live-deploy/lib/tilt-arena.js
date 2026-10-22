// tilt-arena — the pure half of Tilt Arena (owner, 2026-10-21: "combine anything that can be without taking away"). The best parts of
// frontier drafts F-205 (live agent competition with status cards), F-206 (a tiny MLP per agent turned into physical force), F-208
// (genome transfer: the weakest takes a mutated copy of the leader), F-228 (the leader's genome sealed, DOM agent cards) and F-230
// (the orientation genome arena): a population of agents, each a 3-6-2 network (inputs: the target's offset and distance; outputs: a
// force), chase one target. Fitness is a running closeness score; every ROUND seconds the weakest becomes a mutated copy of the leader.
// The target comes from the mode: tilt (or the pointer), gaze (F-226), a hand (F-232). forwardAll is the batch the GPU Swarm mode (F-223)
// runs as a WebGPU compute shader; this CPU version is its reference and its automatic fallback. Pure: no DOM.
import { rng, clamp, entropy } from './field-kit.js';

export const IN = 3, HID = 6, OUT = 2, GENES = IN * HID + HID + HID * OUT + OUT; // 18 + 6 + 12 + 2 = 38
export const ROUND = 2.5, NAMES = ['Ash', 'Birch', 'Cedar', 'Elm', 'Fir', 'Hazel', 'Juniper', 'Larch', 'Maple', 'Oak', 'Pine', 'Rowan', 'Spruce', 'Willow', 'Yew', 'Alder'];

/** n agents from a seed. Pure. */
export function create(seed = 1, n = 12) {
  const r = rng(seed), rnd = () => r.range(-1, 1);
  const W = new Float32Array(n * GENES); for (let i = 0; i < W.length; i++) W[i] = rnd();
  const agents = Array.from({ length: n }, (_, i) => ({ id: i, name: NAMES[i % NAMES.length] + (i >= NAMES.length ? ' ' + (1 + Math.floor(i / NAMES.length)) : ''), x: 0.1 + 0.8 * r(), y: 0.1 + 0.8 * r(), vx: 0, vy: 0, fit: 0, wins: 0 }));
  return { seed, t: 0, round: 0, gen: 0, n, W, agents, target: { x: 0.5, y: 0.5 }, out: new Float32Array(n * OUT), r, lastSwap: '' };
}
/** the network's inputs for every agent: offset to the target and distance. Pure. */
export function inputs(s) { const v = new Float32Array(s.n * IN); s.agents.forEach((a, i) => { const dx = s.target.x - a.x, dy = s.target.y - a.y; v[i * IN] = dx * 2; v[i * IN + 1] = dy * 2; v[i * IN + 2] = Math.hypot(dx, dy) * 2; }); return v; }
/** every agent's 3-6-2 network at once (tanh): weights n*GENES, inputs n*IN -> forces n*OUT. Pure; the GPU shader computes the same. */
export function forwardAll(W, X, n, out = new Float32Array(n * OUT)) {
  const h = new Float32Array(HID);
  for (let a = 0; a < n; a++) {
    const g = a * GENES, x = a * IN;
    for (let j = 0; j < HID; j++) { let z = W[g + IN * HID + j]; for (let i = 0; i < IN; i++) z += W[g + j * IN + i] * X[x + i]; h[j] = Math.tanh(z); }
    const o = g + IN * HID + HID;
    for (let k = 0; k < OUT; k++) { let z = W[o + HID * OUT + k]; for (let j = 0; j < HID; j++) z += W[o + k * HID + j] * h[j]; out[a * OUT + k] = Math.tanh(z); }
  }
  return out;
}
/** one step: forces from s.out (set by forwardAll or the GPU), physics, fitness, and a genome swap each round. Pure but for s. */
export function step(s, dt, target, out) {
  if (target) { s.target.x = clamp(target.x, 0, 1); s.target.y = clamp(target.y, 0, 1); }
  const f = out || forwardAll(s.W, inputs(s), s.n, s.out);
  s.agents.forEach((a, i) => {
    const px = s.target.x - a.x, py = s.target.y - a.y; // a light pull so every agent plays; the network decides how well
    a.vx = (a.vx + (f[i * OUT] * 1.6 + px * 0.8) * dt) * 0.96; a.vy = (a.vy + (f[i * OUT + 1] * 1.6 + py * 0.8) * dt) * 0.96;
    a.x += a.vx * dt; a.y += a.vy * dt;
    if (a.x < 0 || a.x > 1) { a.vx *= -0.5; a.x = clamp(a.x, 0, 1); } if (a.y < 0 || a.y > 1) { a.vy *= -0.5; a.y = clamp(a.y, 0, 1); }
    const d = Math.hypot(s.target.x - a.x, s.target.y - a.y); a.fit = a.fit * 0.985 + (1 - clamp(d * 1.6, 0, 1)) * 0.015;
  });
  s.t += dt; s.round += dt;
  if (s.round >= ROUND) { s.round = 0; evolve(s); }
  return s;
}
/** the weakest takes a mutated copy of the leader's genome (F-208). Pure but for s. */
export function evolve(s) {
  const rank = ranked(s), lead = rank[0], weak = rank[rank.length - 1]; if (lead === weak) return s;
  lead.wins++; const L = lead.id * GENES, K = weak.id * GENES;
  for (let i = 0; i < GENES; i++) s.W[K + i] = clamp(s.W[L + i] + (s.r() < 0.3 ? s.r.range(-0.25, 0.25) : 0), -3, 3);
  weak.fit = lead.fit * 0.8; weak.x = s.r(); weak.y = s.r(); weak.vx = weak.vy = 0; s.gen++;
  s.lastSwap = weak.name + ' took ' + lead.name + "'s genome"; return s;
}
export const ranked = (s) => s.agents.slice().sort((a, b) => b.fit - a.fit || a.id - b.id);
/** the card's mood numbers (field-kit morphOf). Pure. */
export function metrics(s) {
  const fits = s.agents.map((a) => a.fit), mean = fits.reduce((p, v) => p + v, 0) / s.n, sp = s.agents.reduce((p, a) => p + Math.hypot(a.vx, a.vy), 0) / s.n;
  return { entropy: entropy(fits, 8, 0, 1), activity: clamp(sp * 3, 0, 1), consensus: clamp(mean, 0, 1), cx: s.target.x, cy: s.target.y };
}
/** what Seal keeps: the leader's genome, rounded, and the generation (numbers only, never where you looked or pointed). Pure. */
export function params(s) { const l = ranked(s)[0]; return { gen: s.gen, leader: l.name, genome: Array.from(s.W.subarray(l.id * GENES, l.id * GENES + GENES), (v) => Math.round(v * 1000) / 1000) }; }

/** the WGSL for GPU Swarm: one invocation per agent, the same 3-6-2 tanh network as forwardAll. */
export const WGSL = `
@group(0) @binding(0) var<storage, read> W : array<f32>;
@group(0) @binding(1) var<storage, read> X : array<f32>;
@group(0) @binding(2) var<storage, read_write> Y : array<f32>;
@group(0) @binding(3) var<uniform> N : vec4<u32>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {
  let a = id.x; if (a >= N.x) { return; }
  let g = a * ${GENES}u; let x = a * ${IN}u; var h : array<f32, ${HID}>;
  for (var j = 0u; j < ${HID}u; j++) { var z = W[g + ${IN * HID}u + j]; for (var i = 0u; i < ${IN}u; i++) { z += W[g + j * ${IN}u + i] * X[x + i]; } h[j] = tanh(z); }
  let o = g + ${IN * HID + HID}u;
  for (var k = 0u; k < ${OUT}u; k++) { var z = W[o + ${HID * OUT}u + k]; for (var j = 0u; j < ${HID}u; j++) { z += W[o + k * ${HID}u + j] * h[j]; } Y[a * ${OUT}u + k] = tanh(z); }
}`;
