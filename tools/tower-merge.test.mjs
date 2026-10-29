// tools/tower-merge.mjs: the sweep's slices (every floor in exactly one) and the fold of slice files into tower.evidence.json
import test from 'node:test';
import assert from 'node:assert/strict';
import { shard, parseShard, merge, selfCalled } from './tower-merge.mjs';
import { FLOORS } from '../void-live-deploy/lib/tower.js';

test('every floor lands in exactly one slice, the slices are even to within one, and a bad i/N is refused', () => {
  const ids = FLOORS.map((f) => f.id);
  for (const n of [1, 2, 6, 7, ids.length, ids.length + 5]) {
    const slices = Array.from({ length: n }, (_, k) => shard(ids, k + 1, n)), seen = slices.flat();
    assert.deepEqual([...seen].sort(), [...ids].sort(), 'N=' + n + ': every floor once');
    assert.equal(seen.length, new Set(seen).size, 'N=' + n + ': no floor twice');
    const sizes = slices.map((s) => s.length); assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, 'N=' + n + ': even slices ' + sizes.join());
  }
  assert.deepEqual(shard(['a', 'b', 'c', 'd', 'e'], 2, 2), ['b', 'd']);
  for (const bad of [[0, 6], [7, 6], [1, 0], ['x', 6]]) assert.throws(() => shard(ids, ...bad), /want i\/N/);
  assert.deepEqual(parseShard('2/6'), { i: 2, n: 6 }); assert.equal(parseShard('all'), null); assert.equal(parseShard(''), null);
});

test('a merge puts a newer slice row over an older one, never the other way, keeps what no slice measured, and drops self-called rows', () => {
  const row = (at, verdict = 'better', more = {}) => ({ verdict, verse: 1, best: 2, evidence: 'x', at, ...more });
  const base = { note: 'n', floors: {
    calculator: { speed: row('2026-10-25T00:00:00Z', 'worse'), mobile: row('2026-10-25T00:00:00Z'), accuracy: row('2026-10-25T00:00:00Z', 'better', { called: true, evidence: 'called beaten by verse on 2026-10-20' }) },
    wheel: { speed: row('2026-10-25T06:00:00Z', 'better') },
  } };
  const frozen = JSON.stringify(base);
  const slices = [
    { shard: '1/2', floors: { calculator: { speed: row('2026-10-25T06:30:00Z', 'better'), sharing: row('2026-10-25T06:30:00Z') } } },
    { shard: '2/2', floors: { wheel: { speed: row('2026-10-25T05:00:00Z', 'worse') }, 'coin flip': { speed: row('2026-10-25T06:40:00Z') } } },
  ];
  const { data, taken } = merge(base, slices);
  assert.equal(JSON.stringify(base), frozen, 'the inputs are not changed');
  assert.equal(data.note, 'n');
  assert.equal(data.floors.calculator.speed.verdict, 'better', 'the newer slice row replaces the older base row');
  assert.equal(data.floors.calculator.mobile.verdict, 'better', 'a row no slice measured stays');
  assert.equal(data.floors.calculator.sharing.at, '2026-10-25T06:30:00Z', 'a new aspect is added');
  assert.equal(data.floors.wheel.speed.verdict, 'better', 'a fight run that committed after the slice measured keeps its newer row');
  assert.equal(data.floors['coin flip'].speed.at, '2026-10-25T06:40:00Z', 'a floor the base lacks is added whole');
  assert.equal(data.floors.calculator.accuracy, undefined, 'a row the old gate called by itself is dropped');
  assert.deepEqual(taken.sort(), ['calculator / sharing', 'calculator / speed', 'coin flip / speed']);
  // a row with no date is older than any dated one, and a same-dated row (the same measurement seen twice) is taken
  const again = merge({ floors: { a: { speed: row(undefined) } } }, [{ floors: { a: { speed: row('2026-10-25T00:00:00Z') } } }, { floors: { a: { speed: row('2026-10-25T00:00:00Z', 'equal') } } }]);
  assert.equal(again.data.floors.a.speed.verdict, 'equal');
  assert.ok(selfCalled({ called: true, evidence: 'called beaten by verse' }) && !selfCalled({ evidence: 'called beaten by verse' }) && !selfCalled(null));
  assert.deepEqual(merge({}, []).data, { floors: {} });
});
