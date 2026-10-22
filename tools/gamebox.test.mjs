import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../void-live-deploy/lib/table-tools.js';
import box from '../void-live-deploy/skills/gamebox.js';

const seq = (xs) => { let i = 0; return () => xs[i++ % xs.length]; };
test('dice of any count and sides, always in range', () => {
  const r = T.rollDice(3, 20, seq([0, 19, 9])); assert.deepEqual(r.rolls, [1, 20, 10]); assert.equal(r.total, 31);
  for (let i = 0; i < 500; i++) { const x = T.rollDice(5, 7); assert.ok(x.rolls.every((v) => v >= 1 && v <= 7)); }
  assert.deepEqual(T.diceSpec('2d6'), { count: 2, sides: 6 }); assert.deepEqual(T.diceSpec('d20'), { count: 1, sides: 20 }); assert.equal(T.rollDice(500, 1).count, 100);
});
test('coin, number picker, orb, deck, timer and score keeper', () => {
  assert.equal(T.flipCoin(() => 1), 'Heads'); assert.equal(T.pickNumber(10, 1, () => 0), 1); assert.equal(T.ORB.length, 20);
  const d = T.shuffle(T.newDeck()); assert.equal(new Set(d).size, 52); const r = T.draw(d, 5); assert.equal(r.drawn.length, 5); assert.equal(r.left.length, 47);
  assert.equal(T.seconds('1:30'), 90); assert.equal(T.seconds('2m'), 120); assert.equal(T.clock(90), '1:30');
  let p = T.addPlayer(T.addPlayer([], 'Ann'), ''); p = T.bump(p, 1, 5); assert.equal(T.leader(p).name, 'Player 2');
});
test('the box opens on its words and not on look-alikes', () => {
  for (const a of box.examples) assert.ok(box.match(a.toLowerCase(), a), a);
  for (const a of box.nearMisses) assert.ok(!box.match(a.toLowerCase(), a), a);
});
test('the landlord game rolls with the box dice', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../void-live-deploy/skills/monopoly.js', import.meta.url), 'utf8');
  assert.match(src, /M\.roll\(th\.state, rollDice\(2, 6\)\.rolls\)/);
});
