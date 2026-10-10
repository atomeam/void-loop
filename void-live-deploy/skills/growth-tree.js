/**
 * growth-tree — the layout of Void's growth tree (frontier #3), with no three.js: the growth ledger (void.growth.json) in,
 * one branch per entry out. The miniature (skills/mini/growthtree.js) poses from this and nothing else; the tests
 * (tools/growth-tree.test.mjs) check it on a fixture ledger.
 *
 * How it grows, so it reads like a real tree and stays honest about the ledger:
 *  - the oldest entry is the trunk; every later entry, in the order it happened, sprouts from a branch already there, so
 *    every branch is older than the ones growing from it and the newest entries are always at the tips;
 *  - each entry's own text and time seed its branch (where on its parent it sprouts, its angle, its length), so the tree
 *    is the same for everyone, every day, and a new entry only adds a branch: nothing that grew before it moves;
 *  - branches spiral round their parent by the golden angle, lean towards the light and taper; thickness follows the
 *    pipe model (a branch's cross-section feeds every twig above it), so the trunk is thickest and twigs thinnest.
 * Lengths are metres: the trunk is about 1.6 m, a full ledger makes a tree a few metres tall.
 */
import { KIND_COLOR } from './growth.js';

export { KIND_COLOR };
export const TRUNK = 1.6, TWIG = 0.12, TIP_RADIUS = 0.012, PIPE = 2.5, MAX_CHILDREN = 4, MAX_DEPTH = 8;
const GOLDEN = Math.PI * (3 - Math.sqrt(5)), UP = [0, 1, 0];

// FNV-1a, then mulberry32: small, fast and the same in every browser and in node
export function hash32(s) { let h = 0x811c9dc5; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const round = (a) => a.map((x) => Math.round(x * 1e6) / 1e6);

/** The ledger's valid entries, oldest first (ties keep ledger order); each keeps its index in the ledger. */
export function chronological(list, until) {
  const lim = until ? Date.parse(until) : Infinity;
  return (Array.isArray(list) ? list : []).map((e, index) => ({ e, index, t: Date.parse(e && e.at) }))
    .filter((x) => x.e && typeof x.e.what === 'string' && x.e.what.trim() && !isNaN(x.t) && x.t <= lim)
    .sort((a, b) => a.t - b.t || a.index - b.index);
}

/**
 * The tree for a ledger: { branches, height, width } where each branch is
 * { index (in the ledger), kind, at, color, parent (branch number or -1), children, depth, start, end, dir, length,
 *   radius (at its base), tipRadius, profile ([fraction along, radius] from base to tip) }. `until` (an ISO time) grows the tree as it stood then: the time slider's hook.
 */
export function layout(list, { until } = {}) {
  const branches = [];
  for (const { e, index } of chronological(list, until)) {
    const r = rng(hash32(e.at + '|' + e.kind + '|' + e.what));
    const b = { index, kind: e.kind, at: e.at, color: KIND_COLOR[e.kind] || '#9a9a9a', parent: -1, children: [], depth: 0 };
    if (!branches.length) { // the trunk: a slight lean, its own way
      const lean = 0.05 + 0.05 * r(), az = r() * 2 * Math.PI;
      b.dir = norm([Math.sin(lean) * Math.cos(az), Math.cos(lean), Math.sin(lean) * Math.sin(az)]);
      b.start = [0, 0, 0]; b.length = TRUNK; b.azimuth = az;
    } else {
      // the parent: any branch with room; the more recent, the nearer the trunk and the more side shoots it already has, the
      // likelier, so shoots cluster along limbs and the tree spreads into a crown of tips instead of running up in chains
      const n = branches.length;
      let total = 0;
      const w = branches.map((p, i) => { const ok = p.children.length < MAX_CHILDREN && p.depth < MAX_DEPTH; const x = ok ? (0.2 + i / n) * (1 + p.children.length) / (1 + 0.9 * p.depth) ** 3 : 0; total += x; return x; });
      let pick = r() * total, pi = 0;
      while (pi < n - 1 && (pick -= w[pi]) > 0) pi++;
      while (pi > 0 && !w[pi]) pi--; // float rounding past the end lands back on a branch with room
      const p = branches[pi], k = p.children.length;
      const along = p.parent < 0 ? 0.35 + 0.6 * r() : 0.45 + 0.5 * r();
      const spread = (28 + 26 * r()) * Math.PI / 180, az = p.azimuth + GOLDEN * (k + 1) + (r() - 0.5) * 0.6;
      const u = norm(cross(Math.abs(p.dir[1]) > 0.9 ? [1, 0, 0] : UP, p.dir)), v = cross(p.dir, u);
      let dir = norm(add(mul(p.dir, Math.cos(spread)), mul(add(mul(u, Math.cos(az)), mul(v, Math.sin(az))), Math.sin(spread))));
      dir = norm(add(dir, [0, 0.22, 0])); // towards the light
      b.parent = pi; b.depth = p.depth + 1; b.azimuth = az; b.along = along;
      b.start = add(p.start, mul(p.dir, p.length * along));
      b.length = TWIG + (p.length - TWIG) * (0.58 + 0.22 * r()); // shorter than its parent, never shorter than a twig
      if (b.start[1] + dir[1] * b.length < 0.4) dir = norm(add(dir, [0, 1, 0])); // never into the ground
      b.dir = dir;
      p.children.push(n);
    }
    b.end = add(b.start, mul(b.dir, b.length));
    branches.push(b);
  }
  // the pipe model, from the tips down: children always come after their parent
  for (let i = branches.length - 1; i >= 0; i--) {
    const b = branches[i];
    b.radius = (TIP_RADIUS ** PIPE + b.children.reduce((s, c) => s + branches[c].radius ** PIPE, 0)) ** (1 / PIPE);
    b.tipRadius = TIP_RADIUS * 0.6;
    // its shape along its length, [fraction along, radius]: wood carrying branches stays at least as thick as each of them
    // up to its highest fork (no branch is wider than where it grows from), then thins away to a twig like a leader does
    const top = b.children.length ? Math.max(...b.children.map((c) => branches[c].along)) : 0;
    b.profile = top ? [[0, b.radius], [top, Math.max(b.radius * 0.45, ...b.children.map((c) => branches[c].radius))], [1, b.tipRadius]] : [[0, b.radius], [1, b.tipRadius]];
  }
  let height = 0, width = 0;
  for (const b of branches) {
    b.start = round(b.start); b.end = round(b.end); b.dir = round(b.dir);
    height = Math.max(height, b.end[1]); width = Math.max(width, Math.hypot(b.end[0], b.end[2]));
    b.profile = b.profile.map(([f, r]) => [Math.round(f * 1e4) / 1e4, Math.round(r * 1e6) / 1e6]);
    delete b.azimuth; delete b.along;
  }
  return { branches, height, width };
}

/** The point halfway along a branch (what a test taps, and where the card's readout points). */
export const midpoint = (b) => round(add(b.start, mul(b.dir, b.length / 2)));
