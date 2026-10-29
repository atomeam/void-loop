// arena — Verse plays its games against itself (frontier #5). Two versions of the Connect Four engine (skills/connect4-rules.js),
// each a look-ahead depth and a set of evaluation weights, play each other with colours swapped every game and a short random
// opening from a seed (so a deterministic engine does not replay one game). The stronger one is kept; ratings come from the
// games (a performance rating against a fixed anchor), not from a claim. Pure, no DOM, no network.
//   playGame(a, b, seed) -> { result: 'a'|'b'|'draw', moves, aFirst }     match(a, b, n, seed) -> { games, a, b, draw, score }
//   perf(opponentRating, score) -> rating      ladder(depths, games, seed) -> [{ name, depth, rating, vs, score }]
//   tune({ depth, rounds, games, seed }) -> { champion, rounds: [{ challenger, score, kept }], final }
import * as K from '../skills/connect4-rules.js';
import * as O from '../skills/othello.js';

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

// Any two-player game through the same arena (run 62): a game is { create, moves(s), play(s, move), turn(s) -> 1|2,
// winner(s) -> null while playing, else 1, 2 or 0 for a draw }; a player is { name, move(s, r) } with r the game's seeded
// generator. The same random opening and colour swap as Connect Four.
export function playWith(game, a, b, seed) {
  const r = rng(seed), aFirst = seed % 2 === 0, moves = [];
  let s = game.create(), w = null;
  while ((w = game.winner(s)) == null) {
    const legal = game.moves(s), mover = (game.turn(s) === 1) === aFirst ? a : b;
    const mv = moves.length < OPENING ? legal[Math.floor(r() * legal.length)] : mover.move(s, r);
    s = game.play(s, mv); moves.push(mv);
  }
  return { result: w === 0 ? 'draw' : (w === 1) === aFirst ? 'a' : 'b', moves, aFirst };
}

// Othello (skills/othello.js): its engine has no look-ahead depth, so its ladder is three players
export const othelloGame = {
  title: 'Othello',
  create: () => O.createOthelloState(),
  moves: (s) => O.legalMoves(s.board, s.turn),
  play: (s, i) => O.resolveMove(s, i).nextState,
  turn: (s) => s.turn,
  winner: (s) => (s.status === 'playing' ? null : s.status === 'black_wins' ? 1 : s.status === 'white_wins' ? 2 : 0),
};
export function othelloPlayers() {
  return [
    { name: 'random', how: 'any legal move', move: (s, r) => { const m = O.legalMoves(s.board, s.turn); return m[Math.floor(r() * m.length)]; } },
    { name: 'greedy', how: 'the move that flips the most discs', move: (s) => { let best = -1, n = -1; for (const i of O.legalMoves(s.board, s.turn)) { const f = O.flipsFor(s.board, i, s.turn).length; if (f > n) { n = f; best = i; } } return best; } },
    { name: 'the card', how: 'the position table and the reply it leaves (the card\'s own engine)', move: (s) => O.voidMove(s.board, s.turn) },
  ];
}
/** each player against the one before it; the first is the anchor at 1000 */
export function ladderOf(game, players, games, seed = 1) {
  const out = [{ name: players[0].name, how: players[0].how, rating: 1000, vs: null, score: null }];
  for (let i = 1; i < players.length; i++) {
    const m = match(players[i], players[i - 1], games, seed + i, game);
    out.push({ name: players[i].name, how: players[i].how, rating: perf(out[i - 1].rating, m.score), vs: players[i - 1].name, score: m.score });
  }
  return out;
}

export function match(a, b, n, seed = 1, game = null) {
  const m = { games: n, a: 0, b: 0, draw: 0 };
  for (let i = 0; i < n; i++) m[(game ? playWith(game, a, b, seed * 1000 + i) : playGame(a, b, seed * 1000 + i)).result]++;
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
export function tune({ depth = 2, rounds = 5, games = 40, seed = 1, start = K.WEIGHTS } = {}) {
  const r = rng(seed * 7919);
  let champion = { depth, weights: { ...start } }; // start: where the climb begins (the card's weights, or yesterday's champion)
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

// the answer and the curve live in lib/arena-say.js (no game imports, so a game's card can use them); re-exported here
export { arenaSay, arenaCurve } from './arena-say.js';
