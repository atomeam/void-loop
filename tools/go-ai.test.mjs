// V01D's Go opponent (void-live-deploy/lib/go-ai.js), asked by Void: "Next game I want to learn: Go".
// Its moves are checked against the card's own rules engine (skills/go.js): legal only, captures, saves, eyes, passes,
// the same move under the same seed, and a bounded time per move.
import test from 'node:test';
import assert from 'node:assert/strict';
import { think, chooseMove, makeRng, seedOf } from '../void-live-deploy/lib/go-ai.js';
import { goOf, createGoState, placeStone, pass, countPosition, VOID_PLAYOUTS } from '../void-live-deploy/skills/go.js';

const at = (s) => { const c = 'ABCDEFGHJ'.indexOf(s[0]), r = 9 - +s.slice(1); return r * 9 + c; };
// a position from a picture: B and W stones by point name, `turn` to move
const setUp = ({ B = [], W = [], turn = 1, ko = -1, passes = 0 }) => {
  const s = createGoState(9);
  for (const p of B) s.board[at(p)] = 1;
  for (const p of W) s.board[at(p)] = 2;
  return { ...s, turn, ko, passes };
};
const near = (i) => { const r = Math.floor(i / 9), c = i % 9, o = []; if (r) o.push(i - 9); if (r < 8) o.push(i + 9); if (c) o.push(i - 1); if (c < 8) o.push(i + 1); return o; };
const ownEye = (s, i) => near(i).every((q) => s.board[q] === s.turn);
// a real single-point eye: all four sides its own, and the diagonals don't make it false (an edge or two opposing diagonals do)
const realEye = (s, i) => {
  if (!ownEye(s, i)) return false;
  const r = Math.floor(i / 9), c = i % 9, edge = r === 0 || r === 8 || c === 0 || c === 8 ? 1 : 0;
  let bad = 0; for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const y = r + dr, x = c + dc; if (y >= 0 && y < 9 && x >= 0 && x < 9 && s.board[y * 9 + x] === 3 - s.turn) bad++; }
  return bad + edge < 2;
};
const legalMoves = (s) => { const out = []; for (let i = 0; i < 81; i++) { if (s.board[i]) continue; try { placeStone(s, i); out.push(i); } catch (_) {} } return out; };

test('asks for a game against Verse seat it as White; plain "play go" stays two people', () => {
  for (const t of ['play go against void', 'play go with v01d', 'go against you', 'can you play go', 'Can you play Go?', 'play go vs the computer', 'challenge void to go']) assert.deepEqual(goOf(t), { kind: 'game', vs: 'void' }, t);
  for (const t of ['play go', 'go', 'play go with a friend', 'play go with me', 'a game of go']) assert.deepEqual(goOf(t), { kind: 'game' }, t);
  for (const t of ["let's go", 'can you play go fish', 'go home']) assert.equal(goOf(t), null, t);
});

test('only legal moves, never its own eye, over many random positions (checked by skills/go.js)', () => {
  const rng = makeRng(7);
  let checked = 0;
  for (let game = 0; game < 120; game++) {
    let s = createGoState(9);
    const len = Math.floor(rng() * 90);
    for (let k = 0; k < len && s.status === 'playing'; k++) {
      const moves = legalMoves(s).filter((i) => !ownEye(s, i));
      s = moves.length ? placeStone(s, moves[Math.floor(rng() * moves.length)]).nextState : pass(s);
    }
    if (s.status !== 'playing') continue;
    const m = chooseMove(s, { playouts: 80, seed: game });
    if (m !== 'pass') {
      assert.doesNotThrow(() => placeStone(s, m), 'game ' + game + ' move ' + m);
      assert.ok(!realEye(s, m), 'filled its own eye at ' + m); // connecting through a false eye is allowed: it can save a group
    }
    checked++;
  }
  assert.ok(checked >= 100, 'positions checked: ' + checked);
});

test('a ko point is never retaken at once', () => {
  let k = createGoState(9);
  for (const p of ['D5', 'E5', 'E4', 'F4', 'E6', 'F6', 'J9', 'G5', 'F5']) k = placeStone(k, at(p)).nextState; // black F5 took E5: a ko
  assert.equal(k.ko, at('E5'));
  for (let seed = 1; seed <= 5; seed++) assert.notEqual(chooseMove(k, { playouts: 200, seed }), at('E5'));
});

