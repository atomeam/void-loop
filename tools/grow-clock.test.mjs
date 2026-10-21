// .github/workflows/grow-clock.yml (owner, 2026-10-19: "make it grow every ten minutes"): one growth step every 10 minutes, the chain restarts itself
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

function norm(s) { return String(s).replace(/\r\n/g, '\n'); }
const y = norm(readFileSync(new URL('../.github/workflows/grow-clock.yml', import.meta.url), 'utf8'));

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

test('Verse\'s own commits reach the site: each workflow that pushes to main with the Actions token starts the deploy itself (a token push starts no workflow; 2026-10-19 its commits showed "no checks reported")', () => {
  // propose-fix.yml: high-confidence fixes push to main and start deploy
  const proposeFix = norm(readFileSync(new URL('../.github/workflows/propose-fix.yml', import.meta.url), 'utf8'));
  const pfJob = proposeFix.slice(proposeFix.lastIndexOf('permissions:'));
  assert.match(pfJob, /actions: write/, 'propose-fix.yml: the committing job may start a workflow');
  assert.match(proposeFix, /git push -q origin HEAD:main[\s\S]{0,900}gh workflow run deploy\.yml --repo "\$\{\{ github\.repository \}\}" --ref main -f after_merge=true/, 'propose-fix.yml: the deploy starts right after the push to main');

  // grow-self.yml: opens a PR with automerge label; automerge.yml merges and starts deploy
  const growSelf = norm(readFileSync(new URL('../.github/workflows/grow-self.yml', import.meta.url), 'utf8'));
  const gsJob = growSelf.slice(growSelf.lastIndexOf('permissions:'));
  assert.match(gsJob, /actions: write/, 'grow-self.yml: the PR-creating job may start a workflow');
  assert.match(growSelf, /gh pr create[\s\S]{0,500}--label "made by Verse"[\s\S]{0,200}--label "verse hardens"[\s\S]{0,200}--label "automerge"/, 'grow-self.yml: opens PR with automerge label so Verse\'s commits reach the site via automerge');
});
