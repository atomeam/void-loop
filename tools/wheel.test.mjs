// lib/wheel.js: entries, weights, the fair pick, the spin that lands on it, the link and the asks
import test from 'node:test';
import assert from 'node:assert/strict';
import { entriesOf, textOf, slices, pickIndex, plan, under, ease, shuffle, sorted, pack, open, askWheel, fairRandom } from '../void-live-deploy/lib/wheel.js';

test('entries: lines or commas, blanks dropped, weights written *3 or x3', () => {
  assert.deepEqual(entriesOf('Alice\n\n Bob \nCarol'), [{ label: 'Alice', weight: 1 }, { label: 'Bob', weight: 1 }, { label: 'Carol', weight: 1 }]);
  assert.deepEqual(entriesOf('pizza, tacos *3, sushi x2'), [{ label: 'pizza', weight: 1 }, { label: 'tacos', weight: 3 }, { label: 'sushi', weight: 2 }]);
  assert.deepEqual(entriesOf('Max\nRoom 101'), [{ label: 'Max', weight: 1 }, { label: 'Room 101', weight: 1 }], 'a name ending in x or a number is not a weight');
  assert.equal(entriesOf('a*999')[0].weight, 100); assert.equal(textOf(entriesOf('a*3\nb')), 'a *3\nb');
});
test('slices are sized by weight and cover the circle', () => {
  const s = slices(entriesOf('a*1\nb*3')); assert.deepEqual([s[0].start, s[0].end, s[1].start, s[1].end], [0, 90, 90, 360]);
});
test('the pick is fair: over an even spread of random numbers each entry wins exactly its weight', () => {
  const e = entriesOf('a\nb*2\nc*7'), wins = [0, 0, 0], N = 10000;
  for (let k = 0; k < N; k++) wins[pickIndex(e, (k + 0.5) / N)]++;
  assert.deepEqual(wins, [1000, 2000, 7000]);
  const u = fairRandom(); assert.ok(u >= 0 && u < 1);
});
test('the spin lands on the picked entry, from any starting angle, always forward, at least the turns asked', () => {
  for (const text of ['a\nb', 'a\nb\nc\nd\ne\nf\ng', 'x*1\ny*50', Array.from({ length: 60 }, (_, i) => 'n' + i).join('\n')]) {
    const e = entriesOf(text);
    for (let i = 0; i < e.length; i++) for (const from of [0, 17.5, 359.9, 7200 + 123]) for (const v of [0, 0.5, 0.999]) {
      const to = plan(e, i, from, 5, v); assert.equal(under(e, to), i, text.slice(0, 10) + ' i=' + i + ' from=' + from + ' v=' + v); assert.ok(to - from >= 5 * 360 && to - from < 6 * 360);
    }
  }
});
test('it never stops on a line between two slices', () => {
  const e = entriesOf('a\nb\nc\nd'); for (const v of [0, 1]) { const to = plan(e, 1, 0, 5, v), a = ((360 - (to % 360)) % 360 + 360) % 360; assert.ok(a > 90 + 1 && a < 180 - 1, String(a)); }
});
test('ease starts fast and ends at rest', () => { assert.equal(ease(0), 0); assert.equal(ease(1), 1); assert.ok(ease(0.5) > 0.9); });
test('shuffle keeps every entry; sort is A to Z by the language', () => {
  const e = entriesOf('b\na\nc\nÉmile\n10\n9'); let k = 0; const s = shuffle(e, () => [0.9, 0.1, 0.5, 0.3, 0.7][k++ % 5]);
  assert.deepEqual(s.map((x) => x.label).sort(), e.map((x) => x.label).sort()); assert.deepEqual(sorted(e).map((x) => x.label), ['9', '10', 'a', 'b', 'c', 'Émile']);
});
test('the link holds the wheel, any language', () => {
  const e = entriesOf('Zoë *2\n寿司\n🍕 pizza'); assert.deepEqual(open(pack(e)), e); assert.equal(open('!!!'), null); assert.doesNotMatch(pack(e), /[+/=]/);
});
test('the asks', () => {
  assert.deepEqual(askWheel('spin the wheel'), { entries: [] }); assert.deepEqual(askWheel('wheel of names'), { entries: [] }); assert.ok(askWheel('spinner wheel')); assert.ok(askWheel('random name picker wheel'));
  assert.deepEqual(askWheel('spin a wheel with pizza, tacos and sushi').entries.map((x) => x.label), ['pizza', 'tacos', 'sushi']);
  for (const no of ['wheel', 'fortune wheel prices', 'how does a wheel work', 'spin a wheel with pizza', 'the wheel of time', 'wheel alignment near me', 'pick for me']) assert.equal(askWheel(no), null, no);
});
