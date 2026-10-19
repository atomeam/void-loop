// The automerge safety-check (asked by Verse): node --test tools/skill-safety.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testsFor, safety, MARK, BOT } from './skill-safety.mjs';

const TESTS = [['merges.test.mjs', "import m from '../void-live-deploy/skills/merges.js';"], ['status-fix.test.mjs', "import { x } from '../void-live-deploy/skills/status.js';"], ['keep.test.mjs', "from '../void-live-deploy/lib/keep-going.js'"]];

test('only the unit tests that import a changed skill or lib are picked, and a changed test runs itself', () => {
  assert.deepEqual(testsFor(['void-live-deploy/skills/status.js', 'README.md'], TESTS).files, ['tools/status-fix.test.mjs']);
  assert.deepEqual(testsFor(['void-live-deploy/lib/keep-going.js', 'tools/new.test.mjs'], TESTS).files, ['tools/keep.test.mjs', 'tools/new.test.mjs']);
  assert.deepEqual(testsFor(['void-live-deploy/skills/status.js'], [['browser.test.mjs', "import { chromium } from 'playwright-core'; // skills/status.js"]]).files, [], 'a browser script is left to verify.yml');
  assert.deepEqual(testsFor(['void.html', 'docs/MAP.md'], TESTS).files, []);
  // a test that runs a browser script (bench-load.test.mjs spawns bench.mjs) needs Chrome too, even when the PR changed the test itself
  const runs = [['bench-load.test.mjs', "spawnSync(process.execPath, [join(here, 'bench.mjs')])"], ['bench-math.test.mjs', "import { x } from './bench-load.mjs'; import k from '../void-live-deploy/lib/keep-going.js';"]];
  assert.deepEqual(testsFor(['tools/bench-load.test.mjs', 'void-live-deploy/lib/keep-going.js'], runs, ['bench.mjs']).files, ['tools/bench-math.test.mjs'], 'bench-load.mjs is not bench.mjs');
  assert.deepEqual(testsFor(['tools/bench-load.test.mjs'], runs, []).files, ['tools/bench-load.test.mjs'], 'without the list of browser scripts it is run as before');
  assert.equal(testsFor(['void-live-deploy/skills/merges.js'], [['a.test.mjs', "skills/merges.jsx"]]).files.length, 0, 'a longer name is not a match');
});

function rig({ fail = false, comments = [], breakFetch = false } = {}) {
  const calls = [];
  const run = (cmd, args, opts) => {
    calls.push([cmd, ...args]);
    if (breakFetch && args[0] === 'fetch') throw Object.assign(new Error('no network'), { stderr: 'no network' });
    if (cmd === 'node' && fail) throw Object.assign(new Error('x'), { stdout: 'not ok 1 - the card lists merges\n# fail 1\n', stderr: '' });
    return '';
  };
  const gh = (p) => (/\/files/.test(p) ? [{ filename: 'void-live-deploy/skills/merges.js' }] : comments);
  return { calls, run, gh };
}
const T = () => TESTS;

test('green: node --test runs on the affected test file only, on the PR head', () => {
  const r = rig();
  const out = safety(r.run, r.gh, { repo: 'o/r', pr: 5, sha: 'abc', dir: '/tmp/x', tests: T });
  assert.equal(out.state, 'pass'); assert.deepEqual(out.files, ['tools/merges.test.mjs']);
  assert.ok(r.calls.some((c) => c[0] === 'node' && c[1] === '--test' && c[2] === 'tools/merges.test.mjs' && c.length === 3));
  assert.ok(r.calls.some((c) => c[0] === 'git' && c[1] === 'worktree' && c[2] === 'add' && c.includes('abc')));
});

test('red: the merge is held and the PR gets one comment with the failing lines; a second run updates it, not repeats it', () => {
  const r = rig({ fail: true });
  assert.equal(safety(r.run, r.gh, { repo: 'o/r', pr: 5, sha: 'abc', dir: '/tmp/x', tests: T }).state, 'fail');
  const post = r.calls.find((c) => c[0] === 'gh');
  assert.ok(post && post.includes('POST') && post.some((a) => String(a).startsWith('body=' + MARK) && /not ok 1/.test(a)));
  const r2 = rig({ fail: true, comments: [{ id: 9, user: { login: BOT }, body: MARK + '\nold' }] });
  safety(r2.run, r2.gh, { repo: 'o/r', pr: 5, sha: 'abc', dir: '/tmp/x', tests: T });
  assert.ok(r2.calls.some((c) => c[0] === 'gh' && c.includes('PATCH')) && !r2.calls.some((c) => c[0] === 'gh' && c.includes('POST')));
});

