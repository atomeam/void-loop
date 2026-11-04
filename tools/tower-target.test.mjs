// The fight in progress stays the target until it is beaten. Run: node --test tools/tower-target.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tower, FLOORS, passingRows } from '../void-live-deploy/lib/tower.js';
import { nextTarget } from './tower-target.mjs';

test('a locked target stays first while a lighter site appears, and the next smallest takes over once it is beaten', () => {
  const rank = { ranks: {}, order: {}, list: {} }, size = { sites: { 'random.org': { bytes: 700, scripts: 0, nodes: 20, routes: 0 }, 'justflipacoin.com': { bytes: 2e6, scripts: 20, nodes: 5000, routes: 50 } } };
  const t0 = tower([], {}, null, null, rank, size, null);
  assert.equal(t0.floors.find((f) => f.state === 'current').id, 'random number', 'the lightest is first with no lock');
  const t1 = tower([], {}, null, null, rank, size, 'coin flip');
  assert.equal(t1.floors.find((f) => f.state === 'current').id, 'coin flip', 'the locked site stays the target although a lighter one exists');
  const f = FLOORS.find((x) => x.id === 'coin flip'), t2 = tower([], { 'coin flip': passingRows(f) }, null, null, rank, size, 'coin flip');
  assert.equal(t2.floors.find((x) => x.id === 'coin flip').beaten, true);
  assert.equal(t2.floors.find((x) => x.state === 'current').id, 'random number', 'beaten: the next smallest takes over');
  assert.equal(nextTarget({ lock: 'coin flip', floors: t0.floors }), 'coin flip'); assert.equal(nextTarget({ lock: 'coin flip', floors: t2.floors }), 'random number');
  assert.equal(nextTarget({ lock: null, floors: t0.floors }), 'random number');
});

test('no target holds the Tower more than HOLD_DAYS (1 day), progress or not, and the file says why (owner, 2026-11-03)', async () => {
  const { stallCheck, HOLD_DAYS } = await import('./tower-target.mjs');
  assert.equal(HOLD_DAYS, 1);
  const floors = [{ id: 'a', n: 2, m: 12 }];
  const st = stallCheck({ id: 'a', n: 2, since: '2026-11-02' }, floors, '2026-11-03');
  assert.equal(st.stalled, true); assert.match(st.why, /held the Tower since 2026-11-02 .* at 2 of 12 aspects ahead/);
  assert.equal(stallCheck({ id: 'a', n: 1, since: '2026-11-02' }, floors, '2026-11-03').stalled, true, 'a gained aspect does not buy more time');
  assert.equal(stallCheck({ id: 'a', n: 2, since: '2026-11-03' }, floors, '2026-11-03').stalled, false, 'the same day: it keeps the Tower');
});

// the two levels: PASSED moves on (all measured ahead or equal, none behind, the bar met, better on one), CONQUERED is 12 of 12
const row = (verdict) => ({ verdict, evidence: 'gate', verse: 1, best: 2 });
const rowsFor = (f, over = {}) => ({ speed: row('better'), mobile: row('equal-and-better'), accessibility: row('better'), accuracy: row('equal-and-better'), reliability: row('equal-and-better'), ...over });

test('a target that leads on everything measured and meets the bar is PASSED, and the next site takes over in the same run', async () => {
  const { advance } = await import('./tower-target.mjs');
  const rank = { ranks: {}, order: {}, list: {} }, size = { sites: { 'random.org': { bytes: 700, scripts: 0, nodes: 20, routes: 0 }, 'justflipacoin.com': { bytes: 2e6, scripts: 20, nodes: 5000, routes: 50 } } };
  const f = FLOORS.find((x) => x.id === 'coin flip'), t = tower([], { 'coin flip': rowsFor(f) }, null, null, rank, size, 'coin flip');
  const c = t.floors.find((x) => x.id === 'coin flip');
  assert.equal(c.beaten, false, 'not conquered: aspects are still open'); assert.equal(c.cleared, true, 'passed'); assert.equal(c.state, 'passed');
  assert.notEqual(t.floors.find((x) => x.state === 'current').id, 'coin flip', 'the Tower moved on');
  const { file, why } = advance({ id: 'coin flip', since: '2026-11-03' }, t.floors, '2026-11-03');
  assert.match(why, /^passed coin flip \(\d+\/\d+, conquering in background\)$/);
  assert.notEqual(file.id, 'coin flip'); assert.equal(file.passed[0].id, 'coin flip');
  assert.ok(file.background.length > 0 && file.background.every((b) => b.id === 'coin flip' && b.job), 'its open aspects are queued in the background');
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
