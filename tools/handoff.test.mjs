import { isHandoff } from '../void-live-deploy/skills/handoff.js';
import { test } from 'node:test';
import assert from 'node:assert';

test('handoff matches client asks', () => {
  assert.ok(isHandoff('client handoff'));
  assert.ok(isHandoff('status for the client'));
  assert.ok(!isHandoff('void status'));
});
