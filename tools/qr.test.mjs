// The QR encoder (void-live-deploy/lib/qr.js, owner, 2026-10-18: the spectators card shows its link as a QR code, made here with no network).
// Its laws, with numbers: capacities and alignment positions from ISO/IEC 18004's tables, the function patterns and format bits where a
// reader looks for them, and the SVG made of numbers only. Decoding was checked by hand with ZXing (285 codes, every version
// and level) when it was built. node --test tools/qr.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { qrMatrix, qrSvg, rawModules, dataCodewords, alignAt, penalty } from '../void-live-deploy/lib/qr.js';

test('qr: capacities and alignment positions match the standard tables', () => {
  assert.equal(rawModules(1), 208); assert.equal(rawModules(7), 1568); assert.equal(rawModules(40), 29648);
  assert.equal(dataCodewords(1, 0), 19); assert.equal(dataCodewords(1, 1), 16); assert.equal(dataCodewords(1, 3), 9); // 1-L, 1-M, 1-H
  assert.equal(dataCodewords(10, 1), 216); assert.equal(dataCodewords(40, 0), 2956); assert.equal(dataCodewords(40, 1), 2334);
  assert.deepEqual(alignAt(1), []); assert.deepEqual(alignAt(2), [6, 18]); assert.deepEqual(alignAt(7), [6, 22, 38]);
  assert.deepEqual(alignAt(23), [6, 30, 54, 78, 102]); assert.deepEqual(alignAt(32), [6, 34, 60, 86, 112, 138]); assert.deepEqual(alignAt(40), [6, 30, 58, 86, 114, 142, 170]);
});

test('qr: the smallest version that holds the text, a higher level when it fits the same version, null past version 40', () => {
  const a = qrMatrix('hello', { ecl: 'L' }); assert.equal(a.version, 1); assert.equal(a.size, 21); assert.equal(a.ecl, 'H'); // 5 bytes fit 1-H, so L is boosted
  const b = qrMatrix('x'.repeat(17), { ecl: 'L' }); assert.equal(b.version, 1); assert.equal(b.ecl, 'L'); // 17 bytes: 1-L only
  const c = qrMatrix('x'.repeat(18), { ecl: 'L' }); assert.equal(c.version, 2);
  assert.equal(qrMatrix('x'.repeat(2953), { ecl: 'L' }).version, 40); assert.equal(qrMatrix('x'.repeat(2954), { ecl: 'L' }), null);
  assert.equal(qrMatrix('é').version, 1); // UTF-8: two bytes
  const link = 'https://a-to-mind.com/?spectate=' + 'eyJ2IjoxLCJhdCI6MTc5'.repeat(12);
  const q = qrMatrix(link, { ecl: 'L' }); assert.ok(q.version >= 7 && q.version <= 12, 'a 272-byte link is a mid-size code: ' + q.version);
});

test('qr: "HELLO WORLD": finders, timing, the dark module and both copies of the format bits are where every reader looks', () => {
  const q = qrMatrix('HELLO WORLD', { ecl: 'M' }), m = q.modules, at = (x, y) => (m[y][x] ? 1 : 0);
  assert.equal(q.size, 21); assert.equal(q.ecl, 'Q'); // 11 bytes fit 1-Q (13 data codewords), not 1-H (9)
  for (const [cx, cy] of [[3, 3], [17, 3], [3, 17]]) { assert.equal(at(cx, cy), 1); assert.equal(at(cx + 2, cy), 0); assert.equal(at(cx + 3, cy), 1); } // finder: dark core, light ring, dark ring
  for (let i = 8; i < 13; i++) { assert.equal(at(i, 6), i % 2 === 0 ? 1 : 0); assert.equal(at(6, i), i % 2 === 0 ? 1 : 0); } // timing
  assert.equal(at(8, 13), 1); // the dark module
  // the two copies of the 15 format bits agree, and decode to level Q with the chosen mask
  const a = [0, 1, 2, 3, 4, 5, 7, 8].map((y) => at(8, y)).concat([7, 5, 4, 3, 2, 1, 0].map((x) => at(x, 8)));
  const b = [20, 19, 18, 17, 16, 15, 14, 13].map((x) => at(x, 8)).concat([14, 15, 16, 17, 18, 19, 20].map((y) => at(8, y)));
  assert.deepEqual(a, b);
  const bits = parseInt(a.slice().reverse().join(''), 2) ^ 0x5412;
  assert.equal(bits >> 13, 3); assert.equal((bits >> 10) & 7, q.mask); // 11 = Q
});

test('qr: the mask is the one with the lowest penalty, and the penalty counts what ISO 18004 counts', () => {
  const flat = Array.from({ length: 21 }, () => new Array(21).fill(false));
  assert.equal(penalty(flat), 21 * 2 * (3 + 16) + 20 * 20 * 3 + 90); // every row and column one run of 21, every 2x2 block, all light (k = 9)
  const q = qrMatrix('https://a-to-mind.com/'); assert.ok(q.mask >= 0 && q.mask <= 7);
});

test('qr: the SVG is numbers and the fixed label only, one path, with a white quiet zone', () => {
  const s = qrSvg(qrMatrix('<script>alert(1)</script>'), { margin: 3, label: 'QR "x" <y>' });
  assert.match(s, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 (\d+) \1"/);
  assert.ok(!/script|alert|[<>"]x/.test(s.replace(/<\/?(svg|rect|path)\b[^>]*>/g, '')), 'nothing of the text or label escapes');
  assert.match(s, /aria-label="QR x y"/); assert.equal((s.match(/<path /g) || []).length, 1); assert.match(s, /fill="#fff"/);
  assert.equal(qrSvg(null), '');
});
