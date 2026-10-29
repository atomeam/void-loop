// .github/workflows/grow-clock.yml (owner, 2026-10-19: "make it grow every ten minutes"): one growth step every 10 minutes, the chain restarts itself
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

function norm(s) { return String(s).replace(/\r\n/g, '\n'); }
const y = norm(readFileSync(new URL('../.github/workflows/grow-clock.yml', import.meta.url), 'utf8'));

// 2026-10-26 (owner: "look at Verse autonomy and fix it so it definitly will work on its own without either of us"): the clock runs the
// conductor (tools/conductor.mjs) instead of alternating two workflows, so it reads the build queue with the owner token, and the chain
// starts again whatever a run's ticks did. The proving pass (grow-self.yml) is started by the conductor again, at most every 2 hours: the
// owner's 2026-10-24 words were read as "no self hardening" and taken off the clock; the owner put it right on 2026-10-26 ("never said there
// a no self hardening i said to elaborate what that means"; "it needs to say what it improved").
test('a conductor tick every 10 minutes for under the job timeout, then the next run starts whatever happened; the proving pass every 2 hours; one secret', () => {
  const ticks = /n=33/.test(y) ? 33 : 0, sleep = +/sleep (\d+); fi\n\s+done/.exec(y)[1], timeout = +/timeout-minutes: (\d+)/.exec(y)[1];
  assert.equal(ticks, 33); assert.equal(sleep, 600);
  assert.ok((ticks - 1) * sleep / 60 < timeout - 10, 'the loop ends before the job times out, so the chain step runs');
  assert.match(y, /node tools\/conductor\.mjs tick/);
  assert.match(y, /- name: Start the next clock run\n\s+if: always\(\) && !inputs\.dry/, 'a failed tick or run never stops the clock');
  assert.match(y, /gh workflow run grow-clock\.yml/);
  const code = (f) => norm(readFileSync(new URL('./' + f, import.meta.url), 'utf8')).replace(/^\s*\/\/.*$/gm, '');
  assert.match(code('conductor.mjs'), /growDue\(\{[^}]*\}\)[^\n]*start\('grow-self\.yml'\)/, 'the conductor starts the proving pass when it is due (owner, 2026-10-26)');
  assert.match(code('conductor-core.mjs'), /export const GROW_EVERY_H = 2;/, 'at most every 2 hours');
  assert.deepEqual([...new Set([...y.matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1]))], ['VOID_OWNER_TOKEN'], 'the queue token and nothing else');
  assert.match(y, /permissions:\n  actions: write.*\n  contents: write/);
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
