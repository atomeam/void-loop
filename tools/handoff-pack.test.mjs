import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isHandoffPack } from '../void-live-deploy/skills/handoff-pack.js';

test('handoff-pack matches its examples and not near misses', () => {
  assert.ok(isHandoffPack('package the handoff for the client'));
  assert.ok(isHandoffPack('hand off status and automations'));
  assert.ok(isHandoffPack('client handoff pack'));
  assert.ok(!isHandoffPack('my automations'));
  assert.ok(!isHandoffPack('turn this into a proposal'));
  assert.equal(skill.name, 'handoff-pack');
});
