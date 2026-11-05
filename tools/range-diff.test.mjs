// The range report is the diff's file list, the failed job names, and the assertion lines. No network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nameOnly, assertionLines, addressed, codeFiles } from '../void-live-deploy/lib/range-diff.js';

test('a diff lists the files and nothing else', () => {
  assert.deepEqual(nameOnly('a.js\n\nb.js\n'), ['a.js', 'b.js']);
  assert.deepEqual(nameOnly(''), []);
});

test('records are not code', () => {
  assert.deepEqual(codeFiles(['domains/void.voice.md', 'void-live-deploy/incidents.json', 'tools/flakes.json']), []);
  assert.deepEqual(codeFiles(['void-live-deploy/skills/riddle.js', 'tools/x.test.mjs']), ['void-live-deploy/skills/riddle.js', 'tools/x.test.mjs']);
});

test('four failed jobs that are gone on the later commit are not still failing', () => {
  const r = addressed(['python-tests', 'browser-suite (2)', 'browser-suite (1)', 'browser-suite (3)'], []);
  assert.equal(r.before.length, 4);
  assert.deepEqual(r.still, []);
  assert.equal(r.gone.length, 4);
  const kept = addressed(['python-tests', 'browser-suite (1)'], ['python-tests']);
  assert.deepEqual(kept.still, ['python-tests']);
  assert.deepEqual(kept.gone, ['browser-suite (1)']);
});

test('assertion lines are the check results, not the runner noise', () => {
  const log = [
    'Node.js 20 is deprecated.',
    'Process completed with exit code 1.',
    'skills: every skill in index.json gets its own examples -> riddle: "riddle" -> joke',
    'not ok 3 - the book opens',
    'AssertionError: 1 !== 0',
  ].join('\n');
  const lines = assertionLines(log);
  assert.equal(lines.length, 3);
  assert.match(lines[0], /riddle/);
  assert.match(lines[2], /AssertionError/);
});