test('it captures a stone in atari', () => {
  const s = setUp({ B: ['E5', 'A9'], W: ['D5', 'F5', 'E6'], turn: 2 });
  const t = think(s, { seed: 1, playouts: 200 });
  assert.equal(t.move, at('E4')); assert.equal(t.why, 'capture');
  assert.equal(placeStone(s, t.move).captured.length, 1);
});

test('it saves its own group in atari', () => {
  const s = setUp({ B: ['D5', 'F5', 'E6', 'A9'], W: ['E5'], turn: 2 });
  const t = think(s, { seed: 1, playouts: 200 });
  assert.equal(t.move, at('E4')); assert.equal(t.why, 'save');
  // and by taking an attacker that is itself in atari, when there is one: black F5 has one liberty left (F4)
  const s2 = setUp({ B: ['D5', 'F5', 'E6', 'A9'], W: ['E5', 'G5', 'F6'], turn: 2 });
  const t2 = think(s2, { seed: 1, playouts: 200 });
  assert.equal(t2.move, at('F4')); assert.equal(t2.why, 'save');
  assert.deepEqual(placeStone(s2, t2.move).captured, [at('F5')]);
});

test('it does not fill its own eye', () => {
  // a white corner group with a single-point eye at A1; the rest of the board is open
  const s = setUp({ W: ['B1', 'A2', 'B2', 'C1', 'C2', 'A3', 'B3'], B: ['E5'], turn: 2 });
  for (let seed = 1; seed <= 8; seed++) assert.notEqual(chooseMove(s, { playouts: 150, seed }), at('A1'));
});

test('it passes on a filled board (only its own eyes, or suicide, left)', () => {
  const s = createGoState(9);
  s.board = s.board.map(() => 2); s.board[at('A1')] = 0; s.board[at('J9')] = 0;
  assert.deepEqual(think({ ...s, turn: 2 }, { seed: 1 }).move, 'pass'); // both points are White's own eyes
  assert.deepEqual(think({ ...s, turn: 1 }, { seed: 1 }).move, 'pass'); // for Black both are suicide
  assert.equal(think({ ...s, status: 'ended' }).move, 'pass');
});

test('same position and seed, same move; no seed means a seed from the position', () => {
  let s = createGoState(9);
  for (const p of ['E5', 'C3', 'G7', 'C7']) s = placeStone(s, at(p)).nextState;
  assert.equal(chooseMove(s, { seed: 42, playouts: 400 }), chooseMove(s, { seed: 42, playouts: 400 }));
  assert.equal(chooseMove(s, { playouts: 400 }), chooseMove(s, { playouts: 400 }));
  assert.equal(seedOf(s), seedOf({ ...s }));
  const r1 = makeRng(5), r2 = makeRng(5);
  for (let k = 0; k < 10; k++) assert.equal(r1(), r2());
});

test('a move at the card\'s budget takes well under a second', () => {
  let s = createGoState(9);
  for (const p of ['E5', 'C3', 'G7', 'C7', 'D4', 'F6']) s = placeStone(s, at(p)).nextState;
  for (const st of [createGoState(9), s]) {
    const t0 = performance.now(); const t = think(st, { playouts: VOID_PLAYOUTS, seed: 3 }); const ms = performance.now() - t0;
    assert.equal(t.playouts, VOID_PLAYOUTS);
    assert.ok(ms < 900, 'took ' + Math.round(ms) + ' ms');
  }
});

test('it beats a random player (that never fills its own eyes), as Black and as White', () => {
  for (let g = 0; g < 4; g++) {
    const rng = makeRng(100 + g), ai = g % 2 ? 1 : 2;
    let s = createGoState(9);
    while (s.status === 'playing' && s.moveCount < 300) {
      let m;
      if (s.turn === ai) m = chooseMove(s, { playouts: 500 });
      else { const ok = legalMoves(s).filter((i) => !ownEye(s, i)); m = ok.length ? ok[Math.floor(rng() * ok.length)] : 'pass'; }
      s = m === 'pass' ? pass(s) : placeStone(s, m).nextState;
    }
    const c = countPosition({ ...s, status: 'ended' });
    assert.equal(c.black > c.white ? 1 : 2, ai, 'game ' + g + ': ' + c.result);
  }
});
