// The numbers family proof Grok left as "building". vat and hear already have their own tests.
// These three had none that named them: savings growth, a tip, and pixels to centimetres.
import test from 'node:test';
import assert from 'node:assert/strict';
import { _test } from '../void-live-deploy/skills/savings.js';
import { tipOf, compute } from '../void-live-deploy/skills/tip.js';
import { pxConvert } from '../void-live-deploy/lib/calc-more.js';

const { parse, grow } = _test;

test('savings, tip, and pixel size are proved with the arithmetic', () => {
  const q = parse('how much will i have if i save 200 a month for 1 year at 0%');
  assert.equal(q.want, 'grow');
  assert.equal(grow(q.start, 200, 0, 12), 2400);
  const tip = tipOf('20% tip on 45');
  assert.equal(compute(tip).tip, 9);
  assert.equal(pxConvert(96, 'px', 'cm', 96), 2.54);
});