test('a check that cannot be set up skips and never blocks the merge; the worktree is always removed', () => {
  const r = rig({ breakFetch: true });
  const out = safety(r.run, r.gh, { repo: 'o/r', pr: 5, sha: 'abc', dir: '/tmp/x', tests: T });
  assert.equal(out.state, 'skip');
  assert.ok(r.calls.some((c) => c[1] === 'worktree' && c[2] === 'remove'));
});

import { missingDeclared } from './skill-safety.mjs';
const SDK = "Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@anthropic-ai/sdk' imported from /w/tools/claude-brain.mjs";

test('missingDeclared: only a package the repo declares is an environment gap; one it does not is the PR\'s own mistake', () => {
  const pkg = { dependencies: { '@anthropic-ai/sdk': '1' }, devDependencies: { 'playwright-core': '1' } };
  assert.deepEqual(missingDeclared(SDK, pkg), ['@anthropic-ai/sdk']);
  assert.deepEqual(missingDeclared("Cannot find package 'left-pad' imported from x", pkg), []);
  assert.deepEqual(missingDeclared(SDK + '\n' + SDK, pkg), ['@anthropic-ai/sdk'], 'once');
  assert.deepEqual(missingDeclared('not ok 1 - a real failure', pkg), []);
  assert.deepEqual(missingDeclared(SDK, null), []);
});

function installRig({ firstFails = true, afterInstall = 'pass', installFails = false } = {}) {
  const calls = []; let installed = false;
  const run = (cmd, args) => {
    calls.push([cmd, ...args]);
    if (cmd === 'npm') { if (installFails) throw Object.assign(new Error('x'), { stderr: 'npm ERR! network' }); installed = true; return ''; }
    if (cmd === 'node') {
      if (!installed && firstFails) throw Object.assign(new Error('x'), { stdout: SDK, stderr: '' });
      if (installed && afterInstall === 'fail') throw Object.assign(new Error('x'), { stdout: 'not ok 1 - the real failure\n', stderr: '' });
    }
    return '';
  };
  return { calls, run, gh: (p) => (/\/files/.test(p) ? [{ filename: 'void-live-deploy/skills/merges.js' }] : []) };
}
const PKG = () => ({ dependencies: { '@anthropic-ai/sdk': '1' } });

test('a test that cannot load a declared package passes once the dependencies are installed, and the install runs once, without scripts', () => {
  const r = installRig(), out = safety(r.run, r.gh, { repo: 'o/r', pr: 7, sha: 'abc', dir: '/tmp/x', tests: T, pkg: PKG });
  assert.equal(out.state, 'pass'); assert.match(out.why, /after installing dependencies/);
  const installs = r.calls.filter((c) => c[0] === 'npm'); assert.equal(installs.length, 1);
  assert.deepEqual(installs[0], ['npm', 'ci', '--ignore-scripts', '--no-audit', '--no-fund']);
});

test('a failure that survives the install is the PR\'s: it is held and the comment is made', () => {
  const r = installRig({ afterInstall: 'fail' }), out = safety(r.run, r.gh, { repo: 'o/r', pr: 7, sha: 'abc', dir: '/tmp/x', tests: T, pkg: PKG });
  assert.equal(out.state, 'fail');
  assert.ok(r.calls.some((c) => c[0] === 'gh' && c.includes('POST')));
});

test('if the install itself fails the check cannot judge: it skips, it never holds a merge for that', () => {
  const r = installRig({ installFails: true }), out = safety(r.run, r.gh, { repo: 'o/r', pr: 7, sha: 'abc', dir: '/tmp/x', tests: T, pkg: PKG });
  assert.equal(out.state, 'skip'); assert.match(out.why, /could not be installed/);
  assert.ok(!r.calls.some((c) => c[0] === 'gh'));
});

test('a package the repo does not declare is still a failure, with no install tried', () => {
  const r = installRig(), out = safety(r.run, r.gh, { repo: 'o/r', pr: 7, sha: 'abc', dir: '/tmp/x', tests: T, pkg: () => ({}) });
  assert.equal(out.state, 'fail'); assert.ok(!r.calls.some((c) => c[0] === 'npm'));
});
