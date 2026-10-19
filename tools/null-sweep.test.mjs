import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../void-live-deploy/skills/null-sweep-rules.js';

const total = (s) => s.mine.reduce((a, b) => a + b, 0);

test('a board from a seed is the same board every time, with exactly the right number of bad commits', () => {
  const a = S.create(11), b = S.create(11), c = S.create(12);
  assert.deepEqual(a.mine, b.mine); assert.notDeepEqual(a.mine, c.mine);
  assert.equal(total(a), S.MINES); assert.equal(a.mine.length, S.W * S.H);
  assert.equal(S.create(5, 5, 5, 99).mines, 15, 'a board always keeps room for the first clearing');
});

test('the first open is always a clearing: the cell and its ring hold no bad commit, and the count of bad commits is unchanged', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const s = S.create(seed), i = seed % (S.W * S.H), before = total(s);
    S.open(s, i);
    assert.ok(!s.over, 'seed ' + seed + ' lost on the first open');
    for (const j of [i, ...S.around(s, i)]) assert.equal(s.mine[j], 0, 'seed ' + seed + ' cell ' + j);
    assert.equal(total(s), before);
    assert.equal(s.open[i], 1);
  }
});

test('numbers count the eight neighbours, a zero opens its whole empty area, and corners have three neighbours', () => {
  const s = S.create(3, 4, 4, 1); s.mine.fill(0); s.mine[15] = 1; s.started = true;
  assert.equal(S.count(s, 10), 1); assert.equal(S.count(s, 0), 0);
  assert.equal(S.around(s, 0).length, 3); assert.equal(S.around(s, 5).length, 8);
  S.open(s, 0);
  assert.equal(s.open[0], 1); assert.equal(s.open[1], 1); assert.equal(s.open[15], 0, 'the bad commit stays closed');
  assert.equal(s.over, 'win', 'every safe cell opened: ' + s.open.join(''));
});

test('opening a bad commit loses; a flag protects a cell; flagging an open cell does nothing', () => {
  const s = S.create(3, 4, 4, 1); s.mine.fill(0); s.mine[15] = 1; s.started = true;
  S.flag(s, 15); S.open(s, 15); assert.equal(s.over, null, 'a flagged cell does not open'); assert.equal(s.open[15], 0);
  S.flag(s, 15); assert.equal(s.flag[15], 0);
  S.open(s, 15); assert.equal(s.over, 'boom'); assert.equal(s.hit, 15);
  const after = JSON.stringify(s); S.open(s, 0); S.flag(s, 0); assert.equal(JSON.stringify(s), after, 'a finished board does not change');
  const t = S.create(3, 4, 4, 1); t.mine.fill(0); t.mine[15] = 1; t.started = true; S.open(t, 0); S.flag(t, 0); assert.equal(t.flag[0], 0);
});

test('out-of-range and repeated moves change nothing and never throw', () => {
  const s = S.create(9); S.open(s, 40);
  const snap = JSON.stringify(s);
  for (const i of [-1, 81, 1e9, NaN]) { S.open(s, i); S.flag(s, i); }
  S.open(s, 40);
  assert.equal(JSON.stringify(s), snap);
});

test('Verse never reads a hidden bad commit: its move is the same on two boards that differ only under closed cells', () => {
  const a = S.create(21); S.open(a, 40);
  const b = JSON.parse(JSON.stringify(a));
  const closed = []; for (let i = 0; i < a.mine.length; i++) if (!a.open[i]) closed.push(i);
  // move bad commits among cells that are closed and touch no opened cell: nothing Verse can see changes
  const hidden = closed.filter((i) => !S.around(a, i).some((j) => a.open[j]));
  const from = hidden.find((i) => b.mine[i]), to = hidden.find((i) => !b.mine[i]);
  if (from != null && to != null) { b.mine[from] = 0; b.mine[to] = 1; }
  assert.deepEqual(S.botMove(a), S.botMove(b));
});

test('Verse flags what must be a bad commit, opens what must be safe, and says why', () => {
  // one row of four, a bad commit at the left end, the two middle cells already open: the 1 has a single closed neighbour
  const s = S.create(1, 4, 1, 1); s.mine.fill(0); s.mine[0] = 1; s.started = true; s.open = [0, 1, 1, 0];
  const f = S.botMove(s); assert.equal(f.kind, 'flag'); assert.equal(f.i, 0); assert.match(f.why, /only 1 closed cell/);
  S.apply(s, f); assert.equal(s.flag[0], 1); assert.equal(s.why, f.why);
  const o = S.botMove(s); assert.equal(o.kind, 'open'); assert.equal(o.i, 3); assert.match(o.why, /flags? beside it: the rest are safe/);
  S.apply(s, o); assert.equal(s.over, 'win');
  assert.equal(S.botMove(s), null, 'nothing to do on a finished board');
});

test('with no sure move Verse guesses the safest cell and says it is a guess', () => {
  const s = S.create(2); assert.equal(S.botMove(s).i, 40, 'the first open is the middle'); S.apply(s, S.botMove(s));
  let guessed = false; for (let k = 0; k < 80 && !s.over; k++) { const m = S.botMove(s); if (!m) break; if (/no sure move/.test(m.why)) guessed = true; S.apply(s, m); }
  assert.ok(guessed || s.over === 'win', 'a board at this size needs a guess or is cleared without one');
});

test('Verse plays a whole game alone: it always finishes, never takes the move cap, and wins a fair share of beginner boards', () => {
  let wins = 0, boom = 0, guesses = 0; const N = 200;
  for (let seed = 1; seed <= N; seed++) {
    const r = S.selfPlay(seed); assert.ok(r.over === 'win' || r.over === 'boom', 'seed ' + seed + ' did not finish: ' + r.over);
    if (r.over === 'win') wins++; else boom++;
  }
  assert.equal(wins + boom, N);
  assert.ok(wins / N >= 0.55, 'Verse wins only ' + wins + ' of ' + N + ' beginner boards');
  assert.ok(wins / N <= 0.99, 'a solver that never loses leaves the person nothing to beat (' + wins + ')');
  void guesses;
});

test('a human who plays the solver\'s moves wins as often as the solver does (the rules and the solver agree)', () => {
  let a = 0, b = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const s = S.create(seed); let k = 0;
    while (!s.over && k++ < 400) { const m = S.botMove(s); if (!m) break; if (m.kind === 'flag') S.flag(s, m.i); else S.open(s, m.i); }
    if (s.over === 'win') a++;
    if (S.selfPlay(seed).over === 'win') b++;
  }
  assert.equal(a, b);
});
