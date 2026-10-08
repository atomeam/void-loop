import test from 'node:test';
import assert from 'node:assert/strict';
import * as K from '../void-live-deploy/skills/connect4-rules.js';

const play = (s, ...cols) => cols.reduce((x, c) => K.drop(x, c), s);

test('discs fall to the lowest open row; a full column refuses more; turns alternate', () => {
  let s = play(K.create(), 3, 3);
  assert.equal(s.board[5 * 7 + 3], 1); assert.equal(s.board[4 * 7 + 3], 2); assert.equal(s.turn, 1);
  s = play(s, 3, 3, 3, 3); assert.equal(K.rowFor(s.board, 3), -1); assert.equal(K.drop(s, 3), s);
});

test('four in a row wins across, down and on both diagonals', () => {
  assert.equal(play(K.create(), 0, 0, 1, 1, 2, 2, 3).over, 'you');
  assert.equal(play(K.create(), 0, 1, 0, 1, 0, 1, 0).over, 'you');
  assert.equal(play(K.create(), 0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3).over, 'you');
});

test('Void takes a win when it has one, blocks yours, and says why', () => {
  let s = play(K.create(), 0, 6, 0, 6, 1, 6); // Void has three in column 7, you have two and one
  const w = K.voidMove({ ...s, turn: 2 }); // pretend it is Void's turn with three in a column
  let t = play(K.create(), 0, 6, 1, 6, 2); // you threaten 0-1-2-3 across the bottom
  const b = K.voidMove(t); assert.equal(b.col, 3); assert.match(b.why, /you would make four in column 4/);
  let u = play(K.create(), 0, 6, 0, 6, 1, 6, 5); // Void (yellow) has three up column 7 and it is its turn
  const m = K.voidMove(u); assert.equal(m.col, 6); assert.match(m.why, /four in a row/);
  assert.ok(w.why);
});

test('a whole game against Void ends, and every Void move says why', () => {
  let s = K.create();
  for (let k = 0; k < 42 && !s.over; k++) {
    if (s.turn === 2) { const m = K.voidMove(s, 4); s = K.drop(s, m.col, m.why); continue; }
    s = K.drop(s, [0, 1, 2, 3, 4, 5, 6].find((c) => K.rowFor(s.board, c) >= 0));
  }
  assert.ok(s.over);
  for (const l of s.log.filter((x) => x.who === 'Void')) assert.ok(l.why, l.text);
});
