// node --test tools/actions-failure.test.mjs: the GitHub Actions failure reader (asked by Verse: "Automate the extraction of failing job
// names and error logs from GitHub Actions for commit 814032d5."): the failed jobs of a run, the step that failed in each, the last 30
// lines of that step with keys masked (void-live-deploy/lib/actions-failure.js), the record per run (tools/actions-failure.mjs), the
// workflow that runs it on every red run of main (actions-failures.yml), and the incident autopsy's view of it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { failedJobs, failedStep, cleanLine, stepTail, stepLines, failLines, entryOf, parseActions, failuresFor, actionsHtml, TAIL } from '../void-live-deploy/lib/actions-failure.js';
import { readRun, readActions, writeEntry } from './actions-failure.mjs';
import skill, { actOf } from '../void-live-deploy/skills/incident-autopsy.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const T = (s) => '2026-11-01T02:' + s + 'Z ';

// the shape of run 41264790432's jobs (Verse verify on 814032d5): python-tests failed at step 4 and its "say which job went red" step 5 after it
const JOBS = { jobs: [
  { id: 11, name: 'python-tests', conclusion: 'failure', html_url: 'https://github.com/atomeam/void-loop/actions/runs/1/job/11', steps: [
    { number: 3, name: 'An automatic revert is not tested again', conclusion: 'success', started_at: '2026-11-01T02:20:45Z', completed_at: '2026-11-01T02:20:45Z' },
    { number: 5, name: 'Say which job went red', conclusion: 'failure', started_at: '2026-11-01T02:21:57Z', completed_at: '2026-11-01T02:21:57Z' },
    { number: 4, name: 'The fast tests', conclusion: 'failure', started_at: '2026-11-01T02:20:45Z', completed_at: '2026-11-01T02:21:57Z' }] },
  { id: 12, name: 'browser-suite (4)', conclusion: 'success', steps: [] },
  { id: 13, name: 'browser-suite (1)', conclusion: 'failure', steps: [{ number: 4, name: 'Test what shipped', conclusion: 'failure', started_at: '2026-11-01T02:20:50Z', completed_at: '2026-11-01T02:40:00Z' }] },
  { id: 14, name: 'incident', conclusion: 'skipped', steps: [] }] };

// a log where step 3 shares step 4's first second and step 5 shares its last, the way the runner writes them
const LOG = ['﻿' + T('20:45.10') + '##[group]Run if git log -1 --format=%B | grep -q x; then', T('20:45.20') + '##[endgroup]',
  T('20:46.00') + '##[group]Run node --test tools/verse-loop.test.mjs', T('20:46.01') + '\u001b[36;1mnode --test tools/verse-loop.test.mjs\u001b[0m',
  ...Array.from({ length: 40 }, (_, k) => T('21:' + String(10 + (k % 40)).padStart(2, '0') + '.5') + 'ok ' + (k + 1) + ' - test ' + (k + 1)),
  T('21:56.00') + 'not ok 41 - negative controls', T('21:56.10') + 'Authorization: Bearer abcdefghijklmnopqrstuvwx0123456789', // secret-scan: ok (made up)
  T('21:57.05') + '# fail 1', T('21:57.06') + '##[error]Process completed with exit code 1.', T('21:57.07') + '##[end-action id=fast;outcome=failure]',
  T('21:57.10') + '##[group]Run echo "::error title=python-tests failed::a fast test failed"', T('21:57.12') + '##[error]a fast test failed on 814032d5',
  T('21:57.13') + '##[error]Process completed with exit code 1.'].join('\n');

test('the failed jobs of a run: failed or timed out only, each with its first failed step by number', () => {
  const f = failedJobs(JOBS);
  assert.deepEqual(f.map((j) => j.name), ['python-tests', 'browser-suite (1)']);
  assert.equal(f[0].step.number, 4, 'step 5 failed only because step 4 did');
  assert.equal(f[0].url, 'https://github.com/atomeam/void-loop/actions/runs/1/job/11');
  assert.equal(failedStep({ steps: [{ number: 1, conclusion: 'success' }] }), null);
  assert.deepEqual(failedJobs(null), []);
});

