import test from 'node:test';
import assert from 'node:assert/strict';
import { decide } from './review-decide.mjs';
import { fixJob, verdictComment } from './review-fix-job.mjs';

test('a clean review merges itself', () => {
  const d = decide({ review: true, gate: true, exam: true });
  assert.equal(d.action, 'merge');
  assert.match(d.why, /outcome exam/);
});

test('a failed review or gate or a regressed exam files a fix, and names why', () => {
  assert.equal(decide({ review: false }).action, 'fix');
  assert.match(decide({ gate: false }).why, /merge gate/);
  assert.match(decide({ exam: false, why: 'time in Tokyo no longer routes' }).why, /time in Tokyo/);
});

test('a failed review becomes one fix job and a verdict line', () => {
  const j = fixJob(12, 'the merge gate failed');
  assert.equal(j.target, 'review:12');
  assert.match(j.ask, /#12/);
  assert.match(j.ask, /merge gate/);
  assert.match(verdictComment('merge', 'clean'), /Verdict: merge\. clean/);
});

test('only spending money or a message to someone outside waits on a person', () => {
  assert.equal(decide({ spend: true }).action, 'hold');
  assert.match(decide({ spend: true }).why, /confirm line/);
  assert.equal(decide({ outbound: true, review: true }).action, 'hold');
  assert.match(decide({ outbound: true }).why, /outside/);
});
