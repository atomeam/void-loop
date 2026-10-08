/**
 * chess-rules — the whole game of chess in plain JS (no DOM, no three.js), shared by the chess card and its tests.
 * Squares are 0..63 = rank * 8 + file (a1 = 0, h1 = 7, a8 = 56). Pieces are FEN letters: PNBRQK white, pnbrqk black.
 *   create() / fromFEN(fen) / toFEN(s)    a position { board, turn: 'w'|'b', castle: 'KQkq', ep, half, full, keys }
 *   legalMoves(s) -> [{ from, to, piece, captured, promo, castle, ep }]   (every rule: castling through check, en passant, promotion)
 *   play(s, move | 'e2e4' | 'e7e8q') -> new position   status(s) -> 'playing' | 'check' | 'checkmate' | 'stalemate' | 'draw-50' | 'draw-material' | 'draw-repetition'
 *   bestMove(s, { depth, ms }) -> move     a small alpha-beta search (material + piece-square tables, captures searched to quiet)
 */
const VAL = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 0 };
// piece-square tables from white's side, a8..h8 first row (the classic simplified evaluation)
const PST = {
  p: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
  n: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
  b: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
  r: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
  q: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
  k: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
  ke: [-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30, -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50],
};
export const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export const FILES = 'abcdefgh';
export const sqName = (i) => FILES[i & 7] + ((i >> 3) + 1);
export const sqIndex = (n) => FILES.indexOf(n[0]) + (Number(n[1]) - 1) * 8;
const isW = (p) => p >= 'A' && p <= 'Z';
const colorOf = (p) => (p ? (isW(p) ? 'w' : 'b') : null);
const KN = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KG = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]], ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function fromFEN(fen) {
  const [pl, turn, castle, ep, half, full] = String(fen).trim().split(/\s+/);
  const board = Array(64).fill(null); const rows = pl.split('/');
  if (rows.length !== 8) throw new Error('bad FEN');
  rows.forEach((row, i) => { let f = 0; const r = 7 - i; for (const ch of row) { if (/\d/.test(ch)) f += +ch; else board[r * 8 + f++] = ch; } });
  const s = { board, turn: turn === 'b' ? 'b' : 'w', castle: castle && castle !== '-' ? castle : '', ep: ep && ep !== '-' ? sqIndex(ep) : null, half: +half || 0, full: +full || 1, keys: [] };
  s.keys = [key(s)]; return s;
}
export const create = () => fromFEN(START);
export function toFEN(s) {
  let out = '';
  for (let r = 7; r >= 0; r--) { let e = 0; for (let f = 0; f < 8; f++) { const p = s.board[r * 8 + f]; if (!p) e++; else { if (e) out += e; e = 0; out += p; } } if (e) out += e; if (r) out += '/'; }
  return out + ' ' + s.turn + ' ' + (s.castle || '-') + ' ' + (s.ep === null ? '-' : sqName(s.ep)) + ' ' + s.half + ' ' + s.full;
}
const key = (s) => s.board.map((p) => p || '.').join('') + s.turn + s.castle + (s.ep === null ? '-' : s.ep);

export function attacked(board, sq, by) {
  const f = sq & 7, r = sq >> 3, at = (ff, rr) => (ff >= 0 && ff < 8 && rr >= 0 && rr < 8 ? board[rr * 8 + ff] : undefined);
  const P = by === 'w' ? 'P' : 'p', N = by === 'w' ? 'N' : 'n', B = by === 'w' ? 'B' : 'b', R = by === 'w' ? 'R' : 'r', Q = by === 'w' ? 'Q' : 'q', K = by === 'w' ? 'K' : 'k';
  const pr = by === 'w' ? r - 1 : r + 1; if (at(f - 1, pr) === P || at(f + 1, pr) === P) return true;
  for (const [df, dr] of KN) if (at(f + df, r + dr) === N) return true;
  for (const [df, dr] of KG) if (at(f + df, r + dr) === K) return true;
  for (const [dirs, a, b] of [[DIAG, B, Q], [ORTH, R, Q]]) for (const [df, dr] of dirs) {
    let ff = f + df, rr = r + dr;
    while (ff >= 0 && ff < 8 && rr >= 0 && rr < 8) { const p = board[rr * 8 + ff]; if (p) { if (p === a || p === b) return true; break; } ff += df; rr += dr; }
  }
  return false;
}
export function inCheck(s, color = s.turn) { const k = s.board.indexOf(color === 'w' ? 'K' : 'k'); return k >= 0 && attacked(s.board, k, color === 'w' ? 'b' : 'w'); }

