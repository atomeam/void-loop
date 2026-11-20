// The game scorer's pure parts: measured marks, the vision judge's parts and a reviewer's marks. Run: node --test tools/universe-play.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { measuredMarks, visionMarks, reviewerMarks } from './universe-play.mjs';
test('measured marks: 60 fps with a quiet log is 100, errors and a slow frame rate cost, and a frozen end is a possible softlock', () => {
  assert.deepEqual(measuredMarks({ fps: 60, errors: 0, changed: 8, probes: 8, moving: true }), { performance: 100, controls: 100, softlock: 100 });
  assert.equal(measuredMarks({ fps: 30, errors: 1, changed: 4, probes: 8, moving: false }).performance, 25);
  assert.equal(measuredMarks({ fps: 30, errors: 1, changed: 4, probes: 8, moving: false }).controls, 50);
  assert.equal(measuredMarks({ fps: 90, errors: 0, changed: 0, probes: 0, moving: false }).softlock, 40);
});
test('the judge scores parts out of 10 and only the parts that answer a check become marks', () => {
  assert.deepEqual(visionMarks({ juice: 7, fun: 5.5, polish: 6, fair: 8, danger: 9 }), { juice: 70, fun: 55, polish: 60, fair: 80 });
  assert.deepEqual(visionMarks(null), {});
});
test('a reviewer names checks, and a made-up check or a non-number is dropped', () => {
  assert.deepEqual(reviewerMarks('graphics=40,polish=55,nonsense=9,fun=x'), { graphics: 40, polish: 55 });
});
