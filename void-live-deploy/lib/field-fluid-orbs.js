// field-fluid-orbs — F-321, agent-fluid memory orbs (asked by Owner, 2026-10-29; the draft is drafts/F321-webgpu-agent-fluid-memory-orbs
// on atomeam/a-to-mind.com, commit 14093fbb). A small stable-fluids field (velocity u, v and a density d on a 48 x 36 wrapping grid: forces, pressure projection, semi-Lagrangian
// advection, a light blur) that a handful of agents push. Each agent runs one shared tiny MLP (10 inputs: the density where it is, its
// slope, the flow, the swirl, where the pointer is and the device's tilt; 6 hidden; a 2-number force); a small evolutionary mind
// (evolveOrbs, 6 genomes, in a Worker or on the page) evolves that MLP for the draft's fitness: sustained density variance and long-lived orbs. The pointer adds energy, DeviceOrientation
// tilts the whole flow, and where the density peaks a memory orb is born: it drifts with the flow, grows with the density under it, takes
// its hue from the swirl and fades when the peak is gone. An orb can be sealed: an 8 x 8 snapshot of the density around it, as bytes, and
// the agents' genome, hashed with SHA-256; loading a seal stamps the snapshot back, makes its genome the mind's seed, and seals to the same hash.
// What the draft did and why it changed: its agents never used the evolved genomes (their force was a sine of the clock), its density was a
// per-frame particle count (a peak flickers out before an orb can hold it), its seal hashed the time (so no seal could ever be checked
// again) and its load was a stub. Here the force is the MLP's, the density is dye the agents and the pointer lay down and the flow carries,
// the time stays out of the hash, and load works. Its Euler advection is unstable past a small step, so this advects semi-Lagrangian and
// projects (Stam's stable fluids); its WebGPU compute path stays a note: 48 x 36 is well inside a frame on the CPU. Pure: no DOM, no clock, no Math.random; same seed, same field. The card is skills/fluid-orbs-mind.js.
import { rng, clamp, lerp, entropy, canonical, sha256Sync, sha256Hex, evolveStep, randomGenome } from './field-kit.js';

export const GW = 48, GH = 36, N_AGENTS = 18, MAX_ORBS = 7, DMAX = 4, PATCH = 4, POP = 6, MIND_EVERY = 2;
export const IN = 10, HID = 6, OUT = 2, GENES = IN * HID + HID + HID * OUT + OUT; // 80 weights
export const SPEC = Object.fromEntries(Array.from({ length: GENES }, (_, i) => ['w' + i, [-2, 2]]));
export const ORB_MIN = 1.1, ORB_GAP = 8, ORB_FADE = 0.3, ORB_LIFE = 180, ORB_EVERY = 8;
const TILT = 0.4, AGENT_FORCE = 0.35, AGENT_DYE = 0.065, AGENT_SWIM = 0.25, AGENT_SNIFF = 0.5, POINTER_DYE = 0.45, POINTER_PUSH = 0.8, VMAX = 2, DECAY = 0.994, DAMP = 0.992, BLUR = 0.05, ITERS = 10;
const NC = GW * GH, r2 = (v) => Math.round(v * 100) / 100, r4 = (v) => Math.round(v * 1e4) / 1e4;
const I = (x, y) => (((y % GH) + GH) % GH) * GW + (((x % GW) + GW) % GW);
// each cell's four neighbours, once (the projection reads them ten times a step)
const L = new Int32Array(NC), R = new Int32Array(NC), U = new Int32Array(NC), D = new Int32Array(NC);
for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const i = y * GW + x; L[i] = I(x - 1, y); R[i] = I(x + 1, y); U[i] = I(x, y - 1); D[i] = I(x, y + 1); }
const wrapD = (a, n) => { let d = a % n; if (d > n / 2) d -= n; else if (d < -n / 2) d += n; return d; }; // the shorter way round a wrapping axis
const wrapP = (a, n) => ((a % n) + n) % n;

