// /chess/ and the pages under /games/: the rules and engines in Node. Move generation against the standard perft counts (both Verse's engine,
// lib/chess-engine.js, and the rules the page plays by, skills/chess-rules.js), SAN, PGN and FEN in and out, the link that carries a game, the clock,
// mates the engine must find, the puzzles file, and the sudoku, solitaire, word-guess and games-page rules.   node --test tools/chess.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { perft, search, levelOpts, LEVELS } from '../void-live-deploy/lib/chess-engine.js';
import * as R from '../void-live-deploy/skills/chess-rules.js';
import { newGame, push, sanList, toPGN, fromPGN, checkFEN, linkOf, gameFromLink, resultOf, makeClock, pressClock, clockLeft, flagged, clockText, eloAfter, checkPuzzleMove, findMove, lichessAnalysis, movetext } from '../void-live-deploy/lib/chess-play.js';
import { generate, countSolutions, hint, conflicts, LEVELS as SUDOKU } from '../void-live-deploy/lib/sudoku.js';
import { deal, draw, move, legal, won, auto, canFinish } from '../void-live-deploy/lib/solitaire.js';
import { mark, hardOk, inList, shareLine } from '../void-live-deploy/lib/wordguess.js';
import { gameAskOf, GAME_SITES } from '../void-live-deploy/lib/game-sites.js';

