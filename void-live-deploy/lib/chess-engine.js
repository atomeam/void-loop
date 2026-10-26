/**
 * chess-engine: Verse's own chess engine for /chess/ (owner, 2026-10-26: the games floor, Lichess). Written here, not vendored: no third-party engine code.
 * A 0x88 board with make/unmake, Zobrist keys, a transposition table, iterative deepening with principal-variation search, null-move pruning, late-move
 * reductions, killer and history move order, check extensions and a capture search to quiet positions. The evaluation is material, piece-square tables
 * (the same simplified tables as skills/chess-rules.js), the bishop pair, doubled, isolated and passed pawns, and the king walking to the centre in an
 * ending. The rules the page plays by are skills/chess-rules.js; this module only searches (and has its own move generator, checked against the same
 * perft counts in tools/chess.test.mjs).
 *   search(fen, { depth, ms, noise, slip, rng, onInfo }) -> { move: 'e2e4', score, depth, nodes, pv: ['e2e4', ...], mate }
 *   perft(fen, depth) -> number      LEVELS: the eight strengths of the page      levelOpts(n) -> the search options of level n
 * Pure apart from the clock (Date.now) and the rng passed in. Runs in a Web Worker on the page (lib/chess-worker.js).
 */
const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6, BLACK = 8;
const VAL = [0, 100, 320, 335, 500, 900, 0];
const PST = {
  1: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
  2: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
  3: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
  4: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
  5: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
  6: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
  7: [-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30, -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50],
};
const PASSED = [0, 5, 10, 20, 35, 60, 100, 0]; // by ranks advanced
const KNIGHT = [33, 31, 18, 14, -33, -31, -18, -14], KING = [1, -1, 16, -16, 15, 17, -15, -17], DIAG = [15, 17, -15, -17], ORTH = [1, -1, 16, -16];
const MATE = 30000, INF = 32000;
const FILES = 'abcdefgh';
const sq64 = (s) => (s >> 4) * 8 + (s & 7);
const name = (s) => FILES[s & 7] + ((s >> 4) + 1);
const parseSq = (t) => (FILES.indexOf(t[0])) + (+t[1] - 1) * 16;

// Zobrist keys: two 32-bit halves from a fixed seed, so a position has the same key in every run
let seed = 0x9e3779b9;
const r32 = () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed | 0; };
const ZP = []; for (let i = 0; i < 16 * 128; i++) ZP.push([r32(), r32()]);
const ZSIDE = [r32(), r32()], ZC = []; for (let i = 0; i < 16; i++) ZC.push([r32(), r32()]);
const ZEP = []; for (let i = 0; i < 128; i++) ZEP.push([r32(), r32()]);

