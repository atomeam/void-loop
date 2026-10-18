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
