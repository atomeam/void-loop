/**
 * Sorry! rules (Parker Brothers / Hasbro): pure functions, no DOM. skills/sorry.js is the card, the board and the bots.
 *
 * Board: a 60-square track around the edge (15 a side), travelled clockwise. Each colour has a Start, a start square it
 * enters the track on, a 5-square Safety Zone that leaves the track two squares after its own corner, and Home.
 * Each side has two slides in that side's colour: a short one (start square 1 to square 4) and a long one (9 to 13).
 * A pawn that ends its move on the first square of a slide of another colour slides to its end, and every pawn on the
 * slide (yours too) goes back to its Start.
 * Cards (45): five 1s; four each of 2, 3, 4, 5, 7, 8, 10, 11, 12; four Sorry!
 *   1  leave Start, or forward 1            2  leave Start, or forward 2; then draw again
 *   3, 5, 8, 12  forward                     4  backward 4
 *   7  forward 7, or split 7 between two pawns (both forward)
 *   10 forward 10, or backward 1             11 forward 11, or swap places with a rival pawn on the track
 *   Sorry!  a pawn from your Start takes a rival pawn's place on the track and sends it to its Start
 * You can never land on your own pawn; landing on a rival sends it to its Start. Home needs the exact count. If any
 * move is possible you must take one; otherwise the card is lost.
 * Positions: 'S' start, 0..59 the track, 'z0'..'z4' the Safety Zone, 'H' home.
 */
export const COLORS = ['red', 'blue', 'yellow', 'green'];
export const HEX = { red: '#d4343c', blue: '#2a64c8', yellow: '#e8b923', green: '#2c9a54' };
export const TRACK = 60, SIDE = 15, PAWNS = 4, SAFE = 5;
export const startExit = (c) => (c * SIDE + 4) % TRACK; // where a pawn leaving Start goes: the end of its own short slide
export const safeEntry = (c) => (c * SIDE + 2) % TRACK; // the last track square before its Safety Zone
export const SLIDES = [0, 1, 2, 3].flatMap((side) => [{ side, from: side * SIDE + 1, to: side * SIDE + 4 }, { side, from: side * SIDE + 9, to: side * SIDE + 13 }]);
const isSafe = (p) => typeof p === 'string' && p[0] === 'z';
const safeK = (p) => Number(p.slice(1));
const onTrack = (p) => typeof p === 'number';
/** how far along its lap a track square is for colour c (0 = its start square, 58 = its safety entry) */
export const progressOf = (c, i) => (i - startExit(c) + TRACK) % TRACK;
export function distance(c, p) {
  if (p === 'S') return -1;
  if (p === 'H') return 64;
  if (isSafe(p)) return 59 + safeK(p);
  return progressOf(c, p);
}

export function newDeck(rng = Math.random) {
  const d = [1, 1, 1, 1, 1];
  for (const n of [2, 3, 4, 5, 7, 8, 10, 11, 12, 'sorry']) d.push(n, n, n, n);
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}
export function seatsFor(opponents) {
  const n = Math.max(1, Math.min(3, Number(opponents) || 3));
  return n === 1 ? [0, 2] : n === 2 ? [0, 1, 2] : [0, 1, 2, 3];
}
export function createState(opts = {}, rng = Math.random) {
  return { v: 1, seats: seatsFor(opts.opponents == null ? 3 : opts.opponents), human: 0, pawns: COLORS.map(() => Array(PAWNS).fill('S')),
    deck: newDeck(rng), card: null, shown: null, split: null, turn: 0, last: null, winner: null };
}
function clone(s) { return { ...s, pawns: s.pawns.map((p) => [...p]), deck: [...s.deck], split: s.split ? { ...s.split } : null }; }

/** draw the top card (a fresh shuffled deck when it runs out); refused while a card is waiting to be played */
export function draw(state, rng = Math.random) {
  if (state.card != null || state.winner != null) return state;
  const next = clone(state);
  if (!next.deck.length) next.deck = newDeck(rng);
  next.card = next.deck.pop(); next.shown = next.card; next.last = null;
  return next;
}

