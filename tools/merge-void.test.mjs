import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../void-live-deploy/skills/merge-void-rules.js';

test('a line slides toward its start; equal neighbours fuse once; a fused card does not fuse again in the same slide', () => {
  assert.deepEqual(M.slideLine([2, 2, 2, 2]).line, [4, 4, 0, 0]);
  assert.deepEqual(M.slideLine([2, 2, 4, 0]).line, [4, 4, 0, 0]);
  assert.deepEqual(M.slideLine([4, 2, 2, 0]).line, [4, 4, 0, 0]);
  assert.deepEqual(M.slideLine([2, 2, 4, 8]).line, [4, 4, 8, 0]);
  assert.deepEqual(M.slideLine([0, 0, 0, 2]).line, [2, 0, 0, 0]);
  assert.deepEqual(M.slideLine([2, 4, 2, 4]).line, [2, 4, 2, 4]);
  const r = M.slideLine([2, 2, 4, 4]); assert.equal(r.gained, 12); assert.equal(r.fused, 2); assert.equal(r.moved, true);
  assert.equal(M.slideLine([2, 4, 8, 16]).moved, false);
});

test('every direction slides the same way on a rotated grid, and the total of the cards never changes by a slide', () => {
  const g = [2, 0, 2, 4, 0, 4, 0, 0, 8, 0, 0, 8, 0, 0, 0, 2];
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  for (const d of M.DIRS) assert.equal(sum(M.slide(g, d).grid), sum(g), d);
  assert.deepEqual(M.slide(g, 'left').grid.slice(0, 4), [4, 4, 0, 0]);
  assert.deepEqual(M.slide(g, 'right').grid.slice(0, 4), [0, 0, 4, 4]);
  const up = M.slide(g, 'up').grid, down = M.slide(g, 'down').grid;
  assert.equal(up[0], 2); assert.equal(down[12], 8, 'down: the 8 and 8 in column 0 fuse and sit at the bottom'.length ? down[12] : 0);
  assert.equal(M.slide([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 'left').moved, false);
});

test('a board from a seed is the same every time; it starts with two cards, each a 2 or a 4', () => {
  const a = M.create(5), b = M.create(5), c = M.create(6);
  assert.deepEqual(a.grid, b.grid); assert.equal(a.grid.filter(Boolean).length, 2);
  assert.ok(a.grid.every((v) => [0, 2, 4].includes(v)));
  assert.notDeepEqual(a.grid, c.grid);
});

test('a slide that moves something scores, counts and adds a card; one that moves nothing changes nothing at all', () => {
  const s = M.create(1); s.grid.fill(0); s.grid[0] = 2; s.grid[1] = 2;
  M.move(s, 'left'); assert.equal(s.score, 4); assert.equal(s.moves, 1); assert.equal(s.grid[0], 4); assert.equal(s.grid.filter(Boolean).length, 2, 'the fused card and one new card');
  const t = M.create(1); t.grid.fill(0); t.grid[0] = 2; const snap = JSON.stringify(t);
  M.move(t, 'left'); M.move(t, 'up'); assert.equal(JSON.stringify(t), snap, 'already at the left and the top: nothing moves');
  M.move(t, 'sideways'); M.move(t, undefined); assert.equal(JSON.stringify(t), snap);
});

test('reaching the target wins; a full grid with no fusion is stuck; a finished game does not move', () => {
  const w = M.create(1); w.grid.fill(0); w.grid[0] = M.TARGET / 2; w.grid[1] = M.TARGET / 2; M.move(w, 'left'); assert.equal(w.over, 'win');
  const snap = JSON.stringify(w); M.move(w, 'right'); assert.equal(JSON.stringify(w), snap);
  // a checkerboard of 8s and 16s with one free cell: sliding the last row left continues the checkerboard, and the new 2 or 4 cannot fuse with 8 or 16, so the board is full and deadlocked
  const k = M.create(1); k.grid = [8, 16, 8, 16, 16, 8, 16, 8, 8, 16, 8, 16, 0, 16, 8, 16]; assert.equal(M.canMove(k), true);
  M.move(k, 'left'); assert.equal(k.grid.filter((v) => !v).length, 0); assert.equal(k.over, 'stuck', k.grid.join());
  assert.equal(M.canMove(k), false);
});

test('Verse only picks a slide that changes the grid, says why, and plays whole games that all end', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const s = M.create(seed); let n = 0;
    while (!s.over && n++ < 5000) { const m = M.botMove(s); assert.ok(m, 'a move while the game is on'); assert.ok(M.slide(s.grid, m.dir).moved, 'seed ' + seed + ' ' + m.dir); assert.match(m.why, /^slide /); M.apply(s, m); }
    assert.ok(s.over === 'win' || s.over === 'stuck', 'seed ' + seed);
  }
  assert.equal(M.botMove(Object.assign(M.create(1), { over: 'stuck' })), null);
});

test('Verse is beatable and not helpless: it often builds a 256 or better, and it does not win nearly every game', () => {
  const N = 60; let strong = 0, wins = 0;
  for (let seed = 1; seed <= N; seed++) { const r = M.selfPlay(seed); if (r.best >= 256) strong++; if (r.over === 'win') wins++; }
  assert.ok(strong / N >= 0.9, 'only ' + strong + ' of ' + N + ' reached 256');
  assert.ok(wins / N <= 0.5, wins + ' of ' + N + ' won: the target is too easy for it to be an opponent');
});
