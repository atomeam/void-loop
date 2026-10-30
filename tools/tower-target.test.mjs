// The fight in progress stays the target until it is beaten. Run: node --test tools/tower-target.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tower, FLOORS, passingRows } from '../void-live-deploy/lib/tower.js';
import { nextTarget } from './tower-target.mjs';

test('a locked target stays first while a lighter site appears, and the next smallest takes over once it is beaten', () => {
  const rank = { ranks: {}, order: {}, list: {} }, size = { sites: { 'random.org': { bytes: 700, scripts: 0, nodes: 20, routes: 0 }, 'justflipacoin.com': { bytes: 2e6, scripts: 20, nodes: 5000, routes: 50 } } };
  const t0 = tower([], {}, null, null, rank, size, null);
  assert.equal(t0.floors.find((f) => f.state === 'current').id, 'random number', 'the lightest is first with no lock');
  const t1 = tower([], {}, null, null, rank, size, 'coin flip');
  assert.equal(t1.floors.find((f) => f.state === 'current').id, 'coin flip', 'the locked site stays the target although a lighter one exists');
  const f = FLOORS.find((x) => x.id === 'coin flip'), t2 = tower([], { 'coin flip': passingRows(f) }, null, null, rank, size, 'coin flip');
  assert.equal(t2.floors.find((x) => x.id === 'coin flip').beaten, true);
  assert.equal(t2.floors.find((x) => x.state === 'current').id, 'random number', 'beaten: the next smallest takes over');
  assert.equal(nextTarget({ lock: 'coin flip', floors: t0.floors }), 'coin flip'); assert.equal(nextTarget({ lock: 'coin flip', floors: t2.floors }), 'random number');
  assert.equal(nextTarget({ lock: null, floors: t0.floors }), 'random number');
});