function pseudo(s, capturesOnly = false) {
  const out = [], b = s.board, me = s.turn, them = me === 'w' ? 'b' : 'w';
  const add = (from, to, extra) => out.push({ from, to, piece: b[from], captured: b[to] || null, promo: null, castle: null, ep: false, ...extra });
  for (let sq = 0; sq < 64; sq++) {
    const p = b[sq]; if (!p || colorOf(p) !== me) continue;
    const t = p.toLowerCase(), f = sq & 7, r = sq >> 3;
    if (t === 'p') {
      const d = me === 'w' ? 1 : -1, start = me === 'w' ? 1 : 6, last = me === 'w' ? 7 : 0;
      const push = (from, to, extra) => { if ((to >> 3) === last) for (const q of 'qrbn') add(from, to, { ...extra, promo: me === 'w' ? q.toUpperCase() : q }); else add(from, to, extra); };
      const one = sq + 8 * d;
      if (!capturesOnly && one >= 0 && one < 64 && !b[one]) { push(sq, one); const two = sq + 16 * d; if (r === start && !b[two]) add(sq, two); }
      for (const df of [-1, 1]) { const ff = f + df; if (ff < 0 || ff > 7) continue; const to = one + df; if (to < 0 || to > 63) continue;
        if (b[to] && colorOf(b[to]) === them) push(sq, to); else if (to === s.ep) add(sq, to, { ep: true, captured: me === 'w' ? 'p' : 'P' }); }
    } else if (t === 'n' || t === 'k') {
      for (const [df, dr] of t === 'n' ? KN : KG) { const ff = f + df, rr = r + dr; if (ff < 0 || ff > 7 || rr < 0 || rr > 7) continue; const to = rr * 8 + ff;
        if (!b[to] ? !capturesOnly : colorOf(b[to]) === them) add(sq, to); }
      if (t === 'k' && !capturesOnly) {
        const home = me === 'w' ? 4 : 60, R = me === 'w' ? 'R' : 'r', [kc, qc] = me === 'w' ? ['K', 'Q'] : ['k', 'q'];
        if (sq === home && !attacked(b, home, them)) {
          if (s.castle.includes(kc) && b[home + 3] === R && !b[home + 1] && !b[home + 2] && !attacked(b, home + 1, them) && !attacked(b, home + 2, them)) add(sq, home + 2, { castle: 'k' });
          if (s.castle.includes(qc) && b[home - 4] === R && !b[home - 1] && !b[home - 2] && !b[home - 3] && !attacked(b, home - 1, them) && !attacked(b, home - 2, them)) add(sq, home - 2, { castle: 'q' });
        }
      }
    } else {
      const dirs = t === 'b' ? DIAG : t === 'r' ? ORTH : DIAG.concat(ORTH);
      for (const [df, dr] of dirs) { let ff = f + df, rr = r + dr;
        while (ff >= 0 && ff < 8 && rr >= 0 && rr < 8) { const to = rr * 8 + ff; if (b[to]) { if (colorOf(b[to]) === them) add(sq, to); break; } if (!capturesOnly) add(sq, to); ff += df; rr += dr; } }
    }
  }
  return out;
}
/** Apply a move to a copy. (No legality check: use legalMoves or play.) */
export function apply(s, m) {
  const b = s.board.slice(), me = s.turn, d = me === 'w' ? 1 : -1;
  b[m.to] = m.promo || b[m.from]; b[m.from] = null;
  if (m.ep) b[m.to - 8 * d] = null;
  if (m.castle === 'k') { b[m.to - 1] = b[m.to + 1]; b[m.to + 1] = null; }
  if (m.castle === 'q') { b[m.to + 1] = b[m.to - 2]; b[m.to - 2] = null; }
  let c = s.castle; const t = m.piece.toLowerCase();
  if (t === 'k') c = c.replace(me === 'w' ? /[KQ]/g : /[kq]/g, '');
  for (const [sq, ch] of [[0, 'Q'], [7, 'K'], [56, 'q'], [63, 'k']]) if (m.from === sq || m.to === sq) c = c.replace(ch, '');
  const n = { board: b, turn: me === 'w' ? 'b' : 'w', castle: c, ep: t === 'p' && Math.abs(m.to - m.from) === 16 ? (m.from + m.to) / 2 : null,
    half: t === 'p' || m.captured ? 0 : s.half + 1, full: s.full + (me === 'b' ? 1 : 0), keys: null };
  n.keys = (n.half === 0 ? [] : s.keys || []).concat(key(n));
  return n;
}
export function legalMoves(s) { return pseudo(s).filter((m) => !inCheck(apply(s, m), s.turn)); }
/** Play a move given as a move object or coordinates ('e2e4', 'e7e8q'); throws on an illegal move. */
export function play(s, mv) {
  const ms = legalMoves(s);
  let m = null;
  if (typeof mv === 'string') { const from = sqIndex(mv.slice(0, 2)), to = sqIndex(mv.slice(2, 4)), pr = mv[4] ? mv[4].toLowerCase() : null;
    m = ms.find((x) => x.from === from && x.to === to && (!x.promo || x.promo.toLowerCase() === (pr || 'q'))); }
  else m = ms.find((x) => x.from === mv.from && x.to === mv.to && (x.promo || null) === (mv.promo || null)) || ms.find((x) => x.from === mv.from && x.to === mv.to && (!x.promo || /q/i.test(x.promo)));
  if (!m) throw new Error('illegal move ' + (typeof mv === 'string' ? mv : sqName(mv.from) + sqName(mv.to)));
  const n = apply(s, m); n.last = m; return n;
}
function insufficient(b) {
  const left = b.filter((p) => p && !/k/i.test(p));
  if (!left.length) return true;
  if (left.length === 1 && /[nb]/i.test(left[0])) return true;
  if (left.every((p) => /b/i.test(p))) { const cols = new Set(); b.forEach((p, i) => { if (p && /b/i.test(p)) cols.add(((i >> 3) + (i & 7)) % 2); }); return cols.size === 1; }
  return false;
}
export function status(s) {
  const any = legalMoves(s).length > 0, chk = inCheck(s);
  if (!any) return chk ? 'checkmate' : 'stalemate';
  if (s.half >= 100) return 'draw-50';
  if (insufficient(s.board)) return 'draw-material';
  const k = s.keys || []; if (k.length && k.filter((x) => x === k[k.length - 1]).length >= 3) return 'draw-repetition';
  return chk ? 'check' : 'playing';
}
export const isOver = (st) => /mate|draw/.test(st);
/** SAN-ish label for a move (for the move list and the screen reader): Nf3, exd5, O-O, e8=Q+ */
export function moveLabel(s, m) {
  const t = m.piece.toUpperCase(); let out;
  if (m.castle) out = m.castle === 'k' ? 'O-O' : 'O-O-O';
  else {
    const amb = t !== 'P' && t !== 'K' ? legalMoves(s).filter((x) => x.piece === m.piece && x.to === m.to && x.from !== m.from) : [];
    const dis = amb.length ? (amb.some((x) => (x.from & 7) === (m.from & 7)) ? (amb.some((x) => (x.from >> 3) === (m.from >> 3)) ? sqName(m.from) : sqName(m.from)[1]) : FILES[m.from & 7]) : '';
    out = (t === 'P' ? (m.captured ? FILES[m.from & 7] : '') : t + dis) + (m.captured ? 'x' : '') + sqName(m.to) + (m.promo ? '=' + m.promo.toUpperCase() : '');
  }
  const n = apply(s, m), st = status(n); return out + (st === 'checkmate' ? '#' : st === 'check' ? '+' : '');
}

