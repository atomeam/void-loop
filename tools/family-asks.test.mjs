// The benchmark asks that move a short family skill to proven. Each one is an ask that skill matches, and the sum or the split is the worked number.
import test from 'node:test';
import assert from 'node:assert/strict';
import vat from '../void-live-deploy/skills/vat.js';
import { compute } from '../void-live-deploy/lib/vat.js';

test('the three VAT asks the benchmark names are this skill, and 100 at 22% is worked on the device', () => {
  for (const a of ['remove vat from 100', 'add vat to 500', 'vat calculator']) assert.equal(vat.match(a, a), true, a);
  assert.equal(vat.match('what is 20 percent of 50', 'what is 20 percent of 50'), false);
  const r = compute({ amount: 100, rate: 22, mode: 'extract' });
  assert.equal(r.gross, 100);
  assert.ok(r && r.vat > 0 && r.net > 0);
  assert.equal(Math.round((r.net + r.vat) * 100), Math.round(r.gross * 100));
});