/** a field value at a point in cell units (bilinear, wrapping). */
export function sample(f, x, y) {
  const x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0;
  return (f[I(x0, y0)] * (1 - tx) + f[I(x0 + 1, y0)] * tx) * (1 - ty) + (f[I(x0, y0 + 1)] * (1 - tx) + f[I(x0 + 1, y0 + 1)] * tx) * ty;
}
/** the swirl (curl of the flow) at a cell. */
export const curlAt = (s, i) => 0.5 * ((s.v[R[i]] - s.v[L[i]]) - (s.u[D[i]] - s.u[U[i]]));

/** genome object { w0..w79 } into the state's weights (clamped). */
export function setGenome(s, g) { for (let i = 0; i < GENES; i++) s.w[i] = clamp(Number.isFinite(+(g && g['w' + i])) ? +g['w' + i] : 0, -2, 2); return s; }
export const genomeOf = (s) => Object.fromEntries(Array.from(s.w, (v, i) => ['w' + i, r4(v)]));

/** a fresh field: agents scattered, flow still, no orbs. Pure given the seed. */
export function create(seed = 1, genome) {
  const r = rng(seed), F = () => new Float32Array(NC), A = () => new Float32Array(N_AGENTS);
  const s = { seed: +seed || 1, t: 0, u: F(), v: F(), d: F(), u0: F(), v0: F(), d0: F(), p: F(), div: F(), ax: A(), ay: A(), fx: A(), fy: A(), w: new Float32Array(GENES), inp: new Float32Array(IN), hid: new Float32Array(HID), orbs: [], nextOrb: 1, px: null, py: null, gen: 0, fit: 0 };
  for (let k = 0; k < N_AGENTS; k++) { s.ax[k] = r() * GW; s.ay[k] = r() * GH; }
  return setGenome(s, genome || randomGenome(SPEC, rng(((+seed || 1) * 2654435761) >>> 0)));
}

/** one agent's tiny MLP: what it senses where it is -> the force it pushes with (fx, fy in -1..1). */
export function policy(s, k, tiltX = 0, tiltY = 0) {
  const x = s.ax[k], y = s.ay[k], i = I(Math.floor(x), Math.floor(y)), d = s.d, inp = s.inp, w = s.w, h = s.hid;
  inp[0] = sample(d, x, y) / DMAX; inp[1] = (d[R[i]] - d[L[i]]) * 0.5; inp[2] = (d[D[i]] - d[U[i]]) * 0.5;
  inp[3] = sample(s.u, x, y); inp[4] = sample(s.v, x, y);
  inp[5] = s.px == null ? 0 : wrapD(s.px - x, GW) / GW * 2; inp[6] = s.py == null ? 0 : wrapD(s.py - y, GH) / GH * 2;
  inp[7] = tiltX; inp[8] = tiltY; inp[9] = curlAt(s, i) * 4;
  for (let j = 0; j < HID; j++) { let a = w[IN * HID + j]; for (let q = 0; q < IN; q++) a += w[j * IN + q] * inp[q]; h[j] = Math.tanh(a); }
  const o = IN * HID + HID; let fx = w[o + HID * OUT], fy = w[o + HID * OUT + 1];
  for (let j = 0; j < HID; j++) { fx += w[o + j] * h[j]; fy += w[o + HID + j] * h[j]; }
  s.fx[k] = Math.tanh(fx); s.fy[k] = Math.tanh(fy);
  return [s.fx[k], s.fy[k]];
}

/** add force and density in a soft disc around a point (cell units). */
export function splat(s, x, y, fu, fv, dye, rad = 2) {
  const R2 = rad * rad, x0 = Math.floor(x - rad), y0 = Math.floor(y - rad);
  for (let yy = y0; yy <= y0 + 2 * rad + 1; yy++) for (let xx = x0; xx <= x0 + 2 * rad + 1; xx++) {
    const dx = xx - x, dy = yy - y, q = dx * dx + dy * dy; if (q > R2) continue;
    const wt = Math.exp(-q / (R2 * 0.5)), i = I(xx, yy); s.u[i] += fu * wt; s.v[i] += fv * wt; s.d[i] += dye * wt;
  }
}

/** a memory Verse just thought of stirs the fluid at (x, y) (cells) with strength k (0..1): dye over the orb threshold where it sits and
 *  a ring of push outward, so an orb gathers there on the next steps (lib/orb-memories.js stirsOf picks when). */
