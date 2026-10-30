// tools/calc-math.test.mjs: the Maths gaps tools/rival-inventory.mjs found on calculator.net's sitemap, filled on /calculators/ (docs/PARITY.md),
// each on known answers worked out by hand or from published tables (NIST t and chi-square tables), not from the code under test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { run, BY_ID, decOf, roundDec, decText, sciOf, bigOf, bigTo, betaInc, gammaQ, tCdf, lnGamma, gaussJordan, matrixOf } from '../void-live-deploy/lib/calculators.js';

const near = (a, b, tol = 1e-9, what = '') => assert.ok(Math.abs(a - b) <= tol, what + ' ' + a + ' is not ' + b);
const go = (id, given = {}, units = {}) => { const r = run(id, given, units); assert.equal(r.error, '', id + ': ' + r.error); const o = {}; for (const x of r.outputs) o[x.k] = x.kind === 'text' ? x.si : x.value; return { o, r }; };
const bad = (id, given) => assert.notEqual(run(id, given, {}).error, '', id + ' should refuse ' + JSON.stringify(given));
export const IDS = ['solid-shapes', 'number-sequence', 'binary-math', 'hex-math', 'base-convert', 'probability-two', 'ratio', 'factors', 'prime-factorization', 'common-factors',
  'rounding', 'matrix', 'scientific-notation', 'big-number', 'long-division', 'p-value'];

test('every Maths gap-fill is there and works on its own defaults', () => { assert.equal(IDS.length, 16); for (const id of IDS) { assert.ok(BY_ID.get(id), id); go(id); } });

