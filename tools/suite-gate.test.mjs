// The merge gate: no pull request lands unless the full suite passed on top of current main, and only one does.
import test from 'node:test';
import assert from 'node:assert/strict';
import { recordedMain, parseLog, codeUnchanged, mayMerge, failedHere, choose, chooseChecked, nextAfterMerge, nextBatch, batchOf, batchSize, squashOf, driftOk, fixJob, CHECK, BATCH, botRecord } from './suite-gate.mjs';

const MAIN = 'abc1234def567890abc1234def567890abc1234d';
const OLD = '1111111111111111111111111111111111111111';
const pass = (sha) => ({ name: CHECK, status: 'completed', conclusion: 'success', output: { title: 'main:' + sha } });
const fail = (sha) => ({ name: CHECK, status: 'completed', conclusion: 'failure', output: { title: 'main:' + sha } });
const row = (n, suite, drift) => ({ number: n, review: 'merge', suite, drift });

test('a green suite counts only for the main it merged, or when only incidents landed since', () => {
  assert.equal(recordedMain(pass(MAIN)), MAIN);
  assert.equal(recordedMain({ output: { title: 'something else' } }), '');
  assert.equal(mayMerge(row(1, pass(MAIN), null), MAIN), true);
  assert.equal(mayMerge(row(1, pass(OLD), null), MAIN), false, 'an older main with no drift record does not count');
  assert.equal(mayMerge(row(1, pass(OLD), [['void-live-deploy/incidents/entries/a.json']]), MAIN), true);
  assert.equal(mayMerge(row(1, pass(OLD), [['void.html']]), MAIN), false);
  assert.equal(mayMerge(row(1, fail(MAIN), []), MAIN), false);
  assert.equal(mayMerge(row(1, { name: CHECK, status: 'in_progress', conclusion: null, output: { title: 'main:' + MAIN } }, []), MAIN), false);
});

test('the log of commits since the tested main is one file list per commit', () => {
  const commits = parseLog('COMMIT\n\nvoid.html\n\nCOMMIT\n\nvoid-live-deploy/incidents/entries/x.json\n');
  assert.deepEqual(commits, [['void.html'], ['void-live-deploy/incidents/entries/x.json']]);
  assert.equal(codeUnchanged([['void-live-deploy/incidents/entries/x.json'], []]), true);
  assert.equal(codeUnchanged([['void.html']]), false);
  assert.equal(codeUnchanged(null), false);
});

test('merge the one whose suite is fresh, otherwise queue the oldest first', () => {
  const rows = [row(9, null, null), row(3, pass(MAIN), []), row(5, pass(OLD), [['skills/x.js']])];
  assert.equal(choose(rows, MAIN, false).pr.number, 3);
  assert.equal(choose(rows, MAIN, false).action, 'merge');
  const waiting = [row(4, null, null), row(8, null, null)];
  assert.equal(choose(waiting, MAIN, true).action, 'wait');
  assert.equal(choose(waiting, MAIN, true).pr.number, 4);
  const queued = choose(waiting, MAIN, false);
  assert.equal(queued.action, 'queue');
  assert.equal(queued.pr.number, 4, 'the oldest, and only that one');
  assert.equal(choose([row(2, fail(MAIN), [])], MAIN, false).action, 'hold', 'a failure on this main is not queued again');
  assert.equal(choose([{ number: 1, review: 'wait' }], MAIN, false).action, 'hold');
});

test('after a merge the oldest other ready pull request goes to the suite at once, not at the next hourly sweep', () => {
  const rows = [row(9, null, null), row(3, pass(MAIN), []), row(5, fail(MAIN), []), { number: 2, review: 'wait' }];
  assert.equal(nextAfterMerge(rows, rows[1]).number, 5, 'a failure on the old main is tried again on the new one');
  assert.equal(nextAfterMerge([row(3, pass(MAIN), [])], { number: 3 }), null, 'nothing else ready: nothing queued');
});

test('a revert files one heal job and does not skip the check', () => {
  const j = fixJob(MAIN, 'draw backdrop: removed.on stayed true');
  assert.equal(j.target, 'heal:suite-' + MAIN.slice(0, 7));
  assert.match(j.ask, /Do not skip a check/);
  assert.match(j.ask, /abc1234/);
  assert.equal(failedHere(row(1, fail(MAIN), []), MAIN), true);
  assert.equal(failedHere(row(1, fail(OLD), [['void.html']]), MAIN), false, 'main moved with code: try again');
});

