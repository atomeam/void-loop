// field-doodle — the law of Mind Field's Draw mode ("Doodle mind"): the best parts of three frontier drafts on one lattice.
//   F-224 thought-trace lattice: the last few pointer moves are squeezed into a 3-number latent (speed, unevenness, curve) that
//         rewrites the lattice's own update rule live, and the latent's guess of where the stroke goes next shows as oracle nodes.
//   F-225 acoustic causal lattice: a sound level (a number, only after the Listen button; never a recording) feeds the lattice.
//   F-229 causal attention probes: a tiny attention head over a short history of [tilt x, tilt y, field energy, sound] gives a
//         "thought" (hue, contrast, blur, energy) that moves draggable orbs; the orbs deposit back into the lattice where they sit.
// Pure: no DOM, no clock, no Math.random. The pointer's trace is a ring of the last TRACE points in memory, never sealed or saved.
import { rng, clamp, makeGrid, entropy, map01 } from './field-kit.js';

export const GW = 48, GH = 36, TRACE = 24, HIST = 16, ORBS = 4, ORACLES = 3;

/** a fresh mind: the lattice, an empty trace, the orbs, the attention head's fixed seeded weights. */
export function create(seed = 1) {
  const r = rng(seed), W = () => Array.from({ length: 4 }, () => r.range(-1, 1));
  const orbs = Array.from({ length: ORBS }, (_, i) => ({ x: 0.2 + 0.6 * ((i % 2) ? 0.85 : 0.15), y: 0.25 + 0.5 * (i < 2 ? 0 : 1), held: false }));
  return {
    seed, t: 0, a: makeGrid(GW, GH), b: makeGrid(GW, GH), trace: [], latent: [0, 0, 0], rule: rule([0, 0, 0]),
    hist: [], thought: [0.5, 0.5, 0.5, 0], Wq: W(), Wk: [W(), W(), W(), W()], Wv: [W(), W(), W(), W()],
    orbs, oracles: [], energy: 0, prevEnergy: 0, activity: 0, drawn: 0
  };
}

/** the update rule a latent asks for: how far the field spreads, how fast it fades, and the level it grows toward. Pure. */
export function rule(l) {
  return { diffuse: 0.08 + 0.3 * clamp(l[0], 0, 1), decay: 0.955 + 0.04 * (1 - clamp(l[1], 0, 1)), mu: 0.25 + 0.4 * clamp(l[2], 0, 1), growth: 0.06 };
}

/** the trace's latent: mean speed, its unevenness and how much it curves, each 0..1. Pure. */
export function latentOf(trace) {
  if (trace.length < 3) return [0, 0, 0];
  const v = []; for (let i = 1; i < trace.length; i++) v.push([trace[i].x - trace[i - 1].x, trace[i].y - trace[i - 1].y]);
  const sp = v.map(([x, y]) => Math.hypot(x, y)), mean = sp.reduce((s, x) => s + x, 0) / sp.length;
  const vari = sp.reduce((s, x) => s + (x - mean) ** 2, 0) / sp.length;
  let turn = 0, n = 0; for (let i = 1; i < v.length; i++) { const a = Math.atan2(v[i][1], v[i][0]) - Math.atan2(v[i - 1][1], v[i - 1][0]); if (sp[i] > 1e-4 && sp[i - 1] > 1e-4) { turn += Math.abs(Math.atan2(Math.sin(a), Math.cos(a))); n++; } }
  return [map01(mean, 0, 0.03), map01(Math.sqrt(vari), 0, 0.02), map01(n ? turn / n : 0, 0, 1.2)];
}

/** where the stroke goes next: ORACLES points ahead of the last one, turning by the trace's own mean turn. Pure. */
export function predict(trace) {
  if (trace.length < 3) return [];
  const p = trace[trace.length - 1], q = trace[trace.length - 2], o = trace[trace.length - 3];
  let vx = p.x - q.x, vy = p.y - q.y; const sp = Math.hypot(vx, vy); if (sp < 1e-4) return [];
  const a1 = Math.atan2(q.y - o.y, q.x - o.x), a2 = Math.atan2(vy, vx), turn = Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1));
  const out = []; let x = p.x, y = p.y, ang = a2, step = Math.max(sp, 0.012) * 4;
  for (let k = 0; k < ORACLES; k++) { ang += turn * 4; x += Math.cos(ang) * step; y += Math.sin(ang) * step; out.push({ x: clamp(x, 0, 1), y: clamp(y, 0, 1), s: 1 - k / ORACLES }); }
  return out;
}

/** one attention read over the history: softmax(q·k) weighted values -> the thought (hue, contrast, blur, energy), each 0..1. Pure. */
export function attend(s) {
  const H = s.hist; if (!H.length) return s.thought;
  const last = H[H.length - 1], dot = (w, x) => w[0] * x[0] + w[1] * x[1] + w[2] * x[2] + w[3] * x[3];
  const q = s.Wk.map((w) => dot(w, last)), sc = H.map((h) => dot(q, s.Wk.map((w) => dot(w, h))) / 2);
  const mx = Math.max(...sc), ex = sc.map((x) => Math.exp(x - mx)), z = ex.reduce((a, b) => a + b, 0);
  const out = [0, 0, 0, 0]; H.forEach((h, i) => { const wv = ex[i] / z; s.Wv.forEach((w, j) => { out[j] += wv * dot(w, h); }); });
  return out.map((v) => 1 / (1 + Math.exp(-v * 2)));
}

