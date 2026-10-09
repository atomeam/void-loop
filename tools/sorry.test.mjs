import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../void-live-deploy/skills/sorry-rules.js';

const S4 = ['S', 'S', 'S', 'S'];
const at = (pawns, card, turn = 0, extra = {}) => ({ ...R.createState({ opponents: 3 }, () => 0.5), pawns, card, turn, ...extra });

test('the deck is the real 45 cards', () => {
  const d = R.newDeck(() => 0.3);
  assert.equal(d.length, 45);
  assert.equal(d.filter((x) => x === 1).length, 5);
  for (const n of [2, 3, 4, 5, 7, 8, 10, 11, 12, 'sorry']) assert.equal(d.filter((x) => x === n).length, 4, String(n));
  assert.ok(!d.includes(6) && !d.includes(9));
});

test('only a 1 or a 2 leaves Start; a 2 draws again', () => {
  const s = R.createState({ opponents: 3 }, () => 0.5);
  assert.deepEqual(R.movesFor({ ...s, card: 1 }).map((m) => [m.kind, m.to]), [['start', R.startExit(0)]]);
  assert.equal(R.movesFor({ ...s, card: 3 }).length, 0);
  const after = R.play({ ...s, card: 2 }, R.movesFor({ ...s, card: 2 })[0]);
  assert.equal(after.turn, 0); // a 2 draws again
  assert.equal(after.pawns[0][0], R.startExit(0));
});

test('a 4 goes back, a 10 forward or back one, and backing past your own start lets you reach Safety fast', () => {
  const p = R.startExit(0); // 4
  const back4 = R.movesFor(at([[p, 'S', 'S', 'S'], S4, S4, S4], 4));
  assert.deepEqual(back4.map((m) => m.to), [0]);
  assert.equal(R.progressOf(0, 0), 56);
  assert.equal(R.walk(0, 0, 3), 'z0'); // two squares to the safety entry, then in
  assert.deepEqual(R.movesFor(at([[10, 'S', 'S', 'S'], S4, S4, S4], 10)).map((m) => m.to).sort(), [20, 9].sort());
});

test('landing on a rival sends it to Start; you never land on your own pawn', () => {
  const s = at([[20, 'S', 'S', 'S'], [25, 'S', 'S', 'S'], S4, S4], 5);
  const mv = R.movesFor(s).find((m) => m.to === 25), after = R.play(s, mv);
  assert.equal(after.pawns[1][0], 'S');
  assert.deepEqual(after.last.bumped, [1]);
  assert.equal(R.movesFor(at([[20, 25, 'S', 'S'], S4, S4, S4], 5)).filter((m) => m.pawn === 0).length, 0);
});

test("a slide of another colour carries you to its end and clears everyone on it; your own colour's slide does not", () => {
  // blue's short slide is 16..19 (side 1); red lands on 16 with a 3 from 13, and a yellow pawn sits on 18
  const s = at([[13, 'S', 'S', 'S'], S4, [18, 'S', 'S', 'S'], S4], 3);
  const after = R.play(s, R.movesFor(s).find((m) => m.pawn === 0));
  assert.equal(after.pawns[0][0], 19);
  assert.equal(after.pawns[2][0], 'S');
  // red's own long slide (9..13) does nothing for red
  const own = R.play(at([[6, 'S', 'S', 'S'], S4, S4, S4], 3), { pawn: 0, to: 9, kind: 'move' });
  assert.equal(own.pawns[0][0], 9);
});

test('Home needs the exact count; Safety belongs to its colour only', () => {
  assert.equal(R.walk(0, 'z3', 2), 'H');
  assert.equal(R.walk(0, 'z3', 3), null);
  assert.equal(R.walk(1, R.safeEntry(0), 1), R.safeEntry(0) + 1); // blue rolls past red's safety entry
});

test('an 11 swaps with a rival; a Sorry! card bumps a rival from your Start', () => {
  const s = at([[30, 'S', 'S', 'S'], [40, 'S', 'S', 'S'], S4, S4], 11);
  const sw = R.movesFor(s).find((m) => m.kind === 'swap');
  const after = R.play(s, sw);
  assert.equal(after.pawns[0][0], 40); assert.equal(after.pawns[1][0], 30);
  const so = at([['S', 'S', 'S', 'S'], [40, 'S', 'S', 'S'], S4, S4], 'sorry');
  const a2 = R.play(so, R.movesFor(so)[0]);
  assert.equal(a2.pawns[0][0], 40); assert.equal(a2.pawns[1][0], 'S');
});

test('a 7 splits between two pawns, and only when the second half can be played', () => {
  const s = at([[20, 30, 'S', 'S'], S4, S4, S4], 7);
  const split = R.movesFor(s).filter((m) => m.kind === 'split');
  assert.ok(split.length >= 10);
  const half = R.play(s, split.find((m) => m.pawn === 0 && m.split === 3));
  assert.equal(half.card, 7); assert.deepEqual(half.split, { pawn: 0, rest: 4 });
  const second = R.movesFor(half);
  assert.deepEqual(second.map((m) => [m.pawn, m.to]), [[1, 34]]);
  const done = R.play(half, second[0]);
  assert.equal(done.card, null); assert.equal(done.turn, 1);
  assert.equal(R.movesFor(at([[20, 'S', 'S', 'S'], S4, S4, S4], 7)).filter((m) => m.kind === 'split').length, 0); // one pawn out: no split
});

test('the bot plays a legal move, and takes a bump when it can', () => {
  const s = at([[20, 'S', 'S', 'S'], [25, 'S', 'S', 'S'], S4, S4], 5);
  const mv = R.botMove(s);
  assert.equal(mv.to, 25);
  let g = R.createState({ opponents: 3 }, () => 0.42);
  for (let i = 0; i < 400 && g.winner == null; i++) { g = R.draw(g); const m = R.botMove(g); g = m ? R.play(g, m) : R.pass(g); if (g.split) { const m2 = R.botMove(g); g = m2 ? R.play(g, m2) : R.pass(g); } }
  assert.ok(g.pawns.every((arr) => arr.every((q) => q === 'S' || q === 'H' || typeof q === 'number' || /^z[0-4]$/.test(q))));
});