test('solids: a 10 cm cube, a 3 × 4 × 5 box, a unit sphere, a 3-4-5 cone, a capsule', () => {
  let { o } = go('solid-shapes'); near(o.v, 1000, 1e-9); near(o.area, 600, 1e-9);
  ({ o } = go('solid-shapes', { shape: 'box', a: '3', b: '4', h: '5' })); near(o.v, 60, 1e-9); near(o.area, 94, 1e-9);
  ({ o } = go('solid-shapes', { shape: 'sphere', a: '1' })); near(o.v, (4 / 3) * Math.PI, 1e-9); near(o.area, 4 * Math.PI, 1e-9);
  ({ o } = go('solid-shapes', { shape: 'cone', a: '3', h: '4' })); near(o.v, 12 * Math.PI, 1e-9); near(o.area, 24 * Math.PI, 1e-9); // slant 5: π·3·(3 + 5)
  ({ o } = go('solid-shapes', { shape: 'pyramid', a: '6', h: '4' })); near(o.v, 48, 1e-9); near(o.area, 96, 1e-9); // slant height 5: 36 + 4 · ½ · 6 · 5
  ({ o } = go('solid-shapes', { shape: 'capsule', a: '1', h: '2' })); near(o.v, (10 / 3) * Math.PI, 1e-9); near(o.area, 8 * Math.PI, 1e-9);
  ({ o } = go('solid-shapes', { shape: 'hemisphere', a: '1' })); near(o.v, (2 / 3) * Math.PI, 1e-9); near(o.area, 3 * Math.PI, 1e-9);
  bad('solid-shapes', { a: '0' });
});
test('sequences: 2, 5, 8 … ; 3, 6, 12 … ; Fibonacci', () => {
  let { o } = go('number-sequence'); assert.equal(o.an, 29); assert.equal(o.sn, 155); assert.equal(o.first, '2, 5, 8, 11, 14, 17, 20, 23, 26, 29');
  ({ o } = go('number-sequence', { type: 'geom', a1: '3', d: '2' })); assert.equal(o.an, 1536); assert.equal(o.sn, 3069);
  ({ o } = go('number-sequence', { type: 'geom', a1: '5', d: '1', n: '4' })); assert.equal(o.sn, 20);
  ({ o } = go('number-sequence', { type: 'fib' })); assert.equal(o.an, 55); assert.equal(o.sn, 143); assert.equal(o.first, '1, 1, 2, 3, 5, 8, 13, 21, 34, 55');
  ({ o } = go('number-sequence', { type: 'fib', n: '12' })); assert.equal(o.an, 144); assert.match(o.first, /, …$/);
  bad('number-sequence', { n: '2.5' });
});
test('binary and hex arithmetic, of any size', () => {
  assert.equal(go('binary-math').o.res, '10001'); // 11 + 6 = 17
  let { o } = go('binary-math', { op: '/' }); assert.equal(o.res, '1'); assert.equal(o.rem, '101');
  assert.equal(go('binary-math', { op: '&' }).o.res, '10'); assert.equal(go('binary-math', { op: '^' }).o.res, '1101'); assert.equal(go('binary-math', { op: '-', a: '110', b: '1011' }).o.res, '-101');
  ({ o } = go('hex-math')); assert.equal(o.res, '1FE'); assert.equal(o.dec, '510');
  assert.equal(go('hex-math', { a: 'FFFFFFFFFFFFFFFFFFFF', b: '1' }).o.res, '100000000000000000000'); assert.equal(go('hex-math', { a: '0xff', op: '*', b: 'ff' }).o.res, 'FE01');
  bad('binary-math', { a: '102' }); bad('hex-math', { a: 'G1' }); bad('hex-math', { op: '/', b: '0' });
});
test('base conversion: 255 is 11111111, 377 and FF; 36 to the 10th in base 36', () => {
  const { o } = go('base-convert'); assert.equal(o.res, '11111111'); assert.equal(o.oct, '377'); assert.equal(o.hex, 'FF');
  assert.equal(go('base-convert', { n: 'ZZ', from: '36', to: '10' }).o.res, '1295'); assert.equal(go('base-convert', { n: '10000000000', from: '36', to: '10' }).o.res, '3656158440062976');
  bad('base-convert', { to: '37' }); bad('base-convert', { n: '9', from: '8' });
});
test('two events: P(A) = 50%, P(B) = 40%', () => {
  const { o } = go('probability-two'); near(o.and, 20); near(o.or, 70); near(o.one, 50); near(o.neither, 30); near(o.nota, 50); near(o.notb, 60);
  bad('probability-two', { pa: '120' });
});
test('ratios: 2 : 3 = 10 : 15, and 0.5 : 1.25 is 2 : 5', () => {
  let { o } = go('ratio'); assert.equal(o.d, 15); assert.equal(o.simple, '2 : 3');
  ({ o } = go('ratio', { a: '0.5', b: '1.25', c: '4' })); assert.equal(o.simple, '2 : 5'); near(o.d, 10); assert.equal(go('ratio', { a: '24', b: '36' }).o.simple, '2 : 3');
  bad('ratio', { a: '0' });
});
test('factors, primes and common factors', () => {
  let { o } = go('factors'); assert.equal(o.list, '1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30, 60'); assert.equal(o.count, 12); assert.equal(o.sum, 168); assert.equal(o.pairs, '1 × 60, 2 × 30, 3 × 20, 4 × 15, 5 × 12, 6 × 10');
  assert.equal(go('factors', { n: '36' }).o.pairs, '1 × 36, 2 × 18, 3 × 12, 4 × 9, 6 × 6'); assert.equal(go('factors', { n: '97' }).o.prime, 'yes');
  ({ o } = go('prime-factorization')); assert.equal(o.form, '2³ × 3² × 5'); assert.equal(o.flat, '2 × 2 × 2 × 3 × 3 × 5'); assert.equal(o.distinct, 3);
  assert.equal(go('prime-factorization', { n: '1000000007' }).o.prime, 'yes'); assert.equal(go('prime-factorization', { n: '600851475143' }).o.flat, '71 × 839 × 1471 × 6857');
  ({ o } = go('common-factors')); assert.equal(o.gcf, 6); assert.equal(o.common, '1, 2, 3, 6'); assert.equal(o.lcm, 180);
  bad('prime-factorization', { n: '1' }); bad('factors', { n: '2.5' }); bad('common-factors', { data: '12' });
});
test('rounding on exact decimals: 1.005 → 1.01, halves to even, floors and ceilings, tens', () => {
  assert.equal(go('rounding').o.r, '1234.57'); assert.equal(go('rounding', { v: '1.005' }).o.r, '1.01'); // 1.005 is not exact in binary floating point
  assert.equal(go('rounding', { v: '2.5', p: '0', mode: 'even' }).o.r, '2'); assert.equal(go('rounding', { v: '3.5', p: '0', mode: 'even' }).o.r, '4');
  assert.equal(go('rounding', { v: '-2.5', p: '0', mode: 'down' }).o.r, '-3'); assert.equal(go('rounding', { v: '-1.21', p: '1', mode: 'up' }).o.r, '-1.2');
  assert.equal(go('rounding', { v: '-2.5', p: '0' }).o.r, '-3'); assert.equal(go('rounding', { v: '1299.99', p: '-2', mode: 'trunc' }).o.r, '1200'); assert.equal(go('rounding', { v: '1250', p: '-2' }).o.r, '1300');
  assert.equal(go('rounding', { v: '-0.4', p: '0' }).o.r, '0'); assert.equal(decText(roundDec(decOf('0.1'), 5)), '0.1');
  bad('rounding', { v: 'abc' });
});
test('matrices: [[1, 2], [3, 4]] and a 3 × 3', () => {
  let { o, r } = go('matrix'); assert.equal(o.res, '-2 1; 1.5 -0.5'); assert.equal(o.det, -2); assert.deepEqual(r.table.rows[0], ['Row 1', '-2', '1']);
  assert.equal(go('matrix', { op: 'mul' }).o.res, '19 22; 43 50'); assert.equal(go('matrix', { op: 'add' }).o.res, '6 8; 10 12'); assert.equal(go('matrix', { op: 'T', A: '1 2 3; 4 5 6' }).o.res, '1 4; 2 5; 3 6');
  near(go('matrix', { op: 'det', A: '6 1 1; 4 -2 5; 2 8 7' }).o.det, -306, 1e-9); assert.equal(go('matrix', { op: 'scale', k: '3' }).o.res, '3 6; 9 12');
  assert.equal(go('matrix', { op: 'mul', A: '1 2 3', B: '4; 5; 6' }).o.res, '32');
  bad('matrix', { op: 'inv', A: '2 0 1; 1 3 2; 1 1 1' }); bad('matrix', { op: 'det', A: '1 2 3' }); bad('matrix', { A: '1 2; 3' }); bad('matrix', { op: 'add', B: '1 2 3' });
  assert.equal(gaussJordan(matrixOf('0 1; 1 0')).det, -1);
});
test('scientific notation, exact both ways', () => {
  let { o } = go('scientific-notation'); assert.equal(o.sci, '1.23456 × 10⁻⁴'); assert.equal(o.e, '1.23456e-4'); assert.equal(o.eng, '123.456 × 10⁻⁶'); assert.equal(o.dec, '0.000123456');
  ({ o } = go('scientific-notation', { v: '6.02214076e23', sig: '3' })); assert.equal(o.sci, '6.02 × 10²³'); assert.equal(o.dec, '602000000000000000000000');
  assert.equal(go('scientific-notation', { v: '45000' }).o.eng, '45 × 10³'); assert.equal(go('scientific-notation', { v: '9.99', sig: '2' }).o.sci, '1.0 × 10¹');
  assert.equal(go('scientific-notation', { v: '100', sig: '3' }).o.sci, '1.00 × 10²'); assert.equal(go('scientific-notation', { v: '-0.5' }).o.sci, '-5 × 10⁻¹');
  assert.deepEqual(sciOf(decOf('0')), { mant: '0', e: 0 });
});
test('big numbers: 2¹⁰⁰, a carry through twenty nines, and 50! ÷ 48!', () => {
  let { o } = go('big-number'); assert.equal(o.res, '1267650600228229401496703205376'); assert.equal(o.digits, 31);
  assert.equal(go('big-number', { a: '99999999999999999999', op: '+', b: '1' }).o.res, '100000000000000000000');
  const f50 = '30414093201713378043612608166064768844377641568960512000000000000', f48 = '12413915592536072670862289047373375038521486354677760000000000';
  ({ o } = go('big-number', { a: f50, op: '/', b: f48 })); assert.equal(o.res, '2450'); assert.equal(o.rem, '0');
  ({ o } = go('big-number', { a: '100', op: '/', b: '7' })); assert.equal(o.res, '14'); assert.equal(o.rem, '2');
  assert.equal(go('big-number', { a: '462', op: 'gcd', b: '1071' }).o.res, '21');
  bad('big-number', { a: '1.5' }); bad('big-number', { a: '10', b: '1000000' }); assert.equal(bigTo(bigOf('-ff', 16) * 2n, 16), '-1FE');
});
test('long division: 1234 ÷ 7, 1 ÷ 7, 1 ÷ 6, 10 ÷ 4', () => {
  let { o, r } = go('long-division'); assert.equal(o.q, 176); assert.equal(o.r, 2); assert.equal(o.dec, '176.(285714)'); assert.equal(o.mixed, '176 2/7');
  assert.deepEqual(r.table.rows.map((x) => x[2]), [0, 1, 7, 6]); assert.equal(r.table.rows.at(-1)[4], 2);
  assert.equal(go('long-division', { n: '1', d: '7' }).o.dec, '0.(142857)'); assert.equal(go('long-division', { n: '1', d: '6' }).o.dec, '0.1(6)');
  ({ o } = go('long-division', { n: '10', d: '4' })); assert.equal(o.dec, '2.5'); assert.equal(o.mixed, '2 1/2'); assert.equal(go('long-division', { n: '21', d: '7' }).o.dec, '3');
  bad('long-division', { d: '0' });
});
test('p-values against the NIST tables: z 1.96, t(10) 2.228, chi-square(1) 3.841 and (10) 18.307', () => {
  near(go('p-value').o.p, 0.0499958, 1e-6);
  near(go('p-value', { stat: '1.644854', tail: 'right' }).o.p, 0.05, 1e-6); near(go('p-value', { stat: '-1.644854', tail: 'left' }).o.p, 0.05, 1e-6);
  near(go('p-value', { dist: 't', stat: '2.228', df: '10' }).o.p, 0.05, 1e-4); near(go('p-value', { dist: 't', stat: '2.764', df: '10', tail: 'right' }).o.p, 0.01, 1e-4);
  near(go('p-value', { dist: 'chi', stat: '3.841', df: '1', tail: 'right' }).o.p, 0.05, 1e-4); near(go('p-value', { dist: 'chi', stat: '18.307', df: '10', tail: 'right' }).o.p, 0.05, 1e-4);
  assert.equal(go('p-value', { stat: '3' }).o.sig01, 'yes (p < 0.01)'); bad('p-value', { dist: 't', df: '0' });
  near(Math.exp(lnGamma(5)), 24, 1e-9); near(betaInc(0.5, 2, 3), 11 / 16, 1e-12); near(gammaQ(1, 2), Math.exp(-2), 1e-12); near(tCdf(0, 5), 0.5, 1e-12);
});
