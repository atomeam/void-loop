// Steps per mile and steps to distance carry their source (2026-10-30). Before, "how many steps in a mile" said 2,000–2,500 walking and
// 1,400–1,700 running with no link, and "how many steps per mile" found no answer. University of Iowa Student Health gives a little
// over 2,000 steps to walk a mile, about 2,000 on average, and an average stride of about 2.5 ft; it gives no running figure, so the
// answer gives none. Read 2026-10-30. The 2,100 is worked out here from 5,280 ft and the 2.5 ft stride.
import test from 'node:test'; import assert from 'node:assert/strict'; import { load } from './word-math.mjs';
const W = load(), ask = (a) => W.wordMath(a.toLowerCase()), links = (r) => JSON.stringify(r.src.map((s) => s[1]));
const UIOWA = 'https://studenthealth.uiowa.edu/assets/Taking-Strides-FAQs.pdf';

test('steps in a mile is the University of Iowa figure, with no invented running count', () => {
  for (const q of ['how many steps in a mile', 'how many steps per mile', 'how many steps are in one mile']) {
    const r = ask(q);
    assert.equal(r.value, 'a little over 2,000', q); assert.equal(links(r), JSON.stringify([UIOWA]), q); assert.equal(r.read, '2026-10-30', q);
  }
  const r = ask('how many steps in a mile');
  assert.equal(Math.round(5280 / 2.5 / 100) * 100, 2100); assert.match(r.note, /about 2\.5 ft/); assert.match(r.note, /about 2,100/);
  assert.doesNotMatch(r.value + r.note, /1,400|1,700|2,500|running/);
});

test('steps to distance names the same stride source', () => {
  const r = ask('how far is 10000 steps');
  assert.equal(r.value, (10000 * 2.5 / 5280).toFixed(1) + ' miles'); assert.equal(links(r), JSON.stringify([UIOWA])); assert.equal(r.read, '2026-10-30');
  assert.equal(ask('convert 5000 steps to km').value, (5000 * 2.5 / 5280 * 1.609344).toFixed(1) + ' km');
});
