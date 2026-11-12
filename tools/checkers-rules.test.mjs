// American checkers rules (void-live-deploy/skills/checkers-rules.js), lists run 21 (Up for grabs: tests for the biggest untested files).
// Run: node --test tools/checkers-rules.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { create, fromRows, legalMoves, play, status, count, bestMove, playable, DARK, LIGHT } from '../void-live-deploy/skills/checkers-rules.js';

const E = '........';
test('the opening: 12 men each, dark moves first with 7 moves', () => {
  const s = create();
  assert.deepEqual(count(s), { d: 12, D: 0, l: 12, L: 0 });
  assert.equal(s.turn, DARK); assert.equal(legalMoves(s).length, 7); assert.equal(status(s), 'playing');
  for (let sq = 0; sq < 64; sq++) if (s.board[sq]) assert.ok(playable(sq), 'pieces sit on dark squares only');
});
test('a capture is forced, and a capturing man keeps jumping', () => {
  // dark man at row 0 col 0; light men at (1,1) and (3,3): a double jump to (4,4)
  const s = fromRows([E, E, E, E, '...l....', E, '.l......', 'd.......']);
  const ms = legalMoves(s);
  assert.equal(ms.length, 1); assert.deepEqual(ms[0].path, [18, 36]); assert.deepEqual(ms[0].captures, [9, 27]);
  const after = play(s, [0, 18, 36]);
  assert.deepEqual(count(after), { d: 1, D: 0, l: 0, L: 0 }); assert.equal(after.turn, LIGHT);
  assert.equal(status(after), 'dark-wins', 'a side with no move loses');
});
test('a man that reaches the far row is crowned and its move ends there', () => {
  const s = fromRows([E, '.d......', E, E, E, E, E, '.......l']);
  const m = legalMoves(s).find((x) => x.from === 49 && x.path[0] === 56);
  assert.ok(m && m.crown); const after = play(s, m); assert.equal(after.board[56], 'D');
  assert.throws(() => play(s, [49, 41]), /illegal move/, 'men move forward only');
});
test("Verse's search takes a free piece", () => {
  const s = fromRows([E, E, E, E, E, '..l.....', '.d......', E]);
  const m = bestMove(s, { depth: 3, ms: 200, rng: () => 0 });
  assert.deepEqual(m.captures, [18]);
});
