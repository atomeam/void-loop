// Suite checks for the registered delivery skills that package "we own the heavy lifting".
// Run: node --test tools/delivery-skills-suite.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import systemPlan from '../void-live-deploy/skills/system-plan.js';
import systemsOwned from '../void-live-deploy/skills/systems-owned.js';
import deliveryReady from '../void-live-deploy/skills/delivery-ready.js';
import fullHandoff from '../void-live-deploy/skills/full-handoff.js';
import roiPack from '../void-live-deploy/skills/roi-pack.js';

test('system-plan suite passes', () => {
  const s = systemPlan.suite();
  assert.equal(s.ok, true, s.got);
});

test('systems-owned suite passes', () => {
  const s = systemsOwned.suite();
  assert.equal(s.ok, true, s.got);
});

test('delivery-ready suite passes', () => {
  const s = deliveryReady.suite();
  assert.equal(s.ok, true, s.got);
});

test('full-handoff suite passes', () => {
  const s = fullHandoff.suite();
  assert.equal(s.ok, true, s.got);
});

test('roi-pack suite passes', () => {
  const s = roiPack.suite();
  assert.equal(s.ok, true, s.got);
});
