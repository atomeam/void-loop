// The client status family (skills/client-status.js, lists run 18, 2026-11-11): client-status-pack and delivery-board are one routing
// entry, every old ask still reaches the member that answered it, both old names stay as parts, the family sits where client-status-pack
// sat (9890), and the delivery board's progress comes from live readings, never a fixed line.
// Run: node --test tools/client-status-family.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readOrder } from './skills-index.mjs';
import fam from '../void-live-deploy/skills/client-status.js';
import clientStatusPack from '../void-live-deploy/skills/client-status-pack.js';
import deliveryBoard, { progressOf, boardFor } from '../void-live-deploy/skills/delivery-board.js';

test('every example of both old skills lands on the same member as before', () => {
  for (const a of clientStatusPack.examples) assert.equal(fam.part(a.toLowerCase(), a), 'client-status-pack', a);
  for (const a of deliveryBoard.examples) assert.equal(fam.part(a.toLowerCase(), a), 'delivery-board', a);
  // the aliases still answer by their own names
  assert.equal(fam.part('client board on invoice reminders', 'client board on invoice reminders'), 'delivery-board');
  assert.equal(fam.part('client status for the invoice bot', 'client status for the invoice bot'), 'client-status-pack');
});
test('the near misses of both stay out of the family', () => {
  for (const a of fam.nearMisses) assert.equal(fam.match(a.toLowerCase(), a), false, a);
  for (const a of ['status board', 'progress report', 'delivery pack', 'system status']) assert.equal(fam.match(a, a), false, a);
});
test('the old names are kept as parts, the family takes one place in the order, where client-status-pack sat', () => {
  assert.deepEqual(fam.parts, ['client-status-pack', 'delivery-board']);
  const order = readOrder();
  assert.ok(order.includes('client-status'));
  for (const n of fam.parts) assert.ok(!order.includes(n), n);
  assert.ok(order.indexOf('client-status') === order.indexOf('verify-pack') + 1, 'right after verify-pack, where client-status-pack sat');
  assert.ok(existsSync(new URL('../void-live-deploy/skills/order/9890-client-status', import.meta.url)));
  for (const f of ['9890-client-status-pack', '9950-delivery-board']) assert.ok(!existsSync(new URL('../void-live-deploy/skills/order/' + f, import.meta.url)), f);
});
test('the delivery board invents no progress: it reads the guards and the incident log, and names a reading that did not answer', () => {
  assert.ok(!('progress' in boardFor('delivery board for x')), 'no fixed progress line');
  const down = progressOf(null, 'the status API did not answer', null, 'the incident log answered HTTP 404');
  assert.equal(down.overall, 'unknown');
  assert.match(down.lines[0], /did not answer/); assert.match(down.lines[1], /HTTP 404/);
  const up = progressOf(null, '', [], '');
  assert.match(up.lines[1], /Incident log: 0 open/);
});
