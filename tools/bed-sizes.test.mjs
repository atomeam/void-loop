// The bed size answers carry their source (2026-10-30). Before, they had no source, and the full size said 54 × 75 in.
// Better Sleep Council (sponsored by ISPA), Mattress Sizes, read 2026-10-30: Twin 38" x 75", Twin XL 38" x 80", Full (double) 53" x 75",
// Queen 60" x 80", King 76" x 80", California King 72" x 84". Run: node --test tools/bed-sizes.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict'; import { load } from './word-math.mjs';
const W = load(), ask = (a) => W.wordMath(a.toLowerCase()), links = (r) => JSON.stringify(r.src.map((s) => s[1]));
const SRC = JSON.stringify(['https://bettersleep.org/mattress-sizes/']);
const cm = (inches) => Math.round(inches * 2.54);

test('each bed size answer cites the Better Sleep Council chart, with its read date', () => {
  const rows = [
    ['queen bed size in inches', '60 × 80 in', [60, 80]],
    ['what size is a queen bed', '60 × 80 in', [60, 80]],
    ['king bed dimensions', '76 × 80 in', [76, 80]],
    ['king size bed', '76 × 80 in', [76, 80]],
    ['full bed size', '53 × 75 in', [53, 75]],
    ['double bed dimensions', '53 × 75 in', [53, 75]],
    ['twin bed size', '38 × 75 in', [38, 75]],
  ];
  for (const [q, value, [w, l]] of rows) {
    const r = ask(q);
    assert.ok(r, q); assert.equal(r.value, value, q); assert.equal(links(r), SRC, q); assert.equal(r.read, '2026-10-30', q);
    // the metric size in the note is the inch size converted, not a separate number
    assert.ok(r.note.includes('(' + cm(w) + ' × ' + cm(l) + ' cm)'), q + ': ' + r.note);
  }
  assert.match(ask('king bed dimensions').note, /California king is 72 × 84 in/);
  assert.match(ask('twin bed size').note, /twin XL is 38 × 80 in/);
  assert.doesNotMatch(ask('full bed size').value, /54/, 'the full size follows the chart: 53 in wide');
});
