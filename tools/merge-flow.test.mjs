import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nextStep, fixAge, fixNote, isTowerPath, RETRY_MS } from './merge-flow.mjs';

test('a draft skips, a conflict is fixed, a red check merges after the window', () => {
  assert.equal(nextStep({ draft: true }).action, 'skip');
  assert.equal(nextStep({ readiness: 'merge' }).action, 'merge');
  assert.equal(nextStep({ readiness: 'resolve', age: null }).action, 'fix');
  assert.equal(nextStep({ readiness: 'resolve', age: 5 }).action, 'wait');
  assert.equal(nextStep({ readiness: 'stop', age: null }).kind, 'red');
  assert.equal(nextStep({ readiness: 'stop', age: RETRY_MS + 1 }).action, 'merge');
  assert.equal(fixAge([{ body: fixNote('a', 'red'), created_at: '2026-11-10T01:00:00Z' }], 'a', 'red', Date.parse('2026-11-10T02:00:00Z')), 3600e3);
  assert.equal(isTowerPath('skills/tower.js'), true);
  const auto = readFileSync(new URL('./automerge.mjs', import.meta.url), 'utf8');
  assert.match(auto, /verifyHold\.heal/);
  assert.doesNotMatch(auto, /verifyHold\.hold &&/);
  assert.match(auto, /if \(false && ready\.length/);
  assert.match(readFileSync(new URL('./pr-fix.mjs', import.meta.url), 'utf8'), /verse-coder\.mjs/);
  assert.match(readFileSync(new URL('../.github/workflows/watchdog.yml', import.meta.url), 'utf8'), /pr-fix\.yml/);
});
