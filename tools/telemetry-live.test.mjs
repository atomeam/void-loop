// The developer-log card checked against GitHub (lib/telemetry-live.js): what each named PR and commit really did, and main first.
import test from 'node:test';
import assert from 'node:assert/strict';
import { prLine, checksOf, checksLine, mainLine, liveLines, REPO } from '../void-live-deploy/lib/telemetry-live.js';

const run = (name, status, conclusion, started = '2026-10-19T04:00:00Z') => ({ name, status, conclusion, started_at: started });

test('a pull request reads merged, open or closed, with its title', () => {
  assert.match(prLine({ number: 1158, merged_at: '2026-10-19T04:10:10Z', state: 'closed', title: 'Verse Studio: four games' }).text, /^#1158 merged 2026-10-19 04:10 UTC: Verse Studio/);
  assert.equal(prLine({ number: 7, state: 'open', draft: false, title: 'x' }).text, '#7 open, waiting to merge: x');
  assert.equal(prLine({ number: 8, state: 'closed', merged_at: null, title: 'y' }).ok, false);
});
test('checks: the newest run of each name counts, failures are named, running ones are said', () => {
  const c = checksOf({ check_runs: [run('verify', 'completed', 'failure', '2026-10-19T03:00:00Z'), run('verify', 'completed', 'success', '2026-10-19T05:00:00Z'), run('deploy', 'completed', 'failure'), run('bench', 'in_progress', null)] });
  assert.equal(c.text, '1 passed · 1 failed (deploy) · 1 still running');
  assert.equal(checksLine('ecdfb6bb1234', { check_runs: [run('a', 'completed', 'success')] }).ok, true);
  assert.equal(checksOf({ check_runs: [] }).text, 'no checks reported');
});
test('main comes first, as its newest commit that ran checks (a bot record commit runs none); a PR or commit GitHub does not know says so; a refused call never throws', async () => {
  const replies = {
    '/commits?sha=main&per_page=12': [{ sha: 'fff0000aaa', commit: { message: 'Incident: the suite failed', committer: { date: '2026-10-19T05:52:00Z' } } }, { sha: 'abc1234def', commit: { message: 'Merge pull request #1162\n\nbody', committer: { date: '2026-10-19T05:40:00Z' } } }],
    '/commits/fff0000aaa/check-runs?per_page=100': { check_runs: [] },
    '/commits/abc1234def/check-runs?per_page=100': { check_runs: [run('Verse deploy', 'completed', 'success')] },
    '/pulls/1162': { number: 1162, merged_at: '2026-10-19T05:39:00Z', state: 'closed', title: 'Plans without an engine' },
  };
  const fake = async (u) => { const p = u.replace('https://api.github.com/repos/' + REPO, ''); return p in replies ? new Response(JSON.stringify(replies[p])) : new Response('{}', { status: 404 }); };
  const lines = await liveLines({ prs: ['1162', '99999'], shas: ['deadbeef1'] }, fake);
  assert.match(lines[0].text, /^main is at abc1234d \(2026-10-19 05:40 UTC, Merge pull request #1162\): 1 passed$/);
  assert.match(lines[1].text, /^The newest commit is Verse's own records \(1 incident note\)/);
  assert.match(lines[2].text, /^#1162 merged/);
  assert.equal(lines[3].text, '#99999: not a pull request in ' + REPO);
  assert.equal(lines[4].text, 'deadbeef: not a commit in ' + REPO);
  const limited = await liveLines({ prs: ['1'] }, async () => new Response('', { status: 403 }));
  assert.match(limited[0].text, /limiting calls/);
  const down = await liveLines({ prs: ['1'] }, async () => { throw new Error('offline'); });
  assert.match(down[0].text, /did not answer/);
});
test('a commit whose checks still run is marked neither passed nor failed', async () => {
  const { okOf } = await import('../void-live-deploy/lib/telemetry-live.js');
  assert.equal(okOf(checksOf({ check_runs: [run('a', 'completed', 'success'), run('b', 'in_progress', null)] })), null);
  assert.equal(okOf(checksOf({ check_runs: [run('a', 'completed', 'failure'), run('b', 'in_progress', null)] })), false);
  assert.equal(okOf(checksOf({ check_runs: [run('a', 'completed', 'success')] })), true);
});

test('a commit by Verse\'s own workflow with no deploy or suite says why, instead of a bare "no checks reported" (owner, 2026-10-19)', async () => {
  const { mainLine, botNote } = await import('../void-live-deploy/lib/telemetry-live.js');
  const bot = { sha: '69aca41300', author: { login: 'github-actions[bot]' }, commit: { message: 'Verse hardens itself: 8 benchmark ask(s)', committer: { date: '2026-10-19T18:51:00Z' }, author: { name: 'github-actions[bot]' } } };
  assert.match(mainLine(bot, { check_runs: [] }).text, /no checks reported \(a commit by Verse's own workflow: its push starts no check by itself/);
  assert.equal(botNote(bot, { check_runs: [{ name: 'deploy', status: 'completed', conclusion: 'success' }] }), '');
  assert.equal(botNote({ ...bot, author: { login: 'atomeam' }, commit: { ...bot.commit, author: { name: 'atomeam' } } }, { check_runs: [] }), '');
});

test('the reality card re-reads GitHub only while checks still run, at most 4 more times a minute apart (owner, 2026-10-19: "all cards should constantly update")', async () => {
  const { stillRunning, REFRESH_MS, REFRESH_MAX } = await import('../void-live-deploy/lib/telemetry-live.js');
  assert.equal(stillRunning([{ text: 'main is at bffbcd82 (…): 1 passed · 9 still running' }]), true);
  assert.equal(stillRunning([{ text: 'main is at bffbcd82 (…): 10 passed' }, { text: '#1176 merged' }]), false);
  assert.equal(stillRunning(null), false);
  assert.ok(REFRESH_MS >= 60000 && (REFRESH_MAX + 1) * 11 <= 60, 'the first read and every re-read stay within the 60 calls an hour GitHub gives a visitor');
});

test('main as it was on 2026-10-19 19:35: four record commits over a merge whose browser suite failed; the card names the merge and the failure', async () => {
  const c = (sha, message, date, login = 'github-actions[bot]') => ({ sha, author: { login }, commit: { message, committer: { date } } });
  const recent = [
    c('ff1d3548aa', 'Incident: the browser suite failed on bffbcd82 (void-live-deploy/incidents.json)', '2026-10-19T19:35:00Z'),
    c('e2f0a3f7aa', 'Verse hardens itself: 5 benchmark ask(s) for kept, four-channels', '2026-10-19T19:20:00Z'),
    c('f104fab9aa', 'Incident: the browser suite failed on bffbcd82 (void-live-deploy/incidents.json)', '2026-10-19T19:10:00Z'),
    c('c750cfd0aa', 'Incident: the browser suite failed on bffbcd82 (void-live-deploy/incidents.json)', '2026-10-19T18:50:00Z'),
    c('bffbcd82aa', 'Merge pull request #1176 from atomeam/helper/self-card-guard', '2026-10-19T18:00:00Z'),
  ];
  const calls = [];
  const replies = { '/commits?sha=main&per_page=12': recent, '/commits/bffbcd82aa/check-runs?per_page=100': { check_runs: [run('Verse deploy', 'completed', 'success'), run('browser suite', 'completed', 'failure')] } };
  const fake = async (u) => { const p = u.replace('https://api.github.com/repos/' + REPO, ''); calls.push(p); return p in replies ? new Response(JSON.stringify(replies[p])) : new Response('{}', { status: 404 }); };
  const lines = await liveLines({}, fake);
  assert.match(lines[0].text, /^main is at bffbcd82 \(2026-10-19 18:00 UTC, Merge pull request #1176 from atomeam\/helper\/self-card-guard\): 1 passed · 1 failed \(browser suite\) · the browser suite failed on it \(noted 3 times, last 2026-10-19 19:35 UTC\)$/);
  assert.equal(lines[0].ok, false);
  assert.equal(lines[1].text, "The 4 newest commits are Verse's own records (3 incident notes, 1 benchmark update): they run no checks, so main's state is the change below them");
  assert.deepEqual(calls, ['/commits?sha=main&per_page=12', '/commits/bffbcd82aa/check-runs?per_page=100'], 'records are read past without a call');
  // the suite's own check not reported yet: the incident note still marks it failed
  replies['/commits/bffbcd82aa/check-runs?per_page=100'] = { check_runs: [run('Verse deploy', 'completed', 'success')] };
  const again = await liveLines({}, fake);
  assert.equal(again[0].ok, false);
  assert.match(again[0].text, /1 passed · the browser suite failed on it \(noted 3 times/);
});
test('incident notes count only for the commit they name', async () => {
  const { incidentOf, isRecord } = await import('../void-live-deploy/lib/telemetry-live.js');
  const n = (m) => ({ commit: { message: m, committer: { date: '2026-10-19T01:00:00Z' } } });
  assert.equal(incidentOf([n('Incident: the browser suite failed on 3cab42c9 (x)')], 'bffbcd82aa'), null);
  assert.equal(incidentOf([n('Incident: the browser suite failed on bffbcd82 (x)')], 'bffbcd82aa').count, 1);
  assert.equal(isRecord(n('Merge pull request #1')), false);
  assert.equal(isRecord(n('reinvest: today\'s plan for Verse\'s money')), true);
});

// main as it was on 2026-10-30 15:48: its head still waited in a queue hours long, four heads below it had passed every shard, and the report
// named 2fbc0ee8, the 05:44Z head that failed shard 1 and was fixed long before. The card showed only "9 still running" and a ✗ on the old commit.
test('while main\'s head still runs, the newest finished suite says how main stands; a named commit older than main reads as a past result', async () => {
  const replies = {
    '/commits?sha=main&per_page=12': [{ sha: '69119ee0c0', commit: { message: 'Merge pull request #1967', committer: { date: '2026-10-30T15:45:00Z' } } }],
    '/commits/69119ee0c0/check-runs?per_page=100': { check_runs: [run('browser-suite (1)', 'queued', null), run('python-tests', 'queued', null)] },
    '/actions/workflows/verify.yml/runs?branch=main&status=completed&per_page=1': { workflow_runs: [{ id: 41065949248, head_sha: '1d67a5a1aa', conclusion: 'cancelled', updated_at: '2026-10-30T15:49:07Z' }] },
    '/actions/runs/41065949248/jobs?per_page=50': { jobs: ['python-tests', 'browser-suite (1)', 'browser-suite (2)', 'browser-suite (3)', 'browser-suite (4)'].map((n) => run(n, 'completed', 'success', '2026-10-30T15:18:00Z')).concat(run('incident', 'completed', 'cancelled', '2026-10-30T15:44:00Z')) },
    '/commits/2fbc0ee8/check-runs?per_page=100': { check_runs: [run('browser-suite (1)', 'completed', 'failure', '2026-10-30T05:46:00Z'), run('deploy', 'completed', 'success', '2026-10-30T05:45:00Z')] },
  };
  const fake = async (u) => { const p = u.replace('https://api.github.com/repos/' + REPO, ''); return p in replies ? new Response(JSON.stringify(replies[p])) : new Response('{}', { status: 404 }); };
  const lines = await liveLines({ prs: [], shas: ['2fbc0ee8'] }, fake);
  assert.match(lines[0].text, /^main is at 69119ee0 .*still running/);
  assert.equal(lines[1].text, 'the newest suite that finished on main ran on 1d67a5a1 (2026-10-30 15:49 UTC): 5 passed');
  assert.equal(lines[1].ok, true);
  assert.match(lines[2].text, /^2fbc0ee8: 1 passed · 1 failed \(browser-suite \(1\)\) · a past result: main has moved on since/);
  assert.equal(lines[2].ok, null);
  const { finishedLine } = await import('../void-live-deploy/lib/telemetry-live.js');
  assert.equal(finishedLine({ head_sha: 'aa', updated_at: 'x' }, { jobs: [run('browser-suite (1)', 'completed', 'skipped')] }), null, 'a run whose suite was skipped says nothing');
  const head = await liveLines({ shas: ['69119ee0'] }, fake);
  assert.ok(!/past result/.test(head[head.length - 1].text), 'main\'s own head is never a past result');
});
