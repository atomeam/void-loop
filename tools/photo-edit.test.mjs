// Tests for lib/photo-edit.js (the /photos/ page's maths and bytes).
import test from 'node:test'; import assert from 'node:assert/strict'; import zlib from 'node:zlib';
import { fitWithin, historyCap, History, cropRect, clampRect, resizeRect, outSize, sizeLabel, savedPct, outName, sniff, adjustPixels, blurPixels, quantize, encodeIndexedPng, readMeta, privacySentence, zipStore, crc32, isPlain } from '../void-live-deploy/lib/photo-edit.js';
import { stripMeta } from '../void-live-deploy/lib/safety.js';

// a tiny JPEG with an EXIF block: camera, a date and a GPS position (made up for the test)
function exifJpeg() {
  const le = (n, k) => { const a = []; for (let i = 0; i < k; i++) a.push((n >> (8 * i)) & 255); return a; };
  const ent = (tag, type, count, val) => [...le(tag, 2), ...le(type, 2), ...le(count, 4), ...val];
  const ascii = (s) => [...Buffer.from(s + '\0')];
  // layout: header(8) | IFD0 at 8 | strings | exif ifd | gps ifd
  const make = ascii('Verse'), model = ascii('Test Cam');
  const ifd0Len = 2 + 4 * 12 + 4, makeAt = 8 + ifd0Len, modelAt = makeAt + make.length, exifAt = modelAt + model.length, exifLen = 2 + 12 + 4, dateStr = ascii('2024:06:15 18:30:05'), dateAt = exifAt + exifLen, gpsAt = dateAt + dateStr.length;
  const rat = (n, d) => [...le(n, 4), ...le(d, 4)];
  const gpsLen = 2 + 4 * 12 + 4, ratAt = gpsAt + gpsLen, latR = [...rat(38, 1), ...rat(42, 1), ...rat(0, 1)], lonR = [...rat(9, 1), ...rat(8, 1), ...rat(0, 1)];
  const ifd0 = [...le(4, 2), ...ent(0x010f, 2, make.length, le(makeAt, 4)), ...ent(0x0110, 2, model.length, le(modelAt, 4)), ...ent(0x8769, 4, 1, le(exifAt, 4)), ...ent(0x8825, 4, 1, le(gpsAt, 4)), ...le(0, 4)];
  const exif = [...le(1, 2), ...ent(0x9003, 2, dateStr.length, le(dateAt, 4)), ...le(0, 4)];
  const gps = [...le(4, 2), ...ent(1, 2, 2, [78, 0, 0, 0]), ...ent(2, 5, 3, le(ratAt, 4)), ...ent(3, 2, 2, [87, 0, 0, 0]), ...ent(4, 5, 3, le(ratAt + 24, 4)), ...le(0, 4)];
  const tiff = [0x49, 0x49, 42, 0, 8, 0, 0, 0, ...ifd0, ...make, ...model, ...exif, ...dateStr, ...gps, ...latR, ...lonR];
  const body = [...Buffer.from('Exif\0\0'), ...tiff], len = body.length + 2;
  const sof = [0xff, 0xc0, 0, 11, 8, 0, 20, 0, 30, 1, 1, 0x11, 0]; // 30 wide, 20 high
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, len >> 8, len & 255, ...body, 0xff, 0xfe, 0, 7, ...Buffer.from('hello'), ...sof, 0xff, 0xda, 0, 2, 1, 2, 3, 0xff, 0xd9]);
}

