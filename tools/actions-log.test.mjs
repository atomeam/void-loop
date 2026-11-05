// Failed GitHub Actions jobs, for any commit (void-live-deploy/lib/actions-log.js). node --test tools/actions-log.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { failedJobs, failedStep, tailLines, reportOf, sliceStep } from '../void-live-deploy/lib/actions-log.js';

const jobs = (names) => ({ jobs: names.map((n, i) => ({ id: i + 1, name: n.name, conclusion: n.conclusion || 'failure', status: 'completed', steps: n.steps || [{ name: 'Run tests', conclusion: 'failure' }] })) });

test('the failed count is the number of failed job names, for two different commits', () => {
  const a = reportOf(jobs([{ name: 'python-tests' }, { name: 'browser-suite', conclusion: 'success' }, { name: 'deploy', conclusion: 'timed_out' }]));
  assert.deepEqual(a.names, ['python-tests', 'deploy']);
  assert.equal(a.count, a.names.length);
  assert.equal(a.jobs[0].step, 'Run tests');
  const b = reportOf(jobs([{ name: 'lint', conclusion: 'cancelled' }, { name: 'typecheck', conclusion: 'skipped' }, { name: 'unit', conclusion: 'failure' }]));
  assert.deepEqual(b.names, ['unit']);
  assert.equal(b.count, 1);
  assert.notEqual(a.names.join(), b.names.join());
});

test('a log is cut to the failing step and the last 30 lines', () => {
  const lines = Array.from({ length: 40 }, (_, i) => 'line ' + (i + 1));
  const log = ['##[group]Run tests', ...lines, '##[endgroup]', '##[group]Other', 'nope'].join('\n');
  const cut = sliceStep(log, 'Run tests');
  assert.match(cut, /line 40/);
  assert.doesNotMatch(cut, /nope/);
  const tail = tailLines(cut, 30);
  assert.equal(tail.length, 30);
  assert.equal(tail[29], 'line 40');
  const report = reportOf(jobs([{ name: 'python-tests', steps: [{ name: 'Run tests', conclusion: 'failure' }] }]), { 1: log });
  assert.equal(report.jobs[0].tail.length, 30);
  assert.equal(report.count, report.names.length);
  assert.equal(failedStep({ steps: [{ name: 'Install', conclusion: 'success' }, { name: 'Run tests', conclusion: 'failure' }] }).name, 'Run tests');
  assert.equal(failedJobs({ jobs: [] }).length, 0);
});
