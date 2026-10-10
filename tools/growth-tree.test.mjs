// node --test tools/growth-tree.test.mjs: the layout of Void's growth tree (void-live-deploy/skills/growth-tree.js, frontier
// #3) on a fixture ledger: one branch per entry, the same tree every time, the newest at the tips, a new entry only adds a
// branch, and the wood is shaped like a real tree's (on its parent, above the ground, thinning by the pipe model).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { layout, chronological, midpoint, KIND_COLOR, TIP_RADIUS, PIPE, TRUNK } from '../void-live-deploy/skills/growth-tree.js';

const KINDS = ['grow', 'build', 'fix', 'idea', 'finding', 'retire'];
// 40 entries over 8 days, out of order in the file (the ledger allows that), plus three it must skip
const FIXTURE = Array.from({ length: 40 }, (_, i) => ({ at: new Date(Date.UTC(2026, 9, 1 + (i % 8), 9 + Math.floor(i / 8), i)).toISOString().replace('.000', ''), by: 'claude', kind: KINDS[(i * 7) % 6], what: 'entry ' + i }))
  .concat([{ at: 'not a time', by: 'x', kind: 'grow', what: 'undated' }, { at: '2026-10-02T00:00:00Z', by: 'x', kind: 'grow', what: '' }, null]);
const valid = FIXTURE.filter((e) => e && e.what && !isNaN(Date.parse(e.at)));
const T = layout(FIXTURE);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

test('one branch per dated entry; the oldest is the trunk; each keeps its ledger index and its kind colour', () => {
  assert.equal(T.branches.length, valid.length);
  const oldest = chronological(FIXTURE)[0];
  assert.equal(T.branches[0].index, oldest.index);
  assert.equal(T.branches[0].parent, -1);
  assert.deepEqual(T.branches[0].start, [0, 0, 0]);
  assert.equal(T.branches[0].length, TRUNK);
  for (const b of T.branches) {
    assert.equal(FIXTURE[b.index].at, b.at);
    assert.equal(b.color, KIND_COLOR[FIXTURE[b.index].kind]);
  }
  assert.equal(new Set(T.branches.map((b) => b.index)).size, T.branches.length, 'no entry twice');
});

test('the same ledger always makes the same tree, whatever order the file lists it in', () => {
  assert.deepEqual(layout(FIXTURE), T);
  assert.deepEqual(JSON.stringify(layout(JSON.parse(JSON.stringify(FIXTURE)))), JSON.stringify(T));
  const shuffled = valid.slice().reverse(), S = layout(shuffled);
  const key = (t, list) => t.branches.map((b) => list[b.index].what + '@' + b.start.join(',') + '>' + b.end.join(',')).join('|');
  assert.equal(key(S, shuffled), key(T, FIXTURE));
});

test('the newest are at the tips: every branch grows from an older one, and the newest entry has nothing growing from it', () => {
  for (const b of T.branches) for (const c of b.children) assert.ok(Date.parse(T.branches[c].at) >= Date.parse(b.at), 'a child older than its parent');
  const newest = T.branches.reduce((a, b) => (Date.parse(b.at) >= Date.parse(a.at) ? b : a));
  assert.equal(newest.children.length, 0);
  assert.ok(T.branches.filter((b) => !b.children.length).length >= T.branches.length / 3, 'a crown of tips, not a pole');
});

test('a new entry only adds a branch at a tip: every branch that grew before stays exactly where it was', () => {
  const later = FIXTURE.concat([{ at: '2026-10-20T12:00:00Z', by: 'claude', kind: 'grow', what: 'the newest thing' }]);
  const L = layout(later), added = L.branches.find((b) => b.index === later.length - 1);
  assert.equal(L.branches.length, T.branches.length + 1);
  assert.ok(added && added.children.length === 0);
  for (const b of T.branches) {
    const same = L.branches.find((x) => x.index === b.index);
    assert.deepEqual([same.start, same.end, same.parent], [b.start, b.end, b.parent]);
  }
  // the tree as it stood on a past day is the tree grown from the entries up to then (the time slider's hook)
  const until = '2026-10-04T23:59:59Z', past = layout(FIXTURE, { until });
  assert.equal(past.branches.length, valid.filter((e) => e.at <= until).length);
  for (const b of past.branches) assert.deepEqual(T.branches.find((x) => x.index === b.index).start, b.start);
});

test('shaped like a tree: each branch starts on its parent, nothing grows into the ground, wood thins by the pipe model', () => {
  for (const b of T.branches) {
    assert.ok(b.end[1] > 0.3 && b.start[1] >= 0, 'above ground');
    assert.ok(Math.abs(Math.hypot(...b.dir) - 1) < 1e-4);
    assert.ok(Math.abs(dist(b.start, b.end) - b.length) < 1e-4);
    if (b.parent >= 0) {
      const p = T.branches[b.parent], along = [0, 1, 2].reduce((s, k) => s + (b.start[k] - p.start[k]) * p.dir[k], 0) / p.length;
      const onAxis = p.start.map((x, k) => x + p.dir[k] * p.length * along);
      assert.ok(dist(onAxis, b.start) < 1e-4 && along > 0.3 && along < 1, 'sprouts from along its parent');
      assert.ok(b.length < p.length && b.radius < p.radius, 'smaller than what it grows from');
      const angle = Math.acos(Math.max(-1, Math.min(1, [0, 1, 2].reduce((s, k) => s + b.dir[k] * p.dir[k], 0)))) * 180 / Math.PI;
      assert.ok(angle > 5 && angle < 75, 'branches off at a real angle: ' + angle);
    }
    // the pipe model: a branch's cross-section feeds every branch above it
    const want = (TIP_RADIUS ** PIPE + b.children.reduce((s, c) => s + T.branches[c].radius ** PIPE, 0)) ** (1 / PIPE);
    assert.ok(Math.abs(b.radius - want) < 1e-9);
    // its profile runs base to tip, never thinner than a branch it carries before its highest fork, and ends in a twig
    assert.deepEqual(b.profile[0], [0, Math.round(b.radius * 1e6) / 1e6]);
    assert.equal(b.profile[b.profile.length - 1][0], 1);
    for (const c of b.children) assert.ok(b.profile[1][1] >= T.branches[c].radius - 1e-6);
  }
  assert.ok(T.branches[0].radius === Math.max(...T.branches.map((b) => b.radius)), 'the trunk is the thickest');
  assert.ok(T.height > TRUNK && T.width > 0.3);
  assert.deepEqual(midpoint(T.branches[0]), [0, 1, 2].map((k) => Math.round((T.branches[0].dir[k] * TRUNK / 2) * 1e6) / 1e6));
});

test('the real ledger makes a whole tree: a branch for every entry, a few metres tall, nothing out of bounds', () => {
  const ledger = JSON.parse(fs.readFileSync(new URL('../void-live-deploy/void.growth.json', import.meta.url), 'utf8'));
  const R = layout(ledger);
  assert.equal(R.branches.length, chronological(ledger).length);
  assert.ok(R.height > 2 && R.height < 8 && R.width < 5, R.height + ' x ' + R.width);
  assert.ok(R.branches.every((b) => [...b.start, ...b.end, b.radius].every(Number.isFinite)));
  assert.ok(Math.max(...R.branches.map((b) => b.depth)) <= 8);
  assert.deepEqual(layout([]), { branches: [], height: 0, width: 0 });
});
