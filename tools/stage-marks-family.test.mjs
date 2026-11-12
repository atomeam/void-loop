// The stage-marks family (skills/stage-marks.js, lists run 25, 2026-11-12): stage-organize and label are one routing entry, every old
// ask still reaches the member that answered it, both old names stay as parts, label's self-test runs as the family's, both decorators
// still draw, and the family sits where stage-organize sat (0299).
// Run: node --test tools/stage-marks-family.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readOrder } from './skills-index.mjs';
import fam from '../void-live-deploy/skills/stage-marks.js';
import stageOrganize from '../void-live-deploy/skills/stage-organize.js';
import label from '../void-live-deploy/skills/label.js';

test('every example of both old skills lands on the same member as before (stage-organize first, as before)', () => {
  for (const a of stageOrganize.examples) assert.equal(fam.part(a.toLowerCase(), a), 'stage-organize', a);
  for (const a of label.examples) assert.equal(fam.part(a.toLowerCase(), a), stageOrganize.match(a.toLowerCase(), a) ? 'stage-organize' : 'label', a);
  assert.equal(fam.part('tag the clock as work', 'tag the clock as work'), 'stage-organize', 'the overlapping ask stays with stage-organize');
  for (const a of ['draw an arrow from the clock to the note', 'connect the timer to the counter', 'label the clock kitchen']) assert.equal(fam.part(a, a), 'label', a);
  for (const a of ['save this layout as morning', 'show only things tagged work', 'clear unkept']) assert.equal(fam.part(a, a), 'stage-organize', a);
});
test('the near misses of both stay out of the family', () => {
  for (const a of fam.nearMisses) assert.equal(fam.match(a.toLowerCase(), a), false, a);
});
test('label\'s self-test is the family\'s, and both decorators still run', () => {
  assert.equal(typeof fam.suite, 'function'); assert.ok(fam.suite().ok);
  assert.equal(typeof fam.decorate, 'function');
  assert.deepEqual(Object.keys(fam.stageKinds || {}).sort(), Object.keys(label.stageKinds || {}).sort(), 'label\'s stage kinds come along');
});
test('the old names are kept as parts, the family takes one place in the order, where stage-organize sat', () => {
  assert.deepEqual(fam.parts, ['stage-organize', 'label']);
  const order = readOrder();
  assert.ok(order.includes('stage-marks'));
  assert.ok(!order.includes('stage-organize') && !order.includes('label'));
  assert.equal(order.indexOf('compliment'), order.indexOf('stage-marks') - 1, 'compliment still comes right before');
  assert.equal(order.indexOf('joke'), order.indexOf('stage-marks') + 1, 'joke still comes right after');
  assert.equal(order.indexOf('layer') + 1, order.indexOf('stage-arrange'), 'label left the place between layer and stage-arrange');
  assert.ok(existsSync(new URL('../void-live-deploy/skills/order/0299-stage-marks', import.meta.url)));
  assert.ok(!existsSync(new URL('../void-live-deploy/skills/order/0299-stage-organize', import.meta.url)));
  assert.ok(!existsSync(new URL('../void-live-deploy/skills/order/0790-label', import.meta.url)));
});
