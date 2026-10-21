import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// a Windows checkout can hand this back with CRLF; the workflow's own bash sees LF, so the assertions read it the same way
const y = readFileSync(new URL('../.github/workflows/grow-self.yml', import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
const files = (re) => [...y.matchAll(re)].map((m) => m[1].replace(/\\\./g, '.').split('|').sort().join(','));

test('the build job, the pull request job and the git add allow exactly the same files, and nothing else', () => {
  const allow = files(/grep -vE '\^\(([^)]+)\)\$'/g);
  assert.equal(allow.length, 2, 'one allowlist in each job');
  assert.equal(allow[0], allow[1]);
  const expected = ['tools/bench.json', 'tools/art-floor.json', 'tools/card-cycle.json', 'tools/grow-self.state.json', 'domains/void.agents.log.md', 'void-live-deploy/void.growth.json'].sort().join(',');
  assert.equal(allow[0], expected);
  const add = /git add -- ([^\n]+)/.exec(y)[1].split(/\s+/).sort().join(',');
  assert.equal(add, allow[0]);
});

test('the build job holds no secret and no write token; only the pull request job writes; only the queue job holds the owner token', () => {
  const jobs = y.split(/\n  (?=[a-z-]+:\n    (?:needs|runs-on))/).slice(1);
  const by = Object.fromEntries(jobs.map((j) => [/^([a-z-]+):/.exec(j)[1], j]));
  assert.deepEqual(Object.keys(by).sort(), ['build', 'pull-request', 'queue-gaps']);
  assert.doesNotMatch(by.build, /secrets\./); assert.doesNotMatch(by.build, /contents: write|pull-requests: write/);
  assert.match(by['pull-request'], /contents: write/); assert.doesNotMatch(by['pull-request'], /VOID_OWNER_TOKEN/);
  assert.match(by['queue-gaps'], /VOID_OWNER_TOKEN/); assert.doesNotMatch(by['queue-gaps'], /contents: write|pull-requests: write/);
});

test('one preview in flight: an open preview PR or an open state stops the run before it probes anything', () => {
  // an open PR this repo actually labels (the old "verse hardens" label was never created, so the guard read zero forever)
  assert.match(y, /--state open --json number,labels/);
  assert.match(y, /name == "made by Verse" or \.name == "verse hardens"/);
  assert.match(y, /node tools\/grow-gate\.mjs status/);
  assert.match(y, /--state open --json number,labels/);
  // the last preview is verified live and closed before the next one starts; a failure stops with exit 0
  assert.ok(y.includes('VOID_CLAIMS_ONLY="^${regex}$" node tools/claims-verify.mjs --live --check'), 'the previous preview is typed into the live site before a new one starts');
  assert.match(y, /node tools\/grow-gate\.mjs close --proof/);
  assert.match(y, /echo "blocked=1" >> "\$GITHUB_OUTPUT"/);
  assert.match(y, /steps\.closeout\.outputs\.blocked != '1'/);
  // the new preview is recorded in the same patch, so the next run has something to close
  assert.match(y, /node tools\/grow-gate\.mjs open --run/);
  assert.match(y, /node tools\/art-score\.mjs --write; node tools\/art-pixels\.mjs --write/);
  assert.doesNotMatch(y, /git push[^\n]*--force|--no-verify/);
});

test('the gate stops the run itself: an open preview pull request ends the job with exit 0 and generates nothing', () => {
  const gate = y.slice(y.indexOf('- name: One preview at a time'), y.indexOf('- name: Think it up'));
  assert.match(gate, /echo "open=1" >> "\$GITHUB_OUTPUT"/, 'it starts closed to everything downstream, so an early stop is safe');
  assert.match(gate, /gh pr list --repo "\$\{\{ github\.repository \}\}" --state open/);
  assert.match(gate, /\[ "\$prs" = "0" \] \|\| \{[\s\S]*?exit 0/, 'an open preview pull request ends the job');
  assert.match(gate, /could not be read, so nothing new starts this cycle"\n\s+exit 0/, 'a pull request list that cannot be read is treated as open, never as clear');
  assert.ok(gate.indexOf('exit 0') < gate.indexOf('echo "open=0"'), '"open=0" is written only after every stop has been passed');
  assert.match(y, /if: steps\.open\.outputs\.open == '0'/, 'the rest of the job only runs when the gate is clear');
});
