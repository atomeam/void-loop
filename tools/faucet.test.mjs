import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPool, stake, allocate, claim, balances, audit, leaderboard, MIN_STAKE, MAX_NODES } from '../void-live-deploy/lib/faucet.js';

test('createPool: valid', () => {
  const p = createPool('rewards', 100);
  assert.equal(p.name, 'rewards');
  assert.equal(p.seed, 100);
  assert.equal(p.total, 100);
});
test('createPool: invalid returns null', () => {
  assert.equal(createPool(''), null);
  assert.equal(createPool('x', -5), null);
});
test('stake: adds to pool', () => {
  let p = createPool('p', 0);
  p = stake(p, 'node1', 50);
  assert.equal(p.staked.node1, 50);
  assert.equal(p.total, 50);
});
test('stake: invalid amount ignored', () => {
  let p = createPool('p', 0);
  p = stake(p, 'node1', 0);
  assert.equal(p.staked.node1, undefined);
});
test('allocate: splits by weight', () => {
  let p = createPool('p', 100);
  p = allocate(p, [{ node: 'a', weight: 1 }, { node: 'b', weight: 1 }]);
  assert.equal(p.allocations.a, 50);
  assert.equal(p.allocations.b, 50);
});
test('claim: returns owed amount', () => {
  let p = createPool('p', 100);
  p = allocate(p, [{ node: 'a', weight: 1 }]);
  const r = claim(p, 'a');
  assert.equal(r.amount, 100);
  assert.equal(p.claimed.a, 100);
});
test('claim: second claim returns 0', () => {
  let p = createPool('p', 100);
  p = allocate(p, [{ node: 'a', weight: 1 }]);
  claim(p, 'a');
  const r = claim(p, 'a');
  assert.equal(r.amount, 0);
});
test('balances: shows unclaimed', () => {
  let p = createPool('p', 100);
  p = allocate(p, [{ node: 'a', weight: 1 }, { node: 'b', weight: 1 }]);
  claim(p, 'a');
  const b = balances(p);
  assert.equal(b.a, undefined);
  assert.equal(b.b, 50);
});
test('audit: totals', () => {
  let p = createPool('p', 100);
  p = stake(p, 'n', 50);
  p = allocate(p, [{ node: 'n', weight: 1 }]);
  const a = audit(p);
  assert.equal(a.seed, 100);
  assert.equal(a.staked, 50);
  assert.equal(a.allocated, 150);
});
test('leaderboard: sorted by owed desc', () => {
  let p = createPool('p', 100);
  p = allocate(p, [{ node: 'a', weight: 1 }, { node: 'b', weight: 2 }]);
  const lb = leaderboard(p);
  assert.equal(lb[0].node, 'b');
});