const dep = (g, x, y, amt, rad = 1) => { const cx = Math.floor(clamp(x, 0, 0.999) * GW), cy = Math.floor(clamp(y, 0, 0.999) * GH); for (let j = -rad; j <= rad; j++) for (let i = -rad; i <= rad; i++) { const X = cx + i, Y = cy + j; if (X < 0 || Y < 0 || X >= GW || Y >= GH) continue; const k = Y * GW + X; g[k] = Math.min(1, g[k] + amt / (1 + Math.abs(i) + Math.abs(j))); } };

/** one step. input: { x, y, over, down, tiltX, tiltY, audio (0..1, only when listening) }. */
export function step(s, dt, input = {}) {
  s.t += dt;
  if (input.over || input.down) { // the trace keeps only the last TRACE points
    const tr = s.trace, l = tr[tr.length - 1];
    if (!l || Math.hypot(l.x - input.x, l.y - input.y) > 0.002) { tr.push({ x: input.x, y: input.y }); if (tr.length > TRACE) tr.shift(); }
    s.latent = latentOf(tr); s.rule = rule(s.latent); s.oracles = predict(tr);
    if (input.down) { dep(s.a, input.x, input.y, 0.9, 1); s.drawn++; }
  }
  const audio = clamp(+input.audio || 0, 0, 1), tx = clamp(+input.tiltX || 0, -1, 1), ty = clamp(+input.tiltY || 0, -1, 1);
  if (audio > 0.05) dep(s.a, 0.5, 0.5, audio * 0.6, 2);
  // the orbs: held ones stay where the hand puts them; the rest drift toward the thought's place and the oracles; each deposits back
  const th = s.thought, tgt = s.oracles.length ? s.oracles : [{ x: th[0], y: th[1] }];
  s.orbs.forEach((o, i) => { if (!o.held) { const t = tgt[i % tgt.length], k = 0.02 + 0.04 * th[3]; o.x += (t.x + (i - 1.5) * 0.06 - o.x) * k; o.y += (t.y + ((i % 2) - 0.5) * 0.08 - o.y) * k; } o.x = clamp(o.x, 0.02, 0.98); o.y = clamp(o.y, 0.02, 0.98); dep(s.a, o.x, o.y, 0.05 + 0.1 * th[3], 0); });
  // the lattice: diffusion biased by tilt, growth toward the latent's level, the rule's fade
  const A = s.a, B = s.b, R = s.rule, sx = Math.round(tx), sy = Math.round(ty); let e = 0, act = 0;
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const k = y * GW + x, at = (X, Y) => A[clamp(Y, 0, GH - 1) * GW + clamp(X, 0, GW - 1)];
    const lap = at(x - 1, y) + at(x + 1, y) + at(x, y - 1) + at(x, y + 1) - 4 * A[k], up = at(x - sx, y - sy);
    let v = A[k] + R.diffuse * lap + 0.15 * (up - A[k]) * (sx || sy ? 1 : 0);
    v += R.growth * v * (1 - Math.abs(v - R.mu) / Math.max(R.mu, 0.1)) * (v > 0.02 ? 1 : 0);
    v = clamp(v * R.decay, 0, 1); B[k] = v; e += v; act += Math.abs(v - A[k]);
  }
  s.a = B; s.b = A; s.prevEnergy = s.energy; s.energy = e / (GW * GH); s.activity = act / (GW * GH);
  const hx = input.tilting || !input.over ? tx : clamp((input.x - 0.5) * 2, -1, 1), hy = input.tilting || !input.over ? ty : clamp((input.y - 0.5) * 2, -1, 1); // no tilt sensor on: the pointer stands in for tilt in the mind's history (not in the diffusion)
  s.hist.push([hx, hy, s.energy * 4 - 1, audio * 2 - 1]); if (s.hist.length > HIST) s.hist.shift();
  s.thought = attend(s);
}

/** the kit's metrics: entropy, activity, consensus, cx, cy, each 0..1. Pure. */
export function metrics(s) {
  let sx = 0, sy = 0, sw = 0; for (let k = 0; k < s.a.length; k++) { const w = s.a[k]; sx += (k % GW) * w; sy += Math.floor(k / GW) * w; sw += w; }
  return { entropy: entropy(s.a, 16, 0, 1), activity: clamp(s.activity * 40, 0, 1), consensus: clamp(1 - Math.abs(s.thought[0] - s.thought[1]), 0, 1), cx: sw ? sx / sw / (GW - 1) : 0.5, cy: sw ? sy / sw / (GH - 1) : 0.5 };
}
/** page-mood numbers for the card's CSS custom properties (F-229's --hue/--contrast/--blur/--energy, on the card only). Pure. */
export function mood(s) { const t = s.thought; return { '--mf-hue': String(Math.round(t[0] * 360)), '--mf-contrast': (0.9 + t[1] * 0.4).toFixed(2), '--mf-blur': (t[2] * 0.6).toFixed(2) + 'px', '--mf-energy': t[3].toFixed(2) }; }
/** what "save this mind" keeps: the latent, the rule and the thought (numbers only; never the trace). Pure. */
export function params(s) { const r3 = (v) => Math.round(v * 1000) / 1000; return { latent: s.latent.map(r3), rule: Object.fromEntries(Object.entries(s.rule).map(([k, v]) => [k, r3(v)])), thought: s.thought.map(r3), orbs: s.orbs.map((o) => [r3(o.x), r3(o.y)]) }; }
