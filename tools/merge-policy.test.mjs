import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { eligible, superseded, stuckDecision, isBot, loopCovers, fileContained, mainVerifyHold } from './merge-policy.mjs';
import { explainPolicyFailure } from './merge-gate.mjs';

const pr = (over) => ({ number: 1, state: 'open', user: { login: 'atomeam' }, head: { ref: 'helper/x', repo: { full_name: 'atomeam/void-loop' } }, labels: [], created_at: '2026-11-03T00:00:00Z', ...over });

test('the owner and both Actions logins count as the bot', () => {
  assert.equal(isBot('atomeam'), true);
  assert.equal(isBot('github-actions[bot]'), true);
  assert.equal(isBot('app/github-actions'), true);
  assert.equal(isBot('someone'), false);
});

test('a labelled pull request qualifies, and so does a bot branch; a fork does not', () => {
  assert.equal(eligible(pr({ labels: [{ name: 'automerge' }] }), 'atomeam/void-loop'), true);
  assert.equal(eligible(pr({ user: { login: 'app/github-actions' }, head: { ref: 'lab/sync-1', repo: { full_name: 'atomeam/void-loop' } } }), 'atomeam/void-loop'), true);
  assert.equal(eligible(pr({ labels: [], head: { ref: 'feature', repo: { full_name: 'atomeam/void-loop' } } }), 'atomeam/void-loop'), false);
  assert.equal(eligible(pr({ head: { ref: 'helper/x', repo: { full_name: 'other/void-loop' } }, labels: [{ name: 'automerge' }] }), 'atomeam/void-loop'), false);
});

test('an older lab sync is closed; an older loop lap is closed only when its changes are already contained', () => {
  const rows = [
    pr({ number: 1, created_at: '2026-11-01T00:00:00Z', user: { login: 'app/github-actions' }, head: { ref: 'lab/sync-old' } }),
    pr({ number: 2, created_at: '2026-11-03T00:00:00Z', user: { login: 'app/github-actions' }, head: { ref: 'lab/sync-new' } }),
    pr({ number: 3, created_at: '2026-11-02T00:00:00Z', user: { login: 'github-actions[bot]' }, head: { ref: 'loop/a' } }),
    pr({ number: 4, created_at: '2026-11-03T00:00:00Z', user: { login: 'github-actions[bot]' }, head: { ref: 'loop/b' } }),
    pr({ number: 5, created_at: '2026-11-01T00:00:00Z', user: { login: 'someone' }, head: { ref: 'lab/sync-person' } }),
  ];
  const asked = [];
  const blind = superseded(rows, (old) => { asked.push(old.number); return false; });
  assert.deepEqual(blind.close.map((r) => r.number), [1], 'lab/sync still closes on age alone');
  assert.equal(blind.close[0].keep, 2);
  assert.deepEqual(asked, [3], 'the coverage check is not asked about a lab import');
  assert.equal(blind.carry[0].number, 3);
  assert.equal(blind.carry[0].keep, 4);
  assert.deepEqual(blind.carry[0].missing, ['(not checked)']);
  const proven = superseded(rows, () => true);
  assert.deepEqual(proven.close.map((r) => r.number).sort(), [1, 3]);
  assert.deepEqual(proven.carry, []);
  const held = superseded(rows, () => { throw new Error('compare failed'); });
  assert.deepEqual(held.carry.map((r) => r.number), [3]);
  assert.equal(held.carry[0].missing[0], '(coverage check failed)');
  const unchecked = superseded(rows);
  assert.deepEqual(unchecked.close.map((r) => r.number), [1]);
  assert.deepEqual(unchecked.carry.map((r) => r.number), [3], 'with no proof, the older loop pull request stays open');
});