export function stir(s, x, y, k) {
  const q = clamp(+k || 0, 0, 1); if (!q) return;
  splat(s, x, y, 0, 0, ORB_MIN + DMAX * 0.3 * q, 3);
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; splat(s, x + Math.cos(a) * 3, y + Math.sin(a) * 3, Math.cos(a) * 0.6 * q, Math.sin(a) * 0.6 * q, 0, 2); }
}

/** density peaks: cells above min that are the highest of their 3 x 3, highest first. Pure. */
export function findPeaks(d, min = ORB_MIN) {
  const out = [];
  for (let i = 0; i < NC; i++) {
    const v = d[i]; if (v < min) continue;
    if (v < d[L[i]] || v < d[R[i]] || v < d[U[i]] || v < d[D[i]] || v < d[L[U[i]]] || v < d[R[U[i]]] || v < d[L[D[i]]] || v < d[R[D[i]]]) continue;
    out.push({ x: i % GW, y: (i / GW) | 0, v });
  }
  return out.sort((a, b) => b.v - a.v || a.y - b.y || a.x - b.x);
}
const far = (a, b) => Math.hypot(wrapD(a.x - b.x, GW), wrapD(a.y - b.y, GH)) >= ORB_GAP;

/** peaks with no orb near them become orbs (at most MAX_ORBS). Returns the orbs born. */
export function spawnOrbs(s) {
  const born = [];
  for (const p of findPeaks(s.d, ORB_MIN)) {
    if (s.orbs.length >= MAX_ORBS) break;
    if (!s.orbs.every((o) => far(o, p))) continue;
    const o = { id: s.nextOrb++, x: p.x, y: p.y, age: 0, mass: p.v, vort: 0, low: 0, sealed: null };
    s.orbs.push(o); born.push(o);
  }
  return born;
}
/** orbs drift with the flow, follow the density and swirl under them, and go once their peak has been gone for ORB_LIFE frames. */
export function stepOrbs(s, h = 1) {
  for (const o of s.orbs) {
    o.x = wrapP(o.x + sample(s.u, o.x, o.y) * h, GW); o.y = wrapP(o.y + sample(s.v, o.x, o.y) * h, GH);
    const local = sample(s.d, o.x, o.y); o.mass = lerp(o.mass, local, 0.15); o.vort = lerp(o.vort, curlAt(s, I(Math.round(o.x), Math.round(o.y))), 0.2); o.age += h;
    o.low = local < ORB_FADE ? o.low + h : Math.max(0, o.low - 2 * h);
  }
  s.orbs = s.orbs.filter((o) => o.low <= ORB_LIFE);
  return s.orbs;
}
/** an orb's look from its numbers: scale with the density under it, hue with the swirl, opacity with density and how long its peak has been gone. Pure. */
export function orbMorph(o) {
  const m = clamp((+o.mass || 0) / DMAX, 0, 1), w = clamp(Math.abs(+o.vort || 0) / 0.4, 0, 1), fade = clamp(1 - (+o.low || 0) / ORB_LIFE, 0, 1);
  return { scale: r2(0.6 + m * 1.6), hue: Math.round(200 + w * 120 + ((+o.vort || 0) < 0 ? 0 : 20)) % 360, opacity: r2(clamp((0.35 + m * 0.65) * fade, 0, 1)) };
}
/** the colour an orb shows, as #rrggbb: the middle of its glow, hsl(hue, 90%, 60%), gold (hue 42) once sealed. Pure. */
export function orbHex(o) {
  const h = (o && o.sealed ? 42 : orbMorph(o || {}).hue) / 360, s = 0.9, l = 0.6, q = l + s - l * s, p = 2 * l - q;
  const ch = (t) => { t = (t + 1) % 1; const v = t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; return Math.round(v * 255).toString(16).padStart(2, '0'); };
  return '#' + ch(h + 1 / 3) + ch(h) + ch(h - 1 / 3);
}
/** the orb a hand-off carries: the last one sealed that is still on the card, else the densest; null when there is none. Pure. */
export function handOrb(s) {
  const live = (s && s.orbs) || [], sealed = live.filter((o) => o.sealed);
  const pick = (list, key) => list.reduce((b, o) => (b == null || key(o) > key(b) ? o : b), null);
  return sealed.length ? pick(sealed, (o) => +o.sealedAt || 0) : pick(live, (o) => +o.mass || 0);
}
/** the colour page for the orb a hand-off carries ('/color/?c=rrggbb'), or null when the card has no orb. Pure. */
export const orbColorLink = (s) => { const o = handOrb(s); return o ? '/color/?c=' + orbHex(o).slice(1) : null; };