test('the last 30 lines of the failing step: its own window, ending at its exit code, no stamps, colours or bookkeeping, a token masked', () => {
  const step = failedStep(JOBS.jobs[0]), tail = stepTail(LOG, step);
  assert.equal(tail.length, TAIL);
  assert.equal(tail.at(-1), 'Error: Process completed with exit code 1.');
  assert.ok(tail.includes('not ok 41 - negative controls'));
  assert.ok(!tail.some((l) => /fast test failed on|end-action|^\d{4}-\d\d-\d\dT/.test(l)), 'step 5, runner bookkeeping and timestamps are left out');
  assert.ok(tail.some((l) => /Bearer \[redacted\]/.test(l)) && !tail.some((l) => /abcdefghijklmnop/.test(l)), 'the token is masked');
  assert.equal(stepTail(LOG, step, 5).length, 5);
  assert.equal(cleanLine(T('20:46.01') + '\u001b[36;1mnode x\u001b[0m'), 'node x');
  assert.equal(cleanLine('##[group]Run node x'), 'Run node x');
  // no step times: the whole log is the window, still ending at the first exit code
  assert.equal(stepLines(LOG, null).at(-1).raw.endsWith('Process completed with exit code 1.'), true);
});

test('what failed, by name: the not ok and FAIL lines of the step, an annotation that repeats one left out', () => {
  assert.deepEqual(failLines(LOG, failedStep(JOBS.jobs[0])), ['not ok 41 - negative controls']);
  const suite = [T('30:00.0') + 'pass a', T('30:01.0') + 'FAIL the book: opens  -> {"x":1}', T('30:02.0') + '##[error]the book: opens', T('30:03.0') + '##[error]4', T('30:04.0') + '##[error]Process completed with exit code 1.'].join('\n');
  assert.deepEqual(failLines(suite, { started_at: '2026-11-01T02:30:00Z', completed_at: '2026-11-01T02:30:04Z' }), ['FAIL the book: opens  -> {"x":1}']);
});

test('one record per run: workflow, commit, failed jobs with step, what failed and tail; a refused log is said, never worked around', () => {
  const run = { id: 41264790432, head_sha: '814032d54f2e3892c8035403fd148ff3f5183d2e', name: 'Verse verify', event: 'workflow_dispatch', head_branch: 'main', conclusion: 'failure', updated_at: '2026-11-01T02:40:00Z', html_url: 'https://github.com/atomeam/void-loop/actions/runs/41264790432' };
  const e = entryOf(run, JOBS, { 11: LOG, 13: { error: 'HTTP 410: Gone' } });
  assert.equal(e.sha, run.head_sha);
  assert.equal(e.jobs.length, 2);
  assert.equal(e.jobs[0].tail.length, TAIL);
  assert.deepEqual(e.jobs[0].fails, ['not ok 41 - negative controls']);
  assert.deepEqual(e.jobs[1].tail, []);
  assert.match(e.jobs[1].note, /log not read: HTTP 410/);
  assert.equal(entryOf({ ...run, html_url: 'javascript:alert(1)' }, JOBS).run, '');
});

test('readRun reads the run, its jobs and only the failed jobs\' logs, through the given getter', () => {
  const asked = [];
  const get = (p) => { asked.push(p); if (/\/logs$/.test(p)) return p.includes('/jobs/11/') ? LOG : { error: 'HTTP 403' }; if (/\/jobs\?/.test(p)) return JSON.stringify(JOBS); return JSON.stringify({ id: 7, head_sha: 'abcdef1234567', name: 'Verse verify', updated_at: '2026-11-01T02:40:00Z' }); };
  const e = readRun(7, get);
  assert.deepEqual(asked.filter((p) => /\/logs$/.test(p)).map((p) => p.split('/').at(-2)), ['11', '13']);
  assert.equal(e.jobs[0].tail.length, TAIL);
  assert.match(e.jobs[1].note, /HTTP 403/);
  assert.equal(readRun('7; rm -rf /', get), null);
  assert.equal(readRun(8, () => JSON.stringify({ jobs: [{ id: 1, name: 'ok', conclusion: 'success' }] })), null, 'no failed job, no record');
});

test('the store: one file per run, read back newest first; the commit and job filters keep every job name of the run', () => {
  const dir = mkdtempSync(join(tmpdir(), 'actfail-'));
  writeEntry({ at: '2026-11-01T02:40:00Z', sha: 'aaaaaaa1111', runId: 1, workflow: 'Verse verify', jobs: [{ name: 'python-tests', tail: ['x'] }, { name: 'browser-suite (1)', tail: [] }] }, dir);
  writeEntry({ at: '2026-11-02T02:40:00Z', sha: 'bbbbbbb2222', runId: 2, workflow: 'Verse deploy', jobs: [{ name: 'test-and-deploy', tail: [] }] }, dir);
  writeFileSync(join(dir, 'torn.json'), '{');
  const all = readActions(dir);
  assert.deepEqual(all.map((a) => a.runId), [2, 1]);
  const one = failuresFor(all, { sha: 'aaaaaaa', job: 'browser-suite' });
  assert.deepEqual(one[0].jobs.map((j) => j.name), ['browser-suite (1)']);
  assert.deepEqual(one[0].names, ['python-tests', 'browser-suite (1)']);
  assert.deepEqual(failuresFor(all, { sha: 'ccccccc' }), []);
});