function fwd(c, p) {
  if (p === 'H') return null;
  if (isSafe(p)) return safeK(p) + 1 < SAFE ? 'z' + (safeK(p) + 1) : 'H';
  if (progressOf(c, p) === TRACK - 2) return 'z0'; // its safety entry: in, not on round the board again
  return (p + 1) % TRACK;
}
function back(c, p) {
  if (isSafe(p)) return safeK(p) > 0 ? 'z' + (safeK(p) - 1) : safeEntry(c);
  return (p - 1 + TRACK) % TRACK;
}
/** where n steps take a pawn (forward, or back when n < 0); null when it cannot go that far (past Home) */
export function walk(c, p, n) {
  let cur = p;
  for (let i = 0; i < Math.abs(n); i++) { cur = n > 0 ? fwd(c, cur) : back(c, cur); if (cur == null) return null; }
  return cur;
}
const ownAt = (s, c, pos, self) => pos !== 'H' && s.pawns[c].some((q, j) => j !== self && q === pos);
const slideAt = (c, pos) => (onTrack(pos) ? SLIDES.find((sl) => sl.from === pos && sl.side !== c) : null);

/** every legal move for the card in hand: [{ pawn, to, kind, swapWith?, split? }] */
export function movesFor(state, c = state.turn, card = state.card) {
  const mine = state.pawns[c], out = [], seen = new Set();
  const add = (mv) => { const k = mv.pawn + ':' + JSON.stringify(mv.to) + ':' + mv.kind + ':' + (mv.split || 0); if (!seen.has(k)) { seen.add(k); out.push(mv); } };
  if (card == null) return out;
  // the second half of a split 7: another pawn, forward exactly what is left
  if (state.split) {
    mine.forEach((p, m) => {
      if (m === state.split.pawn || p === 'S' || p === 'H') return;
      const to = walk(c, p, state.split.rest); if (to != null && !ownAt(state, c, to, m)) add({ pawn: m, to, kind: 'split2' });
    });
    return out;
  }
  const firstStart = mine.indexOf('S');
  const forward = (n, kind = 'move') => mine.forEach((p, m) => { if (p === 'S' || p === 'H') return; const to = walk(c, p, n); if (to != null && !ownAt(state, c, to, m)) add({ pawn: m, to, kind }); });
  const rivals = [];
  state.seats.forEach((oc) => { if (oc !== c) state.pawns[oc].forEach((q, j) => { if (onTrack(q)) rivals.push({ color: oc, pawn: j, at: q }); }); });
  if ((card === 1 || card === 2) && firstStart >= 0 && !ownAt(state, c, startExit(c), firstStart)) add({ pawn: firstStart, to: startExit(c), kind: 'start' });
  if (typeof card === 'number' && card !== 4) forward(card);
  if (card === 4) mine.forEach((p, m) => { if (p === 'S' || p === 'H') return; const to = walk(c, p, -4); if (to != null && !ownAt(state, c, to, m)) add({ pawn: m, to, kind: 'back' }); });
  if (card === 10) mine.forEach((p, m) => { if (p === 'S' || p === 'H') return; const to = walk(c, p, -1); if (to != null && !ownAt(state, c, to, m)) add({ pawn: m, to, kind: 'back' }); });
  if (card === 11) mine.forEach((p, m) => { if (!onTrack(p)) return; for (const r of rivals) add({ pawn: m, to: r.at, kind: 'swap', swapWith: r }); });
  if (card === 'sorry' && firstStart >= 0) for (const r of rivals) add({ pawn: firstStart, to: r.at, kind: 'sorry', swapWith: r });
  if (card === 7) { // a split: k steps with one pawn, the rest (7 - k) with another
    const out2 = mine.map((p, m) => m);
    for (const a of out2) for (let k = 1; k <= 6; k++) {
      const pa = mine[a]; if (pa === 'S' || pa === 'H') continue;
      const ta = walk(c, pa, k); if (ta == null || ownAt(state, c, ta, a)) continue;
      const after = { ...state, pawns: state.pawns.map((x, i) => (i === c ? x.map((q, j) => (j === a ? ta : q)) : x)) };
      const done = after.pawns[c].some((q, b) => b !== a && q !== 'S' && q !== 'H' && (() => { const tb = walk(c, q, 7 - k); return tb != null && !ownAt(after, c, tb, b); })());
      if (done) add({ pawn: a, to: ta, kind: 'split', split: k });
    }
  }
  return out;
}

