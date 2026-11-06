import test from 'node:test';
import assert from 'node:assert/strict';
import sums, { sumOf } from '../void-live-deploy/skills/sums.js';

test('a word problem shows the worked number, and a bare leftover ask says which total', () => {
  assert.equal(sumOf('if 3 apples cost 2.40 how much do 7 cost').value, 5.6);
  assert.equal(sumOf('a train travels 120 km in 2 hours what is its speed').value, 60);
  assert.equal(sumOf('I have 8 and spend half then find 3 how many do I have').value, 7);
  assert.equal(sumOf('si 4 lápices cuestan 6 cuánto cuestan 10').value, 15);
  assert.equal(sumOf('if 6 eggs cost 1.80 how much do 10 cost').value, 3, 'a unit price for any thing, not only apples');
  assert.equal(sumOf('if 4 movie tickets cost 30 dollars how much do 6 cost').value, 45);
  assert.equal(sumOf('how much do eggs cost'), null);
  assert.equal(sumOf('5 eggs cost too much'), null);
  assert.equal(sumOf('how much is left').kind, 'which');
  assert.equal(sumOf('what is 15% of 80'), null);
  for (const e of sums.examples) assert.ok(sums.match(e.toLowerCase(), e), e);
  for (const n of sums.nearMisses) assert.equal(sums.match(n.toLowerCase(), n), false, n);
});