test('hexen.ai: a newer loop pull request that only touches nightly.json does not contain the consulting note', () => {
  const feature = [
    '@@ -0,0 +1,10 @@',
    '+{',
    '+  "name": "AI Consulting",',
    '+  "slug": "ai-consulting",',
    '+  "description": "Custom AI development, consulting, and infrastructure solutions.",',
    '+  "features": [',
    '+    "Custom AI development",',
    '+    "AI consulting",',
    '+    "AI infrastructure solutions"',
    '+  ]',
    '+}',
  ].join('\n');
  const row = [
    '@@ -436,6 +436,12 @@',
    '+  "ai-consulting": {',
    '+   "at": "2026-10-31T15:55:43Z",',
    '+   "outcome": "pending",',
    '+   "why": "new floor for hexen.ai",',
    '+   "title": "AI Consulting"',
    '+  },',
  ].join('\n');
  const older = [
    { path: 'domains/features/ai-consulting.json', patch: feature },
    { path: 'domains/tower-self.json', patch: row },
  ];
  const newer = [{ path: 'void-live-deploy/progress/nightly.json', patch: '@@ -1 +1 @@\n-{"n":1}\n+{"n":2}\n' }];
  const missed = loopCovers(older, newer, { 'domains/features/ai-consulting.json': '', 'domains/tower-self.json': '{\n  "hexen.ai": {}\n}\n' });
  assert.equal(missed.ok, false);
  assert.deepEqual(missed.missing, ['domains/features/ai-consulting.json', 'domains/tower-self.json']);
  assert.match(missed.patch, /new floor for hexen\.ai/);
  const onMain = loopCovers(older, newer, {
    'domains/features/ai-consulting.json': '{\n  "name": "AI Consulting",\n  "slug": "ai-consulting",\n  "description": "Custom AI development, consulting, and infrastructure solutions.",\n  "features": [\n    "Custom AI development",\n    "AI consulting",\n    "AI infrastructure solutions"\n  ]\n}\n',
    'domains/tower-self.json': '  "hexen.ai": {}\n  "ai-consulting": {\n   "at": "2026-10-31T15:55:43Z",\n   "outcome": "pending",\n   "why": "new floor for hexen.ai",\n   "title": "AI Consulting"\n  },\n',
  });
  assert.equal(onMain.ok, true, 'main already has both notes, so the older lap can close');
  const carried = loopCovers(older, [
    { path: 'domains/features/ai-consulting.json', patch: feature },
    { path: 'domains/tower-self.json', patch: row },
  ], {});
  assert.equal(carried.ok, true, 'the newer pull request has the same lines');
  assert.equal(fileContained({ path: 'a.txt', truncated: true, patch: '+x\n' }, { mainText: 'x' }), false, 'an unreadable patch is not treated as contained');
  assert.equal(loopCovers([], newer, {}).ok, true, 'a branch that adds nothing is already contained');
  const gone = loopCovers(
    [{ path: 'old.txt', patch: '@@ -1 +0,0 @@\n-retire this line\n' }],
    newer,
    { 'old.txt': 'retire this line\n' },
  );
  assert.deepEqual(gone.missing, ['old.txt']);
  assert.equal(loopCovers(
    [{ path: 'old.txt', patch: '@@ -1 +0,0 @@\n-retire this line\n' }],
    [{ path: 'old.txt', patch: '@@ -1 +0,0 @@\n-retire this line\n' }],
    { 'old.txt': 'retire this line\n' },
  ).ok, true);
});

test('six hours: green merges, a conflict is rebased, a red check is named, a young one waits', () => {
  const now = Date.parse('2026-11-04T12:00:00Z');
  const old = pr({ created_at: '2026-11-04T00:00:00Z', mergeable_state: 'clean' });
  assert.equal(stuckDecision(old, [{ name: 'void-review', status: 'completed', conclusion: 'success' }], now).action, 'merge');
  assert.equal(stuckDecision({ ...old, mergeable_state: 'dirty' }, [], now).action, 'rebase');
  assert.equal(stuckDecision({ ...old, mergeable_state: 'behind' }, [], now).action, 'update');
  assert.equal(stuckDecision(old, [{ name: 'void-review', status: 'completed', conclusion: 'failure' }], now).why, 'void-review failure');
  assert.equal(stuckDecision(pr({ created_at: '2026-11-04T10:00:00Z' }), [], now).action, 'young');
});

