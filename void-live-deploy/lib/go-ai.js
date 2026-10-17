/**
 * go-ai — V01D's Go opponent for the 9×9 board in skills/go.js (asked by Void: "Next game I want to learn: Go").
 * The proven approach of the classic 9×9 programs before deep learning: Monte Carlo playouts. For each legal move it
 * plays the game out many times with light random moves that never fill their own single-point eyes, scores each
 * finished board by area with komi, and picks the move that won most often (UCB1 spreads the playouts over the moves
 * at the root, the most-visited move is played). Before the playouts, two pieces of tactics the playouts are too
 * light to see: take a group in atari when it can, and save its own group in atari (by capturing an attacker or by
 * extending to two or more liberties). It never plays an illegal move (occupied, suicide, simple ko), never fills its
 * own eye, avoids self-atari when it has anything else, and passes when nothing sensible is left.
 * Pure and deterministic under a seed: no network, no model, no Math.random (pass rng or seed). Rules match
 * skills/go.js (area scoring, 7 komi, simple ko); tools/go-ai.test.mjs checks its moves against that engine.
 * Input: the state skills/go.js keeps ({ size, board: Array(size²) of 0|1|2, turn, ko, passes, status }).
 */
export const KOMI = 7;

/** A small seeded generator (mulberry32): same seed, same game. */
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** A seed from the position, so the same board and turn always get the same reply. */
export function seedOf(state) {
  let h = 2166136261 >>> 0;
  for (const v of state.board) h = Math.imul(h ^ v, 16777619) >>> 0;
  return Math.imul(h ^ (state.turn || 1) ^ ((state.moveCount || 0) << 4), 16777619) >>> 0;
}

