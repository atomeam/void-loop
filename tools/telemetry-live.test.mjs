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
    '/commits?sha=main&per_page=6': [{ sha: 'fff0000aaa', commit: { message: 'Incident: the suite failed', committer: { date: '2026-10-19T05:52:00Z' } } }, { sha: 'abc1234def', commit: { message: 'Merge pull request #1162\n\nbody', committer: { date: '2026-10-19T05:40:00Z' } } }],
    '/commits/fff0000aaa/check-runs?per_page=100': { check_runs: [] },
    '/commits/abc1234def/check-runs?per_page=100': { check_runs: [run('Verse deploy', 'completed', 'success')] },
    '/pulls/1162': { number: 1162, merged_at: '2026-10-19T05:39:00Z', state: 'closed', title: 'Plans without an engine' },
  };
  const fake = async (u) => { const p = u.replace('https://api.github.com/repos/' + REPO, ''); return p in replies ? new Response(JSON.stringify(replies[p])) : new Response('{}', { status: 404 }); };
  const lines = await liveLines({ prs: ['1162', '99999'], shas: ['deadbeef1'] }, fake);
  assert.match(lines[0].text, /^main is at abc1234d \(2026-10-19 05:40 UTC, Merge pull request #1162\): 1 passed$/);
  assert.match(lines[1].text, /^#1162 merged/);
  assert.equal(lines[2].text, '#99999: not a pull request in ' + REPO);
  assert.equal(lines[3].text, 'deadbeef: not a commit in ' + REPO);
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