test('the markup: escaped, the tail open when one job is asked for, and a plain line when nothing is recorded', () => {
  const list = { actions: [{ at: '2026-11-01T02:40:00Z', sha: 'abcdef1234', runId: 3, workflow: 'Verse <verify>', jobs: [{ name: 'python-tests', step: { number: 4, name: 'The fast tests' }, fails: ['not ok 1 - <x>'], tail: ['<b>boom</b>'] }] }] };
  const h = actionsHtml(list, undefined, { sha: 'abcdef1', job: 'python-tests' });
  assert.ok(h.includes('&lt;b&gt;boom') && !h.includes('<b>boom') && h.includes('Verse &lt;verify&gt;') && h.includes('<details open>') && h.includes('data-fail-lines="1"'));
  assert.ok(actionsHtml(list, undefined, { sha: '0000000' }).includes('No failed job recorded for commit 0000000'));
  assert.deepEqual(parseActions({ actions: [{ sha: 'zz', jobs: [], at: 'x' }] }), []);
});

test('the incident autopsy answers the failed-jobs asks, word for word, and reads the commit and the job from them', () => {
  for (const a of ['Automate the extraction of failing job names and error logs from GitHub Actions for commit 814032d5.', 'Open the GitHub Actions tab for commit 814032d5, identify the four specific failed job names, and extract the last 30 lines of the failing step within python-tests.', 'failed jobs for commit 814032d5'])
    assert.ok(skill.match(a.toLowerCase(), a), a);
  assert.deepEqual(actOf('Open the GitHub Actions tab for commit 814032d5, identify the four specific failed job names, and extract the last 30 lines of the failing step within python-tests.'), { sha: '814032d5', job: 'python-tests' });
  assert.deepEqual(actOf('the failing step within browser-suite (2)'), { sha: '', job: 'browser-suite (2)' });
  for (const a of ['my failed jobs', 'what is github actions', 'show the commit 814032d5']) assert.ok(!skill.match(a.toLowerCase(), a), a);
});

test('commit 814032d5: the record read from GitHub names its four failed jobs, and python-tests\' last 30 lines end at the failing step\'s exit code', () => {
  const e = JSON.parse(readFileSync(join(root, 'void-live-deploy/incidents/actions/41264790432.json'), 'utf8'));
  assert.ok(e.sha.startsWith('814032d5'));
  assert.deepEqual(e.jobs.map((j) => j.name).sort(), ['browser-suite (1)', 'browser-suite (2)', 'browser-suite (3)', 'python-tests']);
  const py = e.jobs.find((j) => j.name === 'python-tests');
  assert.equal(py.step.number, 4);
  assert.equal(py.tail.length, 30);
  assert.equal(py.tail.at(-1), 'Error: Process completed with exit code 1.');
  assert.ok(py.fails.some((l) => /^not ok 10 - negative controls/.test(l)));
});

test('actions-failures.yml: runs on every red run of the workflows that test main, by name, with actions: read and its inputs only through env', () => {
  const y = readFileSync(join(root, '.github/workflows/actions-failures.yml'), 'utf8');
  const names = new Set(readdirSync(join(root, '.github/workflows')).filter((f) => /\.ya?ml$/.test(f)).map((f) => (/^name:\s*(.+)$/m.exec(readFileSync(join(root, '.github/workflows', f), 'utf8')) || [])[1]).filter(Boolean).map((n) => n.trim().replace(/^["']|["']$/g, '')));
  const listed = /workflows:\s*\[([^\]]+)\]/.exec(y)[1].split(',').map((x) => x.trim());
  for (const n of listed) assert.ok(names.has(n), 'no workflow is named ' + n);
  assert.ok(listed.includes('Verse verify') && listed.includes('Verse deploy') && !listed.includes('Actions failure reader'));
  assert.match(y, /actions: read/);
  assert.match(y, /branches: \[main\]/);
  const run = y.slice(y.indexOf('run: |'));
  assert.ok(!/\$\{\{/.test(run), 'no expression is pasted into the script');
  assert.match(y, /git add void-live-deploy\/incidents\/actions/);
});
