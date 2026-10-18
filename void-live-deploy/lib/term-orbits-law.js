// term-orbits-law: terms as bodies (owner, 2026-10-18, operating laws for serious thought). Pure: no DOM, no clock, no network.
// Each important term is a node with a position, a velocity and a count of uses. A term used once keeps an orbit round the centre;
// overuse pulls terms toward each other by (uses - 1) * (uses - 1), and two terms that come closer than MERGE_DIST collapse into
// one visible "mush" node (counts add, names join). Interventions are forces, never edits: push apart, anchor.
import { rng, clamp, occupancyEntropy } from './field-kit.js';

export const MAX_TERMS = 14, MERGE_DIST = 0.045, G = 0.0006, ORBIT_R = 0.3, ORBIT_V = 0.12;
export const STOP = new Set('the and for that with this from have are was were but not you your all can will just than then they them into about what when which would there their been more some also very over'.split(' '));

/** the important terms of a text with their counts: words of 4+ letters that are not stop words, most used first (ties alphabetical). */
export function termsOf(text) {
  const c = new Map(); for (const w of String(text || '').toLowerCase().match(/[a-z][a-z'-]{3,}/g) || []) if (!STOP.has(w)) c.set(w, (c.get(w) || 0) + 1);
  return [...c].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, MAX_TERMS);
}

/** a field from a text: terms start spaced on the orbit ring, moving round it. Deterministic by seed. */
export function create(text, seed = 1) {
  const r = rng(seed), ts = termsOf(text), n = Math.max(1, ts.length), phase = r() * Math.PI * 2;
  const nodes = ts.map(([name, uses], i) => { const a = phase + (i / n) * Math.PI * 2; return { name, uses, x: 0.5 + ORBIT_R * Math.cos(a), y: 0.5 + ORBIT_R * Math.sin(a), vx: -ORBIT_V * Math.sin(a), vy: ORBIT_V * Math.cos(a), anchored: false, mush: false }; });
  return { nodes, merges: [], t: 0 };
}

/** one step: the centre's pull holds the orbit, overuse attracts pairs, rare pairs repel a little, then merging. */
export function step(s, dt = 1 / 60) {
  const N = s.nodes, k = (ORBIT_V * ORBIT_V) / ORBIT_R;
  for (let i = 0; i < N.length; i++) {
    const a = N[i]; if (a.anchored) { a.vx = a.vy = 0; continue; }
    const dx = 0.5 - a.x, dy = 0.5 - a.y, d = Math.max(0.05, Math.hypot(dx, dy)); let fx = (dx / d) * k, fy = (dy / d) * k; // v^2/r at the ring keeps a circle
    for (let j = 0; j < N.length; j++) {
      if (i === j) continue;
      const b = N[j], ex = b.x - a.x, ey = b.y - a.y, dd = Math.max(0.03, Math.hypot(ex, ey)), over = Math.max(0, a.uses - 1) * Math.max(0, b.uses - 1);
      const f = (over > 0 ? G * over : -0.00004) / (dd * dd); fx += (ex / dd) * f; fy += (ey / dd) * f;
    }
    a.vx += fx * dt; a.vy += fy * dt;
  }
  for (const a of N) { if (a.anchored) continue; a.x = clamp(a.x + a.vx * dt, 0.02, 0.98); a.y = clamp(a.y + a.vy * dt, 0.02, 0.98); }
  for (let i = 0; i < N.length; i++) {
    for (let j = i + 1; j < N.length; j++) {
      const a = N[i], b = N[j]; if (Math.hypot(a.x - b.x, a.y - b.y) >= MERGE_DIST) continue;
      const m = a.uses + b.uses;
      const pin = a.anchored ? a : b.anchored ? b : null; // a pinned term holds the mush where it was pinned
      N[i] = { name: a.name + '+' + b.name, uses: m, x: pin ? pin.x : (a.x * a.uses + b.x * b.uses) / m, y: pin ? pin.y : (a.y * a.uses + b.y * b.uses) / m, vx: pin ? 0 : (a.vx * a.uses + b.vx * b.uses) / m, vy: pin ? 0 : (a.vy * a.uses + b.vy * b.uses) / m, anchored: !!pin, mush: true };
      s.merges.push([a.name, b.name]); N.splice(j, 1); j = i;
    }
  }
  s.t += dt; return s;
}

/** intervention: kick every pair within `reach` apart by `force` (a velocity change away from each other). */
export function pushApart(s, force = 0.15, reach = 0.25) {
  for (let i = 0; i < s.nodes.length; i++) {
    for (let j = i + 1; j < s.nodes.length; j++) {
      const a = s.nodes[i], b = s.nodes[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy); if (d >= reach) continue;
      const ux = d > 1e-6 ? dx / d : 1, uy = d > 1e-6 ? dy / d : 0;
      if (!a.anchored) { a.vx -= ux * force; a.vy -= uy * force; } if (!b.anchored) { b.vx += ux * force; b.vy += uy * force; }
    }
  }
  return s;
}
/** intervention: pin a node where it is, or free it. Returns whether it is now anchored. */
export function toggleAnchor(s, name) { const n = s.nodes.find((q) => q.name === name); if (!n) return false; n.anchored = !n.anchored; if (n.anchored) { n.vx = n.vy = 0; } return n.anchored; }
/** the node nearest a point within `r`, or null. */
export function nodeAt(s, x, y, r = 0.06) { let best = null, bd = r; for (const n of s.nodes) { const d = Math.hypot(n.x - x, n.y - y); if (d < bd) { bd = d; best = n; } } return best; }

export function metrics(s) {
  const n = s.nodes.length || 1, xs = s.nodes.map((q) => q.x), ys = s.nodes.map((q) => q.y), sp = s.nodes.reduce((a, q) => a + Math.hypot(q.vx, q.vy), 0) / n;
  return { entropy: clamp(occupancyEntropy(xs, ys, s.nodes.length, 8), 0, 1), activity: clamp(sp / 0.3, 0, 1), consensus: clamp(s.merges.length / Math.max(1, s.merges.length + s.nodes.length), 0, 1), cx: clamp(xs.reduce((a, v) => a + v, 0) / n, 0, 1), cy: clamp(ys.reduce((a, v) => a + v, 0) / n, 0, 1) };
}