/** one step: tilt, pointer, agents, projection, advection, blur, decay, orbs. input { x, y (0..1), over, down, tiltX, tiltY (-1..1) }. */
export function step(s, dt = 1 / 60, input = {}) {
  const h = clamp((+dt || 1 / 60) * 60, 0, 3), { u, v, d, p, div } = s;
  const tx = clamp(+input.tiltX || 0, -1, 1), ty = clamp(+input.tiltY || 0, -1, 1);
  if (input.over) { // the pointer: energy where it is, and the push of its motion (one point kept, overwritten: never a path)
    const x = clamp(+input.x || 0, 0, 1) * GW, y = clamp(+input.y || 0, 0, 1) * GH, mx = s.px == null ? 0 : wrapD(x - s.px, GW), my = s.py == null ? 0 : wrapD(y - s.py, GH);
    splat(s, x, y, mx * POINTER_PUSH, my * POINTER_PUSH, (input.down ? 1 : 0.35) * POINTER_DYE * h, 2.5); s.px = x; s.py = y;
  } else { s.px = null; s.py = null; }
  for (let k = 0; k < N_AGENTS; k++) { // the agents: each reads its patch with the shared policy, swims and pushes
    const [fx, fy] = policy(s, k, tx, ty), x = s.ax[k], y = s.ay[k];
    // and each swims up the density slope it senses (inp 1, 2), so trails feed on themselves and the fluid pools where agents gather:
    // the field's own peaks (and its orbs) come from the agents, not only from the pointer
    const gx = s.inp[1], gy = s.inp[2], gn = Math.hypot(gx, gy), sx = gn > 1e-4 ? gx / gn : 0, sy = gn > 1e-4 ? gy / gn : 0;
    s.ax[k] = wrapP(x + (sample(u, x, y) + fx * AGENT_SWIM + sx * AGENT_SNIFF) * h, GW); s.ay[k] = wrapP(y + (sample(v, x, y) + fy * AGENT_SWIM + sy * AGENT_SNIFF) * h, GH);
    splat(s, s.ax[k], s.ay[k], fx * AGENT_FORCE * h, fy * AGENT_FORCE * h, AGENT_DYE * h, 1.5);
  }
  for (let i = 0; i < NC; i++) { div[i] = -0.5 * (u[R[i]] - u[L[i]] + v[D[i]] - v[U[i]]); p[i] = 0; } // pressure projection: the flow keeps no sources or sinks
  for (let it = 0; it < ITERS; it++) for (let i = 0; i < NC; i++) p[i] = (div[i] + p[L[i]] + p[R[i]] + p[U[i]] + p[D[i]]) * 0.25;
  let mu = 0, mv = 0;
  for (let i = 0; i < NC; i++) { u[i] -= 0.5 * (p[R[i]] - p[L[i]]); v[i] -= 0.5 * (p[D[i]] - p[U[i]]); mu += u[i]; mv += v[i]; }
  // the whole flow's drift is the device's tilt and nothing else: a wrapping field would otherwise let the agents' shared push slide
  // everything one way (a moving flat sheet, not a fluid); DeviceOrientation leans the whole flow by setting that drift
  const du = mu / NC - TILT * tx, dv = mv / NC - TILT * ty;
  for (let i = 0; i < NC; i++) { u[i] -= du; v[i] -= dv; const sp = Math.hypot(u[i], v[i]); if (sp > VMAX) { u[i] *= VMAX / sp; v[i] *= VMAX / sp; } }
  s.u0.set(u); s.v0.set(v); s.d0.set(d);
  for (let i = 0; i < NC; i++) { // semi-Lagrangian advection: each cell takes what flowed to it (stable at any step)
    const bx = (i % GW) - s.u0[i] * h, by = ((i / GW) | 0) - s.v0[i] * h;
    u[i] = sample(s.u0, bx, by) * DAMP; v[i] = sample(s.v0, bx, by) * DAMP; d[i] = sample(s.d0, bx, by);
  }
  s.d0.set(d);
  for (let i = 0; i < NC; i++) d[i] = clamp((s.d0[i] * (1 - 4 * BLUR) + BLUR * (s.d0[L[i]] + s.d0[R[i]] + s.d0[U[i]] + s.d0[D[i]])) * Math.pow(DECAY, h), 0, DMAX);
  stepOrbs(s, h);
  if (s.t % ORB_EVERY === 0) spawnOrbs(s);
  s.t++;
  return s;
}

