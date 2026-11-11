// The reuse-tools family (skills/reuse-tools.js, lists run 16, 2026-11-11): reuse-pack and connect-pack are one routing entry, every old
// ask still reaches the member that answered it, both old names stay as parts, and the family sits where reuse-pack sat (9900).
// Run: node --test tools/reuse-tools-family.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readOrder } from './skills-index.mjs';
import fam from '../void-live-deploy/skills/reuse-tools.js';
import reusePack from '../void-live-deploy/skills/reuse-pack.js';
import connectPack from '../void-live-deploy/skills/connect-pack.js';

test('every example of both old skills lands on the same member as before (reuse-pack first, as before)', () => {
  for (const a of reusePack.examples) assert.equal(fam.part(a.toLowerCase(), a), 'reuse-pack', a);
  for (const a of connectPack.examples) assert.equal(fam.part(a.toLowerCase(), a), reusePack.match(a.toLowerCase(), a) ? 'reuse-pack' : 'connect-pack', a);
  // the ask both took (tools/skill-overlap.mjs): reuse-pack answered it first and still does
  assert.equal(fam.part('reuse pack for client onboarding', 'reuse pack for client onboarding'), 'reuse-pack');
  assert.equal(fam.part('connect pack for client onboarding', 'connect pack for client onboarding'), 'connect-pack');
});
test('the near misses of both stay out of the family', () => {
  for (const a of fam.nearMisses) assert.equal(fam.match(a.toLowerCase(), a), false, a);
});
test('the old names are kept as parts, the family takes one place in the order, where reuse-pack sat', () => {
  assert.deepEqual(fam.parts, ['reuse-pack', 'connect-pack']);
  const order = readOrder();
  assert.ok(order.includes('reuse-tools'));
  assert.ok(!order.includes('reuse-pack') && !order.includes('connect-pack'));
  assert.ok(order.indexOf('reuse-tools') === order.indexOf('handoff-checklist') + 1, 'the family sits where reuse-pack sat, right after handoff-checklist');
  assert.ok(existsSync(new URL('../void-live-deploy/skills/order/9900-reuse-tools', import.meta.url)));
  assert.ok(!existsSync(new URL('../void-live-deploy/skills/order/9900-reuse-pack', import.meta.url)));
  assert.ok(!existsSync(new URL('../void-live-deploy/skills/order/9910-connect-pack', import.meta.url)));
});
