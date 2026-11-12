// The experiments family (skills/experiments.js, lists run 20, 2026-11-12): lab and make are one routing entry, every old ask still reaches
// the member that answered it, both old names stay as parts, and the family sits where lab sat (0127).
// Run: node --test tools/experiments-family.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readOrder } from './skills-index.mjs';
import fam from '../void-live-deploy/skills/experiments.js';
import lab from '../void-live-deploy/skills/lab.js';
import make from '../void-live-deploy/skills/make.js';

test('every example of both old skills lands on the same member as before (lab first, as before)', () => {
  for (const a of lab.examples) assert.equal(fam.part(a.toLowerCase(), a), 'lab', a);
  for (const a of make.examples) assert.equal(fam.part(a.toLowerCase(), a), lab.match(a.toLowerCase(), a) ? 'lab' : 'make', a);
  for (const a of ['the lab', 'open the lab']) assert.equal(fam.part(a, a), 'lab', a + ' stays with the lab card');
  for (const a of ['timing game', 'make a 3d torus', 'uap timeline']) assert.equal(fam.part(a, a), 'make', a);
});
test('the near misses of both stay out of the family', () => {
  for (const a of fam.nearMisses) assert.equal(fam.match(a.toLowerCase(), a), false, a);
});
test('the old names are kept as parts, the family takes one place in the order, where lab sat', () => {
  assert.deepEqual(fam.parts, ['lab', 'make']);
  const order = readOrder();
  assert.ok(order.includes('experiments'));
  assert.ok(!order.includes('lab') && !order.includes('make'));
  assert.ok(order.indexOf('anneal-ambition') === order.indexOf('experiments') + 1, 'anneal-ambition still comes right after');
  assert.ok(existsSync(new URL('../void-live-deploy/skills/order/0127-experiments', import.meta.url)));
  assert.ok(!existsSync(new URL('../void-live-deploy/skills/order/0127-lab', import.meta.url)));
  assert.ok(!existsSync(new URL('../void-live-deploy/skills/order/0130-make', import.meta.url)));
});