/** { entropy, activity, consensus, cx, cy } in 0..1 like every field mind, plus vorticity 0..1, peak (the highest density 0..1) and orbs. */
export function metrics(s) {
  let sum = 0, mx = 0, sx = 0, sy = 0, speed = 0, mu = 0, mv = 0, curl = 0;
  for (let i = 0; i < NC; i++) {
    const dd = s.d[i]; sum += dd; if (dd > mx) mx = dd; sx += dd * (i % GW); sy += dd * ((i / GW) | 0);
    speed += Math.hypot(s.u[i], s.v[i]); mu += s.u[i]; mv += s.v[i]; curl += Math.abs(curlAt(s, i));
  }
  return {
    entropy: r4(entropy(s.d, 16, 0, Math.max(0.5, mx))), activity: r4(clamp(speed / NC / 0.4, 0, 1)), consensus: r4(speed > 1e-9 ? clamp(Math.hypot(mu, mv) / speed, 0, 1) : 0),
    cx: r4(sum > 1e-6 ? clamp(sx / sum / (GW - 1), 0, 1) : 0.5), cy: r4(sum > 1e-6 ? clamp(sy / sum / (GH - 1), 0, 1) : 0.5),
    vorticity: r4(clamp(curl / NC / 0.25, 0, 1)), peak: r4(mx / DMAX), orbs: s.orbs.length
  };
}
/** the card's chrome from the field (F-321: "CSS custom properties driven by field entropy/vorticity morph the chrome"; on the card only,
 *  never the page): --fo-entropy and --fo-vorticity 0..1, --fo-hue (deep-space blue to violet as the swirl rises), --fo-edge (border alpha). Pure. */
export function chromeOf(m = {}) {
  const e = clamp(+m.entropy || 0, 0, 1), w = clamp(+m.vorticity || 0, 0, 1);
  return { '--fo-entropy': String(r2(e)), '--fo-vorticity': String(r2(w)), '--fo-hue': String(Math.round(215 + w * 75 + e * 20)), '--fo-edge': String(r2(0.2 + w * 0.5)) };
}
/** what a seal of the whole field keeps: the generation, its fitness and the weights. Never the pointer. */
export const params = (s) => ({ law: 'F-321', gen: s.gen || 0, fit: r4(s.fit || 0), genome: Array.from(s.w, r4) });

