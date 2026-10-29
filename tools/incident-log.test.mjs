// node --test tools/incident-log.test.mjs: a red browser suite becomes one incident entry (tools/incident-log.mjs), and the
// incident skill answers "what broke lately" from the list (skills/incident.js latelyOf, incidentsHtml).
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFails, incidentOf, addIncident, touchedBy } from './incident-log.mjs';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { latelyOf, incidentsHtml } from '../void-live-deploy/skills/incident.js';

const OUT = ['pass films page: anyone watches', 'FAIL monopoly: "play monopoly" stands the board  -> {"ready":true}', 'slow 11 s before: x',
  'FAIL 3D countdown: a leaf flips  -> {"drawn":false}', 'FAIL monopoly: "play monopoly" stands the board  -> again', '562/565 passed'].join('\n');

test('incident-log: the failed checks are read from the suite output, each once; a clean run is no incident', () => {
  assert.deepEqual(parseFails(OUT), ['monopoly: "play monopoly" stands the board', '3D countdown: a leaf flips']);
  assert.deepEqual(parseFails('565/565 passed\n'), []);
  assert.equal(incidentOf({ sha: 'abc', run: 'https://github.com/atomeam/void-loop/actions/runs/1', output: 'all passed' }), null);
  const inc = incidentOf({ sha: 'f382286b2f866bc1daf3f1d1ef1149eb27238871', run: 'https://github.com/atomeam/void-loop/actions/runs/1', output: OUT, at: '2026-10-15T12:20:00Z' });
  assert.equal(inc.checks.length, 2); assert.equal(inc.suite, 'browser suite on main'); assert.equal(inc.run, 'https://github.com/atomeam/void-loop/actions/runs/1');
  assert.equal(incidentOf({ sha: 'a', run: 'javascript:alert(1)', output: OUT }).run, '', 'only a GitHub link is kept');
});

test('incident-log: newest first, the same commit once, the list capped', () => {
  const a = { at: '1', sha: 'aaa', checks: ['x'] }, b = { at: '2', sha: 'bbb', checks: ['y'] };
  assert.deepEqual(addIncident([a], b).map((x) => x.sha), ['bbb', 'aaa']);
  assert.deepEqual(addIncident([b, a], { ...b, at: '3' }).map((x) => x.at), ['3', '1']);
  assert.equal(addIncident(Array.from({ length: 40 }, (_, i) => ({ sha: 's' + i, checks: [] })), { sha: 'new', checks: [] }).length, 30);
});

test('incident-log: a second record for the same commit (another shard) adds its checks, never drops the first ones', () => {
  const one = addIncident([], { at: '1', sha: 'ccc', checks: ['shard 1 check'] });
  const two = addIncident(one, { at: '2', sha: 'ccc', checks: ['shard 3 check', 'shard 1 check'] });
  assert.equal(two.length, 1); assert.deepEqual(two[0].checks, ['shard 1 check', 'shard 3 check']);
});

test('incident skill: "what broke lately" asks open the list; the brief asks and ordinary words do not', () => {
  for (const t of ['what broke lately', 'what broke', 'recent incidents', 'incidents', 'void incidents', 'what failed on main', 'what went wrong lately', 'incident log']) assert.ok(latelyOf(t), t);
  for (const t of ['write an incident brief', 'incident report for the login outage', 'postmortem template', 'what broke my car', 'is void working', 'what is an incident']) assert.ok(!latelyOf(t), t);
  const h = incidentsHtml((s) => String(s), [{ at: '2026-10-15T12:20:00Z', sha: 'f382286b2f86', run: 'https://github.com/atomeam/void-loop/actions/runs/1', suite: 'browser suite on main', checks: ['monopoly: Roll moves the pawn', 'countdown'] }]);
  assert.match(h, /monopoly: Roll moves the pawn/); assert.match(h, /f382286/); assert.match(h, /actions\/runs\/1/); assert.match(h, /data-ask="incident brief: monopoly: Roll moves the pawn"/);
  assert.match(incidentsHtml((s) => String(s), []), /Nothing has broken/);
});

test('touchedBy lists the paths one commit changed, and nothing for a bad sha (asked by Verse)', () => {
  const d = mkdtempSync(join(tmpdir(), 'inc-')), git = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: d, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  git('init', '-q'); mkdirSync(join(d, 'void-live-deploy/skills'), { recursive: true });
  writeFileSync(join(d, 'a.txt'), '1'); git('add', '.'); git('commit', '-qm', 'one');
  writeFileSync(join(d, 'void-live-deploy/skills/clock.js'), 'x'); writeFileSync(join(d, 'a.txt'), '2'); git('add', '.'); git('commit', '-qm', 'two');
  const sha = git('rev-parse', 'HEAD').trim();
  assert.deepEqual(touchedBy(sha, d).sort(), ['a.txt', 'void-live-deploy/skills/clock.js']);
  assert.deepEqual(touchedBy('nonsense; rm -rf', d), []); assert.deepEqual(touchedBy('0'.repeat(40), d), []);
  assert.deepEqual(incidentOf({ sha, output: 'FAIL x', touched: ['a.txt'] }).touched, ['a.txt']); assert.deepEqual(incidentOf({ sha, output: 'FAIL x' }).touched, []);
});