test('metadata is read in full and the privacy sentence names it', () => {
  const m = readMeta(exifJpeg());
  assert.equal(m.kind, 'jpeg'); assert.equal(m.width, 30); assert.equal(m.height, 20);
  const by = Object.fromEntries(m.items.map((x) => [x.label, x.value]));
  assert.equal(by['Camera make'], 'Verse'); assert.equal(by['Camera model'], 'Test Cam'); assert.equal(by.Taken, '2024:06:15 18:30:05');
  assert.ok(Math.abs(m.gps.lat - 38.7) < 1e-6 && Math.abs(m.gps.lon + 9.1333) < 1e-3); assert.ok(m.has.gps && m.has.comment);
  assert.match(privacySentence(m), /place it was taken/); assert.match(privacySentence(readMeta(new Uint8Array(20))), /No camera/);
});
test('stripping leaves a file with no metadata (the same strip the page offers)', () => {
  const r = stripMeta(exifJpeg()), m = readMeta(r.bytes); assert.equal(m.items.length, 0); assert.equal(m.has.gps, false); assert.equal(m.width, 30);
});
test('sniff, sizes, names', () => {
  assert.equal(sniff(exifJpeg()), 'jpeg'); assert.equal(sniff(new Uint8Array(20)), '');
  assert.deepEqual(fitWithin(8000, 6000, 40e6), { w: 8000, h: 5000 }.w ? { w: 7302, h: 5477, scaled: true } : null);
  assert.equal(historyCap(4000, 3000), 10); assert.equal(historyCap(100, 100), 20); assert.equal(historyCap(20000, 20000), 3);
  assert.equal(sizeLabel(812), '812 B'); assert.equal(sizeLabel(340000), '340 KB'); assert.equal(sizeLabel(1234567), '1.23 MB'); assert.equal(savedPct(1000, 250), 75); assert.equal(savedPct(1000, 1200), -20);
  const t = new Set(); assert.equal(outName('My Photo (1).PNG', 'image/webp', t), 'My_Photo_1-verse.webp'); assert.equal(outName('My Photo (1).PNG', 'image/webp', t), 'My_Photo_1-verse-2.webp');
  assert.deepEqual(outSize(4000, 3000, { w: 1000 }), { w: 1000, h: 750 }); assert.deepEqual(outSize(4000, 3000, { pct: 50 }), { w: 2000, h: 1500 }); assert.deepEqual(outSize(4000, 3000), { w: 4000, h: 3000 });
});
test('crop: aspect presets, clamping and corner resize', () => {
  assert.deepEqual(cropRect(400, 300, 1), { x: 50, y: 0, w: 300, h: 300 }); assert.deepEqual(cropRect(300, 400, 16 / 9), { x: 0, y: 116, w: 300, h: 169 });
  assert.deepEqual(clampRect({ x: -5, y: 290, w: 50, h: 50 }, 400, 300), { x: 0, y: 250, w: 50, h: 50 });
  const r = resizeRect({ x: 0, y: 0, w: 100, h: 100 }, 50, 0, 1, 400, 300); assert.equal(r.w, 150); assert.equal(r.h, 150);
  const g = resizeRect({ x: 300, y: 0, w: 50, h: 50 }, 500, 500, 0, 400, 300); assert.equal(g.x + g.w, 400);
});
test('history: undo, redo, the cap', () => {
  const h = new History(2).reset('a'); h.push('b'); h.push('c'); h.push('d'); assert.equal(h.past.length, 2); assert.equal(h.undo(), 'c'); assert.equal(h.undo(), 'b'); assert.equal(h.undo(), 'b'); assert.equal(h.redo(), 'c'); h.push('x'); assert.equal(h.canRedo, false);
});
test('adjustments: brightness, mono, invert, blur and a plain look changes nothing', () => {
  const px = () => new Uint8ClampedArray([200, 100, 50, 255, 10, 20, 30, 255]);
  const same = px(); adjustPixels(same, 2, 1, { filter: 'none' }); assert.deepEqual([...same], [...px()]); assert.ok(isPlain({}));
  const br = px(); adjustPixels(br, 2, 1, { bri: 20 }); assert.ok(br[0] > 200 && br[4] > 10);
  const mono = px(); adjustPixels(mono, 2, 1, { filter: 'mono' }); assert.ok(Math.abs(mono[0] - mono[1]) <= 1 && Math.abs(mono[1] - mono[2]) <= 1);
  const inv = px(); adjustPixels(inv, 2, 1, { filter: 'invert' }); assert.equal(inv[0], 55); assert.equal(inv[2], 205);
  const edge = new Uint8ClampedArray(5 * 3 * 4); for (let i = 0; i < 15; i++) { edge[i * 4] = i % 5 < 2 ? 0 : 255; edge[i * 4 + 3] = 255; } blurPixels(edge, 5, 3, 1); assert.ok(edge[(5 + 1) * 4] > 0 && edge[(5 + 1) * 4] < 255);
});
test('palette PNG: fewer colours, a real PNG that inflates to the indices, alpha kept', async () => {
  const w = 16, h = 16, d = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < w * h; i++) { d[i * 4] = (i * 7) % 256; d[i * 4 + 1] = (i * 13) % 256; d[i * 4 + 2] = (i * 29) % 256; d[i * 4 + 3] = i < 8 ? 0 : 255; }
  const q = quantize(d, w, h, 16); assert.ok(q.palette.length / 4 <= 16); assert.equal(q.indices.length, w * h); assert.equal(q.palette[q.indices[0] * 4 + 3], 0);
  const png = await encodeIndexedPng(q.indices, q.palette, w, h); assert.equal(sniff(png), 'png'); const m = readMeta(png); assert.equal(m.width, w);
  let i = 8, idat = null, plte = 0, trns = false; while (i < png.length) { const len = new DataView(png.buffer, png.byteOffset).getUint32(i), type = Buffer.from(png.subarray(i + 4, i + 8)).toString(); if (type === 'IDAT') idat = png.subarray(i + 8, i + 8 + len); if (type === 'PLTE') plte = len / 3; if (type === 'tRNS') trns = true; i += 12 + len; }
  const raw = zlib.inflateSync(Buffer.from(idat)); assert.equal(raw.length, (w + 1) * h); assert.equal(raw[1], q.indices[0]); assert.ok(plte <= 16 && trns);
});
test('zip made on the device: a standard store zip', () => {
  const z = zipStore([{ name: 'a.txt', data: new TextEncoder().encode('hello') }, { name: 'b.txt', data: new TextEncoder().encode('world') }]);
  assert.equal(z[0], 0x50); assert.equal(crc32(new TextEncoder().encode('hello')), 0x3610a686); assert.ok(Buffer.from(z).includes('world'));
});