// ---- memory: sealing an orb ---------------------------------------------------------------------------------------------------
/** the density around an orb: an 8 x 8 patch of bytes (0..255) centred on the orb's cell. */
export function orbSnapshot(s, o) {
  const cx = wrapP(Math.round(o.x), GW), cy = wrapP(Math.round(o.y), GH), bytes = [];
  for (let dy = -PATCH; dy < PATCH; dy++) for (let dx = -PATCH; dx < PATCH; dx++) bytes.push(Math.round(clamp(s.d[I(cx + dx, cy + dy)] / DMAX, 0, 1) * 255));
  return { cx, cy, n: 2 * PATCH, bytes };
}
/** the text that is hashed: the orb's place, its bytes and the genome, nothing else (no time, no pointer). Pure. */
export const orbText = (snap) => canonical({ idea: 'agent-fluid-memory-orbs', kind: 'orb', cx: snap.cx, cy: snap.cy, n: snap.n, bytes: snap.bytes, genome: snap.genome || [] });
const snapOf = (s, o) => ({ ...orbSnapshot(s, o), genome: Array.from(s.w, r4) });
export function sealOrbSync(s, o) { const snap = snapOf(s, o); return { hash: sha256Sync(orbText(snap)), snap }; }
export async function sealOrb(s, o) { const snap = snapOf(s, o); return { hash: await sha256Hex(orbText(snap)), snap }; }
/** true when a snapshot still hashes to the seal it was kept with. */
export const verifySnap = (snap, hash) => !!snap && Array.isArray(snap.bytes) && sha256Sync(orbText(snap)) === hash;
/** stamp a sealed snapshot back into the field, make its genome the agents' seed, and put a sealed orb on it. Returns the orb. */
export function loadOrb(s, snap, hash = null) {
  const n = snap.n || 2 * PATCH, h = n / 2;
  if (Array.isArray(snap.genome) && snap.genome.length === GENES) for (let i = 0; i < GENES; i++) s.w[i] = clamp(+snap.genome[i] || 0, -2, 2);
  for (let k = 0; k < snap.bytes.length; k++) { const dx = (k % n) - h, dy = ((k / n) | 0) - h; s.d[I(snap.cx + dx, snap.cy + dy)] = clamp(+snap.bytes[k] || 0, 0, 255) / 255 * DMAX; }
  s.orbs = s.orbs.filter((o) => far(o, { x: snap.cx, y: snap.cy }));
  if (s.orbs.length >= MAX_ORBS) s.orbs.shift();
  const o = { id: s.nextOrb++, x: snap.cx, y: snap.cy, age: 0, mass: s.d[I(snap.cx, snap.cy)], vort: 0, low: 0, sealed: hash };
  s.orbs.push(o); return o;
}

// ---- the mind: evolving the agents' policy ---------------------------------------------------------------------------------------
/** the draft's fitness: sustained density variance and orb lifetime (life: the share of orb slots alive over the run, 0..1), with a
 *  little swirl so a still pool of dye never wins. 0..1. */
export function fitness(s, life = 0) {
  let sum = 0, q = 0; for (let i = 0; i < NC; i++) sum += s.d[i];
  const mean = sum / NC; for (let i = 0; i < NC; i++) { const e = s.d[i] - mean; q += e * e; }
  return r4(0.45 * clamp(q / NC / 0.05, 0, 1) + 0.4 * clamp(+life || 0, 0, 1) + 0.15 * metrics(s).vorticity);
}
/** a genome's score: a fresh field on a fixed seed, a synthetic pointer circling where the person last pointed (never their path). */
export function rollout(genome, seed = 1, pointer = null, steps = 40) {
  const s = create(seed, genome), c = pointer && Number.isFinite(+pointer.x) ? { x: clamp(+pointer.x, 0, 1), y: clamp(+pointer.y, 0, 1) } : { x: 0.5, y: 0.5 };
  let life = 0;
  for (let i = 0; i < steps; i++) { const a = i / 8; step(s, 1 / 60, { over: true, down: i % 16 < 3, x: c.x + 0.2 * Math.cos(a), y: c.y + 0.2 * Math.sin(a) }); life += s.orbs.length / MAX_ORBS; }
  return fitness(s, life / steps);
}
/** one generation for the Worker (by name) or the page: { pop, seed, gen, pointer } -> { pop, best, fitness, gen }. Pure. */
export function evolveOrbs({ pop = null, seed = 1, gen = 0, pointer = null } = {}) {
  const r = rng(((+seed || 1) * 31 + (+gen || 0) * 7919) >>> 0 || 1);
  const P = Array.isArray(pop) && pop.length === POP ? pop : Array.from({ length: POP }, (_, i) => (i === 0 ? genomeOf(create(seed)) : randomGenome(SPEC, r)));
  const fits = P.map((g) => rollout(g, seed, pointer));
  let bi = 0; for (let i = 1; i < P.length; i++) if (fits[i] > fits[bi]) bi = i;
  return { pop: evolveStep(P, fits, SPEC, r, { sigma: 0.08 }), best: P[bi], fitness: fits[bi], gen: (+gen || 0) + 1 };
}
