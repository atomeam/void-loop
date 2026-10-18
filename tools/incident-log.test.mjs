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
