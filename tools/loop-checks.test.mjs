// tools/loop-checks.mjs: which workflows a workflow-token pull request must start, and that deploy stays a PR check.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checksFor, prNumber, ghArgs } from './loop-checks.mjs';

test('a diff that touches no filtered path starts the five checks every pull request gets', () => {
  const files = checksFor(['docs/TAGTEAM.md', 'built.txt']).map((c) => c.file);
  assert.deepEqual(files, ['void-review.yml', 'merge-gate.yml', 'deploy.yml', 'collide.yml', 'automerge.yml']);
});

test('a page diff also starts the critic, and a workflow diff starts the linter', () => {
  const files = checksFor(['void-live-deploy/skills/x.js', '.github/workflows/verse-loop.yml']).map((c) => c.file);
  assert.ok(files.includes('loop-critic.yml'));
  assert.ok(files.includes('workflow-lint.yml'));
  assert.ok(!files.includes('bench.yml'));
});

test('the bench, the windows suite and the ringer check follow their own files', () => {
  assert.ok(checksFor(['tools/bench.mjs']).some((c) => c.file === 'bench.yml'));
  assert.ok(checksFor(['tools/ouroboros_test.py']).some((c) => c.file === 'ouroboros.yml'));
  assert.ok(checksFor(['void-live-deploy/skills/scene3d.js']).some((c) => c.file === 'touch-webkit.yml'));
  assert.ok(checksFor(['void-live-deploy/skills/scene3d.js']).some((c) => c.file === 'loop-critic.yml'), 'scene3d lives under void-live-deploy, so the critic runs too');
});

test('a sweep that is already automerge does not start automerge again', () => {
  const files = checksFor(['void.html'], { from: 'automerge' }).map((c) => c.file);
  assert.ok(!files.includes('automerge.yml'));
  assert.ok(files.includes('void-review.yml') && files.includes('deploy.yml') && files.includes('loop-critic.yml'));
});

test('the gh command names the branch and the pull request, and a url counts as its number', () => {
  assert.equal(prNumber('https://github.com/atomeam/void-loop/pull/2261'), '2261');
  assert.equal(prNumber('7'), '7');
  assert.equal(prNumber(''), '');
  const a = ghArgs({ file: 'deploy.yml', args: (pr) => ['-f', `pr=${pr}`] }, { pr: '7', ref: 'loop/20261105-095831', repo: 'atomeam/void-loop' });
  assert.deepEqual(a, ['workflow', 'run', 'deploy.yml', '--repo', 'atomeam/void-loop', '--ref', 'loop/20261105-095831', '-f', 'pr=7']);
});

test('deploy.yml treats a dispatched pr as the quick checks, and the upload cannot run', () => {
  const yml = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  assert.match(yml, /prcheck="\$\{\{ inputs\.pr \}\}"/);
  assert.match(yml, /\[ "\$EVENT" = "pull_request" \] \|\| \[ -n "\$prcheck" \]/);
  assert.match(yml, /inputs\.pr == ''/);
  const upload = yml.slice(yml.indexOf('- name: Deploy to Cloudflare Pages'));
  assert.match(upload, /inputs\.pr == ''/);
  assert.match(yml, /github\.event_name != 'workflow_dispatch' \|\| inputs\.pr != ''/);
  assert.match(yml, /github\.event_name == 'pull_request' \|\| inputs\.pr != ''/);
});