// A padded board (one ring of edge points, value 3) so neighbours need no bounds checks.
const EDGE = 3;
class Board {
  constructor(size) {
    this.n = size; this.w = size + 2; this.cells = new Int8Array(this.w * this.w).fill(EDGE);
    this.dirs = [1, -1, this.w, -this.w];
    this.mark = new Int32Array(this.w * this.w); this.stamp = 0; this.stack = new Int32Array(this.w * this.w);
    this.ko = -1;
  }
  static from(state) {
    const b = new Board(state.size);
    for (let i = 0; i < state.size * state.size; i++) b.cells[b.pad(i)] = state.board[i] || 0;
    b.ko = state.ko >= 0 ? b.pad(state.ko) : -1;
    return b;
  }
  copyFrom(o) { this.cells.set(o.cells); this.ko = o.ko; }
  pad(i) { return (Math.floor(i / this.n) + 1) * this.w + (i % this.n) + 1; }
  unpad(p) { return (Math.floor(p / this.w) - 1) * this.n + (p % this.w) - 1; }
  // distinct liberties of the group at p, counting no further than `limit`
  libs(p, limit = 1e9) {
    const c = this.cells, color = c[p], mark = this.mark, st = this.stack, s = ++this.stamp;
    let top = 0, n = 0; st[top++] = p; mark[p] = s;
    while (top) {
      const q = st[--top];
      for (const d of this.dirs) {
        const r = q + d; if (mark[r] === s) continue;
        const v = c[r];
        if (v === 0) { mark[r] = s; if (++n >= limit) return n; } else if (v === color) { mark[r] = s; st[top++] = r; }
      }
    }
    return n;
  }
  // the liberty points of the group at p (for a group known to have few)
  libPoints(p) {
    const c = this.cells, color = c[p], mark = this.mark, st = this.stack, s = ++this.stamp, out = [];
    let top = 0; st[top++] = p; mark[p] = s;
    while (top) {
      const q = st[--top];
      for (const d of this.dirs) { const r = q + d; if (mark[r] === s) continue; const v = c[r]; if (v === 0) { mark[r] = s; out.push(r); } else if (v === color) { mark[r] = s; st[top++] = r; } }
    }
    return out;
  }
  stones(p) {
    const c = this.cells, color = c[p], mark = this.mark, st = this.stack, s = ++this.stamp, out = [];
    let top = 0; st[top++] = p; mark[p] = s;
    while (top) { const q = st[--top]; out.push(q); for (const d of this.dirs) { const r = q + d; if (mark[r] !== s && c[r] === color) { mark[r] = s; st[top++] = r; } } }
    return out;
  }
  remove(p) { const g = this.stones(p); for (const q of g) this.cells[q] = 0; return g.length; }
  // a single-point eye of `color`: every neighbour is that colour (or the edge), and the diagonals don't let the opponent break it
  isEye(p, color) {
    const c = this.cells, w = this.w;
    for (const d of this.dirs) { const v = c[p + d]; if (v !== color && v !== EDGE) return false; }
    let bad = 0, edge = 0;
    for (const d of [w + 1, w - 1, -w + 1, -w - 1]) { const v = c[p + d]; if (v === EDGE) edge = 1; else if (v === 3 - color) bad++; }
    return bad + edge < 2;
  }
  // is a move by `color` at p legal (empty, not the ko point, not suicide)?
  legal(p, color) {
    const c = this.cells;
    if (c[p] !== 0 || p === this.ko) return false;
    for (const d of this.dirs) if (c[p + d] === 0) return true;
    const opp = 3 - color;
    c[p] = color;
    let ok = false;
    for (const d of this.dirs) {
      const v = c[p + d];
      if (v === opp && this.libs(p + d, 1) === 0) { ok = true; break; } // it captures
      if (v === color && this.libs(p + d, 1) > 0) { ok = true; break; } // joins a group that keeps a liberty
    }
    c[p] = 0;
    return ok;
  }
  // play a legal move; returns the number of stones it took
  play(p, color) {
    const c = this.cells, opp = 3 - color;
    c[p] = color;
    let taken = 0, lastTaken = -1;
    for (const d of this.dirs) { const r = p + d; if (c[r] === opp && this.libs(r, 1) === 0) { lastTaken = r; taken += this.remove(r); } }
    // simple ko, the same rule as skills/go.js: one stone took exactly one and stands alone with one liberty
    let alone = true; for (const d of this.dirs) if (c[p + d] === color) { alone = false; break; }
    this.ko = taken === 1 && alone && this.libs(p, 2) === 1 ? lastTaken : -1;
    return taken;
  }
  // area score: stones plus empty points whose neighbours are all one colour (after a playout every empty point is an eye or dame)
  score() {
    const c = this.cells; let b = 0, w = 0;
    for (let r = 1; r <= this.n; r++) for (let q = r * this.w + 1, e = q + this.n; q < e; q++) {
      const v = c[q];
      if (v === 1) b++; else if (v === 2) w++;
      else { let sb = 0, sw = 0; for (const d of this.dirs) { const u = c[q + d]; if (u === 1) sb = 1; else if (u === 2) sw = 1; } if (sb && !sw) b++; else if (sw && !sb) w++; }
    }
    return b - w - KOMI; // > 0: Black wins
  }
  // the same count as skills/go.js countPosition (every stone alive): stones plus empty regions only one colour touches, minus komi
  area() {
    const c = this.cells, mark = this.mark, st = this.stack, s = ++this.stamp; let b = 0, w = 0;
    for (let r = 1; r <= this.n; r++) for (let q = r * this.w + 1, e = q + this.n; q < e; q++) {
      const v = c[q];
      if (v === 1) { b++; continue; } if (v === 2) { w++; continue; } if (mark[q] === s) continue;
      let top = 0, n = 0, touch = 0; st[top++] = q; mark[q] = s;
      while (top) { const x = st[--top]; n++; for (const d of this.dirs) { const y = x + d, u = c[y]; if (u === 1 || u === 2) touch |= u; else if (u === 0 && mark[y] !== s) { mark[y] = s; st[top++] = y; } } }
      if (touch === 1) b += n; else if (touch === 2) w += n;
    }
    return b - w - KOMI;
  }
}

// one light playout from `b` with `color` to move; returns the winner (1 or 2)
function playout(b, color, rng, empties) {
  const n2 = empties.length; let len = 0;
  for (let q = 1; q <= b.n; q++) for (let p = q * b.w + 1, e = p + b.n; p < e; p++) if (b.cells[p] === 0) empties[len++] = p;
  let passes = 0, moves = 0; const cap = n2 * 3;
  while (passes < 2 && moves < cap) {
    let played = false;
    if (len) {
      const start = Math.floor(rng() * len);
      for (let k = 0; k < len; k++) {
        const idx = (start + k) % len, p = empties[idx];
        if (b.cells[p] !== 0) { empties[idx] = empties[--len]; k--; if (!len) break; continue; } // taken since: drop it
        if (b.isEye(p, color) || !b.legal(p, color)) continue;
        const took = b.play(p, color);
        empties[idx] = empties[--len];
        if (took) { len = 0; for (let q = 1; q <= b.n; q++) for (let r = q * b.w + 1, e = r + b.n; r < e; r++) if (b.cells[r] === 0) empties[len++] = r; } // stones came off: the points are open again
        played = true; break;
      }
    }
    if (played) passes = 0; else { passes++; b.ko = -1; }
    color = 3 - color; moves++;
  }
  return b.score() > 0 ? 1 : 2;
}