/** a position on the 0x88 board from a FEN. Pure. */
export function fromFEN(fen) {
  const [pl, turn, cs, ep, half] = String(fen).trim().split(/\s+/);
  const b = new Int8Array(128), map = { p: P, n: N, b: B, r: R, q: Q, k: K };
  const rows = pl.split('/'); if (rows.length !== 8) throw new Error('bad FEN');
  rows.forEach((row, i) => { let f = 0; const r = 7 - i; for (const ch of row) { if (/\d/.test(ch)) f += +ch; else { const t = map[ch.toLowerCase()]; if (!t || f > 7) throw new Error('bad FEN'); b[r * 16 + f++] = t | (ch === ch.toLowerCase() ? BLACK : 0); } } });
  const st = { b, side: turn === 'b' ? BLACK : 0, castle: 0, ep: -1, half: +half || 0, kings: [0, 0], lo: 0, hi: 0, hist: [] };
  for (const c of cs || '') st.castle |= { K: 1, Q: 2, k: 4, q: 8 }[c] || 0;
  if (ep && ep !== '-') st.ep = parseSq(ep);
  for (let s = 0; s < 128; s++) if (!(s & 0x88) && (b[s] & 7) === K) st.kings[b[s] & BLACK ? 1 : 0] = s;
  hashAll(st); return st;
}
function hashAll(st) {
  let lo = 0, hi = 0;
  for (let s = 0; s < 128; s++) if (!(s & 0x88) && st.b[s]) { const z = ZP[st.b[s] * 128 + s]; lo ^= z[0]; hi ^= z[1]; }
  if (st.side) { lo ^= ZSIDE[0]; hi ^= ZSIDE[1]; }
  lo ^= ZC[st.castle][0]; hi ^= ZC[st.castle][1];
  if (st.ep >= 0) { lo ^= ZEP[st.ep][0]; hi ^= ZEP[st.ep][1]; }
  st.lo = lo; st.hi = hi;
}
/** whether square s is attacked by the side `by` (0 white, 8 black). Pure. */
export function attacked(st, s, by) {
  const b = st.b;
  const pd = by ? 16 : -16; // a white pawn attacks from below
  for (const d of [pd - 1, pd + 1]) { const f = s + d; if (!(f & 0x88) && b[f] === (P | by)) return true; }
  for (const d of KNIGHT) { const f = s + d; if (!(f & 0x88) && b[f] === (N | by)) return true; }
  for (const d of KING) { const f = s + d; if (!(f & 0x88) && b[f] === (K | by)) return true; }
  for (const d of DIAG) { let f = s + d; while (!(f & 0x88)) { const p = b[f]; if (p) { if (p === (B | by) || p === (Q | by)) return true; break; } f += d; } }
  for (const d of ORTH) { let f = s + d; while (!(f & 0x88)) { const p = b[f]; if (p) { if (p === (R | by) || p === (Q | by)) return true; break; } f += d; } }
  return false;
}
const inCheck = (st) => attacked(st, st.kings[st.side ? 1 : 0], st.side ^ BLACK);
// a move is one number: from | to << 7 | promo << 14 | flags << 17 (1 capture, 2 en passant, 4 castle, 8 double push)
const mv = (f, t, pr = 0, fl = 0) => f | (t << 7) | (pr << 14) | (fl << 17);
const FROM = (m) => m & 127, TO = (m) => (m >> 7) & 127, PROMO = (m) => (m >> 14) & 7, FLAGS = (m) => m >> 17;
/** the pseudo-legal moves (captures only when `caps`). */
function gen(st, caps = false) {
  const out = [], b = st.b, me = st.side, them = me ^ BLACK;
  for (let s = 0; s < 128; s++) {
    if (s & 0x88) { s += 7; continue; }
    const p = b[s]; if (!p || (p & BLACK) !== me) continue;
    const t = p & 7;
    if (t === P) {
      const d = me ? -16 : 16, start = me ? 6 : 1, last = me ? 0 : 7, one = s + d;
      const push = (to, fl) => { if ((to >> 4) === last) { for (const pr of [Q, R, B, N]) out.push(mv(s, to, pr, fl)); } else out.push(mv(s, to, 0, fl)); };
      if (!(one & 0x88) && !b[one]) { if (!caps || (one >> 4) === last) push(one, 0); if (!caps && (s >> 4) === start && !b[one + d]) out.push(mv(s, one + d, 0, 8)); }
      for (const dd of [d - 1, d + 1]) { const to = s + dd; if (to & 0x88) continue; if (b[to] && (b[to] & BLACK) === them) push(to, 1); else if (to === st.ep) out.push(mv(s, to, 0, 3)); }
    } else if (t === N || t === K) {
      for (const d of t === N ? KNIGHT : KING) { const to = s + d; if (to & 0x88) continue; const q = b[to]; if (!q) { if (!caps) out.push(mv(s, to)); } else if ((q & BLACK) === them) out.push(mv(s, to, 0, 1)); }
      if (t === K && !caps) {
        const home = me ? 0x74 : 0x04, kc = me ? 4 : 1, qc = me ? 8 : 2;
        if (s === home && !attacked(st, home, them)) {
          if ((st.castle & kc) && b[home + 3] === (R | me) && !b[home + 1] && !b[home + 2] && !attacked(st, home + 1, them) && !attacked(st, home + 2, them)) out.push(mv(s, home + 2, 0, 4));
          if ((st.castle & qc) && b[home - 4] === (R | me) && !b[home - 1] && !b[home - 2] && !b[home - 3] && !attacked(st, home - 1, them) && !attacked(st, home - 2, them)) out.push(mv(s, home - 2, 0, 4));
        }
      }
    } else {
      const dirs = t === B ? DIAG : t === R ? ORTH : KING;
      for (const d of dirs) { let to = s + d; while (!(to & 0x88)) { const q = b[to]; if (q) { if ((q & BLACK) === them) out.push(mv(s, to, 0, 1)); break; } if (!caps) out.push(mv(s, to)); to += d; } }
    }
  }
  return out;
}
const CASTLE_MASK = new Uint8Array(128).fill(15); CASTLE_MASK[0x00] = 15 ^ 2; CASTLE_MASK[0x07] = 15 ^ 1; CASTLE_MASK[0x04] = 15 ^ 3; CASTLE_MASK[0x70] = 15 ^ 8; CASTLE_MASK[0x77] = 15 ^ 4; CASTLE_MASK[0x74] = 15 ^ 12;
const zx = (st, z) => { st.lo ^= z[0]; st.hi ^= z[1]; };
function make(st, m) {
  const b = st.b, f = FROM(m), t = TO(m), fl = FLAGS(m), p = b[f], me = st.side;
  const cap = fl & 2 ? (P | (me ^ BLACK)) : b[t];
  st.hist.push([m, cap, st.castle, st.ep, st.half, st.lo, st.hi]);
  zx(st, ZC[st.castle]); if (st.ep >= 0) zx(st, ZEP[st.ep]);
  zx(st, ZP[p * 128 + f]); if (cap && !(fl & 2)) zx(st, ZP[cap * 128 + t]);
  b[f] = 0; const np = PROMO(m) ? PROMO(m) | me : p; b[t] = np; zx(st, ZP[np * 128 + t]);
  if (fl & 2) { const cs = t + (me ? 16 : -16); b[cs] = 0; zx(st, ZP[cap * 128 + cs]); }
  if (fl & 4) { const [rf, rt] = t > f ? [t + 1, t - 1] : [t - 2, t + 1]; const rk = b[rf]; b[rt] = rk; b[rf] = 0; zx(st, ZP[rk * 128 + rf]); zx(st, ZP[rk * 128 + rt]); }
  if ((p & 7) === K) st.kings[me ? 1 : 0] = t;
  st.castle &= CASTLE_MASK[f] & CASTLE_MASK[t]; zx(st, ZC[st.castle]);
  st.ep = fl & 8 ? (f + t) >> 1 : -1; if (st.ep >= 0) zx(st, ZEP[st.ep]);
  st.half = (p & 7) === P || cap ? 0 : st.half + 1;
  st.side ^= BLACK; zx(st, ZSIDE);
}
function unmake(st) {
  const [m, cap, castle, ep, half, lo, hi] = st.hist.pop(), b = st.b, f = FROM(m), t = TO(m), fl = FLAGS(m);
  st.side ^= BLACK; const me = st.side;
  const p = PROMO(m) ? (P | me) : b[t];
  b[f] = p; b[t] = fl & 2 ? 0 : cap;
  if (fl & 2) b[t + (me ? 16 : -16)] = cap;
  if (fl & 4) { const [rf, rt] = t > f ? [t + 1, t - 1] : [t - 2, t + 1]; b[rf] = b[rt]; b[rt] = 0; }
  if ((p & 7) === K) st.kings[me ? 1 : 0] = f;
  st.castle = castle; st.ep = ep; st.half = half; st.lo = lo; st.hi = hi;
}
function nullMake(st) { st.hist.push([0, 0, st.castle, st.ep, st.half, st.lo, st.hi]); if (st.ep >= 0) zx(st, ZEP[st.ep]); st.ep = -1; st.side ^= BLACK; zx(st, ZSIDE); st.half = 0; }
function nullUnmake(st) { const [, , castle, ep, half, lo, hi] = st.hist.pop(); st.side ^= BLACK; st.castle = castle; st.ep = ep; st.half = half; st.lo = lo; st.hi = hi; }
/** the legal moves as numbers. */
function legal(st) { const out = []; for (const m of gen(st)) { make(st, m); if (!attacked(st, st.kings[st.side ? 0 : 1], st.side)) out.push(m); unmake(st); } return out; }
export const uci = (m) => name(FROM(m)) + name(TO(m)) + (PROMO(m) ? ' pnbrqk'[PROMO(m)] : '');
/** the number of leaf positions `depth` moves deep: the standard check of a move generator. Pure. */
export function perft(fen, depth) {
  const st = typeof fen === 'string' ? fromFEN(fen) : fen;
  const go = (d) => { if (!d) return 1; let n = 0; for (const m of gen(st)) { make(st, m); if (!attacked(st, st.kings[st.side ? 0 : 1], st.side)) n += go(d - 1); unmake(st); } return n; };
  return go(depth);
}
/** the position's worth in centipawns for the side to move. Pure. */
export function evaluate(st) {
  const b = st.b; let score = 0, mat = 0, bishops = [0, 0];
  const pawnsF = [new Int8Array(8), new Int8Array(8)];
  for (let s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } const p = b[s]; if (!p) continue; const t = p & 7; if (t === P) pawnsF[p & BLACK ? 1 : 0][s & 7]++; else if (t !== K) mat += VAL[t]; if (t === B) bishops[p & BLACK ? 1 : 0]++; }
  const end = mat <= 2600;
  for (let s = 0; s < 128; s++) {
    if (s & 0x88) { s += 7; continue; } const p = b[s]; if (!p) continue;
    const t = p & 7, black = p & BLACK, r = s >> 4, f = s & 7, idx = black ? r * 8 + f : (7 - r) * 8 + f;
    let v = VAL[t] + PST[t === K && end ? 7 : t][idx];
    if (t === P) {
      const c = black ? 1 : 0, o = 1 - c, my = pawnsF[c], op = pawnsF[o];
      if (my[f] > 1) v -= 12; if ((f === 0 || !my[f - 1]) && (f === 7 || !my[f + 1])) v -= 14;
      let passed = true; const dir = black ? -16 : 16;
      for (let ff = Math.max(0, f - 1); ff <= Math.min(7, f + 1) && passed; ff++) for (let q = s + dir + (ff - f); !(q & 0x88); q += dir) if (b[q] === (P | (black ^ BLACK))) { passed = false; break; }
      if (passed) v += PASSED[black ? 7 - r : r] * (end ? 2 : 1);
    }
    score += black ? -v : v;
  }
  if (bishops[0] >= 2) score += 30; if (bishops[1] >= 2) score -= 30;
  return st.side ? -score : score;
}
// the transposition table: 2^18 entries of [hi key, depth, flag, score, move]
const TT_BITS = 18, TT_SIZE = 1 << TT_BITS, TT_MASK = TT_SIZE - 1;
const ttKey = new Int32Array(TT_SIZE), ttDepth = new Int8Array(TT_SIZE), ttFlag = new Int8Array(TT_SIZE), ttScore = new Int16Array(TT_SIZE), ttMove = new Int32Array(TT_SIZE);
const EXACT = 1, LOWER = 2, UPPER = 3;
const repeated = (st) => { const h = st.hist; for (let i = h.length - 2; i >= 0 && i >= h.length - 1 - st.half; i -= 2) if (h[i][5] === st.lo && h[i][6] === st.hi) return true; return false; };
const nonPawn = (st) => { for (let s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } const p = st.b[s]; if (p && (p & BLACK) === st.side && (p & 7) !== P && (p & 7) !== K) return true; } return false; };
/** search a position. `prior` are the keys of the positions before it in the game (repetition). Returns the best move in coordinates. */
export function search(fen, { depth = 6, ms = 1000, noise = 0, slip = 0, rng = Math.random, onInfo = null, prior = [] } = {}) {
  const st = fromFEN(fen); for (const [lo, hi] of prior) st.hist.push([0, 0, 0, -1, 0, lo, hi]); st.half = Math.min(st.half + prior.length, 100);
  const root = legal(st); if (!root.length) return { move: null, score: inCheck(st) ? -MATE : 0, depth: 0, nodes: 0, pv: [], mate: null };
  const t0 = Date.now(); let nodes = 0, stop = false;
  const killers = []; const history = new Int32Array(16 * 128);
  const tick = () => { if ((++nodes & 2047) === 0 && Date.now() - t0 > ms) stop = true; return stop; };
  const score = (m, ply, ttm) => { if (m === ttm) return 1e7; const fl = FLAGS(m); if (fl & 1) return 1e6 + VAL[(st.b[TO(m)] & 7) || 1] * 10 - VAL[st.b[FROM(m)] & 7] / 10; if (PROMO(m)) return 9e5; const k = killers[ply]; if (k && (k[0] === m || k[1] === m)) return 8e5; return history[st.b[FROM(m)] * 128 + TO(m)]; };
  const sortMoves = (ms_, ply, ttm) => { const sc = ms_.map((m) => score(m, ply, ttm)); const idx = ms_.map((_, i) => i).sort((a, b) => sc[b] - sc[a]); return idx.map((i) => ms_[i]); };
  function quiesce(alpha, beta, ply) {
    if (tick()) return 0;
    const stand = evaluate(st); if (stand >= beta) return beta; if (stand > alpha) alpha = stand;
    if (ply > 60) return alpha;
    for (const m of sortMoves(gen(st, true), ply, 0)) {
      if (!PROMO(m) && stand + VAL[(st.b[TO(m)] & 7) || 1] + 200 < alpha) continue; // a capture that cannot lift the score past alpha
      make(st, m); if (attacked(st, st.kings[st.side ? 0 : 1], st.side)) { unmake(st); continue; }
      const v = -quiesce(-beta, -alpha, ply + 1); unmake(st); if (stop) return 0;
      if (v >= beta) return beta; if (v > alpha) alpha = v;
    }
    return alpha;
  }
  function nega(d, alpha, beta, ply, canNull) {
    if (ply && (st.half >= 100 || repeated(st))) return 0;
    const chk = inCheck(st); if (chk) d++;
    if (d <= 0) return quiesce(alpha, beta, ply);
    if (tick()) return 0;
    const i = st.lo & TT_MASK; let ttm = 0;
    if (ttKey[i] === st.hi) { ttm = ttMove[i]; if (ply && ttDepth[i] >= d) { let s = ttScore[i]; const f = ttFlag[i]; if (s > MATE - 300) s -= ply; else if (s < 300 - MATE) s += ply; if (f === EXACT || (f === LOWER && s >= beta) || (f === UPPER && s <= alpha)) return s; } }
    if (canNull && !chk && d >= 3 && ply && beta < MATE - 100 && nonPawn(st) && evaluate(st) >= beta) {
      nullMake(st); const v = -nega(d - 3, -beta, -beta + 1, ply + 1, false); nullUnmake(st); if (stop) return 0; if (v >= beta) return beta;
    }
    let best = -INF, bestM = 0, legalN = 0; const a0 = alpha;
    for (const m of sortMoves(gen(st), ply, ttm)) {
      make(st, m); if (attacked(st, st.kings[st.side ? 0 : 1], st.side)) { unmake(st); continue; }
      legalN++; let v;
      const quiet = !(FLAGS(m) & 1) && !PROMO(m);
      if (legalN === 1) v = -nega(d - 1, -beta, -alpha, ply + 1, true);
      else {
        const red = quiet && !chk && d >= 3 && legalN > 3 && !inCheck(st) ? 1 + (legalN > 8 ? 1 : 0) : 0;
        v = -nega(d - 1 - red, -alpha - 1, -alpha, ply + 1, true);
        if (v > alpha && (red || v < beta)) v = -nega(d - 1, -beta, -alpha, ply + 1, true);
      }
      unmake(st); if (stop) return 0;
      if (v > best) { best = v; bestM = m; }
      if (v > alpha) alpha = v;
      if (alpha >= beta) { if (quiet) { const k = killers[ply] || (killers[ply] = [0, 0]); if (k[0] !== m) { k[1] = k[0]; k[0] = m; } history[st.b[FROM(m)] * 128 + TO(m)] += d * d; } break; }
    }
    if (!legalN) return chk ? -MATE + ply : 0;
    ttKey[i] = st.hi; ttDepth[i] = d; ttScore[i] = best > MATE - 300 ? best + ply : best < 300 - MATE ? best - ply : best; ttMove[i] = bestM; ttFlag[i] = best <= a0 ? UPPER : best >= beta ? LOWER : EXACT;
    return best;
  }
  const pvOf = (first) => { const out = [uci(first)]; let n = 0; make(st, first); n++; const seen = new Set(); while (out.length < 12) { const i = st.lo & TT_MASK; if (ttKey[i] !== st.hi || !ttMove[i] || seen.has(st.lo)) break; seen.add(st.lo); const m = ttMove[i]; if (!legal(st).includes(m)) break; out.push(uci(m)); make(st, m); n++; } while (n--) unmake(st); return out; };
  let best = root[0], bestScore = 0, done = 0, pv = [uci(best)];
  // a level that plays below its best: every root move gets a full score at a shallow depth, then noise, then the best of those (a person's slips)
  if (noise > 0) {
    const d = Math.max(1, depth); const sc = [];
    for (const m of root) { make(st, m); sc.push(-nega(d - 1, -INF, INF, 1, true)); unmake(st); }
    let bi = 0, bv = -INF; sc.forEach((v, i) => { const nv = v + (rng() * 2 - 1) * noise; if (nv > bv) { bv = nv; bi = i; } });
    if (slip > 0 && rng() < slip) bi = Math.floor(rng() * root.length);
    const m = root[bi]; return { move: uci(m), score: sc[bi], depth: d, nodes, pv: [uci(m)], mate: null };
  }
  let ordered = sortMoves(root, 0, 0);
  for (let d = 1; d <= depth; d++) {
    let alpha = -INF, beta = INF, bm = 0, bv = -INF;
    for (const m of ordered) {
      make(st, m);
      let v = bm ? -nega(d - 1, -alpha - 1, -alpha, 1, true) : -nega(d - 1, -beta, -alpha, 1, true);
      if (bm && v > alpha && !stop) v = -nega(d - 1, -beta, -alpha, 1, true);
      unmake(st); if (stop) break;
      if (v > bv) { bv = v; bm = m; } if (v > alpha) alpha = v;
    }
    if (stop && !bm) break;
    if (bm) { best = bm; bestScore = bv; ordered = [bm, ...ordered.filter((x) => x !== bm)]; }
    if (stop) break;
    done = d; pv = pvOf(best);
    if (onInfo) onInfo({ depth: d, score: bestScore, nodes, pv, mate: Math.abs(bestScore) > MATE - 200 ? Math.sign(bestScore) * Math.ceil((MATE - Math.abs(bestScore)) / 2) : null, ms: Date.now() - t0 });
    if (Math.abs(bestScore) > MATE - 200 && d >= MATE - Math.abs(bestScore)) break; // a mate found in full
    if (Date.now() - t0 > ms * 0.55) break; // the next depth would not finish
  }
  return { move: uci(best), score: bestScore, depth: done, nodes, pv, mate: Math.abs(bestScore) > MATE - 200 ? Math.sign(bestScore) * Math.ceil((MATE - Math.abs(bestScore)) / 2) : null };
}
/** the eight levels: an approximate strength said plainly (a guess against club players, not a rating anyone measured), and how each searches */
export const LEVELS = Object.freeze([
  { n: 1, elo: 600, depth: 1, ms: 200, noise: 300, slip: 0.25 },
  { n: 2, elo: 800, depth: 1, ms: 200, noise: 150, slip: 0.1 },
  { n: 3, elo: 1000, depth: 2, ms: 300, noise: 80, slip: 0.04 },
  { n: 4, elo: 1200, depth: 2, ms: 400, noise: 35, slip: 0 },
  { n: 5, elo: 1400, depth: 3, ms: 500, noise: 0, slip: 0 },
  { n: 6, elo: 1600, depth: 5, ms: 1000, noise: 0, slip: 0 },
  { n: 7, elo: 1800, depth: 8, ms: 2000, noise: 0, slip: 0 },
  { n: 8, elo: 2000, depth: 30, ms: 4000, noise: 0, slip: 0 },
]);
export const levelOpts = (n) => { const l = LEVELS[Math.max(1, Math.min(8, +n || 4)) - 1]; return { depth: l.depth, ms: l.ms, noise: l.noise, slip: l.slip }; };
/** the keys of a FEN's position, for repetition across a game's history (search's `prior`). Pure. */
export const keyOf = (fen) => { const st = fromFEN(fen); return [st.lo, st.hi]; };
