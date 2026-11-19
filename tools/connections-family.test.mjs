// The connections family (skills/connections.js, lists run 26, 2026-11-18): connect-flows and systems-connect-pack are one routing entry,
// every old ask still reaches the member that answered it, both old names stay as parts, systems-connect-pack's self-test runs as the
// family's, and the family sits where connect-flows sat (12000).
// Run: node --test tools/connections-family.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readOrder } from './skills-index.mjs';
import fam from '../void-live-deploy/skills/connections.js';
import connectFlows from '../void-live-deploy/skills/connect-flows.js';
import pack from '../void-live-deploy/skills/systems-connect-pack.js';

test('every example of both old skills lands on the same member as before (connect-flows first)', () => {
  for (const a of connectFlows.examples) assert.equal(fam.part(a.toLowerCase(), a), 'connect-flows', a);
  for (const a of pack.examples) assert.equal(fam.part(a.toLowerCase(), a), connectFlows.match(a.toLowerCase(), a) ? 'connect-flows' : 'systems-connect-pack', a);
  for (const a of ['systems connect pack for client onboarding', 'package the connections for weekly status reports']) assert.equal(fam.part(a.toLowerCase(), a), 'systems-connect-pack', a);
});
test('the near misses of both stay out of the family', () => {
  for (const a of fam.nearMisses) assert.equal(fam.match(a.toLowerCase(), a), false, a);
  for (const a of ['connect to wifi', 'what is a system']) assert.equal(fam.match(a, a), false, a);
});
test('systems-connect-pack\'s self-test is the family\'s', () => { assert.ok(fam.suite().ok); });
test('the old names are kept as parts, the family takes one place in the order, where connect-flows sat', () => {
  assert.deepEqual(fam.parts, ['connect-flows', 'systems-connect-pack']);
  const order = readOrder();
  assert.ok(order.includes('connections'));
  assert.ok(!order.includes('connect-flows') && !order.includes('systems-connect-pack'));
  assert.ok(existsSync(new URL('../void-live-deploy/skills/order/12000-connections', import.meta.url)));
  assert.ok(!existsSync(new URL('../void-live-deploy/skills/order/12020-systems-connect-pack', import.meta.url)));
});
