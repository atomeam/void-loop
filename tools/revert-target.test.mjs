// verify-main reverts the commit that broke the failing check, not whichever commit it happened to test (tools/revert-target.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { failingChecks, annotations, namesFrom, pickRevert, verifiedState, stillLive, stillRed, pickLive, TITLE, COUNT_TITLE } from './revert-target.mjs';

const RACK = 'rack: "what games do you have" stands a 3D shelf';

test('reads the failed checks from the suite output', () => {
  const out = 'pass a\nFAIL ' + RACK + '  -> {"boxes":["chess"]}\npass b\nFAIL voice: mic  -> {}\nFAIL voice: mic  -> {}\n418/420 passed';
  assert.deepEqual(failingChecks(out), [RACK, 'voice: mic']);
  assert.deepEqual(failingChecks('pass a\n1/1 passed'), []);
});

test('annotations round-trip, and a long list is marked incomplete', () => {
  const lines = annotations([RACK, '50% off\nline two']);
  assert.equal(lines[0], '::error title=' + TITLE + '::' + RACK);
  assert.equal(lines[1], '::error title=' + TITLE + '::50%25 off%0Aline two');
  assert.equal(lines[2], '::error title=' + COUNT_TITLE + '::2');
  const back = (ls) => ls.map((l) => { const m = /^::error title=([^:]+)::(.*)$/.exec(l); return { title: m[1], message: decodeURIComponent(m[2]) }; });
  assert.deepEqual(namesFrom(back(annotations([RACK]))), { names: [RACK], complete: true });
  const twelve = Array.from({ length: 12 }, (_, i) => 'check ' + i);
  assert.equal(namesFrom(back(annotations(twelve))).complete, false); // only 9 fit: not a complete record
  assert.equal(namesFrom([]).complete, false); // an old run with no record
});

test('2026-10-09: the rack broke at #215; the red run on #217 reverts #215, not #217', () => {
  const pick = pickRevert({ tested: 'm217', failing: [RACK], history: [
    { sha: 'm216', state: 'unknown', failing: null }, // its run was superseded
    { sha: 'm215', state: 'fail', failing: [RACK] },
    { sha: 'm214', state: 'pass', failing: [] },
  ] });
  assert.equal(pick.action, 'revert');
  assert.equal(pick.sha, 'm215');
});

test('a check that goes red right after a pass blames the tested commit', () => {
  const pick = pickRevert({ tested: 't', failing: [RACK], history: [{ sha: 'p', state: 'pass', failing: [] }] });
  assert.deepEqual([pick.action, pick.sha], ['revert', 't']);
});

test('a new failure at the tested commit reverts it even while an older one is still red', () => {
  const pick = pickRevert({ tested: 't', failing: [RACK, 'new check'], history: [{ sha: 'r', state: 'fail', failing: [RACK] }, { sha: 'p', state: 'pass', failing: [] }] });
  assert.deepEqual([pick.action, pick.sha], ['revert', 't']);
});

test('unclear records report instead of reverting the wrong commit', () => {
  // red before, names not recorded (an old run): could be the same check, so do not blame the tested commit
  assert.equal(pickRevert({ tested: 't', failing: [RACK], history: [{ sha: 'old', state: 'fail', failing: null }] }).action, 'report');
  // unverified commits between the last pass and the tested one: any of them may have broken it
  const many = pickRevert({ tested: 't', failing: [RACK], history: [{ sha: 'u', state: 'unknown', failing: null }, { sha: 'p', state: 'pass', failing: [] }] });
  assert.equal(many.action, 'report');
  assert.match(many.why, /t, u/);
  // two checks that went red at different earlier commits
  const split = pickRevert({ tested: 't', failing: ['a', 'b'], history: [{ sha: 'x', state: 'fail', failing: ['a', 'b'] }, { sha: 'y', state: 'fail', failing: ['a'] }, { sha: 'p', state: 'pass', failing: [] }] });
  assert.equal(split.action, 'report');
  // no verified commit at all
  assert.equal(pickRevert({ tested: 't', failing: [RACK], history: [] }).action, 'report');
});

test('a failure outside the named checks: blamed only when the commit before passed', () => {
  assert.deepEqual(pickRevert({ tested: 't', failing: [], history: [{ sha: 'p', state: 'pass', failing: [] }] }).sha, 't');
  assert.equal(pickRevert({ tested: 't', failing: [], history: [{ sha: 'r', state: 'fail', failing: [RACK] }] }).sha, 't'); // red before, but for another reason
  assert.equal(pickRevert({ tested: 't', failing: [], history: [{ sha: 'r', state: 'fail', failing: [] }, { sha: 'p', state: 'pass', failing: [] }] }).sha, 'r');
});

