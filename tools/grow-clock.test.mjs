// .github/workflows/grow-clock.yml (owner, 2026-10-19: "make it grow every ten minutes"): one growth step every 10 minutes, the chain restarts itself
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const y = readFileSync(new URL('../.github/workflows/grow-clock.yml', import.meta.url), 'utf8');

test('a step every 10 minutes for under the job timeout, then the next run starts; it starts only the growth workflows and holds no secret', () => {
  const ticks = +/seq 0 (\d+)/.exec(y)[1] + 1, sleep = +/sleep (\d+)/.exec(y)[1], timeout = +/timeout-minutes: (\d+)/.exec(y)[1];
  assert.equal(sleep, 600);
  assert.ok((ticks - 1) * sleep / 60 < timeout - 10, 'the loop ends before the job times out, so the chain step runs');
  assert.match(y, /gh workflow run grow-clock\.yml/);
  const started = [...y.matchAll(/start ([\w-]+\.yml)/g)].map((m) => m[1]).sort();
  assert.deepEqual([...new Set(started)], ['grow-self.yml', 'probe-asks.yml', 'propose-fix.yml']);
  for (const w of started) assert.ok(existsSync(new URL('../.github/workflows/' + w, import.meta.url)), w);
  assert.doesNotMatch(y, /secrets\./); assert.match(y, /permissions:\n  actions: write\n/);
  assert.match(y, /group: grow-clock\n  cancel-in-progress: false/);
});