// the standard perft positions (chessprogramming.org "Perft Results"): start, "Kiwipete", positions 3, 4 and 5
const PERFT = [['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', [20, 400, 8902, 197281]], ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],
  ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]], ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]], ['rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]]];
test('the engine\'s move generator matches the standard perft counts', () => { for (const [fen, counts] of PERFT) counts.forEach((n, i) => assert.equal(perft(fen, i + 1), n, fen + ' depth ' + (i + 1))); });
test('the rules the page plays by match the same perft counts (to depth 3)', () => {
  const pf = (s, d) => (d ? R.legalMoves(s).reduce((n, m) => n + pf(R.apply(s, m), d - 1), 0) : 1);
  for (const [fen, counts] of PERFT) counts.slice(0, 3).forEach((n, i) => assert.equal(pf(R.fromFEN(fen), i + 1), n, fen + ' depth ' + (i + 1)));
});
test('the engine finds mates and wins material, and every level answers with a legal move', () => {
  assert.equal(search('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', { depth: 4, ms: 2000 }).move, 'd1d8'); // back-rank mate in 1
  assert.equal(search('r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', { depth: 4, ms: 2000 }).move, 'h5f7'); // scholar's mate
  const m2 = search('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', { depth: 6, ms: 3000 }); assert.equal(m2.mate, 1);
  const m3 = search('k7/8/1K6/8/8/8/8/7R w - - 0 1', { depth: 8, ms: 3000 }); assert.ok(m3.mate >= 1 && m3.mate <= 2, 'king and rook mate in two found: ' + m3.mate);
  const q = search('4k3/8/8/3q4/8/8/8/3QK3 w - - 0 1', { depth: 4, ms: 2000 }); assert.equal(q.move, 'd1d5'); // takes the free queen
  const start = R.create();
  for (const l of LEVELS) { const r = search(R.toFEN(start), { ...levelOpts(l.n), ms: 300 }); assert.ok(R.legalMoves(start).some((m) => R.sqName(m.from) + R.sqName(m.to) === r.move), 'level ' + l.n + ' plays ' + r.move); }
  assert.equal(search('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', { depth: 3 }).move, null); // stalemate: no move
});
test('the engine sees a draw by repetition coming from the game\'s history', () => {
  const fen = '6k1/8/8/8/8/8/8/R5K1 w - - 0 1', r = search(fen, { depth: 3, ms: 500, prior: [] }); assert.ok(r.move);
});
test('SAN is read and written, with disambiguation, castling, promotion and check', () => {
  const g = newGame(); for (const m of ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'O-O']) assert.ok(push(g, m), m);
  assert.deepEqual(sanList(g), ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'O-O']);
  const r = newGame('6k1/P7/8/8/8/8/8/K2R3R w - - 0 1'); assert.ok(push(r, 'Rdf1')); assert.equal(r.moves[0].san, 'Rdf1');
  const p = newGame('7k/P7/8/8/8/8/8/K7 w - - 0 1'); assert.ok(push(p, 'a8=Q+')); assert.equal(p.moves[0].san, 'a8=Q+'); assert.equal(p.moves[0].uci, 'a7a8q');
  assert.ok(findMove(R.create(), 'Ngf3')); assert.equal(findMove(R.create(), 'Ke2'), null); assert.ok(findMove(R.create(), 'e2e4'));
});
test('PGN in and out: headers, comments, side lines and NAGs are read past; a FEN start is kept', () => {
  const r = fromPGN('[Event "Test"]\n[White "A"]\n\n1. e4 {best by test} e5 (1... c5 2. Nf3) 2. Nf3 $1 Nc6 3. Bb5 a6 1/2-1/2');
  assert.equal(r.error, ''); assert.deepEqual(sanList(r.game), ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6']); assert.equal(r.headers.White, 'A');
  const out = toPGN(r.game, { White: 'Ann' }); assert.match(out, /\[White "Ann"\]/); assert.match(out, /1\. e4 e5 2\. Nf3 Nc6 3\. Bb5 a6 \*/);
  assert.deepEqual(sanList(fromPGN(out).game), sanList(r.game));
  const f = fromPGN('[FEN "4k3/8/8/8/8/8/4P3/4K3 b - - 0 1"]\n\n1... Kd7 2. e4'); assert.equal(f.error, ''); assert.equal(movetext(f.game), '1... Kd7 2. e4'); assert.match(toPGN(f.game), /\[SetUp "1"\]/);
  assert.match(fromPGN('1. e4 e5 2. Ke3').error, /not legal/); assert.match(fromPGN('[FEN "<b>"]\n1. e4').error, /not a position/);
});
test('FEN is checked with a reason', () => {
  assert.equal(checkFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'), '');
  assert.match(checkFEN('8/8/8/8/8/8/8/K7 w - - 0 1'), /one king/); assert.match(checkFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP w'), /8 rows/);
  assert.match(checkFEN('R6k/8/8/8/8/8/8/K7 w - - 0 1'), /not to move is in check/); assert.match(checkFEN('k7/8/8/8/8/8/8/K6x w'), /Unknown piece/);
});
test('a link carries a game and opens it again; the Lichess link carries the position', () => {
  const g = newGame(); for (const m of ['d4', 'd5', 'c4']) push(g, m); const link = linkOf(g, { mode: 'two' });
  assert.equal(link, '?m=d2d4.d7d5.c2c4&mode=two'); assert.deepEqual(sanList(gameFromLink(link).game), ['d4', 'd5', 'c4']);
  assert.match(gameFromLink('?m=e2e4.e2e4').error, /not legal/); assert.match(gameFromLink('?fen=<script>').error, /./);
  assert.equal(lichessAnalysis('8/8/8/8/8/8/8/K6k w - - 0 1'), 'https://lichess.org/analysis/standard/8/8/8/8/8/8/8/K6k_w_-_-_0_1');
});
test('the result of a game, the clock with increment, a rating after a game', () => {
  const g = newGame(); for (const m of ['f3', 'e5', 'g4', 'Qh4#']) push(g, m); assert.equal(resultOf(g), '0-1');
  const c = makeClock(60000, 2000); pressClock(c, 'w', 0); assert.equal(c.running, 'b'); assert.equal(clockLeft(c, 'b', 10000), 50000);
  pressClock(c, 'b', 10000); assert.equal(c.left.b, 52000); assert.equal(c.running, 'w'); assert.equal(flagged(c, 70001), 'w'); assert.equal(clockText(65000), '1:05'); assert.equal(clockText(5400), '5.4');
  assert.equal(eloAfter(1200, 1200, 1, 32), 1216); assert.equal(eloAfter(1200, 1200, 0.5, 32), 1200);
});
test('a puzzle answer: the line\'s move, or any other move that mates at once', () => {
  const pos = R.fromFEN('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1');
  assert.deepEqual(checkPuzzleMove(pos, ['d1d8'], 0, 'd1d8'), { ok: true, done: true, reply: null }); assert.equal(checkPuzzleMove(pos, ['d1d8'], 0, 'd1d7').ok, false);
});
test('the puzzles file: every puzzle\'s line is legal, ends in mate when it says so, and the ids are unique', () => {
  const { puzzles } = JSON.parse(fs.readFileSync(new URL('../void-live-deploy/chess/puzzles.json', import.meta.url)));
  assert.ok(puzzles.length >= 1); assert.equal(new Set(puzzles.map((p) => p.id)).size, puzzles.length);
  for (const p of puzzles) { let s = R.fromFEN(p.fen); for (const u of p.line) s = R.play(s, u); if (/^mate/.test(p.theme)) assert.equal(R.status(s), 'checkmate', p.id); assert.ok(p.line.length % 2 === 1, p.id + ' ends on the solver\'s move'); }
});
test('sudoku: each level makes a puzzle with exactly one solution, at its clue count, and a hint gives a right number with a reason', () => {
  for (const level of Object.keys(SUDOKU)) { const p = generate(3, level); assert.equal(countSolutions(p.puzzle, 2), 1, level); assert.ok(p.clues <= SUDOKU[level].clues + 2, level + ' clues ' + p.clues);
    assert.ok(p.puzzle.every((v, i) => !v || v === p.solution[i])); const h = hint(p.puzzle, p.solution); assert.equal(h.n, p.solution[h.i]); assert.ok(h.why.length > 10); }
  assert.deepEqual(generate(9, 'easy'), generate(9, 'easy')); const g = Array(81).fill(0); g[0] = 5; g[1] = 5; assert.deepEqual([...conflicts(g)].sort(), [0, 1]);
});
test('solitaire: a deal has 52 cards laid out, moves follow the rules, and a won game is seen', () => {
  const s = deal(7, 1); assert.equal(s.stock.length + s.tab.reduce((n, t) => n + t.length, 0), 52); assert.equal(s.tab[6].length, 7); assert.ok(s.tab.every((t) => t[t.length - 1].up));
  draw(s); assert.equal(s.waste.length, 1); assert.equal(s.stock.length, 23);
  assert.equal(legal(s, { from: 'tab0', n: 2, to: 'tab1' }), false);
  const w = { n: 0, drawN: 1, stock: [], waste: [], found: [0, 1, 2, 3].map((x) => Array.from({ length: 12 }, (_, i) => ({ s: x, r: i + 1, up: true }))), tab: [0, 1, 2, 3].map((x) => [{ s: x, r: 13, up: true }]).concat([[], [], []]), score: 0, moves: 0, passes: 0 };
  assert.ok(canFinish(w)); while (auto(w)); assert.ok(won(w)); assert.equal(w.score, 40);
  const k = { ...deal(1, 1), tab: [[{ s: 0, r: 13, up: true }], [{ s: 1, r: 12, up: true }], [], [], [], [], []] }; assert.ok(move(k, { from: 'tab1', n: 1, to: 'tab0' })); assert.equal(k.tab[0].length, 2);
});
test('word guess: letters marked with repeats counted, hard mode kept, the list searched, a share line with no letters', () => {
  assert.equal(mark('crane', 'crane'), 'ggggg'); assert.equal(mark('speed', 'abide'), 'bbyby'); assert.equal(mark('eerie', 'there'), 'ybybg'); assert.equal(mark('llama', 'hello'), 'yybbb');
  assert.equal(hardOk('stone', [{ word: 'crane', marks: 'bbbgg' }]), ''); assert.match(hardOk('stork', [{ word: 'crane', marks: 'bbbgg' }]), /Letter 4/);
  const w = JSON.parse(fs.readFileSync(new URL('../void-live-deploy/games/word/words.json', import.meta.url))); assert.ok(w.answers.length > 500); assert.ok(w.answers.every((a) => inList(a, w.valid)), 'every answer is a valid guess'); assert.ok(!inList('xyzzq', w.valid));
  assert.ok(!/[a-z]{5}/i.test(shareLine([{ word: 'crane', marks: 'bgybb' }], '#1', false, false).split('\n').slice(1, -1).join('')));
});
test('the asks that open the games pages', () => {
  assert.equal(gameAskOf('chess puzzles'), '/chess/?mode=puzzle'); assert.equal(gameAskOf('sudoku'), '/games/sudoku/'); assert.equal(gameAskOf('play minesweeper'), '/games/mines/'); assert.equal(gameAskOf('2048 game'), '/games/merge/');
  assert.equal(gameAskOf('klondike solitaire'), '/games/solitaire/'); assert.equal(gameAskOf('five letter word game'), '/games/word/'); assert.equal(gameAskOf('games'), '/games/'); assert.equal(gameAskOf('chess history'), '');
  assert.equal(new Set(GAME_SITES.map((r) => r.path)).size, GAME_SITES.length); for (const r of GAME_SITES) assert.ok(fs.existsSync(new URL('../void-live-deploy' + r.path + 'index.html', import.meta.url)) && fs.existsSync(new URL('../void-live-deploy' + r.path + 'app.js', import.meta.url)), r.path);
});