// ---------- the computer opponent ----------
function evaluate(s) { // from the side to move
  let mg = 0, minor = 0; for (const p of s.board) if (p && /[qrbn]/i.test(p)) minor += VAL[p.toLowerCase()];
  const endgame = minor <= 1300;
  for (let i = 0; i < 64; i++) { const p = s.board[i]; if (!p) continue; const t = p.toLowerCase(), w = isW(p);
    const idx = w ? (7 - (i >> 3)) * 8 + (i & 7) : (i >> 3) * 8 + (i & 7);
    const v = VAL[t] + (t === 'k' && endgame ? PST.ke : PST[t])[idx]; mg += w ? v : -v; }
  return s.turn === 'w' ? mg : -mg;
}
const MATE = 100000;
const order = (ms) => ms.sort((a, b) => ((b.captured ? VAL[b.captured.toLowerCase()] * 10 - VAL[b.piece.toLowerCase()] : 0) + (b.promo ? 800 : 0)) - ((a.captured ? VAL[a.captured.toLowerCase()] * 10 - VAL[a.piece.toLowerCase()] : 0) + (a.promo ? 800 : 0)));
export function bestMove(s, { depth = 3, ms = 700, rng = Math.random } = {}) {
  const t0 = Date.now(); let nodes = 0, stop = false;
  const out = () => { if ((++nodes & 1023) === 0 && Date.now() - t0 > ms) stop = true; return stop; };
  function quiesce(p, a, b, qd) {
    const stand = evaluate(p); if (stand >= b) return b; if (stand > a) a = stand; if (qd <= 0 || out()) return a;
    for (const m of order(pseudo(p, true))) { const n = apply(p, m); if (inCheck(n, p.turn)) continue; const v = -quiesce(n, -b, -a, qd - 1); if (v >= b) return b; if (v > a) a = v; }
    return a;
  }
  function nega(p, d, a, b, ply) {
    if (out()) return 0;
    if (ply && p.half >= 100) return 0;
    if (d <= 0) return quiesce(p, a, b, 6);
    let any = false;
    for (const m of order(pseudo(p))) {
      const n = apply(p, m); if (inCheck(n, p.turn)) continue; any = true;
      const v = -nega(n, d - 1, -b, -a, ply + 1); if (stop) return 0;
      if (v >= b) return b; if (v > a) a = v;
    }
    if (!any) return inCheck(p) ? -MATE + ply : 0;
    return a;
  }
  const root = order(legalMoves(s)); if (!root.length) return null;
  let best = root[0];
  for (let d = 1; d <= depth && !stop; d++) {
    let bestV = -Infinity, bestD = null, ties = [];
    for (const m of root) {
      const v = -nega(apply(s, m), d - 1, -Infinity, -bestV + 1, 1); if (stop) break;
      if (v > bestV) { bestV = v; bestD = m; ties = [m]; } else if (v === bestV) ties.push(m);
    }
    if (!stop && bestD) { best = ties.length > 1 && d === depth ? ties[Math.floor(rng() * ties.length)] : bestD; root.splice(root.indexOf(bestD), 1); root.unshift(bestD); }
  }
  return best;
}
