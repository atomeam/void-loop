// baseconv (skills/baseconv.js): the asks that name a base, and the card: the answer big, all four bases, bits, the signed and text readings, the converter link; a bad digit says why.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sk from '../void-live-deploy/skills/baseconv.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const card = (text) => { const el = { dataset: {}, innerHTML: '' }; const r = sk.run(text, { showPage: (fn) => { fn(el); return el; }, esc }); return { r, el, h: el.innerHTML }; };
const out = (h) => (/<p class="bc-out"[^>]*>([^<]*)<\/p>/.exec(h) || [])[1];
const rows = (h) => [...h.matchAll(/<td style="padding:3px 10px 3px 0;opacity:\.7">(\w+)<\/td><td[^>]*>([^<]*)<\/td>/g)].map((m) => m[1] + '=' + m[2]);

test('the asks: its examples and hand-written ones on both sides', () => {
  for (const e of sk.examples) assert.ok(sk.match(e.toLowerCase(), e), e);
  for (const n of sk.nearMisses) assert.ok(!sk.match(n.toLowerCase(), n), n);
  for (const t of ['4142 hex to decimal', '12 binary to hex', '-1 in hex']) assert.ok(sk.match(t.toLowerCase(), t), t);
  for (const t of ['z hex to binary', 'hello', '5 km to miles']) assert.ok(!sk.match(t.toLowerCase(), t), t);
});
test('the converter named first, then the number: "binary to decimal 1010", "hex to binary: ff"', () => {
  assert.equal(out(card('binary to decimal 1010').h), '10'); assert.equal(out(card('hex to binary: ff').h), '1111 1111');
  assert.equal(out(card('decimal to hex 255').h), 'FF');
  for (const t of ['binary to decimal', 'binary to decimal converter', 'hex to rgb #ff0000']) assert.ok(!sk.match(t.toLowerCase(), t), 'no number, or not a base: ' + t);
});
test('ff hex to binary: grouped answer, all four bases, 8 bits, signed -1, the link back to base 16', () => {
  const { r, el, h } = card('ff hex to binary');
  assert.equal(r, 'baseconv'); assert.equal(el.dataset.cardKind, 'Converter');
  assert.ok(h.startsWith('<h2>ff hex to binary</h2>'));
  assert.equal(out(h), '1111 1111');
  assert.deepEqual(rows(h), ['Binary=1111 1111', 'Octal=377', 'Decimal=255', 'Hex=FF']);
  assert.ok(h.includes('>8 bits; as a signed 8-bit number: -1.</p>'), h);
  assert.ok(h.includes('<a class="bc-open" href="/base-converter/?b=16&amp;v=ff">Open the converter</a>'));
});
test('0xff in decimal reads the prefix as hex; what is 1010 in decimal reads 0s and 1s as binary (decimal to decimal answers nothing)', () => {
  let h = card('0xff in decimal').h; assert.ok(h.startsWith('<h2>ff hex to decimal</h2>')); assert.equal(out(h), '255');
  h = card('what is 1010 in decimal').h; assert.ok(h.startsWith('<h2>1010 binary to decimal</h2>')); assert.equal(out(h), '10');
  assert.deepEqual(rows(h), ['Binary=1010', 'Octal=12', 'Decimal=10', 'Hex=0A']);
  assert.ok(h.includes('href="/base-converter/?b=2&amp;v=1010"'));
  assert.equal(out(card('what is 101010 in decimal').h), '42');
  assert.equal(out(card('what is 1020 in decimal').h), '1,020', 'a 2 in it: decimal, as before');
  assert.equal(out(card('42 in binary').h), '0010 1010', 'to binary: the decimal number, as before');
});
test('4142 hex to decimal: its text reading, escaped quotes', () => {
  const h = card('4142 hex to decimal').h;
  assert.equal(out(h), '16,706');
  assert.ok(h.includes('>15 bits; as a signed 16-bit number: 16706; as text: &quot;AB&quot;.</p>'), h);
});
test('a digit the base does not have: the reason and the plain converter link, no table', () => {
  const h = card('12 binary to hex').h;
  assert.equal(h, '<h2>Base converter</h2><p>&quot;12&quot; is not a base 2 number: digits 0 to 1 only.</p><p><a href="/base-converter/">Open the converter</a></p>');
  assert.equal(card('hello').h, '<h2>Base converter</h2><p>I could not read that.</p><p><a href="/base-converter/">Open the converter</a></p>');
});
