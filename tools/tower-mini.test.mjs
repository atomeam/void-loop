// the 3D tower's layout (skills/mini/tower.js layout, pure): floor heights that fit, which floors carry a name, what is cut
import test from 'node:test';
import assert from 'node:assert/strict';
import { layout, MAX_LABELS, AHEAD_SHOWN, FLOOR_H, MIN_FLOOR_H, TOWER_H, GAP, BASE_H } from '../void-live-deploy/skills/mini/tower.js';
import { tower, FLOORS, aspectsOf, passingRows } from '../void-live-deploy/lib/tower.js';
import { miniFloors } from '../void-live-deploy/skills/tower.js';

const fake = (beaten, ahead = 4) => [...Array.from({ length: beaten }, (_, i) => ({ id: 'b' + i, site: 'site' + i + '.example', state: 'beaten', n: 11, m: 11, page: '/p' + i + '/' })),
  { id: 'cur', site: 'now.example', state: 'current', n: 4, m: 11, page: '/now/' }, ...Array.from({ length: ahead }, (_, i) => ({ id: 'a' + i, site: 'ahead' + i + '.example', state: 'ahead', n: 0, m: 9 }))];

test('a few floors stand at full height, bottom first; the current one and every surpassed one carry a name', () => {
  const L = layout(fake(3, 2));
  assert.equal(L.floors, 6); assert.equal(L.floorH, FLOOR_H); assert.equal(L.current, 3); assert.equal(L.cut, 0);
  assert.equal(L.labelled, 4); assert.deepEqual(L.drawn.map((f) => f.labelled), [true, true, true, true, false, false]);
  assert.ok(L.drawn[0].y < L.drawn[1].y && L.drawn[0].y > BASE_H, 'the first conquest sits just above the base'); assert.equal(L.drawn[0].state, 'beaten'); assert.equal(L.drawn[0].page, '/p0/');
});
test('20+ floors still read: the height scales to fit, labels stop at the last 12 surpassed plus the current one, and the base says how many are cut', () => {
  const L = layout(fake(20, 4));
  assert.equal(L.floors, 25); assert.equal(L.current, 20); assert.equal(L.drawn.length, 21 + AHEAD_SHOWN, 'the queue has no end: only the next few are drawn');
  assert.ok(L.floorH < FLOOR_H && L.floorH >= MIN_FLOOR_H); assert.ok(L.height <= TOWER_H + BASE_H + GAP * 30 + 1e-9, 'the tower fits the frame');
  assert.equal(L.labelled, MAX_LABELS + 1); assert.equal(L.cut, 8);
  const named = L.drawn.filter((f) => f.labelled).map((f) => f.id); assert.deepEqual(named, [...Array.from({ length: 12 }, (_, i) => 'b' + (8 + i)), 'cur']);
  assert.ok(L.drawn.filter((f) => f.state === 'ahead').every((f) => !f.labelled));
});
test('no current floor (everything surpassed) and bad data are handled', () => {
  const L = layout(fake(2, 0).slice(0, 2)); assert.equal(L.current, -1); assert.equal(L.drawn.length, 2); assert.equal(L.labelled, 2);
  const E = layout(null); assert.equal(E.floors, 0); assert.equal(E.drawn.length, 0); assert.equal(E.labelled, 0); assert.equal(E.cut, 0);
  const W = layout([{ site: 'x'.repeat(200), state: 'weird', page: 7 }]); assert.equal(W.drawn[0].state, 'beaten'); assert.equal(W.drawn[0].site.length, 48); assert.equal(W.drawn[0].page, '');
});
test('the card hands the miniature the real tower: ids, states, n of m and the page without its query', () => {
  const ev = Object.fromEntries(FLOORS.slice(0, 3).map((f) => [f.id, passingRows(f)]));
  const m = miniFloors(tower([], ev));
  assert.equal(m.filter((f) => f.state === 'beaten').length, 3); assert.equal(m.filter((f) => f.state === 'current').length, 1); assert.equal(m[3].state, 'current');
  assert.ok(m.every((f) => typeof f.id === 'string' && typeof f.site === 'string' && Number.isFinite(f.n) && Number.isFinite(f.m)));
  const rn = m.find((f) => f.id === 'random number'); assert.equal(rn.page, '/random/');
  assert.deepEqual(Object.keys(m[0]).sort(), ['id', 'm', 'n', 'page', 'site', 'state']);
});
