import test from 'node:test';
import assert from 'node:assert/strict';
import { generatedTouched } from './generated.mjs';
import { onlyBuildConflicts } from './merge-gate.mjs';
import { behindCount } from './pre-pr.mjs';

test('a build output in the diff is named, a source file is not', () => {
  assert.deepEqual(generatedTouched(['void-live-deploy/skills/index.json', 'void-live-deploy/skills/order/0100-x', 'tools/pre-pr.mjs']), ['void-live-deploy/skills/index.json']);
});

test('the merge gate regenerates a build output and stops on any other file', () => {
  assert.equal(onlyBuildConflicts(['void-live-deploy/skills/index.json', 'void-live-deploy/sitemap.xml']), true);
  assert.equal(onlyBuildConflicts(['void-live-deploy/skills/index.json', 'void.html']), false);
  assert.equal(onlyBuildConflicts([]), false);
});

test('behind main is the count git prints', () => {
  assert.equal(behindCount('origin/main', 'HEAD', () => ({ status: 0, stdout: '3\n' })), 3);
  assert.equal(behindCount('origin/main', 'HEAD', () => ({ status: 1, stdout: '' })), null);
});
