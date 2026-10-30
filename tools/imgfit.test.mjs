// lib/imgfit.js: a photo made the size a form asks for. Run: node --test tools/imgfit.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { toPx, fitBox, fitSize, jpegSize, pdfOfJpeg, isAsk, sizeIn, MAX_SIDE, cropBox, PRESETS } from '../void-live-deploy/lib/imgfit.js';

test('sizes in cm, mm and inches become pixels through the dpi; nonsense is 0', () => {
  assert.equal(toPx(3.5, 'cm', 200), 276); assert.equal(toPx(2.5, 'cm', 200), 197); assert.equal(toPx(1, 'in', 300), 300); assert.equal(toPx(25.4, 'mm', 300), 300); assert.equal(toPx(413, 'px'), 413);
  assert.equal(toPx(0, 'px'), 0); assert.equal(toPx(-3, 'cm'), 0); assert.equal(toPx('abc', 'px'), 0); assert.equal(toPx(5, 'furlong'), 0); assert.equal(toPx(MAX_SIDE + 1, 'px'), 0); assert.equal(toPx(1, 'cm', 0), 118, 'a missing dpi is 300');
});
test('fill crops the middle to the box, fit keeps the whole picture, stretch squeezes', () => {
  const f = fitBox(4000, 3000, 300, 300, 'fill'); assert.deepEqual([f.w, f.h, f.sw, f.sh, f.sx, f.sy], [300, 300, 3000, 3000, 500, 0]);
  const t = fitBox(3000, 4000, 300, 300, 'fill'); assert.deepEqual([t.sw, t.sh, t.sx, t.sy], [3000, 3000, 0, 500]);
  const i = fitBox(4000, 3000, 400, 400, 'fit'); assert.deepEqual([i.w, i.h], [400, 300]); const s = fitBox(4000, 3000, 100, 500, 'stretch'); assert.deepEqual([s.w, s.h, s.sw], [100, 500, 4000]);
  assert.equal(fitBox(0, 10, 10, 10), null);
});
test('the size search keeps the best quality under the limit, and says so honestly when nothing fits', async () => {
  const enc = (q) => new Uint8Array(Math.round(2000 + q * 90000)); // bigger with quality, as a JPEG is
  const r = await fitSize(enc, 50000); assert.ok(r.fits && r.bytes.length <= 50000 && r.bytes.length > 45000 && r.quality > 0.4 && r.quality < 0.6, JSON.stringify([r.bytes.length, r.quality]));
  assert.ok((await fitSize(enc, 1e9)).quality === 0.95 && (await fitSize(enc, 1e9)).fits); const no = await fitSize(enc, 1000); assert.equal(no.fits, false); assert.equal(no.smallest, no.bytes.length); assert.equal(no.quality, 0.05);
  assert.equal((await fitSize(enc, 0)).quality, 0.92, 'no limit: a good picture');
});
test('a JPEG reports its pixel size', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 17, 8, 1, 0x2c, 0, 0xc8, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]); assert.deepEqual(jpegSize(jpeg), { w: 200, h: 300 }); assert.equal(jpegSize(new Uint8Array([1, 2, 3, 4])), null);
});
test('the PDF is one page the size of the picture, with right offsets', () => {
  const jpeg = new Uint8Array(500).fill(7); jpeg[0] = 0xff; jpeg[1] = 0xd8; const pdf = pdfOfJpeg(jpeg, 600, 300, 300), text = new TextDecoder('latin1').decode(pdf);
  assert.ok(text.startsWith('%PDF-1.4')); assert.match(text, /\/MediaBox \[0 0 144\.00 72\.00\]/); assert.match(text, /\/Width 600 \/Height 300/); assert.ok(text.trimEnd().endsWith('%%EOF'));
  const start = Number(/startxref\n(\d+)/.exec(text)[1]); assert.equal(text.slice(start, start + 4), 'xref');
  const offs = [...text.slice(start).matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1])); assert.equal(offs.length, 5); offs.forEach((o, n) => assert.equal(text.slice(o, o + 7), (n + 1) + ' 0 obj', 'object ' + (n + 1)));
});
test('the asks and the sizes in them', () => {
  for (const a of ['resize a photo to 3.5 x 2.5 cm under 50 kb', 'compress my image to 100kb', 'resize my signature', 'image compressor', 'make this picture 600 by 800 px', 'reduce the size of my photo', 'pan card photo size', 'crop a photo']) assert.ok(isAsk(a), a);
  for (const a of ['strip the exif from a photo', 'draw a picture of a cat', 'my photos', 'resize the stage', 'what is the size of the moon', 'make a cartoon image', 'make me a sandwich', 'crop a local image', 'rotate a local image']) assert.ok(!isAsk(a), a);
  assert.deepEqual(sizeIn('resize a photo to 3.5 x 2.5 cm under 50 kb'), { w: 3.5, h: 2.5, unit: 'cm', kb: 50 }); assert.deepEqual(sizeIn('make this picture 600 by 800 px'), { w: 600, h: 800, unit: 'px' }); assert.deepEqual(sizeIn('compress my image to 100kb'), { kb: 100 }); assert.deepEqual(sizeIn('under 2 mb'), { kb: 2048 }); assert.deepEqual(sizeIn('resize a photo'), {});
});

test('"make the image red" is the stage picture\'s colour edge, not the resizer; "make" with a size still is', async () => {
  const { isAsk: ask } = await import('../void-live-deploy/lib/imgfit.js');
  assert.equal(ask('make the image red'), false); assert.equal(ask('make the image blue'), false);
  assert.equal(ask('make this picture 600 by 800 px'), true);
});
test('a crop moved and zoomed by hand: the output shape kept, zoom makes the window smaller, the window never leaves the picture', () => {
  const c = cropBox(1000, 500, 100, 100); assert.deepEqual([c.sx, c.sy, c.sw, c.sh], [250, 0, 500, 500], 'zoom 1, centred: the plain fill crop');
  const z = cropBox(1000, 500, 100, 100, { zoom: 2, cx: 0.25, cy: 0.5 }); assert.deepEqual([z.sx, z.sy, z.sw, z.sh], [125, 125, 250, 250]);
  const edge = cropBox(1000, 500, 100, 100, { cx: 0, cy: 1 }); assert.deepEqual([edge.sx, edge.sy], [0, 0], 'pushed past the edge, it stops at it'); assert.equal(edge.cx, 0.25);
  assert.equal(cropBox(1000, 500, 100, 100, { zoom: 0.2 }).zoom, 1, 'never zoomed out past the whole crop');
  for (const [label, w, h, u, dpi, kb] of PRESETS) assert.ok(label && w > 0 && h > 0 && ['cm', 'mm', 'in', 'px'].includes(u) && dpi >= 72 && kb >= 0, label);
});
