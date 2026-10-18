// stigmergy-law: the stigmergy board (owner, 2026-10-18, operating laws for serious thought). Pure: no DOM, no clock, no network.
// Marks with weights are left on a grid. Nothing assigns a task: the board only keeps marks and lets time act on them. Each tick a
// trail touched in 2 or more separate sessions (the visit counter) is reinforced and grows; a trail touched in one session
// evaporates by DECAY. Heat is the weight times how many sessions came back, so the paths earning attention glow.
import { clamp } from './field-kit.js';

export const W = 12, H = 8, DECAY = 0.85, GROW = 1.12, CAP = 10, FLOOR = 0.02, MAX_MARK = 3;

export function create() { return { w: new Array(W * H).fill(0), visits: new Array(W * H).fill(0), last: new Array(W * H).fill(-1), session: 0, ticks: 0 }; }

/** a new visit: later marks count as another session. */
export function newSession(s) { s.session++; return s; }

/** leave a mark of `weight` (capped) at cell (x, y); a different session from the last toucher bumps the visit counter. */
export function leave(s, x, y, weight = 1) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= W || y >= H) return s;
  const i = y * W + x; s.w[i] = clamp(s.w[i] + clamp(Number(weight) || 0, 0, MAX_MARK), 0, CAP);
  if (s.last[i] !== s.session) { s.visits[i]++; s.last[i] = s.session; }
  return s;
}

/** one tick of time: reinforced trails (visits >= 2) grow, the rest evaporate; a trail below FLOOR is gone, its counter too. */
export function tick(s) {
  for (let i = 0; i < s.w.length; i++) {
    if (s.w[i] <= 0) continue;
    s.w[i] = s.visits[i] >= 2 ? Math.min(CAP, s.w[i] * GROW) : s.w[i] * DECAY;
    if (s.w[i] < FLOOR) { s.w[i] = 0; s.visits[i] = 0; s.last[i] = -1; }
  }
  s.ticks++; return s;
}

/** the heat view: 0..1 per cell, weight times returning visits. */
export function heat(s) { return s.w.map((v, i) => clamp((v * Math.min(s.visits[i], 4)) / CAP, 0, 1)); }

/** the cells earning attention, hottest first. */
export function hottest(s, n = 3) { const h = heat(s); return h.map((v, i) => ({ x: i % W, y: Math.floor(i / W), heat: v })).filter((c) => c.heat > 0).sort((a, b) => b.heat - a.heat || a.y - b.y || a.x - b.x).slice(0, n); }

export function metrics(s) {
  const h = heat(s), sum = h.reduce((a, v) => a + v, 0), live = s.w.filter((v) => v > 0).length, reinforced = s.visits.filter((v, i) => v >= 2 && s.w[i] > 0).length;
  let cx = 0.5, cy = 0.5, ent = 0;
  if (sum > 0) { cx = h.reduce((a, v, i) => a + v * ((i % W) + 0.5), 0) / sum / W; cy = h.reduce((a, v, i) => a + v * (Math.floor(i / W) + 0.5), 0) / sum / H; ent = -h.reduce((a, v) => (v > 0 ? a + (v / sum) * Math.log(v / sum) : a), 0) / Math.log(W * H); }
  return { entropy: clamp(ent, 0, 1), activity: clamp(live / (W * H), 0, 1), consensus: live ? reinforced / live : 0, cx, cy };
}

/** only plain data goes to disk: weights, visit counters, the session number. */
export function dump(s) { return JSON.stringify({ w: s.w.map((v) => Math.round(v * 1000) / 1000), visits: s.visits, last: s.last, session: s.session, ticks: s.ticks }); }
export function load(text) {
  try {
    const o = JSON.parse(text), s = create();
    if (!o || o.w.length !== W * H || o.visits.length !== W * H || o.last.length !== W * H) return create();
    s.w = o.w.map((v) => clamp(+v || 0, 0, CAP)); s.visits = o.visits.map((v) => Math.max(0, Math.floor(+v || 0)));
    s.last = o.last.map((v) => Math.floor(+v) || 0); s.session = Math.max(0, Math.floor(+o.session) || 0); s.ticks = Math.max(0, Math.floor(+o.ticks) || 0);
    return s;
  } catch { return create(); }
}
