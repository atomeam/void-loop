// Paint and concrete answers carry their source (2026-10-30). Before, "how many gallons of paint for 400 square feet" and the concrete
// bag answers stated 350 sq ft a gallon and the bag yields with no link and no read date. Paint now cites This Old House (a gallon
// usually covers 350 to 400 sq ft; Verse uses the low end), and the bag yields cite Quikrete's Concrete Mix data sheet.
import test from 'node:test'; import assert from 'node:assert/strict'; import { load } from './word-math.mjs';
const W = load(), ask = (a) => W.wordMath(a.toLowerCase());
const TOH = 'https://www.thisoldhouse.com/painting/how-much-paint-do-i-need';
const QK = 'https://www.quikrete.com/PDFs/DATA_SHEET-Concrete%20Mix%201101.pdf';
const YIELD = { 40: 0.3, 50: 0.375, 60: 0.45, 80: 0.6 }; // cu ft a bag, as the data sheet prints it

test('paint uses 350 sq ft a gallon, the low end of the This Old House range', () => {
  const r = ask('how many gallons of paint for 400 square feet');
  assert.equal(r.value, 'about 2.3 gallons'); assert.match(r.note, /350 to 400/); assert.match(r.note, /stucco or unpainted drywall/);
  assert.equal(r.src[0][1], TOH); assert.equal(r.read, '2026-10-30');
  assert.equal(ask('how much paint for 700 sq ft with one coat').value, 'about 2 gallons');
});

test('each bag size is the Quikrete yield', () => {
  for (const [lb, y] of Object.entries(YIELD)) {
    const r = ask('how many ' + lb + 'lb bags of concrete for 1 cubic yard');
    assert.equal(r.value, Math.ceil(27 / y) + ' bags', lb); assert.equal(r.src[0][1], QK, lb); assert.equal(r.read, '2026-10-30', lb);
  }
  const s = ask('how much concrete for a 10x10 slab 4 inches thick');
  assert.equal(s.value, '1.23 cubic yards'); assert.match(s.note, /56 bags of 80 lb/); assert.equal(s.src[0][1], QK);
});
