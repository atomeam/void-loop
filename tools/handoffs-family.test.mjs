// The handoffs family (skills/handoffs.js, lists run 23, 2026-11-12): delivery-pack, client-handoff, system-handoff and full-handoff are
// one routing entry, every old ask still reaches the member that answered it, all four old names stay as parts, and the family sits
// where delivery-pack sat (1192). full-handoff had no order file and its own example "show the complete handoff for weekly reports"
// failed its match (main's red verify on 2026-11-12); both are fixed here.
// Run: node --test tools/handoffs-family.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readOrder } from './skills-index.mjs';
import fam from '../void-live-deploy/skills/handoffs.js';
import deliveryPack from '../void-live-deploy/skills/delivery-pack.js';
import clientHandoff from '../void-live-deploy/skills/client-handoff.js';
import systemHandoff from '../void-live-deploy/skills/system-handoff.js';
import fullHandoff from '../void-live-deploy/skills/full-handoff.js';

const before = [deliveryPack, clientHandoff, systemHandoff, fullHandoff];
const first = (a) => (before.find((m) => m.match(a.toLowerCase(), a)) || {}).name || null;

test('every example of the four old skills lands on the same member as before (delivery-pack first, as before)', () => {
  for (const m of before) for (const a of m.examples) assert.equal(fam.part(a.toLowerCase(), a), first(a), a);
  for (const a of deliveryPack.examples) assert.equal(fam.part(a.toLowerCase(), a), 'delivery-pack', a);
  assert.equal(fam.part('handoff pack for my saas idea', 'handoff pack for my SaaS idea'), 'delivery-pack', 'the overlapping ask stays with the delivery pack');
  assert.equal(fam.part('system handoff for the invoice automation', 'system handoff for the invoice automation'), 'system-handoff');
  for (const a of ['full handoff for the invoice automation', 'show the complete handoff for weekly reports', 'package the handoff for the support router']) assert.equal(fam.part(a.toLowerCase(), a), 'full-handoff', a);
});
test('full-handoff passes its own suite again and leaves a handoff checklist to handoff-checklist', () => {
  assert.equal(fullHandoff.suite().ok, true);
  for (const a of ['make a handoff checklist for invoice reminders', 'generate a handoff checklist for the weekly status reports']) assert.equal(fam.match(a.toLowerCase(), a), false, a);
});
test('the near misses of all four stay out of the family', () => {
  for (const a of fam.nearMisses) assert.equal(fam.match(a.toLowerCase(), a), false, a);
});
test('the old names are kept as parts, the family takes one place in the order, where delivery-pack sat', () => {
  assert.deepEqual(fam.parts, ['delivery-pack', 'client-handoff', 'system-handoff', 'full-handoff']);
  const order = readOrder();
  assert.ok(order.includes('handoffs'));
  for (const n of fam.parts) assert.ok(!order.includes(n), n);
  assert.ok(order.indexOf('systems-monitor') === order.indexOf('handoffs') + 1, 'systems-monitor still comes right after');
  assert.ok(existsSync(new URL('../void-live-deploy/skills/order/1192-handoffs', import.meta.url)));
  for (const f of ['1192-delivery-pack', '1193-client-handoff', '1194-system-handoff']) assert.ok(!existsSync(new URL('../void-live-deploy/skills/order/' + f, import.meta.url)), f);
});
