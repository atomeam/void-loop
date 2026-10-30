import test from 'node:test';
import assert from 'node:assert/strict';
import { takeOf, putOf } from './gate-land.mjs';

test('a run takes only the floors it measured, with the icons', () => {
  const ev = { note: 'n', floors: { a: { speed: { verdict: 'better', at: '2026-10-25T10:00:00Z' } }, b: { speed: { verdict: 'worse', at: '2026-10-25T10:00:00Z' } } }, icons: { 'a.com': 'tower.icons/a.com.png' } };
  const t = takeOf(ev, ['a', 'zzz']); assert.deepEqual(Object.keys(t.floors), ['a']); assert.deepEqual(t.icons, ev.icons);
});

test('putting a run back keeps what other runs landed meanwhile and never an older row over a newer one', () => {
  const base = { note: 'n', floors: {
    other: { speed: { verdict: 'better', at: '2026-10-25T10:05:00Z' } },                       // landed by another run
    same: { speed: { verdict: 'better', at: '2026-10-25T10:09:00Z' }, mobile: { verdict: 'better', at: '2026-10-25T10:01:00Z' } } }, icons: { 'o.com': 'tower.icons/o.com.png' } };
  const mine = { floors: {
    mine: { speed: { verdict: 'better', at: '2026-10-25T10:06:00Z' } },
    same: { speed: { verdict: 'worse', at: '2026-10-25T10:02:00Z' }, mobile: { verdict: 'equal', at: '2026-10-25T10:07:00Z' } } }, icons: { 'm.com': 'tower.icons/m.com.png' } };
  const out = putOf(base, mine);
  assert.ok(out.floors.other && out.floors.mine, 'both runs stay');
  assert.equal(out.floors.same.speed.verdict, 'better', 'the newer row wins');
  assert.equal(out.floors.same.mobile.verdict, 'equal', 'my newer aspect lands');
  assert.deepEqual(Object.keys(out.icons).sort(), ['m.com', 'o.com']); assert.equal(base.floors.same.mobile.verdict, 'better', 'the input is not changed');
});
