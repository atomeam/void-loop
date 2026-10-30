// tests for lib/epub-edit.js: an EPUB read and written again (mimetype first and stored), the change of its cover, the merge of books and the compression of a book
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readBook, writeBook, changeCover, coverOf, resolve, mergeBooks, obfuscate, identifierOf, encryptedOf, compressBook } from '../void-live-deploy/lib/epub-edit.js';
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

// an EPUB 2 book with an NCX, and an obfuscated font (the IDPF algorithm, keyed by the book's identifier)
async function ncxBook(id, font) {
  const ncx = '<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><navMap><navPoint id="a" playOrder="1"><navLabel><text>Part one</text></navLabel><content src="text/one.xhtml"/><navPoint id="b" playOrder="2"><navLabel><text>A &amp; B</text></navLabel><content src="text/one.xhtml#b"/></navPoint></navPoint></navMap></ncx>';
  const enc = '<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><EncryptedData xmlns="http://www.w3.org/2001/04/xmlenc#"><EncryptionMethod Algorithm="http://www.idpf.org/2008/embedding"/><CipherData><CipherReference URI="OPS/f.otf"/></CipherData></EncryptedData></encryption>';
  return writeBook([
    { name: 'META-INF/container.xml', data: te.encode(container) },
    { name: 'META-INF/encryption.xml', data: te.encode(enc) },
    { name: 'OPS/book.opf', data: te.encode('<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">' + id + '</dc:identifier><dc:title>NCX book</dc:title><dc:creator>Ann</dc:creator><dc:language>fr</dc:language></metadata><manifest><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/><item id="t" href="text/one.xhtml" media-type="application/xhtml+xml"/><item id="f" href="f.otf" media-type="font/otf"/></manifest><spine toc="ncx"><itemref idref="t"/></spine></package>') },
    { name: 'OPS/toc.ncx', data: te.encode(ncx) },
    { name: 'OPS/text/one.xhtml', data: te.encode('<html xmlns="http://www.w3.org/1999/xhtml"><body><p>NCX words.</p><p id="b">More.</p></body></html>') },
    { name: 'OPS/f.otf', data: await obfuscate(font, id) },
  ]);
}
const FONT = Uint8Array.from({ length: 3000 }, (_, i) => (i * 7 + 3) & 255); FONT.set(te.encode('OTTO'));

test('font obfuscation is its own inverse, keyed by the identifier without spaces', async () => {
  const o = await obfuscate(FONT, ' urn:x 1 '), back = await obfuscate(o, 'urn:x1');
  assert.ok(!same(o.subarray(0, 4), FONT.subarray(0, 4)));
  assert.ok(same(o.subarray(1040), FONT.subarray(1040)), 'only the first 1040 bytes');
  assert.ok(same(back, FONT));
});

test('two books merge into one: each in its own folder, one reading order, one table of contents, the words in order', async () => {
  const a = await book2(), b = await ncxBook('urn:book:b', FONT);
  const r = await mergeBooks([{ name: 'a.epub', bytes: a }, { name: 'b.epub', bytes: b }], '', new Date(0)), m = await readBook(r.bytes);
  assert.equal(r.title, 'Two and 1 more');
  assert.equal(m.opfPath, 'content.opf');
  const spine = [...m.opf.matchAll(/<itemref\b[^>]*idref="([^"]+)"/g)].map((x) => x[1]);
  assert.deepEqual(spine, ['b1-c', 'b1-t', 'b2-t']);
  const have = new Set(m.files.map((f) => f.name));
  for (const i of m.items) assert.ok(have.has(i.path), i.path + ' is in the book');
  assert.ok(have.has('b1/OPS/images/front.jpg') && have.has('b2/OPS/text/one.xhtml'));
  assert.equal(coverOf(m).id, 'b1-pic', 'the first book\'s cover');
  assert.match(m.opf, /<dc:creator>Ann<\/dc:creator>/);
  assert.match(m.opf, /<dc:language>fr<\/dc:language>/);
  const nav = td.decode(m.files.find((f) => f.name === 'nav.xhtml').data);
  assert.match(nav, /<a href="b2\/OPS\/text\/one\.xhtml">NCX book<\/a>/);
  assert.match(nav, /<a href="b2\/OPS\/text\/one\.xhtml#b">A &amp; B<\/a>/, 'the NCX entries, nested, with their #part');
  const ncx = td.decode(m.files.find((f) => f.name === 'toc.ncx').data);
  assert.equal((ncx.match(/<navPoint\b/g) || []).length, 4, 'a part for each book, and the 2 entries of the second');
  const words = (await epubParas(r.bytes)).paras, want = [...(await epubParas(a)).paras, ...(await epubParas(b)).paras];
  assert.deepEqual(words, want);
});

