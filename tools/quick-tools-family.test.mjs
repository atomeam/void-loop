// The quick-tools family (skills/quick-tools.js, lists run 22, 2026-11-12): stage-image and util are one routing entry, every old ask
// still reaches the member that answered it, both old names stay as parts, and the family sits where stage-image sat (0455).
// Run: node --test tools/quick-tools-family.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readOrder } from './skills-index.mjs';
import fam from '../void-live-deploy/skills/quick-tools.js';
import stageImage from '../void-live-deploy/skills/stage-image.js';
import util from '../void-live-deploy/skills/util.js';

test('every example of both old skills lands on the same member as before (stage-image first, as before)', () => {
  for (const a of stageImage.examples) assert.equal(fam.part(a.toLowerCase(), a), 'stage-image', a);
  for (const a of util.examples) assert.equal(fam.part(a.toLowerCase(), a), stageImage.match(a.toLowerCase(), a) ? 'stage-image' : 'util', a);
  assert.equal(fam.part('qr code for this stage view', 'qr code for this stage view'), 'stage-image', 'the overlapping ask stays with the stage picture');
  for (const a of ['qr code for https://a-to-mind.com', 'generate a password', 'word count of hello world']) assert.equal(fam.part(a, a), 'util', a);
});
test('the near misses of both stay out of the family', () => {
  for (const a of fam.nearMisses) assert.equal(fam.match(a.toLowerCase(), a), false, a);
});
test('the old names are kept as parts, the family takes one place in the order, where stage-image sat', () => {
  assert.deepEqual(fam.parts, ['stage-image', 'util']);
  const order = readOrder();
  assert.ok(order.includes('quick-tools'));
  assert.ok(!order.includes('stage-image') && !order.includes('util'));
  assert.ok(order.indexOf('note-tools') === order.indexOf('quick-tools') - 1, 'note-tools still comes right before');
  assert.ok(order.indexOf('outline-note') === order.indexOf('quick-tools') + 1, 'outline-note still comes right after');
  assert.ok(existsSync(new URL('../void-live-deploy/skills/order/0455-quick-tools', import.meta.url)));
  assert.ok(!existsSync(new URL('../void-live-deploy/skills/order/0455-stage-image', import.meta.url)));
  assert.ok(!existsSync(new URL('../void-live-deploy/skills/order/0460-util', import.meta.url)));
});