// 2026-11-06: since the suite gate (#2309) the bot no longer arms GitHub's auto-merge (it would merge on whatever main is, without the
// suite). It disarms it, and merges one pull request itself with a squash, only after the suite passed on top of current main.
// suite-gate.yml lives on main and checks the pull request out itself, so the suite is dispatched from main (#2315).
test('the automerge workflow merges with a squash after the suite gate, and keeps the hourly run', () => {
  const yml = readFileSync(new URL('../.github/workflows/automerge.yml', import.meta.url), 'utf8');
  const src = readFileSync(new URL('./automerge.mjs', import.meta.url), 'utf8');
  assert.match(yml, /pull-requests: write/, 'file .github/workflows/automerge.yml keeps pull-requests: write');
  assert.match(yml, /17 \* \* \* \*/, 'file .github/workflows/automerge.yml keeps the hourly run');
  assert.match(yml, /STUCK:/, 'file .github/workflows/automerge.yml keeps the stuck sweep');
  assert.match(src, /disablePullRequestAutoMerge/, 'file tools/automerge.mjs disarms GitHub auto-merge until the suite is green');
  assert.match(src, /merge_method=squash/, 'file tools/automerge.mjs squash-merges after the suite');
  assert.match(src, /chooseChecked\(rows, mainSha, running, safetyOk\)/, 'file tools/automerge.mjs: the suite gate chooses, and the safety-check runs on its batch');
  assert.match(src, /const safetyOk = [^]*?safety\(ex, gh,/, 'file tools/automerge.mjs safety-checks the batch');
  assert.match(src, /update-branch/, 'file tools/automerge.mjs brings a branch that is behind main up to date');
  assert.doesNotMatch(src, /enablePullRequestAutoMerge/, 'file tools/automerge.mjs must not arm GitHub auto-merge');
  assert.match(src, /workflow', 'run', 'suite-gate\.yml', '--repo', repo, '--ref', 'main'/, 'file tools/automerge.mjs starts the suite from main');
  assert.match(src, /superseded\(prs, loopCoverage\)/, 'file tools/automerge.mjs checks that a newer loop pull request contains the older one before closing it');
  assert.match(src, /void-carry/, 'file tools/automerge.mjs records the missing delta and leaves the pull request open');
  assert.match(src, /!Array\.isArray\(v\.files\)/, 'file tools/automerge.mjs does not treat an unreadable compare as an empty diff');
});

test('a merge-policy failure names the rule and the file, branch or label', () => {
  // the #2315 log: the assertion had no message, so the gate printed "FAIL merge-policy" and a duration
  const hidden = [
    'TAP version 13',
    '# Subtest: the automerge workflow arms squash auto-merge and keeps the hourly run',
    'not ok 1 - the automerge workflow arms squash auto-merge and keeps the hourly run',
    '  ---',
    '  duration_ms: 2.239531',
    '  type: \'test\'',
    '  location: \'/tmp/tools/merge-policy.test.mjs:51:1\'',
    '  failureType: \'testCodeFailure\'',
    '  error: |-',
    '    The input did not match the regular expression /enablePullRequestAutoMerge/. Input:',
    '',
    '    \'// the whole of tools/automerge.mjs, which also says label automerge and branch helper/x\\n\' +',
    '',
    '  code: \'ERR_ASSERTION\'',
    '  name: \'AssertionError\'',
    '  operator: \'match\'',
    '  ...',
    'not ok 2 - a cursor branch with no label does not qualify',
    '  ---',
    '  error: \'branch cursor/suite-start-branch-79be has no automerge label\'',
    '  code: \'ERR_ASSERTION\'',
    '  ...',
    'not ok 3 - the label is missing',
    '  ---',
    '  error: \'label automerge is not on this pull request\'',
    '  code: \'ERR_ASSERTION\'',
    '  ...',
    '# fail 3',
  ].join('\n');
  assert.deepEqual(explainPolicyFailure(hidden), [
    'merge-policy rule "the automerge workflow arms squash auto-merge and keeps the hourly run" violated by file tools/automerge.mjs: The input did not match the regular expression /enablePullRequestAutoMerge/.',
    'merge-policy rule "a cursor branch with no label does not qualify" violated by branch cursor/suite-start-branch-79be: branch cursor/suite-start-branch-79be has no automerge label',
    'merge-policy rule "the label is missing" violated by label automerge: label automerge is not on this pull request',
  ]);
  assert.deepEqual(explainPolicyFailure('TAP version 13\nok 1 - a labelled pull request qualifies\n# fail 0\n'), []);
  const gate = readFileSync(new URL('./merge-gate.mjs', import.meta.url), 'utf8');
  assert.match(gate, /explainPolicyFailure/);
  assert.match(gate, /FAIL\\s\+merge-policy/);
});

// 2026-11-06: only 2 of 300 automerge runs were full sweeps. A run on main about no pull request (a deploy, the review of main) took the
// "sweep" group and replaced the waiting sweep, and the suite gate's own result ("Suite on main", on main, no pull request) was skipped
// by the job "if" and by idleEvent. So no new batch went to the suite and nothing merged.
test('a suite gate result sweeps, and an idle run on main never replaces the waiting sweep', () => {
  const yml = readFileSync(new URL('../.github/workflows/automerge.yml', import.meta.url), 'utf8');
  const src = readFileSync(new URL('./automerge.mjs', import.meta.url), 'utf8');
  const group = yml.match(/^\s*group: (.+)$/m)[1];
  assert.match(group, /head_branch == 'main' && github\.event\.workflow_run\.name != 'Suite on main' && github\.event\.workflow_run\.name != 'Verse verify' && format\('idle-\{0\}', github\.run_id\)\) \|\| 'sweep'/);
  assert.match(yml, /if: .*github\.event\.workflow_run\.name == 'Suite on main'/);
  assert.match(yml, /github\.event\.workflow_run\.name == 'Verse verify'/);
  assert.match(src, /wr\.name !== 'Suite on main' && wr\.name !== 'Verse verify' && !\(wr\.pull_requests/);
});

test('a red Verse verify on the current main head blocks automerge, and a green one does not', () => {
  const fail = (headSha, committedAt, extra = {}) => ({ headSha, status: 'completed', conclusion: 'failure', committedAt, covers: true, updatedAt: '2026-11-09T21:30:40Z', url: 'https://github.com/atomeam/void-loop/actions/runs/42697922754', ...extra });
  const ok = (headSha, committedAt) => ({ headSha, status: 'completed', conclusion: 'success', committedAt, covers: true, updatedAt: '2026-11-09T19:17:20Z' });
  // 2026-11-09 21:43 UTC: #2574 merged onto f474c754d. That head had no verify of its own. The newest
  // finished verify that covers it was bd18dbef, failure, completed 21:30. The suite gate had passed
  // because inherited reds do not fail a batch. The merge should have waited.
  const ontoRedAncestor = mainVerifyHold([
    ok('a841e248d57d31a1922aa3902b9500d7e0bf6fdf', 1000),
    fail('bd18dbef95a0656d147a15e8e162d80699ee181b', 2000),
    { headSha: 'f474c754d', status: 'in_progress', conclusion: null, committedAt: 3000, covers: true },
  ], 'f474c754d');
  assert.equal(ontoRedAncestor.hold, true);
  assert.equal(ontoRedAncestor.rule, 'main-verify-red');
  assert.equal(ontoRedAncestor.file, '.github/workflows/verify.yml');
  assert.match(ontoRedAncestor.hint, /green on the current main head/);
  assert.match(ontoRedAncestor.hint, /bd18dbef/);
  // 22:49 UTC: #2590 through #2603 merged while verify on the then-current head d619471 had already finished red.
  const ontoRedHead = mainVerifyHold([fail('d61947130e2671b44ea09571d0c6f154c11361b8', 4000)], 'd61947130e2671b44ea09571d0c6f154c11361b8');
  assert.equal(ontoRedHead.hold, true);
  assert.match(ontoRedHead.hint, /d61947130/);
  // a green verify on the current head lets Verse merge itself, even when an older head was red
  const green = mainVerifyHold([
    fail('bd18dbef95a0656d147a15e8e162d80699ee181b', 2000),
    ok('9d8fcd5c1184d3a3a906ddb5a07f384b6d998586', 5000),
  ], '9d8fcd5c1184d3a3a906ddb5a07f384b6d998586');
  assert.equal(green.hold, false, 'file .github/workflows/verify.yml is green on this head, so automerge is not blocked');
  // a slow failure that finishes after a newer green head does not hold: the newer commit is the verdict
  const newerGreen = mainVerifyHold([
    { ...fail('oldred', 1000), updatedAt: '2026-11-09T23:00:00Z' },
    { ...ok('newgreen', 2000), updatedAt: '2026-11-09T22:00:00Z' },
  ], 'newgreen');
  assert.equal(newerGreen.hold, false);
  // a reverted commit's red verify does not cover this head
  assert.equal(mainVerifyHold([
    { headSha: 'reverted', status: 'completed', conclusion: 'failure', committedAt: 9000, covers: false },
    ok('main', 3000),
  ], 'main').hold, false);
  assert.equal(mainVerifyHold([{ headSha: 'abc', status: 'completed', conclusion: 'cancelled', covers: true, committedAt: 1 }], 'abc').hold, false);
  assert.equal(mainVerifyHold([], 'abc').hold, false);
  const src = readFileSync(new URL('./automerge.mjs', import.meta.url), 'utf8');
  assert.match(src, /mainVerifyHold\(runs, mainSha\)/, 'file tools/automerge.mjs reads Verse verify before it merges');
  assert.match(src, /verifyHold\.hold && \(choice\.action === 'merge' \|\| choice\.action === 'queue'\)/, 'file tools/automerge.mjs does not merge or queue a suite while main verify is red');
  assert.match(src, /rule: ' \+ verifyHold\.rule/);
  assert.match(src, /file: ' \+ verifyHold\.file/);
  assert.match(src, /fix: ' \+ verifyHold\.hint/);
});