test('an obfuscated font is obfuscated again with the new book\'s identifier, so a reader gets the same font', async () => {
  const r = await mergeBooks([{ name: 'a.epub', bytes: await book2() }, { name: 'b.epub', bytes: await ncxBook('urn:book:b', FONT) }]), m = await readBook(r.bytes);
  assert.deepEqual(encryptedOf(m.files), [{ alg: 'http://www.idpf.org/2008/embedding', path: 'b2/OPS/f.otf' }]);
  const stored = m.files.find((f) => f.name === 'b2/OPS/f.otf').data;
  assert.ok(same(await obfuscate(stored, identifierOf(m.opf)), FONT));
  assert.match(r.notes.join(' '), /1 obfuscated font obfuscated again/);
});

test('a book with DRM, or fewer than 2 books, is refused with the reason', async () => {
  await assert.rejects(mergeBooks([{ name: 'a.epub', bytes: await book2() }]), /pick 2 or more EPUB files/);
  const drm = await writeBook([{ name: 'META-INF/container.xml', data: te.encode(container) }, { name: 'META-INF/encryption.xml', data: te.encode('<encryption><EncryptedData><EncryptionMethod Algorithm="http://www.w3.org/2001/04/xmlenc#aes128-cbc"/><CipherData><CipherReference URI="OPS/text/one.xhtml"/></CipherData></EncryptedData></encryption>') }, { name: 'OPS/book.opf', data: te.encode('<package version="2.0"><metadata></metadata><manifest></manifest><spine></spine></package>') }]);
  await assert.rejects(mergeBooks([{ name: 'a.epub', bytes: await book2() }, { name: 'locked.epub', bytes: drm }]), /locked\.epub: parts of this book are encrypted \(DRM\)/);
});

// a book with one large JPEG (noise does not deflate) and, when fixed, the fixed layout mark; `enc` names the picture in encryption.xml
const BIG = Uint8Array.from({ length: 20000 }, (_, i) => (i * 2654435761) >>> 24);
const picBook = ({ fixed = false, enc = false } = {}) => writeBook([
  { name: 'META-INF/container.xml', data: te.encode(container) },
  ...(enc ? [{ name: 'META-INF/encryption.xml', data: te.encode('<encryption><EncryptedData><EncryptionMethod Algorithm="http://www.w3.org/2001/04/xmlenc#aes128-cbc"/><CipherData><CipherReference URI="OPS/images/big.jpg"/></CipherData></EncryptedData></encryption>') }] : []),
  { name: 'OPS/book.opf', data: te.encode('<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">x</dc:identifier><dc:title>Pics</dc:title>' + (fixed ? '<meta property="rendition:layout">pre-paginated</meta>' : '') + '</metadata><manifest><item id="p" href="images/big.jpg" media-type="image/jpeg"/><item id="t" href="text/one.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="t"/></spine></package>') },
  { name: 'OPS/images/big.jpg', data: BIG },
  { name: 'OPS/text/one.xhtml', data: te.encode('<html xmlns="http://www.w3.org/1999/xhtml"><body><img src="../images/big.jpg"/><p>Words with a picture.</p></body></html>') },
]);

test('a book is made smaller: a picture made again replaces the old one under its own name, and the words stay', async () => {
  const src = await picBook(), seen = [], r = await compressBook(src, async (d, t, side) => { seen.push([d.length, t, side]); return JPG; }, { maxSide: 1600 });
  assert.deepEqual(seen, [[20000, 'image/jpeg', 1600]]);
  assert.ok(r.bytes.length < src.length);
  const a = await readBook(src), b = await readBook(r.bytes);
  assert.ok(same(b.files.find((f) => f.name === 'OPS/images/big.jpg').data, JPG));
  for (const f of a.files.filter((x) => x.name !== 'OPS/images/big.jpg')) assert.ok(same(b.files.find((g) => g.name === f.name).data, f.data), f.name);
  assert.match(r.notes.join(' '), /% smaller/); assert.match(r.notes.join(' '), /the picture was made smaller/);
});

test('a picture that does not get smaller keeps its bytes, and a book that does not get smaller is the same file', async () => {
  const src = await picBook(), r = await compressBook(src, async () => new Uint8Array(30000));
  assert.ok(same(r.bytes, src)); assert.match(r.notes[0], /already as small as Verse can make it/);
  const r2 = await compressBook(src, async () => { throw new Error('cannot open'); });
  assert.ok(same(r2.bytes, src));
});

test('a fixed layout book keeps the size of its pictures, and an encrypted picture is not touched', async () => {
  const sides = []; await compressBook(await picBook({ fixed: true }), async (d, t, side) => { sides.push(side); return JPG; }, { maxSide: 1600 });
  assert.deepEqual(sides, [0]);
  let called = 0; const r = await compressBook(await picBook({ enc: true }), async () => { called++; return JPG; }, { maxSide: 1600 });
  assert.equal(called, 0); assert.match(r.notes.join(' '), /1 encrypted file keeps its bytes/);
});
