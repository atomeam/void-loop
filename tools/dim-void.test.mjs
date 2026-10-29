import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../void-live-deploy/skills/dim-void-rules.js';

const popcount = (n) => { let c = 0; while (n) { c += n & 1; n >>>= 1; } return c; };

test('a press flips the lamp and its neighbours that exist: five in the middle, four on an edge, three in a corner', () => {
  assert.deepEqual(D.reach(12, 5).sort((a, b) => a - b), [7, 11, 12, 13, 17]);
  assert.equal(D.reach(2, 5).length, 4); assert.equal(D.reach(0, 5).length, 3); assert.equal(D.reach(24, 5).length, 3);
  const s = D.create(1); s.lights.fill(0); s.lights[12] = 1; D.press(s, 12); assert.equal(s.lights.filter(Boolean).length, 4, 'the centre went out, the four around it lit');
  D.press(s, 12); assert.equal(s.lights.filter(Boolean).length, 1, 'pressing twice undoes it');
});

test('a board from a seed is the same every time, never already dark, and always solvable', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const a = D.create(seed), b = D.create(seed);
    assert.deepEqual(a.lights, b.lights); assert.ok(a.lights.some(Boolean), 'seed ' + seed);
    assert.ok(Number.isInteger(a.par) && a.par >= 1 && a.par <= 25, 'par ' + a.par);
  }
  assert.notDeepEqual(D.create(1).lights, D.create(2).lights);
});

test('the solution put every lamp out, and it is the shortest: checked against every press set on 3x3 and 4x4', () => {
  for (const n of [3, 4]) {
    const m = n * n;
    for (let board = 1; board < (1 << m); board += n === 3 ? 1 : 37) {
      const lights = Array.from({ length: m }, (_, i) => (board >> i) & 1);
      let bestW = Infinity;
      for (let p = 0; p < (1 << m); p++) { // brute force: the lamps after pressing the set p
        const l = lights.slice(); for (let j = 0; j < m; j++) if ((p >> j) & 1) for (const i of D.reach(j, n)) l[i] ^= 1;
        if (!l.some(Boolean)) bestW = Math.min(bestW, popcount(p));
      }
      const sol = D.solve(lights, n);
      if (bestW === Infinity) { assert.equal(sol, null, 'n=' + n + ' board ' + board); continue; }
      assert.ok(sol, 'n=' + n + ' board ' + board);
      const l = lights.slice(); for (const j of sol) for (const i of D.reach(j, n)) l[i] ^= 1;
      assert.ok(!l.some(Boolean), 'the solution works'); assert.equal(sol.length, bestW, 'the shortest: n=' + n + ' board ' + board);
    }
  }
});

test('on 5x5 about a quarter of all boards are solvable (2^23 of 2^25), and the all-lit board is', () => {
  let ok = 0, N = 1200, seed = 12345;
  const r = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let k = 0; k < N; k++) if (D.solve(Array.from({ length: 25 }, () => (r() < 0.5 ? 1 : 0)), 5)) ok++;
  assert.ok(ok / N > 0.2 && ok / N < 0.3, 'solvable share ' + ok / N);
  assert.ok(D.solve(new Array(25).fill(1), 5));
  assert.deepEqual(D.solve(new Array(25).fill(0), 5), []);
});

test('pressing out of range or after the end changes nothing; the board is won when every lamp is out', () => {
  const s = D.create(3), snap = JSON.stringify(s);
  for (const i of [-1, 25, NaN, 1.5, 'x']) D.press(s, i); assert.equal(JSON.stringify(s), snap);
  for (const i of D.solve(s.lights, 5)) D.press(s, i);
  assert.equal(s.over, 'win'); assert.equal(s.presses, s.par);
  const done = JSON.stringify(s); D.press(s, 0); assert.equal(JSON.stringify(s), done);
});

test('Verse plays the board alone in exactly par presses, every press says why, and it never has a move on a finished board', () => {
  for (let seed = 1; seed <= 100; seed++) { const r = D.selfPlay(seed); assert.equal(r.over, 'win'); assert.equal(r.presses, r.par, 'seed ' + seed); }
  const s = D.create(4); const m = D.botMove(s); assert.match(m.why, /it is one of the \d+ presses that put every lamp out/);
  const t = D.create(4); for (const i of D.solve(t.lights, 5)) D.press(t, i); assert.equal(D.botMove(t), null);
});
