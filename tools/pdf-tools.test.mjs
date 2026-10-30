// tests for lib/pdf-tools.js: the engine runs on the vendored pdf-lib in node, and every result is read back and counted
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parsePages, splitGroups, sizeText, imageKind, zip, engine } from '../void-live-deploy/lib/pdf-tools.js';
globalThis.self ??= globalThis; vm.runInThisContext(readFileSync(new URL('../void-live-deploy/vendor/pdf-lib-1.17.1/pdf-lib.min.js', import.meta.url), 'utf8'));
const L = globalThis.PDFLib, T = engine(L);
const make = async (n, label = 'p') => { const d = await L.PDFDocument.create(); for (let i = 1; i <= n; i++) { const p = d.addPage([200 + i, 300]); p.drawText(label + i, { x: 20, y: 150 }); } return d.save(); };
const sizes = async (bytes) => (await L.PDFDocument.load(bytes)).getPages().map((p) => Math.round(p.getWidth()));
test('page specs: ranges, open ends, even, odd, last, junk dropped, order kept', () => {
  assert.deepEqual(parsePages('1-3, 5', 9), [0, 1, 2, 4]); assert.deepEqual(parsePages('8-', 10), [7, 8, 9]); assert.deepEqual(parsePages('-2', 5), [0, 1]);
  assert.deepEqual(parsePages('even', 6), [1, 3, 5]); assert.deepEqual(parsePages('odd', 5), [0, 2, 4]); assert.deepEqual(parsePages('last', 4), [3]); assert.deepEqual(parsePages('3,1', 4), [2, 0]);
  assert.deepEqual(parsePages('0, 99, x, 2', 5), [1]); assert.deepEqual(parsePages('5-3', 6), [2, 3, 4]); assert.deepEqual(parsePages('', 5), []);
});
test('split groups: ranges, every N, each', () => {
  assert.deepEqual(splitGroups(6, { ranges: '1-2;3-6' }), [[0, 1], [2, 3, 4, 5]]); assert.deepEqual(splitGroups(5, { every: 2 }), [[0, 1], [2, 3], [4]]); assert.deepEqual(splitGroups(3, { each: true }), [[0], [1], [2]]);
});
test('merge keeps order, a file can name its pages', async () => {
  const a = await make(3), b = await make(2);
  assert.deepEqual(await sizes(await T.merge([{ bytes: a }, { bytes: b }])), [201, 202, 203, 201, 202]);
  assert.deepEqual(await sizes(await T.merge([{ bytes: b }, { bytes: a, pages: '3' }])), [201, 202, 203]);
});
test('split, extract, remove, reverse', async () => {
  const a = await make(5);
  const parts = await T.split(a, { every: 2 }); assert.equal(parts.length, 3); assert.deepEqual(await sizes(parts[2].bytes), [205]); assert.equal(parts[0].name, 'part-1.pdf');
  assert.deepEqual(await sizes(await T.extract(a, '2,4-5')), [202, 204, 205]);
  assert.deepEqual(await sizes(await T.remove(a, 'odd')), [202, 204]);
  assert.deepEqual(await sizes(await T.reverse(a)), [205, 204, 203, 202, 201]);
  await assert.rejects(T.remove(a, '1-5'), /every page/); await assert.rejects(T.extract(a, '99'), /No such/);
});
test('rotate only the named pages, and rotation adds up', async () => {
  const a = await make(3), r = await T.rotate(a, '2', 90), d = await L.PDFDocument.load(r);
  assert.deepEqual(d.getPages().map((p) => p.getRotation().angle), [0, 90, 0]);
  const d2 = await L.PDFDocument.load(await T.rotate(r, '', -90)); assert.deepEqual(d2.getPages().map((p) => p.getRotation().angle), [270, 0, 270]);
});
test('assemble: reorder with a turn, across two files', async () => {
  const a = await make(2), b = await make(2), out = await L.PDFDocument.load(await T.assemble([a, b], [{ doc: 1, page: 1, rotate: 90 }, { doc: 0, page: 0 }, { doc: 5, page: 0 }, { doc: 0, page: 9 }]));
  assert.equal(out.getPageCount(), 2); assert.equal(out.getPage(0).getRotation().angle, 90); assert.equal(Math.round(out.getPage(0).getWidth()), 202);
});
test('images to pdf: a4 fits, fit keeps size, margins shrink', async () => {
  const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAD0lEQVR4nGP4z8Dwn4EBAAkEAgCG0d3sAAAAAElFTkSuQmCC', 'base64'));
  assert.equal(imageKind(png), 'png'); assert.equal(imageKind(Uint8Array.of(0xff, 0xd8, 1)), 'jpg'); assert.equal(imageKind(Uint8Array.of(1, 2, 3)), '');
  let d = await L.PDFDocument.load(await T.imagesToPdf([{ bytes: png, kind: 'png' }, { bytes: png, kind: 'png' }], { size: 'a4' })); assert.equal(d.getPageCount(), 2); assert.equal(Math.round(d.getPage(0).getWidth()), 595);
  d = await L.PDFDocument.load(await T.imagesToPdf([{ bytes: png, kind: 'png' }], { size: 'letter', landscape: true })); assert.equal(Math.round(d.getPage(0).getWidth()), 792);
  d = await L.PDFDocument.load(await T.imagesToPdf([{ bytes: png, kind: 'png' }], { size: 'fit' })); assert.deepEqual([d.getPage(0).getWidth(), d.getPage(0).getHeight()], [2, 1]);
});
test('page numbers, watermark, crop, info, optimize keep every page', async () => {
  const a = await make(3);
  for (const out of [await T.numberPages(a, { format: 'n of N', start: 5, skipFirst: true }), await T.watermark(a, 'DRAFT', { spec: '1' }), await T.optimize(a)]) assert.equal((await L.PDFDocument.load(out)).getPageCount(), 3);
  const c = await L.PDFDocument.load(await T.crop(a, { top: 10, left: 20 }, '1')); assert.equal(Math.round(c.getPage(0).getCropBox().width), 181); assert.equal(Math.round(c.getPage(1).getCropBox().width), 202);
  await assert.rejects(T.crop(a, { top: 400 }), /whole page/);
  const i = await T.info(await T.info(a, { title: 'Hello', author: 'Me', keywords: 'a, b' })); assert.deepEqual([i.pages, i.title, i.author], [3, 'Hello', 'Me']);
});
test('zip: a stored archive with the right names and sizes', () => {
  const z = zip([{ name: 'a.txt', bytes: new TextEncoder().encode('hello') }, { name: 'b.txt', bytes: new TextEncoder().encode('world!') }]), dv = new DataView(z.buffer);
  assert.equal(dv.getUint32(0, true), 0x04034b50); assert.equal(dv.getUint32(14, true), 0x3610a686); assert.equal(dv.getUint16(z.length - 12, true), 2); assert.equal(sizeText(1536), '1.5 KB'); assert.equal(sizeText(5 * 1048576), '5.00 MB');
});
