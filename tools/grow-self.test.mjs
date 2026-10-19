import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const y = readFileSync(new URL('../.github/workflows/grow-self.yml', import.meta.url), 'utf8');
const files = (re) => [...y.matchAll(re)].map((m) => m[1].replace(/\\\./g, '.').split('|').sort().join(','));

test('the build job, the pull request job and the git add allow exactly the same files, and nothing else', () => {
  const allow = files(/grep -vE '\^\(([^)]+)\)\$'/g);
  assert.equal(allow.length, 2, 'one allowlist in each job');
  assert.equal(allow[0], allow[1]);
  assert.equal(allow[0], ['tools/bench.json', 'tools/art-floor.json', 'tools/card-cycle.json', 'domains/void.agents.log.md', 'void-live-deploy/void.growth.json'].sort().join(','));
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

test('one hardening pull request open at a time, and an art floor is only ever raised, never lowered, by this run', () => {
  assert.match(y, /--label "verse hardens" --state open/);
  assert.match(y, /node tools\/art-score\.mjs --write; node tools\/art-pixels\.mjs --write/);
  assert.doesNotMatch(y, /git push[^\n]*--force|--no-verify/);
});
