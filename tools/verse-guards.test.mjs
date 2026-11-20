import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GUARDS, HOUSE_HOURS, guardsFor, recordOf, changed, blankGuard } from '../void-live-deploy/lib/verse-guards.js';
import { LOOPS } from '../void-live-deploy/lib/house-loops.js';
import { runGuards, revertOnBranch, editOnBranch } from './verse-guards.mjs';

const at = (p) => fileURLToPath(new URL(p, import.meta.url));

test('five guards ride the house lanes: the cards on four of them, the rest on every one', () => {
  assert.deepEqual(GUARDS.map((g) => g.id), ['leaks', 'cards', 'tower', 'deploy', 'home']);
  assert.deepEqual(HOUSE_HOURS, LOOPS.map((l) => l.hourUtc));
  assert.deepEqual(guardsFor(1).map((g) => g.id), ['leaks', 'tower', 'deploy', 'home']);
  assert.deepEqual(guardsFor(3).map((g) => g.id), ['leaks', 'cards', 'tower', 'deploy', 'home']);
  for (const g of GUARDS) for (const h of g.hours || []) assert.ok(HOUSE_HOURS.includes(h), g.id + ' rides an hour no lane runs');
});

test('every guard has its blank line on /progress/ and a row in the page', () => {
  const page = readFileSync(at('../void-live-deploy/progress/app.js'), 'utf8');
  for (const g of GUARDS) {
    assert.match(page, new RegExp("'" + g.id + "'"));
    assert.equal(JSON.parse(readFileSync(at('../void-live-deploy/progress/loops/' + g.id + '.json'), 'utf8')).id, g.id);
  }
});

test('a record keeps what it said, counts failures and pauses after three', () => {
  const g = GUARDS[0], now = Date.UTC(2026, 10, 20, 1);
  let rec = recordOf(g, blankGuard(g), { last: 'Nothing named.', ok: true, paidCents: 0 }, now);
  assert.equal(rec.status, 'Ran.');
  assert.equal(changed(rec, recordOf(g, rec, { last: 'Nothing named.', ok: true }, now)), false);
  for (let i = 0; i < 3; i++) rec = recordOf(g, rec, { ok: false, last: 'x' }, now);
  assert.equal(rec.state.fails, 3);
  const held = recordOf(g, rec, { ok: true, last: 'y' }, now + 1000);
  assert.match(held.status, /Paused until/);
  assert.equal(held.last, rec.last);
});

test('a guard that throws is one failed run, and a missing guard is skipped', async () => {
  const lines = [];
  const load = async (id) => (id === 'leaks' ? { run: async () => { throw new Error('boom'); } } : id === 'home' ? { run: async () => ({ last: 'Both are on the page.', ok: true }) } : null);
  const out = await runGuards(['leaks', 'home', 'cards'], { dry: true, load, log: (l) => lines.push(l) });
  assert.deepEqual(out.map((o) => [o.id, o.skipped ? 'skipped' : o.status]), [['leaks', 'Could not finish. It tries again at the next run.'], ['home', 'Ran.'], ['cards', 'skipped']]);
  assert.match(lines.join('\n'), /guard leaks threw: boom/);
});

test('the house lanes call the guards after their own job, fenced', () => {
  const src = readFileSync(at('./house-loops.mjs'), 'utf8');
  assert.match(src, /runRides\(lane/);
  assert.match(src, /catch \(e\) \{ console\.log\('guards: '/);
  assert.ok(readdirSync(at('../tools')).includes('guards'));
});

test('a revert goes on its own helper branch and is pushed only when it applies and the check passes', () => {
  const calls = [];
  const mk = (fail = {}) => (a) => { calls.push(a.join(' ')); const k = a.find((x) => ['revert', 'push', 'worktree'].includes(x)); return { status: fail[k] ? 1 : 0, stdout: k === undefined && a[0] === 'rev-list' ? 'c p' : a[0] === 'log' ? 'Landing: x' : '' }; };
  assert.deepEqual(revertOnBranch('abc12345', 'helper/home-back-abc12345', 'the heart was hidden', () => true, mk()), { pushed: true, branch: 'helper/home-back-abc12345' });
  assert.ok(calls.some((c) => /push -q origin HEAD:refs\/heads\/helper\/home-back-abc12345/.test(c)));
  assert.ok(calls.some((c) => /Verse-auto-revert: the heart was hidden/.test(c)));
  assert.match(revertOnBranch('abc12345', 'helper/x', 'w', () => true, mk({ revert: 1 })).why, /conflicts/);
  assert.match(revertOnBranch('abc12345', 'helper/x', 'w', () => false, mk()).why, /would not bring it back/);
  assert.equal(calls.filter((c) => /worktree remove/.test(c)).length >= 3, true);
});

test('an edit goes on its own helper branch: pushed when it changed something, never when it did not', () => {
  const calls = [];
  const run = (a) => { calls.push(a.join(' ')); return { status: 0, stdout: '', stderr: '' }; };
  assert.deepEqual(editOnBranch('helper/regen-1', 'Regenerate', () => true, run), { pushed: true, branch: 'helper/regen-1' });
  assert.ok(calls.some((c) => /commit -q -m Regenerate/.test(c)));
  assert.equal(editOnBranch('helper/regen-2', 'x', () => false, run).pushed, false);
  const refuse = (a) => ({ status: a.includes('push') ? 1 : 0, stdout: '', stderr: 'refusing to allow a token without workflow scope to update workflow' });
  assert.match(editOnBranch('helper/wf', 'x', () => true, refuse).why, /cannot change workflow files/);
});

test('a guard keeps its own memory in its record and gets a spawn to run a generator', async () => {
  const out = await runGuards(['deploy'], { dry: true, log: () => {}, load: async () => ({ run: async (ctx) => { assert.equal(typeof ctx.spawn, 'function'); assert.equal(typeof ctx.editOnBranch, 'function'); return { last: 'Looked.', ok: true, state: { handled: ['1'] } }; } }) });
  assert.equal(out[0].status, 'Ran.');
});
