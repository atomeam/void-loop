// arena — Void plays its games against itself (frontier #5). Two versions of the Connect Four engine (skills/connect4-rules.js),
// each a look-ahead depth and a set of evaluation weights, play each other with colours swapped every game and a short random
// opening from a seed (so a deterministic engine does not replay one game). The stronger one is kept; ratings come from the
// games (a performance rating against a fixed anchor), not from a claim. Pure, no DOM, no network.
//   playGame(a, b, seed) -> { result: 'a'|'b'|'draw', moves, aFirst }     match(a, b, n, seed) -> { games, a, b, draw, score }
//   perf(opponentRating, score) -> rating      ladder(depths, games, seed) -> [{ name, depth, rating, vs, score }]
//   tune({ depth, rounds, games, seed }) -> { champion, rounds: [{ challenger, score, kept }], final }
import * as K from '../skills/connect4-rules.js';

export const OPENING = 2; // plies played at random from the seed before the engines take over

// a small seeded generator (mulberry32): the same seed gives the same games, so a rating can be replayed
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// the engine always plays yellow (2); a player on red sees the board with the colours swapped
const swapped = (s) => ({ ...s, board: s.board.map((x) => (x ? 3 - x : 0)) });
function moveFor(player, s) {
  const view = s.turn === 2 ? s : swapped(s);
  return K.voidMove(view, player.depth, player.weights || K.WEIGHTS).col;
}

export function playGame(a, b, seed) {
  const r = rng(seed), aFirst = seed % 2 === 0, moves = [];
  let s = K.create();
  while (!s.over) {
    const red = s.turn === 1, mover = red === aFirst ? a : b;
    let col;
    if (moves.length < OPENING) { const open = [0, 1, 2, 3, 4, 5, 6].filter((c) => K.rowFor(s.board, c) >= 0); col = open[Math.floor(r() * open.length)]; }
    else col = moveFor(mover, s);
    s = K.drop(s, col); moves.push(col);
  }
  const redWon = s.over === 'you', result = s.over === 'draw' ? 'draw' : redWon === aFirst ? 'a' : 'b';
  return { result, moves, aFirst };
}

export function match(a, b, n, seed = 1) {
  const m = { games: n, a: 0, b: 0, draw: 0 };
  for (let i = 0; i < n; i++) m[playGame(a, b, seed * 1000 + i).result]++;
  m.score = (m.a + m.draw / 2) / n;
  return m;
}

/** a performance rating: the opponent's rating moved by the score (Elo's logistic), at most 400 either way */
export function perf(opp, score) {
  if (score >= 1) return opp + 400;
  if (score <= 0) return opp - 400;
  return Math.round(opp + Math.max(-400, Math.min(400, 400 * Math.log10(score / (1 - score)))));
}

/** each depth against the one below it; depth `depths[0]` is the anchor at 1000 */
export function ladder(depths, games, seed = 1) {
  const out = [{ name: 'depth ' + depths[0], depth: depths[0], rating: 1000, vs: null, score: null }];
  for (let i = 1; i < depths.length; i++) {
    const prev = out[i - 1], m = match({ depth: depths[i] }, { depth: prev.depth }, games, seed + i);
    out.push({ name: 'depth ' + depths[i], depth: depths[i], rating: perf(prev.rating, m.score), vs: prev.name, score: m.score });
  }
  return out;
}

const KEEP = 0.55; // a challenger is kept only when it clearly wins, not on a coin flip
/** hill-climb the evaluation at a fixed depth: each round a nudged copy of the champion plays it; the winner is kept */
export function tune({ depth = 2, rounds = 5, games = 40, seed = 1 } = {}) {
  const r = rng(seed * 7919);
  let champion = { depth, weights: { ...K.WEIGHTS } };
  const log = [];
  for (let i = 0; i < rounds; i++) {
    const weights = Object.fromEntries(Object.entries(champion.weights).map(([k, v]) => [k, Math.round(v * (0.5 + r()) * 10) / 10]));
    const challenger = { depth, weights }, m = match(challenger, champion, games, seed * 100 + i);
    const kept = m.score > KEEP;
    log.push({ challenger: weights, score: m.score, kept });
    if (kept) champion = challenger;
  }
  const final = match(champion, { depth, weights: K.WEIGHTS }, games, seed * 100 + 99);
  return { champion, rounds: log, final };
}

// The answer to "how good are you at connect four": the record the games wrote (tools/arena.mjs -> arena.json), never a claim.
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
export function arenaSay(a) {
  if (!a || !Array.isArray(a.ladder) || !a.ladder.length) return 'I have not played myself at Connect Four yet, so I have no rating to give.';
  const top = a.ladder[a.ladder.length - 1], low = a.ladder[0];
  return 'Rated from ' + plural(a.games, 'game') + ' against myself (' + (a.anchor || low.name + ' = ' + low.rating) + '): looking ' + top.depth + ' moves ahead I play at '
    + top.rating + ', ' + (top.rating - low.rating) + ' above looking ' + low.depth + ' ahead. ' + a.ladder.map((s) => s.name + ' ' + s.rating).join(' · ') + '.'
    + (a.tuned ? ' A tuned evaluation scored ' + Math.round(a.tuned.score * 100) + '% against my own and ' + (a.tuned.kept ? 'was kept.' : 'was not kept.') : '')
    + (a.played ? ' Played ' + a.played + '.' : '');
}
/** the curve: rating against look-ahead depth, an inline SVG (no library), labelled for a screen reader */
export function arenaCurve(a, w = 300, h = 140) {
  const L = (a && a.ladder) || [];
  if (!L.length) return '';
  const lo = Math.min(...L.map((s) => s.rating)) - 50, hi = Math.max(...L.map((s) => s.rating)) + 50, pad = 28;
  const x = (i) => pad + (L.length === 1 ? 0 : (i * (w - 2 * pad)) / (L.length - 1)), y = (r) => h - pad - ((r - lo) * (h - 2 * pad)) / (hi - lo);
  const pts = L.map((s, i) => x(i).toFixed(1) + ',' + y(s.rating).toFixed(1));
  return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" role="img" aria-label="Rating by look-ahead depth: ' + L.map((s) => s.name + ' ' + s.rating).join(', ') + '">'
    + '<polyline points="' + pts.join(' ') + '" fill="none" stroke="currentColor" stroke-width="2"/>'
    + L.map((s, i) => '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(s.rating).toFixed(1) + '" r="4" fill="currentColor"/><text x="' + x(i).toFixed(1) + '" y="' + (y(s.rating) - 8).toFixed(1) + '" font-size="11" text-anchor="middle" fill="currentColor">' + s.rating + '</text><text x="' + x(i).toFixed(1) + '" y="' + (h - 8) + '" font-size="11" text-anchor="middle" fill="currentColor">depth ' + s.depth + '</text>').join('')
    + '</svg>';
}