/**
 * Think about the position and choose. state: skills/go.js's state; the side to move is state.turn.
 * opts: { playouts = 1000, rng, seed } (rng wins over seed; neither: a seed from the position).
 * Returns { move: point index | 'pass', why: 'capture'|'save'|'playouts'|'no move'|'ahead'|'lost', winrate, playouts }.
 */
export function think(state, opts = {}) {
  const color = state.turn, opp = 3 - color, size = state.size;
  if (state.status && state.status !== 'playing') return { move: 'pass', why: 'no move', winrate: null, playouts: 0 };
  const rng = opts.rng || makeRng(opts.seed != null ? opts.seed : seedOf(state));
  const budget = Math.max(1, opts.playouts || 1000);
  const b = Board.from(state);
  const all = []; for (let i = 0; i < size * size; i++) all.push(b.pad(i));

  // tactics first: the biggest capture, or saving the biggest group of ours in atari
  let best = null;
  const offer = (p, value, why) => { if (b.legal(p, color) && (!best || value > best.value)) best = { p, value, why }; };
  const seen = new Set();
  for (const p of all) {
    const v = b.cells[p]; if (!v || seen.has(p)) continue;
    const g = b.stones(p); for (const q of g) seen.add(q);
    if (b.libs(p, 2) !== 1) continue;
    const [lib] = b.libPoints(p);
    if (v === opp) offer(lib, g.length, 'capture');
    else {
      // save it: take an attacker that is itself in atari, or extend to two or more liberties
      const near = new Set();
      for (const q of g) for (const d of b.dirs) { const r = q + d; if (b.cells[r] === opp && b.libs(r, 2) === 1) near.add(b.libPoints(r)[0]); }
      for (const l of near) offer(l, g.length + 0.5, 'save');
      if (b.legal(lib, color)) { const t = new Board(size); t.copyFrom(b); t.play(lib, color); if (t.libs(lib, 3) >= 2) offer(lib, g.length + 0.25, 'save'); }
    }
  }
  if (best) return { move: b.unpad(best.p), why: best.why, winrate: null, playouts: 0 };

  // the moves worth trying: legal, not our own eye, and not self-atari unless that is all there is
  let cands = all.filter((p) => b.legal(p, color) && !b.isEye(p, color));
  const safe = cands.filter((p) => { const t = new Board(size); t.copyFrom(b); const took = t.play(p, color); return took > 0 || t.libs(p, 2) >= 2; });
  if (safe.length) cands = safe;
  if (!cands.length) return { move: 'pass', why: 'no move', winrate: null, playouts: 0 };

  // flat Monte Carlo with UCB1 at the root
  const wins = new Float64Array(cands.length), visits = new Float64Array(cands.length), sim = new Board(size), empties = new Int32Array(size * size);
  for (let k = 0; k < budget; k++) {
    let pick = -1;
    if (k < cands.length) pick = k;
    else {
      let top = -1; const lnk = Math.log(k);
      for (let j = 0; j < cands.length; j++) { const u = wins[j] / visits[j] + 0.7 * Math.sqrt(lnk / visits[j]); if (u > top) { top = u; pick = j; } }
    }
    sim.copyFrom(b); sim.play(cands[pick], color);
    if (playout(sim, opp, rng, empties) === color) wins[pick]++;
    visits[pick]++;
  }
  let pick = 0;
  for (let j = 1; j < cands.length; j++) if (visits[j] > visits[pick] || (visits[j] === visits[pick] && wins[j] > wins[pick])) pick = j;
  const winrate = visits[pick] ? wins[pick] / visits[pick] : 0;

  // the other side just passed: stop if we are ahead on the board as it stands, or if even our best move loses
  if (state.passes === 1) {
    const now = b.area(), ahead = color === 1 ? now > 0 : now < 0;
    if (ahead && winrate >= 0.5) return { move: 'pass', why: 'ahead', winrate, playouts: budget };
    if (winrate < 0.1) return { move: 'pass', why: 'lost', winrate, playouts: budget };
  }
  return { move: b.unpad(cands[pick]), why: 'playouts', winrate, playouts: budget };
}

/** The move only: a point index, or 'pass'. */
export const chooseMove = (state, opts) => think(state, opts).move;