// Batches (2026-11-06: one 25-minute suite run per pull request kept 30 waiting for half a day).
const inBatch = (check, nums) => ({ ...check, output: { ...check.output, summary: 'The full browser suite ...\nbatch: ' + nums.map((n) => '#' + n).join(' ') } });
const squash = (n, files) => Object.assign(files, { subject: 'Some change (#' + n + ')' });

test('one suite run takes up to BATCH ready pull requests, oldest first, and the check names them', () => {
  const rows = Array.from({ length: BATCH + 3 }, (_, i) => row(100 + i, null, null));
  const q = choose(rows, MAIN, false);
  assert.equal(q.action, 'queue');
  assert.equal(q.pr.number, 100);
  assert.deepEqual(q.batch.map((r) => r.number), Array.from({ length: BATCH }, (_, i) => 100 + i));
  assert.deepEqual(batchOf(inBatch(pass(MAIN), [4, 7, 9])), [4, 7, 9]);
  assert.deepEqual(batchOf(pass(MAIN)), [], 'a check from before batches names no batch');
  assert.equal(choose(rows, MAIN, true).action, 'wait', 'still one run at a time');
});

test('a green batch merges one after another: the squashes of its own batch do not make the others stale', () => {
  assert.equal(squashOf('Stall alarm and batches (#2343)'), 2343);
  assert.equal(squashOf('Merge branch main'), 0);
  const commits = parseLog('COMMIT Stall alarm (#4)\n\ntools/a.mjs\n\nCOMMIT Record (#77)\n\nvoid-live-deploy/incidents/entries/x.json\n');
  assert.equal(commits[0].subject, 'Stall alarm (#4)');
  assert.deepEqual([...commits[0]], ['tools/a.mjs']);
  assert.equal(driftOk(commits, [4, 7]), true, 'a batch mate and an incident record');
  assert.equal(driftOk(commits, [7]), false, 'a squash from outside the batch is real drift');
  assert.equal(driftOk([squash(4, ['x.js'])], []), false, 'no batch: only incidents are allowed, as before');
  const g = inBatch(pass(OLD), [4, 7, 9]);
  const rows = [row(4, inBatch(pass(MAIN), [4, 7, 9]), []), row(7, inBatch(pass(MAIN), [4, 7, 9]), []), row(9, inBatch(pass(MAIN), [4, 7, 9]), []), row(12, null, null)];
  const m = choose(rows, MAIN, false);
  assert.equal(m.action, 'merge');
  assert.deepEqual(m.batch.map((r) => r.number), [4, 7, 9], 'every pull request of the green run, in order');
  // after #4 landed, main moved by its squash only: #7 and #9 still merge
  assert.equal(mayMerge(row(7, g, [squash(4, ['tools/a.mjs'])]), MAIN), true);
  assert.equal(mayMerge(row(7, g, [squash(4, ['tools/a.mjs']), squash(55, ['void.html'])]), MAIN), false, 'another pull request landed in between');
  assert.deepEqual(nextBatch(rows, m.batch).map((r) => r.number), [12], 'then the next run starts on the new main');
});

test('a red batch is split in half until the red pull request runs alone, and only then is it held', () => {
  const red8 = inBatch(fail(MAIN), [1, 2, 3, 4, 5, 6, 7, 8]);
  const rows = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => row(n, red8, []));
  assert.equal(failedHere(rows[0], MAIN), false, 'a red batch holds no one pull request');
  assert.equal(batchSize(rows[0], MAIN), 4);
  assert.deepEqual(choose(rows, MAIN, false).batch.map((r) => r.number), [1, 2, 3, 4]);
  assert.equal(batchSize(row(1, inBatch(fail(MAIN), [1, 2]), []), MAIN), 1);
  const alone = row(1, inBatch(fail(MAIN), [1]), []);
  assert.equal(failedHere(alone, MAIN), true, 'red alone on this main: held until the head or main moves');
  const next = choose([alone, row(2, inBatch(fail(MAIN), [1, 2]), [])], MAIN, false);
  assert.equal(next.pr.number, 2);
  assert.equal(next.batch.length, 1, 'the half it was in, split again');
  assert.equal(batchSize(row(1, inBatch(fail(OLD), [1, 2, 3, 4, 5, 6, 7, 8]), [['void.html']]), MAIN), BATCH, 'main moved with code: a full batch again');
});

