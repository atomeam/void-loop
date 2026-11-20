// The floor Verse is on stays the floor until it is assimilated (docs/TOWER-RULES.md). Run: node --test tools/tower-target.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tower, FLOORS, passingRows } from '../void-live-deploy/lib/tower.js';
import { nextTarget } from './tower-target.mjs';

// docs/TOWER-RULES.md: the climb is closest first, and the floor Verse is on stays until every aspect is verified
test('a locked floor stays first while a closer site appears, and the next closest takes over once it is assimilated', () => {
  const rf = FLOORS.find((x) => x.id === 'random number'), near = { 'random number': rowsFor(rf) };
  const t0 = tower([], near, null);
  assert.equal(t0.floors.find((f) => f.state === 'current').id, 'random number', 'the closest is first with no lock');
  const t1 = tower([], near, null, null, null, null, 'coin flip');
  assert.equal(t1.floors.find((f) => f.state === 'current').id, 'coin flip', 'the locked floor stays the floor although a closer one exists');
  const f = FLOORS.find((x) => x.id === 'coin flip'), t2 = tower([], { ...near, 'coin flip': passingRows(f) }, null, null, null, null, 'coin flip');
  assert.equal(t2.floors.find((x) => x.id === 'coin flip').beaten, true);
  assert.equal(t2.floors.find((x) => x.state === 'current').id, 'random number', 'assimilated: the next closest takes over');
  assert.equal(nextTarget({ lock: 'coin flip', floors: t0.floors }), 'coin flip'); assert.equal(nextTarget({ lock: 'coin flip', floors: t2.floors }), 'random number');
  assert.equal(nextTarget({ lock: null, floors: t0.floors }), 'random number');
});

test('a floor with no progress for STALL_DAYS gives way: its gaps go to the build queue, it rests, and the next closest takes over (owner, 2026-11-19)', async () => {
  const { stallCheck, advance, STALL_DAYS, REST_DAYS } = await import('./tower-target.mjs');
  assert.ok(STALL_DAYS >= 1 && STALL_DAYS < 30); assert.ok(REST_DAYS > STALL_DAYS);
  const floors = [{ id: 'a', n: 2, m: 12, assim: 40, open: ['speed'], left: ['speed'], lost: [], missingFeatures: ['All airlines'], page: '/a/' }, { id: 'b', n: 11, m: 12, assim: 30 }];
  const fresh = advance({ id: 'a', n: 2, assim: 40, since: '2026-11-08', progressAt: '2026-11-08' }, floors, '2026-11-09').file;
  assert.equal(fresh.id, 'a', 'one quiet day: it stays');
  const st = stallCheck({ id: 'a', n: 2, assim: 40, since: '2026-10-01', progressAt: '2026-10-01' }, floors, '2026-11-09');
  assert.equal(st.stalled, true);
  const { file, why } = advance({ id: 'a', n: 2, assim: 40, since: '2026-10-01', progressAt: '2026-10-01' }, floors, '2026-11-09');
  assert.equal(file.id, 'b', 'the climb moves on'); assert.match(why, /no progress/);
  assert.ok(file.background.some((r) => r.id === 'a' && r.aspect === 'feature: All airlines' && /^build: /.test(r.job)), 'its crawl gaps are queued');
  assert.ok(file.background.some((r) => r.id === 'a' && r.aspect === 'speed'), 'its open checks are queued');
  const again = advance(file, floors, '2026-11-10').file; assert.equal(again.id, 'b', 'it rests and is not picked straight back');
  const progress = stallCheck({ id: 'a', n: 2, assim: 35, since: '2026-10-01', progressAt: '2026-10-01' }, floors, '2026-11-09');
  assert.equal(progress.stalled, false, 'getting closer is progress');
});

// the two levels: PASSED moves on (all measured ahead or equal, none behind, the bar met, better on one), CONQUERED is 12 of 12
const row = (verdict) => ({ verdict, evidence: 'gate', verse: 1, best: 2 });
const rowsFor = (f, over = {}) => ({ speed: row('better'), mobile: row('equal-and-better'), accessibility: row('better'), accuracy: row('equal-and-better'), reliability: row('equal-and-better'), ...over });

test('a floor that leads on everything measured but still has open aspects is not assimilated and stays; one verified on every aspect is', async () => {
  const { advance } = await import('./tower-target.mjs');
  const f = FLOORS.find((x) => x.id === 'coin flip'), t = tower([], { 'coin flip': rowsFor(f) }, null, null, null, null, 'coin flip', []);
  const c = t.floors.find((x) => x.id === 'coin flip');
  assert.equal(c.beaten, false, 'aspects are still open');
  const kept = advance({ id: 'coin flip', since: '2026-11-03', assimilated: [] }, t.floors, '2026-11-03').file;
  assert.equal(kept.id, 'coin flip', 'it stays the floor'); assert.equal(kept.assimilated.length, 0, 'never an unverified win');
  const t2 = tower([], { 'coin flip': passingRows(f) }, null, null, null, null, 'coin flip', []);
  const { file, why } = advance({ id: 'coin flip', since: '2026-11-03', assimilated: [] }, t2.floors, '2026-11-03');
  assert.match(why, /^assimilated coin flip/); assert.notEqual(file.id, 'coin flip'); assert.equal(file.assimilated[0].id, 'coin flip');
});

test('the bar is not lowered: no accuracy measured, or behind on one aspect, or never better, is not PASSED', () => {
  const f = FLOORS.find((x) => x.id === 'coin flip'), at = (ev) => tower([], { 'coin flip': ev }, null).floors.find((x) => x.id === 'coin flip');
  const { accuracy, ...noAcc } = rowsFor(f);
  assert.equal(at(noAcc).cleared, false, 'a correct answer on its main job is part of the bar');
  assert.equal(at(rowsFor(f, { offline: row('worse') })).cleared, false, 'behind on one: not passed');
  const tie = Object.fromEntries(Object.entries(rowsFor(f)).map(([k, v]) => [k, { ...v, verdict: 'equal-and-better' }]));
  assert.equal(at(tie).cleared, false, 'better on at least one thing');
});

test('a passed site never moves back: a later loss shows as a fix, and it stays off the queue', () => {
  const f = FLOORS.find((x) => x.id === 'coin flip'), t = tower([], { 'coin flip': rowsFor(f, { offline: row('worse') }) }, null, null, null, null, null, ['coin flip']);
  const c = t.floors.find((x) => x.id === 'coin flip');
  assert.equal(c.state, 'passed'); assert.ok(c.behind.includes('offline'), 'the loss is named as the fix to make');
});