test('a green suite closes the open incidents: closedAt, closedBy, minutes; a closed one and a later one are left alone', async () => {
  const { closeOpen, openCount } = await import('./incident-log.mjs');
  const open = { at: '2026-10-18T12:00:00Z', sha: 'aaa', checks: ['x'] }, done = { at: '2026-10-17T12:00:00Z', sha: 'bbb', checks: ['y'], closedAt: '2026-10-17T12:30:00Z', closedBy: 'ccc', minutes: 30 }, later = { at: '2026-10-18T14:00:00Z', sha: 'ddd', checks: ['z'] };
  const out = closeOpen([later, open, done], { sha: 'f'.repeat(40), run: 'https://github.com/atomeam/void-loop/actions/runs/9', at: '2026-10-18T12:25:00Z' });
  assert.deepEqual([out[1].closedAt, out[1].closedBy === 'f'.repeat(40), out[1].minutes], ['2026-10-18T12:25:00Z', true, 25]);
  assert.equal(out[0].closedAt, undefined, 'an incident that began after the green run stays open');
  assert.deepEqual(out[2], done, 'a closed incident is not touched');
  assert.equal(openCount([later, open, done]), 2); assert.equal(openCount(out), 1);
  assert.equal(closeOpen([open], { sha: 'x', run: 'javascript:1', at: '2026-10-18T13:00:00Z' })[0].closedRun, '');
  assert.deepEqual(closeOpen(null, {}), []);
});

test('the incident page says fixed after N min, or still open', () => {
  const h = incidentsHtml((s) => String(s), [{ at: '2026-10-18T12:00:00Z', sha: 'aaaaaaaa', checks: ['x'], closedAt: '2026-10-18T12:25:00Z', closedBy: 'fffffff0', minutes: 25 }, { at: '2026-10-18T14:00:00Z', sha: 'bbbbbbbb', checks: ['y'] }]);
  assert.match(h, /fixed after 25 min by fffffff/); assert.match(h, /not marked fixed yet/);
});

test('a shard that passes on a later commit closes what it fixed: the shards are kept, each failed shard must pass again, and an old entry waits for all four', async () => {
  const { passShards, shardsOf, incidentOf, addIncident, openCount } = await import('./incident-log.mjs');
  assert.deepEqual(shardsOf('4, 2,2,9,x'), [2, 4]); assert.deepEqual(shardsOf([3, '1']), [1, 3]); assert.deepEqual(shardsOf(null), []);
  const red = incidentOf({ sha: 'a'.repeat(40), output: 'FAIL x', at: '2026-10-29T10:00:00Z', shards: '4,2' });
  assert.deepEqual(red.shards, [2, 4]); assert.equal('shards' in incidentOf({ sha: 'a'.repeat(40), output: 'FAIL x' }), false, 'no shards given, none written');
  assert.deepEqual(addIncident([red], { ...red, checks: ['y'], shards: [1] })[0].shards, [1, 2, 4], 'a second record for the commit adds its shards');
  const old = { at: '2026-10-29T09:00:00Z', sha: 'b'.repeat(40), checks: ['z'] }, later = { at: '2026-10-29T12:00:00Z', sha: 'c'.repeat(40), checks: ['w'], shards: [2] };
  const earlier = (s) => s !== 'c'.repeat(40); // c is not an earlier commit of the commit that passed
  const run = 'https://github.com/atomeam/void-loop/actions/runs/7', sha = 'd'.repeat(40);
  let list = passShards([later, red, old], { sha, run, at: '2026-10-29T11:00:00Z', shards: '2', isEarlier: earlier });
  assert.deepEqual([list[1].passed, list[1].closedAt], [[2], undefined], 'one of its two shards passed: still open');
  assert.equal(list[0], later, 'a commit that is not earlier is left alone'); assert.deepEqual(list[2].passed, [2], 'an entry with no shards waits for all four');
  list = passShards(list, { sha, run, at: '2026-10-29T11:30:00Z', shards: [4, 1], isEarlier: earlier });
  assert.deepEqual([list[1].closedAt, list[1].closedBy, list[1].closedRun, list[1].minutes], ['2026-10-29T11:30:00Z', sha, run, 90]);
  assert.equal(list[2].closedAt, undefined); assert.deepEqual(list[2].passed, [1, 2, 4]);
  list = passShards(list, { sha, run, at: '2026-10-29T11:40:00Z', shards: [3], isEarlier: earlier });
  assert.equal(list[2].closedAt, '2026-10-29T11:40:00Z', 'all four passed: closed'); assert.equal(openCount(list), 1);
  assert.deepEqual(passShards([red], { sha: red.sha, shards: [2, 4], isEarlier: () => true }), [red], 'the red commit itself never closes its own incident');
  assert.deepEqual(passShards([red], { sha, shards: [2, 4], isEarlier: () => false }), [red], 'nor does a commit on another history');
  const closed = list[1]; assert.equal(passShards([closed], { sha, shards: [1, 2, 3, 4], isEarlier: () => true })[0], closed, 'a closed one is left as it was');
});

test('isAncestor reads the git history and never throws', async () => {
  const { isAncestor } = await import('./incident-log.mjs');
  const d = mkdtempSync(join(tmpdir(), 'anc-')), git = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: d, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  git('init', '-q'); writeFileSync(join(d, 'a'), '1'); git('add', '.'); git('commit', '-qm', 'one'); const one = git('rev-parse', 'HEAD').trim();
  writeFileSync(join(d, 'a'), '2'); git('commit', '-qam', 'two'); const two = git('rev-parse', 'HEAD').trim();
  assert.equal(isAncestor(one, two, d), true); assert.equal(isAncestor(two, one, d), false);
  assert.equal(isAncestor('x; rm -rf /', two, d), false); assert.equal(isAncestor('0'.repeat(40), two, d), false);
});