test('the safety-check runs on the batch the gate chose only, and a pull request that fails it leaves the batch', () => {
  const rows = [row(4, null, null), row(8, null, null), row(12, null, null)];
  const asked = [];
  const ok = chooseChecked(rows, MAIN, false, (r) => { asked.push(r.number); return true; });
  assert.equal(ok.choice.action, 'queue');
  assert.deepEqual(ok.choice.batch.map((r) => r.number), [4, 8, 12]);
  assert.deepEqual(asked, [4, 8, 12], 'each pull request in the batch is checked once');
  const many = Array.from({ length: 20 }, (_, i) => row(i + 1, null, null));
  const seen = [];
  chooseChecked(many, MAIN, false, (r) => { seen.push(r.number); return true; });
  assert.equal(seen.length, 8, 'only the batch, not every ready pull request');
  const asked2 = [];
  const bad = chooseChecked(rows, MAIN, false, (r) => { asked2.push(r.number); return r.number !== 8; });
  assert.deepEqual(bad.choice.batch.map((r) => r.number), [4, 12], 'the failing pull request is out of the batch');
  assert.deepEqual(bad.rows.map((r) => r.number), [4, 12]);
  assert.deepEqual(asked2, [4, 8, 12], 'a pull request that passed is not checked again');
});

test('a fresh green pull request that fails the safety-check is not merged; the gate chooses again', () => {
  const rows = [row(3, pass(MAIN), []), row(5, null, null)];
  const out = chooseChecked(rows, MAIN, false, (r) => r.number !== 3);
  assert.equal(out.choice.action, 'queue');
  assert.equal(out.choice.pr.number, 5);
  const none = chooseChecked(rows, MAIN, false, () => false);
  assert.equal(none.choice.action, 'hold');
  assert.equal(chooseChecked(rows, MAIN, true, () => true).choice.action, 'merge');
  let calls = 0;
  assert.equal(chooseChecked([row(4, null, null)], MAIN, true, () => { calls++; return true; }).choice.action, 'wait');
  assert.equal(calls, 0, 'nothing is checked while the gate only waits');
});

test('a green run merges past the records the bot writes straight to main, and past nothing else', () => {
  const log = 'COMMIT Tower gate: prizes measured against their live sites\nAUTHOR github-actions[bot]\n\nvoid-live-deploy/tower-evidence/prizes-27fdb497.json\nvoid-live-deploy/tower.evidence.json\nvoid-live-deploy/tower.shots/prizes.jpg\n\n'
    + 'COMMIT Site test: 12 checks\nAUTHOR github-actions[bot]\n\nvoid-live-deploy/tester-log.json\ntools/site-test.log.json\n';
  const recs = parseLog(log);
  assert.equal(recs[0].author, 'github-actions[bot]');
  assert.deepEqual([...recs[0]], ['void-live-deploy/tower-evidence/prizes-27fdb497.json', 'void-live-deploy/tower.evidence.json', 'void-live-deploy/tower.shots/prizes.jpg'], 'the author line is not a file');
  assert.equal(recs[1].subject, 'Site test: 12 checks');
  assert.equal(driftOk(recs, []), true, 'bot records only: the green run still counts');
  assert.equal(mayMerge(row(4, pass(OLD), recs), MAIN), true);
  const bot = (subject, files) => Object.assign([...files], { subject, author: 'github-actions[bot]' });
  assert.equal(botRecord(bot('Verse loop: nightly (#2312)', ['domains/x.md'])), false, 'a squash of a pull request is never a record');
  assert.equal(botRecord(bot('Versus by itself', ['void-live-deploy/assimilated.json', 'void-live-deploy/colour/index.html'])), false, 'a page is code');
  assert.equal(botRecord(bot('Upkeep', ['void-live-deploy/lib/clips.json'])), false, 'lib and skills feed the pages');
  assert.equal(botRecord(bot('Upkeep', ['.github/workflows/x.yml'])), false, 'a workflow is code');
  assert.equal(botRecord(bot('Deps', ['package-lock.json'])), false, 'dependencies are code');
  assert.equal(botRecord(bot('Empty', [])), false, 'a commit with no files says nothing');
  assert.equal(botRecord(Object.assign(['void-live-deploy/tester-log.json'], { subject: 'Site test', author: 'someone' })), false, 'only the record bot');
  assert.equal(botRecord(['void-live-deploy/tester-log.json']), false, 'no author line (an older log): not a record');
  assert.equal(driftOk([...recs, squash(55, ['void.html'])], [4]), false, 'a pull request from outside the batch is still real drift');
});
