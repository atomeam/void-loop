// tests for lib/epub-edit.js: an EPUB read and written again (mimetype first and stored), and the change of its cover
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readBook, writeBook, changeCover, coverOf, resolve } from '../void-live-deploy/lib/epub-edit.js';
import { epubOf, epubParas } from '../void-live-deploy/lib/converter.js';

const te = new TextEncoder(), td = new TextDecoder();
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 7, 7, 0xff, 0xd9]), PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 5, 5]);
const encode = async (t) => (t === 'image/png' ? PNG : JPG);
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const container = '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>';
// an EPUB 2 book whose cover is named by <meta name="cover">, its cover page showing the picture from another folder
const book2 = (coverType = 'image/jpeg', file = 'images/front.jpg') => writeBook([
  { name: 'META-INF/container.xml', data: te.encode(container) },
  { name: 'OPS/book.opf', data: te.encode('<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">x</dc:identifier><dc:title>Two</dc:title><meta name="cover" content="pic"/></metadata><manifest><item id="pic" href="' + file + '" media-type="' + coverType + '"/><item id="c" href="text/cover.xhtml" media-type="application/xhtml+xml"/><item id="t" href="text/one.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c"/><itemref idref="t"/></spine></package>') },
  { name: 'OPS/' + file, data: new Uint8Array([1, 2, 3, 4]) },
  { name: 'OPS/text/cover.xhtml', data: te.encode('<html xmlns="http://www.w3.org/1999/xhtml"><body><img src="../' + file + '"/></body></html>') },
  { name: 'OPS/text/one.xhtml', data: te.encode('<html xmlns="http://www.w3.org/1999/xhtml"><body><p>The first words.</p></body></html>') },
]);

test('a link is read from the file it is in', () => {
  assert.equal(resolve('EPUB/text/c1.xhtml', '../images/a%20b.jpg#x'), 'EPUB/images/a b.jpg');
  assert.equal(resolve('content.opf', 'cover.jpg'), 'cover.jpg');
});

test('the book is written with the mimetype first, stored, with no extra field', async () => {
  const z = await book2(), v = new DataView(z.buffer);
  assert.equal(v.getUint32(0, true), 0x04034b50);
  assert.equal(v.getUint16(8, true), 0, 'stored');
  assert.equal(v.getUint16(28, true), 0, 'no extra field');
  assert.equal(td.decode(z.subarray(30, 38)), 'mimetype');
  assert.equal(td.decode(z.subarray(38, 58)), 'application/epub+zip');
  const b = await readBook(z);
  assert.equal(b.opfPath, 'OPS/book.opf');
  assert.equal(b.version, '2.0');
  assert.deepEqual(b.files.find((f) => f.name === 'OPS/images/front.jpg').data, new Uint8Array([1, 2, 3, 4]));
});

test('an EPUB 2 cover named by <meta name="cover"> gets the new picture in its own file, and nothing else changes', async () => {
  const src = await book2(), r = await changeCover(src, encode), a = await readBook(src), b = await readBook(r.bytes);
  assert.equal(coverOf(b).path, 'OPS/images/front.jpg');
  assert.ok(same(b.files.find((f) => f.name === 'OPS/images/front.jpg').data, JPG));
  for (const f of a.files) if (f.name !== 'OPS/images/front.jpg') assert.ok(same(b.files.find((g) => g.name === f.name).data, f.data), f.name + ' is as it was');
  assert.equal(b.files.length, a.files.length);
  assert.match(r.notes.join(' '), /5 of the 6 files the book had are byte for byte as they were/);
});

test('a PNG cover stays a PNG, so the pages that link to it still work', async () => {
  const r = await changeCover(await book2('image/png', 'images/front.png'), encode), b = await readBook(r.bytes);
  assert.ok(same(b.files.find((f) => f.name === 'OPS/images/front.png').data, PNG));
});

test('a GIF cover is written as a JPEG under a new name, and the package and the pages link to the new name', async () => {
  const r = await changeCover(await book2('image/gif', 'images/front.gif'), encode), b = await readBook(r.bytes), c = coverOf(b);
  assert.equal(c.path, 'OPS/images/front.jpg');
  assert.equal(c.type, 'image/jpeg');
  assert.ok(!b.files.some((f) => f.name === 'OPS/images/front.gif'));
  assert.match(td.decode(b.files.find((f) => f.name === 'OPS/text/cover.xhtml').data), /src="\.\.\/images\/front\.jpg"/);
  assert.match(r.notes.join(' '), /1 page now link to it/);
});

test('a book with no cover gets the picture, both cover marks and a cover page first, and its words stay', async () => {
  const src = epubOf({ title: 'Plain', paras: ['One.', 'Two.'] }, new Date(0)), r = await changeCover(src, encode), b = await readBook(r.bytes);
  const c = coverOf(b);
  assert.equal(c.path, 'OEBPS/cover.jpg');
  assert.ok(c.props.includes('cover-image'), 'the EPUB 3 mark');
  assert.match(b.opf, /<meta name="cover" content="cover-image"\/>/, 'the EPUB 2 mark');
  const spine = [...b.opf.matchAll(/<itemref\b[^>]*idref="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(spine, ['cover-page', 'text']);
  const page = b.items.find((i) => i.id === 'cover-page');
  assert.match(td.decode(b.files.find((f) => f.name === page.path).data), /<img src="cover\.jpg"/);
  assert.deepEqual((await epubParas(r.bytes)).paras.filter((p) => p !== 'Cover'), (await epubParas(src)).paras);
});

test('a file that is not an EPUB, or names a cover it does not have, is refused with the reason', async () => {
  await assert.rejects(changeCover(te.encode('hello'), encode), /not an EPUB file/);
  const z = await writeBook([{ name: 'META-INF/container.xml', data: te.encode(container) }, { name: 'OPS/book.opf', data: te.encode('<package version="3.0"><metadata></metadata><manifest><item id="p" href="gone.jpg" media-type="image/jpeg" properties="cover-image"/></manifest><spine></spine></package>') }]);
  await assert.rejects(changeCover(z, encode), /names gone\.jpg as its cover, but that file is not in the book/);
});
