// The automerge safety-check (asked by Verse): node --test tools/skill-safety.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testsFor, safety, MARK, BOT } from './skill-safety.mjs';

const TESTS = [['merges.test.mjs', "import m from '../void-live-deploy/skills/merges.js';"], ['status-fix.test.mjs', "import { x } from '../void-live-deploy/skills/status.js';"], ['keep.test.mjs', "from '../void-live-deploy/lib/keep-going.js'"]];

test('only the unit tests that import a changed skill or lib are picked, and a changed test runs itself', () => {
  assert.deepEqual(testsFor(['void-live-deploy/skills/status.js', 'README.md'], TESTS).files, ['tools/status-fix.test.mjs']);
  assert.deepEqual(testsFor(['void-live-deploy/lib/keep-going.js', 'tools/new.test.mjs'], TESTS).files, ['tools/new.test.mjs', 'tools/keep.test.mjs'], 'the PR\'s own test runs first');
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

test('"lock it" is the picked thing\'s lock (a note against arrows), never the whole screen; "lock now" and "lock the screen" still lock it (2026-10-19)', async () => {
  const { safetyIntent } = await import('../void-live-deploy/lib/safety.js');
  assert.equal(safetyIntent('lock it'), null);
  assert.deepEqual(safetyIntent('lock now'), { op: 'lock' });
  assert.deepEqual(safetyIntent('lock the screen'), { op: 'lock' });
});

// 2026-10-30: three merges broke main on checks the safety-check could have run in seconds. These replay their changed files.
import { checksFor, readTests, readBrowser, MAX_TESTS } from './skill-safety.mjs';
import { fileURLToPath } from 'node:url';
const repoDir = fileURLToPath(new URL('..', import.meta.url));

test('the near tests survive the cap: a lib with many importers still runs its own tests first', () => {
  const many = [...Array(20)].map((_, i) => ['a' + String(i).padStart(2, '0') + '.test.mjs', "from '../void-live-deploy/lib/tower.js'"]);
  const near = [['tower.test.mjs', "from '../void-live-deploy/lib/tower.js'"], ['tower-merge.test.mjs', "from '../void-live-deploy/lib/tower.js'"]];
  const got = testsFor(['void-live-deploy/lib/tower.js', 'tools/zz.test.mjs'], [...many, ...near, ['zz.test.mjs', 'x']]).files;
  assert.equal(got.length, MAX_TESTS);
  assert.deepEqual(got.slice(0, 3), ['tools/zz.test.mjs', 'tools/tower.test.mjs', 'tools/tower-merge.test.mjs'], 'the PR\'s own test, the module\'s test, then tower-*');
  assert.equal(got[3], 'tools/a00.test.mjs', 'then the rest in name order');
  assert.deepEqual(testsFor(['void-live-deploy/lib/tower.js'], [['tower-gate.test.mjs', "from '../void-live-deploy/lib/tower.js'; for (const n of ['playwright-core', 'playwright']) req(n)"], ['tower-x.test.mjs', "const { chromium } = await import('playwright-core'); lib/tower.js'"], ...near]).files,
    ['tools/tower.test.mjs', 'tools/tower-merge.test.mjs'], 'a test that loads Playwright itself is left to verify.yml');
  assert.ok(!testsFor(['void-live-deploy/lib/tower.js'], [['towering.test.mjs', "lib/tower.js'"], ...many]).files.slice(0, 1).includes('tools/towering.test.mjs'), 'tower- is the prefix, not tower');
});

test('#1643 (a second hosting floor in lib/tower.js) now runs tower.test and tower-merge.test, on the real repository', () => {
  const changed = ['docs/MAP.md', 'void-live-deploy/lib/tower.js', 'void-live-deploy/parity.json', 'void-live-deploy/self.json'];
  const got = testsFor(changed, readTests(repoDir), readBrowser(repoDir)).files;
  assert.ok(got.includes('tools/tower.test.mjs') && got.includes('tools/tower-merge.test.mjs'), got.join(' '));
});

test('#1682 (the Brain router) still runs brain-route.test and brain-watch.test first', () => {
  const changed = ['void-live-deploy/lib/brain-route.js', 'void-live-deploy/lib/brain-mind.js', 'void-live-deploy/lib/brain-host.js', 'tools/brain-route.test.mjs'];
  const got = testsFor(changed, readTests(repoDir), readBrowser(repoDir)).files;
  assert.equal(got[0], 'tools/brain-route.test.mjs');
  assert.ok(got.includes('tools/brain-host.test.mjs'), got.join(' '));
});

test('#1690 (a new /api route) runs openapi-check.mjs; a page or a lib alone does not', () => {
  assert.deepEqual(checksFor(['void-live-deploy/functions/api/holidays.js', 'void-live-deploy/skills/holidays.js']), ['tools/openapi-check.mjs']);
  assert.deepEqual(checksFor(['void-live-deploy/openapi.json']), ['tools/openapi-check.mjs']);
  assert.deepEqual(checksFor(['tools/openapi-check.mjs']), ['tools/openapi-check.mjs']);
  assert.deepEqual(checksFor(['void-live-deploy/lib/tower.js', 'void.html', 'docs/x.md']), []);
});

test('a failed repo check holds the merge with its own command in the comment, before any unit test runs', () => {
  const calls = [];
  const run = (cmd, args) => { calls.push([cmd, ...args]); if (cmd === 'node' && args[0] === 'tools/openapi-check.mjs') throw Object.assign(new Error('x'), { stdout: '/api/holidays: a route in neither the spec nor INTERNAL\n', stderr: '' }); return ''; };
  const gh = (p) => (/\/files/.test(p) ? [{ filename: 'void-live-deploy/functions/api/holidays.js' }, { filename: 'void-live-deploy/skills/merges.js' }] : []);
  const out = safety(run, gh, { repo: 'o/r', pr: 7, sha: 'abc', dir: '/tmp/x', tests: T });
  assert.equal(out.state, 'fail'); assert.match(out.why, /openapi-check/);
  assert.ok(calls.some((c) => c[0] === 'gh' && c.some((a) => String(a).startsWith('body=' + MARK) && a.includes('`node tools/openapi-check.mjs` failed') && a.includes('/api/holidays'))));
  assert.ok(!calls.some((c) => c[0] === 'node' && c[1] === '--test'), 'held before the unit tests');
});

test('a passing repo check is named in the result', () => {
  const run = () => '', gh = (p) => (/\/files/.test(p) ? [{ filename: 'void-live-deploy/functions/api/x.js' }] : []);
  const out = safety(run, gh, { repo: 'o/r', pr: 7, sha: 'abc', dir: '/tmp/x', tests: T });
  assert.equal(out.state, 'pass'); assert.match(out.why, /openapi-check\.mjs passed/);
});
