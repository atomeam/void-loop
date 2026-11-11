// The proposals family (skills/proposals.js, lists run 17, 2026-11-11): proposal-pack and proposal are one routing entry, every old ask
// still reaches the member that answered it, both old names stay as parts, and the family sits where proposal-pack sat (1025).
// Run: node --test tools/proposals-family.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readOrder } from './skills-index.mjs';
import fam from '../void-live-deploy/skills/proposals.js';
import proposalPack from '../void-live-deploy/skills/proposal-pack.js';
import proposal from '../void-live-deploy/skills/proposal.js';

test('every example of both old skills lands on the same member as before (proposal-pack first, as before)', () => {
  for (const a of proposalPack.examples) assert.equal(fam.part(a.toLowerCase(), a), 'proposal-pack', a);
  for (const a of proposal.examples) assert.equal(fam.part(a.toLowerCase(), a), proposalPack.match(a.toLowerCase(), a) ? 'proposal-pack' : 'proposal', a);
  assert.equal(fam.part('turn this into a proposal', 'turn this into a proposal'), proposalPack.match('turn this into a proposal', 'turn this into a proposal') ? 'proposal-pack' : 'proposal');
});
test('the near misses of both stay out of the family', () => {
  for (const a of fam.nearMisses) assert.equal(fam.match(a.toLowerCase(), a), false, a);
});
test('the old names are kept as parts, the family takes one place in the order, where proposal-pack sat', () => {
  assert.deepEqual(fam.parts, ['proposal-pack', 'proposal']);
  const order = readOrder();
  assert.ok(order.includes('proposals'));
  assert.ok(!order.includes('proposal-pack') && !order.includes('proposal'));
  assert.ok(order.indexOf('proposals') === order.indexOf('actions') + 1, 'the family sits where proposal-pack sat, right after actions');
  assert.ok(order.indexOf('shop') === order.indexOf('proposals') + 1, 'nothing moved between it and shop');
  assert.ok(existsSync(new URL('../void-live-deploy/skills/order/1025-proposals', import.meta.url)));
  assert.ok(!existsSync(new URL('../void-live-deploy/skills/order/1030-proposal', import.meta.url)));
});