test('what verify-main found on a commit, from its deploy runs', () => {
  const api = (path) => {
    if (path.includes('head_sha=red')) return { workflow_runs: [{ id: 1, name: 'Void deploy', event: 'push' }, { id: 9, name: 'Void deploy', event: 'pull_request' }] };
    if (path.includes('head_sha=green')) return { workflow_runs: [{ id: 2, name: 'Void deploy', event: 'workflow_dispatch' }] };
    if (path.includes('head_sha=gone')) return { workflow_runs: [{ id: 3, name: 'Void deploy', event: 'push' }] };
    if (path.endsWith('runs/1/jobs')) return { jobs: [{ id: 11, name: 'test-and-deploy', status: 'completed', conclusion: 'success' }, { id: 12, name: 'verify-main', status: 'completed', conclusion: 'failure' }] };
    if (path.endsWith('runs/2/jobs')) return { jobs: [{ id: 21, name: 'verify-main', status: 'completed', conclusion: 'success' }] };
    if (path.endsWith('runs/3/jobs')) return { jobs: [{ id: 31, name: 'verify-main', status: 'completed', conclusion: 'cancelled' }] };
    if (path.includes('check-runs/12/annotations')) return [{ title: TITLE, message: RACK }, { title: COUNT_TITLE, message: '1' }, { title: 'other', message: 'x' }];
    throw new Error('unexpected ' + path);
  };
  const body = () => 'Merge pull request #1';
  assert.deepEqual(verifiedState('red', 'o/r', api, body), { sha: 'red', state: 'fail', failing: [RACK] });
  assert.deepEqual(verifiedState('green', 'o/r', api, body), { sha: 'green', state: 'pass', failing: [] });
  assert.equal(verifiedState('gone', 'o/r', api, body).state, 'unknown');
  assert.equal(verifiedState('green', 'o/r', api, () => 'Revert "x"\n\nVoid-auto-revert: abc').state, 'unknown'); // never re-tested
});

// Every merge has its own verify run (deploy.yml, 2026-10-10), so two red suites can finish together: a revert is taken
// only while its target is still live on main and its failed checks are still red on main's newest verified head.
test('a target that left main\'s first-parent line, or was already reverted by another run, is not reverted again', () => {
  const bodies = { h: 'Merge #5', r: 'Revert "x"\n\nVoid-auto-revert: m215', m216: 'Merge #216', m215: 'Merge #215', m214: 'Merge #214' };
  const body = (s) => bodies[s] || '';
  assert.deepEqual(stillLive('m215', ['h', 'm216', 'm215', 'm214'], body), { live: true });
  assert.equal(stillLive('m215', ['h', 'r', 'm216', 'm215', 'm214'], body).live, false);
  assert.match(stillLive('m215', ['h', 'r', 'm216', 'm215', 'm214'], body).why, /already reverted on main \(r\)/);
  assert.match(stillLive('gone', ['h', 'm216'], body).why, /not on main's first-parent line/);
  assert.equal(stillLive('m215abcdef', ['h', 'r2', 'm215abcdef'], (s) => (s === 'r2' ? 'Void-auto-revert: m215abc' : '')).live, false, 'a short sha in the trailer still matches');
});

test('a check that main\'s newest verified head no longer fails is not reverted for', () => {
  assert.deepEqual(stillRed([RACK], null), { red: true }); // nothing newer verified: the tested run stands
  assert.deepEqual(stillRed([RACK], { sha: 'n', state: 'unknown', failing: null }), { red: true });
  assert.equal(stillRed([RACK], { sha: 'newhead', state: 'pass', failing: [] }).red, false);
  assert.match(stillRed([RACK], { sha: 'newhead', state: 'pass', failing: [] }).why, /newhead passed the suite/);
  assert.deepEqual(stillRed([RACK], { sha: 'n', state: 'fail', failing: [RACK, 'other'] }), { red: true });
  assert.equal(stillRed([RACK], { sha: 'n', state: 'fail', failing: ['other'] }).red, false);
  assert.deepEqual(stillRed([RACK], { sha: 'n', state: 'fail', failing: null }), { red: true }); // red, names unknown
  assert.deepEqual(stillRed([], { sha: 'n', state: 'fail', failing: [] }), { red: true }); // outside the named checks, still so
  assert.equal(stillRed([], { sha: 'n', state: 'fail', failing: [RACK] }).red, false);
});

test('pickLive: the pick stands only while the target is live and the check is still red on main', () => {
  const history = [{ sha: 'p', state: 'pass', failing: [] }];
  const api = (path) => {
    if (path.includes('head_sha=t')) return { workflow_runs: [{ id: 1, name: 'Void deploy', event: 'push' }] };
    if (path.includes('head_sha=green')) return { workflow_runs: [{ id: 2, name: 'Void deploy', event: 'push' }] };
    if (path.includes('head_sha=')) return { workflow_runs: [] };
    if (path.endsWith('runs/1/jobs')) return { jobs: [{ id: 12, name: 'verify-main', status: 'completed', conclusion: 'failure' }] };
    if (path.endsWith('runs/2/jobs')) return { jobs: [{ id: 21, name: 'verify-main', status: 'completed', conclusion: 'success' }] };
    if (path.includes('check-runs/12/annotations')) return [{ title: TITLE, message: RACK }, { title: COUNT_TITLE, message: '1' }];
    throw new Error('unexpected ' + path);
  };
  const body = (s) => (s === 'rev' ? 'Revert\n\nVoid-auto-revert: t' : 'Merge');
  // the tested commit is main's head and its own red run is the newest word: revert
  assert.deepEqual([pickLive({ tested: 't', failing: [RACK], history, mainLine: ['t', 'p'], body, repo: 'o/r', api }).action], ['revert']);
  // another suite already reverted it: report
  assert.match(pickLive({ tested: 't', failing: [RACK], history, mainLine: ['rev', 't', 'p'], body, repo: 'o/r', api }).why, /already reverted/);
  // a newer head passed the suite (someone fixed it forward): report
  const r = pickLive({ tested: 't', failing: [RACK], history, mainLine: ['green', 't', 'p'], body, repo: 'o/r', api });
  assert.equal(r.action, 'report'); assert.match(r.why, /green passed the suite/);
  // a newer head with no finished suite yet: the tested run's word stands
  assert.equal(pickLive({ tested: 't', failing: [RACK], history, mainLine: ['newer', 't', 'p'], body, repo: 'o/r', api }).action, 'revert');
});
