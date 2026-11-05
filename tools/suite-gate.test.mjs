// The merge gate: no pull request lands unless the full suite passed on top of current main, and only one does.
import test from 'node:test';
import assert from 'node:assert/strict';
import { recordedMain, parseLog, codeUnchanged, mayMerge, failedHere, choose, fixJob, CHECK } from './suite-gate.mjs';

const MAIN = 'abc1234def567890abc1234def567890abc1234d';
const OLD = '1111111111111111111111111111111111111111';
const pass = (sha) => ({ name: CHECK, status: 'completed', conclusion: 'success', output: { title: 'main:' + sha } });
const fail = (sha) => ({ name: CHECK, status: 'completed', conclusion: 'failure', output: { title: 'main:' + sha } });
const row = (n, suite, drift) => ({ number: n, review: 'merge', suite, drift });

test('a green suite counts only for the main it merged, or when only incidents landed since', () => {
  assert.equal(recordedMain(pass(MAIN)), MAIN);
  assert.equal(recordedMain({ output: { title: 'something else' } }), '');
  assert.equal(mayMerge(row(1, pass(MAIN), null), MAIN), true);
  assert.equal(mayMerge(row(1, pass(OLD), null), MAIN), false, 'an older main with no drift record does not count');
  assert.equal(mayMerge(row(1, pass(OLD), [['void-live-deploy/incidents/entries/a.json']]), MAIN), true);
  assert.equal(mayMerge(row(1, pass(OLD), [['void.html']]), MAIN), false);
  assert.equal(mayMerge(row(1, fail(MAIN), []), MAIN), false);
  assert.equal(mayMerge(row(1, { name: CHECK, status: 'in_progress', conclusion: null, output: { title: 'main:' + MAIN } }, []), MAIN), false);
});

test('the log of commits since the tested main is one file list per commit', () => {
  const commits = parseLog('COMMIT\n\nvoid.html\n\nCOMMIT\n\nvoid-live-deploy/incidents/entries/x.json\n');
  assert.deepEqual(commits, [['void.html'], ['void-live-deploy/incidents/entries/x.json']]);
  assert.equal(codeUnchanged([['void-live-deploy/incidents/entries/x.json'], []]), true);
  assert.equal(codeUnchanged([['void.html']]), false);
  assert.equal(codeUnchanged(null), false);
});

test('one pull request: merge the one whose suite is fresh, otherwise queue the oldest, never two', () => {
  const rows = [row(9, null, null), row(3, pass(MAIN), []), row(5, pass(OLD), [['skills/x.js']])];
  assert.equal(choose(rows, MAIN, false).pr.number, 3);
  assert.equal(choose(rows, MAIN, false).action, 'merge');
  const waiting = [row(4, null, null), row(8, null, null)];
  assert.equal(choose(waiting, MAIN, true).action, 'wait');
  assert.equal(choose(waiting, MAIN, true).pr.number, 4);
  const queued = choose(waiting, MAIN, false);
  assert.equal(queued.action, 'queue');
  assert.equal(queued.pr.number, 4, 'the oldest, and only that one');
  assert.equal(choose([row(2, fail(MAIN), [])], MAIN, false).action, 'hold', 'a failure on this main is not queued again');
  assert.equal(choose([{ number: 1, review: 'wait' }], MAIN, false).action, 'hold');
});

test('a revert files one heal job and does not skip the check', () => {
  const j = fixJob(MAIN, 'draw backdrop: removed.on stayed true');
  assert.equal(j.target, 'heal:suite-' + MAIN.slice(0, 7));
  assert.match(j.ask, /Do not skip a check/);
  assert.match(j.ask, /abc1234/);
  assert.equal(failedHere(row(1, fail(MAIN), []), MAIN), true);
  assert.equal(failedHere(row(1, fail(OLD), [['void.html']]), MAIN), false, 'main moved with code: try again');
});
