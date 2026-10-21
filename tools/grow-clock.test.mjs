// .github/workflows/grow-clock.yml (owner, 2026-10-19: "make it grow every ten minutes"): one growth step every 10 minutes, the chain restarts itself
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

// a Windows checkout can hand this back with CRLF; the workflow's own bash sees LF, so the assertions read it the same way
const y = readFileSync(new URL('../.github/workflows/grow-clock.yml', import.meta.url), 'utf8').replace(/\r\n?/g, '\n');

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

test("Verse's own changes reach the site: a workflow that pushes to main with the Actions token starts the deploy itself, and the one that opens a pull request is merged instead", () => {
  // a token push starts no workflow (2026-10-19 its commits showed "no checks reported"), so the deploy is started by hand
  const pf = readFileSync(new URL('../.github/workflows/propose-fix.yml', import.meta.url), 'utf8');
  const job = pf.slice(pf.lastIndexOf('permissions:'));
  assert.match(job, /actions: write/, 'propose-fix.yml: the committing job may start a workflow');
  assert.match(pf, /git push -q origin HEAD:main[\s\S]{0,900}gh workflow run deploy\.yml --repo "\$\{\{ github\.repository \}\}" --ref main -f after_merge=true/, 'propose-fix.yml: the deploy starts right after the push to main');
  // grow-self.yml no longer pushes to main: it opens a pull request (one at a time, labelled), and that is merged like any other
  const gs = readFileSync(new URL('../.github/workflows/grow-self.yml', import.meta.url), 'utf8');
  assert.match(gs, /gh pr create --repo "\$\{\{ github\.repository \}\}" --base main --head "\$branch"/, 'grow-self.yml opens a pull request');
  assert.match(gs, /--label "made by Verse"/, 'the pull request says who made it');
  assert.match(gs, /An automated preview PR is already open\. Halting loop to prevent stacking\./, 'one preview at a time');
});