function bump(next, pos, except) {
  next.pawns.forEach((arr, ci) => arr.forEach((q, j) => { if (q === pos && !(except && except.color === ci && except.pawn === j)) { arr[j] = 'S'; next.last.bumped.push(ci); } }));
}
/** play a move (one of movesFor's); bumps, slides, checks the win, and passes the turn (a 2 draws again) */
export function play(state, mv) {
  const c = state.turn, next = clone(state), from = next.pawns[c][mv.pawn];
  next.last = { color: c, pawn: mv.pawn, from, to: mv.to, kind: mv.kind, card: state.card, bumped: [], slid: null };
  if (mv.kind === 'swap') { next.pawns[mv.swapWith.color][mv.swapWith.pawn] = from; next.pawns[c][mv.pawn] = mv.to; }
  else if (mv.kind === 'sorry') { next.pawns[mv.swapWith.color][mv.swapWith.pawn] = 'S'; next.last.bumped.push(mv.swapWith.color); next.pawns[c][mv.pawn] = mv.to; }
  else { if (onTrack(mv.to)) bump(next, mv.to, { color: c, pawn: mv.pawn }); next.pawns[c][mv.pawn] = mv.to; }
  // a slide of another colour: to its end, and everyone on it goes back to Start
  const sl = slideAt(c, next.pawns[c][mv.pawn]);
  if (sl) {
    for (let q = sl.from + 1; q <= sl.to; q++) bump(next, q, { color: c, pawn: mv.pawn });
    next.pawns[c][mv.pawn] = sl.to; next.last.slid = sl; next.last.to = sl.to;
  }
  if (mv.kind === 'split') { next.split = { pawn: mv.pawn, rest: 7 - mv.split }; return next; } // the same card, the other pawn next
  next.split = null;
  if (next.pawns[c].every((q) => q === 'H')) next.winner = c;
  const again = state.card === 2 && next.winner == null;
  next.card = null;
  next.turn = again ? c : nextSeat(next, c);
  return next;
}
/** no legal move: the card is lost and the turn passes (a 2 still draws again) */
export function pass(state) {
  const next = clone(state), c = state.turn;
  next.last = { color: c, passed: true, card: state.card, bumped: [] };
  const again = state.card === 2; next.card = null; next.split = null;
  next.turn = again ? c : nextSeat(next, c);
  return next;
}
function nextSeat(s, c) { const i = s.seats.indexOf(c); return s.seats[(i + 1) % s.seats.length]; }

/** the computer: send rivals home, get home, get out of Start, use slides, stay out of reach */
export function botMove(state, c = state.turn) {
  const moves = movesFor(state, c);
  if (!moves.length) return null;
  const score = (mv) => {
    const after = play({ ...state, card: state.card }, mv);
    let s = 0;
    for (const oc of state.seats) {
      const d = state.pawns[oc].reduce((a, q) => a + distance(oc, q), 0) - after.pawns[oc].reduce((a, q) => a + distance(oc, q), 0);
      s += oc === c ? -d : d * 0.9; // our progress up, theirs down
    }
    if (after.pawns[c][mv.pawn] === 'H') s += 20;
    if (mv.kind === 'start' || mv.kind === 'sorry') s += 14;
    const others = []; state.seats.forEach((oc) => { if (oc !== c) after.pawns[oc].forEach((q) => { if (onTrack(q)) others.push(q); }); });
    const landed = after.pawns[c][mv.pawn];
    if (onTrack(landed) && others.some((q) => { const gap = (landed - q + TRACK) % TRACK; return gap >= 1 && gap <= 12; })) s -= 6;
    if (mv.kind === 'split') { const rest = movesFor(after, c); s += rest.length ? Math.max(...rest.map((r) => { const a2 = play(after, r); return a2.pawns[c].reduce((a, q) => a + distance(c, q), 0); })) - after.pawns[c].reduce((a, q) => a + distance(c, q), 0) : -50; }
    return s;
  };
  let best = moves[0], top = -Infinity;
  for (const mv of moves) { const s = score(mv); if (s > top) { top = s; best = mv; } }
  return best;
}
