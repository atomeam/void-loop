import test from 'node:test';
import assert from 'node:assert/strict';
import go, { goOf, createGoState, placeStone, pass, countPosition, toggleDead, resume, pointName, KOMI } from '../void-live-deploy/skills/go.js';

const at = (s) => { const c = 'ABCDEFGHJ'.indexOf(s[0]), r = 9 - +s.slice(1); return r * 9 + c; };
const play = (st, ...pts) => pts.reduce((s, p) => (p === 'pass' ? pass(s) : placeStone(s, at(p)).nextState), st);

test('asks for the board game Go open it; "let\'s go" and other goes do not', () => {
  for (const t of ['go', 'Go', 'play go', "let's play go", 'a game of go', 'go board', 'play baduk', 'teach me to play go', 'the board game go', 'play go with a friend']) assert.ok(goOf(t), t);
  for (const t of ["let's go", 'go go go', 'go home', 'play go fish', 'pokemon go', 'go to the store', 'i want to go', 'can we go']) assert.equal(goOf(t), null, t);
});

test('a placement is a move, not a verdict: no count moves, no winner, the other seat plays next', () => {
  const s = play(createGoState(), 'E5');
  assert.deepEqual(s.captured, { 1: 0, 2: 0 });
  assert.equal(s.status, 'playing'); assert.equal(s.turn, 2); assert.equal(s.moveCount, 1); assert.equal(pointName(s.last), 'E5');
  assert.throws(() => placeStone(s, at('E5')), /taken/);
});

test('a capture happens when a stone takes the last liberty, and only then the count goes up', () => {
  let s = play(createGoState(), 'A2', 'A1'); // white A1 in the corner, black A2 above it
  assert.equal(s.captured[1], 0);
  s = play(s, 'B1'); // black takes the last liberty
  assert.equal(s.board[at('A1')], 0); assert.equal(s.captured[1], 1); assert.equal(s.captured[2], 0);
  // a whole group of two comes off together
  let g = play(createGoState(), 'D5', 'E5', 'D4', 'E4', 'F5', 'J9', 'F4', 'J8', 'E6', 'J7');
  g = play(g, 'E3');
  assert.equal(g.captured[1], 2); assert.equal(g.board[at('E5')], 0); assert.equal(g.board[at('E4')], 0);
});

test('suicide is refused unless it captures; ko forbids the immediate retake but not a later one', () => {
  assert.throws(() => play(createGoState(), 'A2', 'J9', 'B1', 'A1'), /suicide/);
  let k = play(createGoState(), 'D5', 'E5', 'E4', 'F4', 'E6', 'F6', 'J9', 'G5', 'F5');
  assert.equal(k.captured[1], 1);
  assert.throws(() => play(k, 'E5'), /ko/);
  k = play(k, 'J1', 'J2'); // a move elsewhere each, then the retake is fine
  assert.doesNotThrow(() => play(k, 'E5'));
});

test('a pass wins nothing; two in a row end play; a count before then is an estimate, after it a result', () => {
  let s = play(createGoState(), 'E5', 'pass');
  assert.equal(s.status, 'playing');
  const est = countPosition(s);
  assert.equal(est.final, false); assert.equal(est.result, undefined);
  assert.throws(() => pass(pass(s)) && placeStone(pass(pass(s)), at('A1')), /ended/);
  s = play(s, 'pass');
  assert.equal(s.status, 'ended');
  assert.deepEqual(countPosition(s), { black: 81, white: KOMI, komi: KOMI, neutral: 0, final: true, result: 'B+74', why: { black: { stones: 1, territory: 80 }, white: { stones: 0, territory: 0, komi: KOMI } } });
});

test('after play ends, dead groups are marked by the players, count for the other side, and play can resume', () => {
  let s = play(createGoState(), 'E5', 'A1', 'pass', 'pass');
  assert.equal(countPosition(s).neutral, 79); // two colours touch the same open area: nobody's yet
  s = toggleDead(s, at('A1'));
  assert.deepEqual(s.dead, [at('A1')]);
  assert.equal(countPosition(s).black, 81);
  assert.deepEqual(toggleDead(s, at('A1')).dead, []);
  const r = resume(s);
  assert.equal(r.status, 'playing'); assert.deepEqual(r.dead, []); assert.equal(r.passes, 0);
});

test('the skill\'s own suite passes (skills-check runs it too)', () => assert.deepEqual(go.suite(), { ok: true }));
