import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { diagnose, freshRuns, withoutCheck, run, healTarget } from './guards/deploy.mjs';

const inc = (over = {}, fails = [], step = 'The live domain serves this deploy') => ({ at: '2026-11-20T00:40:00Z', runId: 44650000001, workflow: 'Verse deploy', branch: 'main', conclusion: 'failure', jobs: [{ name: 'test-and-deploy', step: { name: step }, fails, tail: [] }], ...over });
const NOW = Date.parse('2026-11-20T02:00:00Z');

test('a stale inventory is a regenerate; an owner-only file in the live check is a workflow line; anything else is a heal', () => {
  const a = diagnose(inc({}, ['FAIL parity   # the inventories and timelines are current', 'AssertionError: parity: out of date, run node tools/parity.mjs --write:']));
  assert.deepEqual(a.fix, { kind: 'regen', id: 'parity' });
  const b = diagnose(inc({}, ['::error::a-to-mind.com/tower.size.json is not serving this deploy (9019fd75): the production domain is behind']));
  assert.deepEqual(b.fix, { kind: 'workflow-line', path: '/tower.size.json' });
  assert.match(b.cause, /answers only the owner/);
  const c = diagnose(inc({}, ['::error::a-to-mind.com/skills/index.json is not serving this deploy (x)']));
  assert.equal(c.fix.kind, 'heal');
  assert.equal(diagnose(inc({}, ['FAIL nothing known'], 'Quick checks')).fix.kind, 'heal');
});
test('only the unhandled red runs on main from the last day count', () => {
  const list = [inc(), inc({ runId: 2, at: '2026-11-18T00:00:00Z' }), inc({ runId: 3, branch: 'helper/x' }), inc({ runId: 4, workflow: 'Verse verify' }), inc({ runId: 5, conclusion: 'success' }), inc({ runId: 6 })];
  assert.deepEqual(freshRuns(list, ['6'], NOW).map((i) => i.runId), [44650000001]);
});
test('the owner-only check line goes and nothing else', () => {
  const yml = ['          check /skills/index.json void-live-deploy/skills/index.json || ok=1', '          check /tower.size.json void-live-deploy/tower.size.json || ok=1', '          echo done'].join('\n');
  assert.equal(withoutCheck(yml, '/tower.size.json'), ['          check /skills/index.json void-live-deploy/skills/index.json || ok=1', '          echo done'].join('\n'));
  assert.equal(withoutCheck(yml, '/nope'), yml);
  assert.equal(healTarget(44650000001), 'heal:deploy-50000001');
});

function repoWith(...incs) {
  const root = mkdtempSync(join(tmpdir(), 'dg-')), d = join(root, 'void-live-deploy/incidents/actions');
  mkdirSync(d, { recursive: true });
  incs.forEach((i) => writeFileSync(join(d, i.runId + '.json'), JSON.stringify(i)));
  return root;
}
test('a stale inventory is regenerated on a helper branch, once; the run is then remembered', async () => {
  const root = repoWith(inc({}, ['AssertionError: parity: out of date, run node tools/parity.mjs --write:']));
  const pushed = [], jobs = [];
  const ctx = { root, now: NOW, dry: false, prev: {}, queueJob: async (a, t) => { jobs.push(t); return { queued: true, why: '' }; }, spawn: () => ({ status: 0, stdout: ' M docs/PARITY/x.md' }), editOnBranch: (b, m, edit) => { pushed.push([b, m, edit('/tmp', null)]); return { pushed: true, branch: b }; } };
  const r = await run(ctx);
  assert.match(r.last, /parity.*Regenerated it on helper\/regen-parity-/);
  assert.equal(pushed.length, 1); assert.equal(pushed[0][2], true);
  assert.deepEqual(r.state.handled, ['44650000001']);
  const again = await run({ ...ctx, prev: { state: { handled: r.state.handled } } });
  assert.match(again.last, /No main deploy or live check has failed/);
  assert.equal(pushed.length, 1);
});
test('a workflow change the token may not push is handed to the coder with the exact line', async () => {
  const root = repoWith(inc({}, ['::error::a-to-mind.com/tower.target.json is not serving this deploy (x)']));
  const jobs = [];
  const r = await run({ root, now: NOW, prev: {}, queueJob: async (a, t) => { jobs.push([t, a]); return { queued: true, why: '' }; }, editOnBranch: () => ({ pushed: false, why: 'the push to helper/x was refused (the token cannot change workflow files)' }), spawn: () => ({}) });
  assert.match(r.last, /answers only the owner/);
  assert.match(r.last, /Handed it to the coder \(queued\)/);
  assert.match(jobs[0][1], /tower\.target\.json/);
});
test('an unknown failure is a heal job with the step and the first error line', async () => {
  const root = repoWith(inc({}, ['FAIL something new'], 'Quick checks'));
  const jobs = [];
  const r = await run({ root, now: NOW, prev: {}, queueJob: async (a, t) => { jobs.push(a); return { queued: true, why: '' }; }, editOnBranch: () => ({}), spawn: () => ({}) });
  assert.match(jobs[0], /"Quick checks": FAIL something new/);
  assert.match(r.last, /a failed step: Quick checks/);
});

test('the deploy check can ask whether a path is owner-only', async () => {
  const { spawnSync } = await import('node:child_process');
  const ask = (p) => spawnSync('node', [new URL('./owner-only.mjs', import.meta.url).pathname, p]).status;
  assert.equal(ask('/tower.size.json'), 0);
  assert.equal(ask('/history/x.json'), 0);
  assert.equal(ask('/skills/index.json'), 1);
  assert.equal(spawnSync('node', [new URL('./owner-only.mjs', import.meta.url).pathname]).status, 1);
});
