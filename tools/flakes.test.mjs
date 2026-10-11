import test from 'node:test';
import assert from 'node:assert/strict';
import { recorded, due, targetOf, askOf, text, DAYS } from './flakes.mjs';
import { keyOf, APPEND_JSON } from './records.mjs';

const now = new Date('2026-10-11T12:00:00Z'), day = (d) => new Date(now.getTime() - d * 864e5).toISOString();

test('one heal queues nothing; two in a week queue exactly one job', () => {
  let e = recorded([], 'aaaaaaa', ['chess / pixels'], day(1));
  assert.deepEqual(due(e, now), [], 'once is not a pattern');
  e = recorded(e, 'bbbbbbb', ['chess / pixels', 'sky / still'], day(0));
  const jobs = due(e, now);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].check, 'chess / pixels'); assert.equal(jobs[0].times, 2); assert.equal(jobs[0].target, 'flake:chess-pixels');
});

test('an old heal falls out of the week, and the same check on the same commit counts once', () => {
  let e = recorded([], 'aaaaaaa', ['x'], day(DAYS + 1));
  e = recorded(e, 'bbbbbbb', ['x'], day(0));
  assert.deepEqual(due(e, now), []);
  assert.equal(recorded(e, 'bbbbbbb', ['x']).length, e.length, 'recorded twice by two runs of the same head is one');
});

test('the job says fix it, never skip it, and fits the queue', () => {
  const g = { check: 'a'.repeat(300), times: 2, shas: ['aaaaaaa', 'bbbbbbb'] };
  assert.ok(targetOf(g.check).length <= 40 && targetOf(g.check).startsWith('flake:'));
  assert.ok(askOf(g).length <= 200);
  assert.match(askOf({ check: 'sky / still', times: 2, shas: ['a', 'b'] }), /never skip, quarantine or retry/);
});

test('the file is one entry per line, and merge-main and revert-records treat it as an append-only record', () => {
  const t = text(recorded([], 'aaaaaaa', ['x', 'y'], day(0)));
  assert.equal(t.split('\n').length, 5);
  assert.deepEqual(JSON.parse(t).map((x) => x.check), ['x', 'y']);
  assert.equal(text([]), '[]\n');
  assert.ok(APPEND_JSON.includes('tools/flakes.json'));
  assert.equal(keyOf('tools/flakes.json', { check: 'X', sha: 'A' }), 'x|a');
});
