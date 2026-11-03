// suite check for business-idea skill
import { match } from '../void-live-deploy/skills/business-idea.js';
import { test } from 'node:test';
import assert from 'node:assert';

test('business idea match', () => {
  assert.ok(match('business idea: track clients'));
  assert.ok(!match('hello world'));
});
