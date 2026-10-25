// lib/baseconv.js: a number in every base at once, exact at any size, and the asks that name it. Run: node --test tools/baseconv.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { convert, all, group, parse, clean, baseOf, parseAsk, MAX_DIGITS } from '../void-live-deploy/lib/baseconv.js';

test('hex to binary and back, exactly, with the grouping a person reads', () => {
  const r = convert('ff', 16, 2); assert.equal(r.out, '11111111'); assert.equal(r.outGrouped, '1111 1111'); assert.equal(r.all.dec, '255'); assert.equal(r.all.hex, 'FF'); assert.equal(r.all.oct, '377');
  assert.equal(convert('1010', 2, 16).out, 'A'); assert.equal(convert('255', 10, 16).out, 'FF'); assert.equal(convert('0xDEADBEEF', 0, 10).out, '3735928559'); assert.equal(convert('0b101', 0, 10).out, '5'); assert.equal(convert('0o17', 0, 2).out, '1111');
  assert.equal(convert('zz', 36, 10).out, '1295'); assert.equal(convert('FF', 16, 2).out, '11111111', 'case does not matter'); assert.equal(convert('1 0000 1111', 2, 10).out, '271', 'spaces in the input are fine');
});
test('huge numbers are exact, never rounded', () => {
  const r = convert('ffffffffffffffffffff', 16, 10); assert.equal(r.out, '1208925819614629174706175'); assert.equal(r.all.bits, 80);
  const big = 'f'.repeat(1000), back = convert(convert(big, 16, 10).out, 10, 16).out; assert.equal(back, big.toUpperCase());
  assert.equal(convert('1'.repeat(MAX_DIGITS + 1), 2, 10).ok, false);
});
test('grouping: binary by four, hex by two, decimal by commas, octal by three', () => {
  assert.equal(group('101', 2), '0101'); assert.equal(group('100000000', 2), '0001 0000 0000'); assert.equal(group('fff', 16), '0f ff'); assert.equal(group('1234567', 10), '1,234,567'); assert.equal(group('12345', 8), '12 345'); assert.equal(group('-1234', 10), '-1,234'); assert.equal(group('abc', 7), 'abc');
});
test('what the bits mean: the signed reading in the smallest width, negatives in two\'s complement, and bytes as text', () => {
  assert.deepEqual([all(255n).signed.width, all(255n).signed.value], [8, -1n]); assert.deepEqual([all(127n).signed.width, all(127n).signed.value], [8, 127n]); assert.equal(all(128n).signed.value, -128n); assert.equal(all(256n).signed.width, 16);
  const n = all(-1n); assert.equal(n.signed.width, 8); assert.equal(n.signed.twos, '11111111'); assert.equal(all(-129n).signed.width, 16); assert.equal(all(-129n).signed.twos, '1111111101111111');
  assert.equal(all(0x48656c6c6fn).text, 'Hello'); assert.equal(all(0x01n).text, ''); assert.equal(all(1n << 70n).signed.width, 128, 'any size: the smallest power-of-two width that holds it'); assert.equal(all(1n << 127n).signed.value, -(1n << 127n), 'the top bit of 128 set reads negative');
});
test('a wrong digit says which digits belong to the base', () => {
  assert.match(convert('12', 2, 10).why, /not a base 2 number: digits 0 to 1 only/); assert.match(convert('xyz', 16, 10).why, /not a base 16 number/); assert.match(convert('', 10, 2).why, /Type a number first/);
  assert.equal(parse('12', 2), null); assert.equal(parse('ff', 16), 255n); assert.deepEqual(clean(' -0x1F '), { digits: '1f', base: 16, negative: true });
});
test('the asks people make: either order, a prefix, a bare number, base N', () => {
  assert.deepEqual(parseAsk('ff hex to binary'), { value: 'ff', from: 16, to: 2 }); assert.deepEqual(parseAsk('hex ff to binary'), { value: 'ff', from: 16, to: 2 });
  assert.deepEqual(parseAsk('1010 binary to decimal?'), { value: '1010', from: 2, to: 10 }); assert.deepEqual(parseAsk('convert 255 decimal to hex'), { value: '255', from: 10, to: 16 });
  assert.deepEqual(parseAsk('convert ff from hex to binary'), { value: 'ff', from: 16, to: 2 }); assert.deepEqual(parseAsk('0xff in decimal'), { value: '0xff', from: 0, to: 10 });
  assert.deepEqual(parseAsk('255 in binary'), { value: '255', from: 0, to: 2 }); assert.deepEqual(parseAsk('zz base 36 to decimal'), null, 'base 36 digits need a prefix word the pattern does not take');
  for (const a of ['what time is it in tokyo', '100 c to f', 'how many cups in 3 liters', 'hello world to binary', 'translate hello to spanish']) assert.equal(parseAsk(a), null, a);
  assert.equal(baseOf('Hexadecimal'), 16); assert.equal(baseOf('base 7'), 7); assert.equal(baseOf('base 40'), 0);
});

test('fractions exactly: a repeating part is caught, a terminating one ends, the working is shown', async () => {
  const { parseReal, formatReal, stepsToDecimal, stepsFromDecimal, stepsFraction } = await import('../void-live-deploy/lib/baseconv.js');
  assert.equal(formatReal(parseReal('0.1', 10), 2).text, '0.0(0011)'); assert.equal(formatReal(parseReal('0.5', 10), 2).text, '0.1');
  assert.equal(formatReal(parseReal('10.101', 2), 10).text, '2.625'); assert.equal(formatReal(parseReal('ff.8', 16), 10).text, '255.5');
  assert.equal(formatReal(parseReal('0.1', 3), 10).text, '0.(3)'); assert.equal(formatReal(parseReal('-3.25', 10), 16).text, '-3.4');
  assert.equal(parseReal('1.2', 2), null); assert.equal(parseReal('12', 10), null, 'no point: not a fraction');
  const s = stepsToDecimal('ff', 16); assert.deepEqual(s.map((x) => [x.value, x.power, x.term]), [[15, 1, 240n], [15, 0, 15n]]);
  assert.deepEqual(stepsFromDecimal(10n, 2).map((x) => x.r), [0, 1, 0, 1]);
  assert.deepEqual(stepsFraction(parseReal('0.625', 10), 2).map((x) => x.digit).join(''), '101');
});
