// tools/merge-gate.mjs (closed PR #2335's leftover, lists run 25): a red gate run that only lacked an installed package installs the
// lockfile once and runs the checks again; missingPackages reads which packages a run could not find.
// Run: node --test tools/merge-gate-install.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { missingPackages } from './merge-gate.mjs';

test('bare and scoped package names are read; relative files and node builtins are not an install problem', () => {
  const log = [
    "Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'playwright-core' imported from /tmp/merge-gate-x/tools/record.mjs",
    "Error: Cannot find module '@anthropic-ai/sdk/resources' imported from /tmp/x.mjs",
    "Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/tmp/merge-gate-x/tools/gone.mjs' imported from /tmp/a.mjs",
    "Cannot find module './lib/missing.js'", "Cannot find module 'node:nope'",
    "Cannot find package 'playwright-core' imported from /tmp/y.mjs",
  ].join('\n');
  assert.deepEqual(missingPackages(log), ['@anthropic-ai/sdk', 'playwright-core']);
  assert.deepEqual(missingPackages('FAIL some-check: 1 != 2'), []);
  assert.deepEqual(missingPackages(''), []);
});
test('the gate installs the lockfile once, without install scripts, and runs the checks again only after a good install', () => {
  const src = readFileSync(new URL('./merge-gate.mjs', import.meta.url), 'utf8');
  assert.match(src, /missingPackages\(String\(checks\.stdout/);
  assert.match(src, /\['ci', '--ignore-scripts', '--no-audit', '--no-fund'\]/);
  assert.match(src, /if \(ci\.status === 0\) checks = runChecks\(\);/);
  assert.equal((src.match(/npm', \['ci'/g) || []).length, 1, 'one install, never a loop');
});
