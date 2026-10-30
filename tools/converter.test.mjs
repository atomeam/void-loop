// tests for lib/converter.js: the catalog and its honest counts, the search, the format read from the bytes, and every file Verse writes
// itself read back by an independent reader in this file (WAV, AIFF, BMP, TIFF, GIF, EPUB, DOCX, RTF, HTML, PDF with the vendored pdf-lib)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as C from '../void-live-deploy/lib/converter.js';
import { unzip } from '../void-live-deploy/lib/translate-docs.js';
globalThis.self ??= globalThis; vm.runInThisContext(readFileSync(new URL('../void-live-deploy/vendor/pdf-lib-1.17.1/pdf-lib.min.js', import.meta.url), 'utf8'));
const L = globalThis.PDFLib;
const ascii = (b, at, n) => String.fromCharCode(...b.subarray(at, at + n));
const dv = (b) => new DataView(b.buffer, b.byteOffset, b.byteLength);
const tone = (n, rate, f = 440, a = 0.5) => Float32Array.from({ length: n }, (_, i) => a * Math.sin(2 * Math.PI * f * i / rate));
const close = (a, b, eps, msg) => { assert.equal(a.length, b.length, msg + ': length'); for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > eps) assert.fail(msg + ': sample ' + i + ' is ' + a[i] + ', not ' + b[i]); };
const img = (w, h, f) => { const data = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(f(x, y), (y * w + x) * 4); return { width: w, height: h, data }; };

test('the catalog: 106 tools as onlineconverter.com lists them, unique ids, the counts the page shows', () => {
  assert.equal(C.CATALOG.length, 106);
  assert.equal(new Set(C.CATALOG.map((t) => t.id)).size, 106);
  assert.deepEqual(C.counts(), { here: 57, verse: 18, part: 9, no: 22, all: 106 });
  for (const t of C.CATALOG) {
    assert.ok(C.CATS.includes(t.cat), t.id + ' category'); assert.ok(['here', 'verse', 'part', 'no'].includes(t.status), t.id + ' status');
    assert.ok(t.note && t.note.length > 10, t.id + ' says why'); if (t.status === 'verse') assert.match(t.href, /^\/[a-z-]+\//, t.id + ' links the Verse page');
    if (t.status === 'here') assert.ok(t.to || t.run, t.id + ' runs here');
  }
  // video: MP4, MOV, WEBM and MKV are written here and 15 edits run here (WebCodecs, /lib/video-write.js, /lib/video-mux.js); the rest are
  // honestly not on Verse yet, each with why
  const NOT_YET = ['video-3gp', 'video-avi', 'video-flv', 'video-wmv', 'add-transition-to-video', 'make-split-screen-video', 'repair-mp4', 'stabilize-video'];
  for (const t of C.CATALOG.filter((x) => x.cat === 'Video')) { assert.equal(t.status, NOT_YET.includes(t.id) ? 'no' : 'here', t.id); if (t.status === 'no') assert.doesNotMatch(t.note, /does not do this yet/, t.id + ' says the real reason'); }
  for (const id of ['audio-to-video', 'remove-audio-from-video', 'gif-to-video', 'image-to-video', 'pdf-to-video']) { assert.equal(C.toolOf(id).status, 'here', id); assert.equal(C.toolOf(id).run, 'video', id); }
  // sound: WAV, AIFF and FLAC with Verse's own encoders, OGG and OPUS with the browser's Opus encoder; MP3, M4A and the rest not yet
  for (const f of ['wav', 'aiff', 'flac', 'alac', 'ogg', 'opus']) { assert.equal(C.toolOf('audio-' + f).status, 'here', f); assert.equal(C.toolOf('audio-' + f).to, f); }
  for (const f of ['mp3', 'amr', 'm4a', 'm4r', 'wma']) assert.equal(C.toolOf('audio-' + f).status, 'no', f);
  assert.match(C.toolOf('audio-ogg').note, /Opus/); assert.equal(C.MIME.flac, 'audio/flac'); assert.equal(C.MIME.opus, 'audio/ogg');
  assert.equal(C.toolOf('pptx-to-video').status, 'no'); assert.equal(C.toolOf('merge-video').many, true); assert.equal(C.toolOf('add-audio-to-video').from, 'video+sound');
  assert.deepEqual(C.targetsOf('webm'), ['mp4', 'mov', 'mkv', 'wav', 'aiff', 'flac', 'alac', 'ogg', 'opus']); assert.equal(C.MIME.mkv, 'video/x-matroska'); assert.equal(C.MIME.mov, 'video/quicktime');
  assert.match(C.toolOf('video-wmv').note, /no browser can code/); assert.equal(C.toolOf('video-mp4').to, 'mp4'); assert.equal(C.toolOf('video-webm').from, 'video');
  assert.equal(C.search('mov to avi')[1].tool.id, 'video-mp4'); assert.equal(C.search('mov to webm')[0].tool.id, 'video-webm'); assert.equal(C.search('webm to mkv')[0].tool.id, 'video-mkv'); assert.equal(C.search('mp4 to mov')[0].tool.id, 'video-mov');
  assert.equal(C.toolOf('audio-wav').status, 'here'); assert.equal(C.toolOf('audio-mp3').status, 'no'); assert.equal(C.toolOf('image-png').status, 'here');
  assert.equal(C.toolOf('nope'), null);
});

test('search: "x to y" finds the converter, and where it is not on Verse, the nearest one that works', () => {
  const ids = (q) => C.search(q).map((r) => r.tool.id);
  assert.deepEqual(ids('mp4 to mp3'), ['audio-mp3', 'audio-wav']);
  assert.deepEqual(ids('png to jpg'), ['image-jpg']);
  assert.deepEqual(ids('convert jpeg to png'), ['image-png']);
  assert.deepEqual(ids('wav to aiff'), ['audio-aiff']);
  assert.equal(ids('pdf to txt')[0], 'doc-txt');
  assert.ok(ids('cut mp3').includes('cut-mp3'));
  assert.ok(ids('merge pdf').includes('merge-pdf'));
  assert.deepEqual(C.search(''), []); assert.deepEqual(C.search('to'), []);
});

test('the format comes from the first bytes, not only from the name', () => {
  const b = (...x) => Uint8Array.from(x);
  assert.equal(C.formatOf(b(0xff, 0xd8, 0xff, 0xe0, 0, 0), 'x.png'), 'jpg');
  assert.equal(C.formatOf(b(0x89, 0x50, 0x4e, 0x47, 0, 0), 'x.jpg'), 'png');
  assert.equal(C.formatOf(C.wav([tone(10, 8000)], 8000)), 'wav');
  assert.equal(C.formatOf(C.aiff([tone(10, 8000)], 8000)), 'aiff');
  assert.equal(C.formatOf(C.bmp(img(2, 2, () => [1, 2, 3, 255]))), 'bmp');
  assert.equal(C.formatOf(C.tiff(img(2, 2, () => [1, 2, 3, 255]))), 'tiff');
  assert.equal(C.formatOf(C.gif(img(2, 2, () => [1, 2, 3, 255]))), 'gif');
  assert.equal(C.formatOf(new TextEncoder().encode('%PDF-1.7\n')), 'pdf');
  assert.equal(C.formatOf(new TextEncoder().encode('{\\rtf1 hi}')), 'rtf');
  assert.equal(C.formatOf(new TextEncoder().encode('<!doctype html><p>x')), 'html');
  assert.equal(C.formatOf(new TextEncoder().encode('plain words')), 'txt');
  assert.equal(C.formatOf(C.epubOf({ title: 'T', paras: ['a'] })), 'epub');
  assert.deepEqual(C.targetsOf('jpeg'), ['png', 'webp', 'gif', 'bmp', 'tiff', 'pdf']);
  assert.deepEqual(C.targetsOf('mp4'), ['mov', 'webm', 'mkv', 'wav', 'aiff', 'flac', 'alac', 'ogg', 'opus']); assert.deepEqual(C.targetsOf('mov'), ['mp4', 'webm', 'mkv', 'wav', 'aiff', 'flac', 'alac', 'ogg', 'opus']);
  assert.deepEqual(C.targetsOf('mp3'), ['wav', 'aiff', 'flac', 'alac', 'ogg', 'opus']); assert.deepEqual(C.targetsOf('flac'), ['wav', 'aiff', 'alac', 'ogg', 'opus']);
  assert.deepEqual(C.targetsOf('mobi'), []);
});

test('WAV: the exact 44-byte header, and the samples come back through the decoder', () => {
  const rate = 22050, L1 = tone(1000, rate, 440), R1 = tone(1000, rate, 660, 0.25), w = C.wav([L1, R1], rate), v = dv(w);
  assert.equal(ascii(w, 0, 4), 'RIFF'); assert.equal(v.getUint32(4, true), w.length - 8); assert.equal(ascii(w, 8, 8), 'WAVEfmt ');
  assert.equal(v.getUint16(20, true), 1); assert.equal(v.getUint16(22, true), 2); assert.equal(v.getUint32(24, true), rate); assert.equal(v.getUint32(28, true), rate * 4);
  assert.equal(v.getUint16(32, true), 4); assert.equal(v.getUint16(34, true), 16); assert.equal(ascii(w, 36, 4), 'data'); assert.equal(v.getUint32(40, true), 4000); assert.equal(w.length, 4044);
  const d = C.decodePcm(w); assert.equal(d.rate, rate); assert.equal(d.channels.length, 2);
  close(d.channels[0], L1, 1 / 32000, 'left'); close(d.channels[1], R1, 1 / 32000, 'right');
});

test('AIFF: big-endian header with the 80-bit rate, read back the same', () => {
  for (const rate of [8000, 44100, 48000]) {
    const s = tone(500, rate, 300), a = C.aiff([s], rate), v = dv(a);
    assert.equal(ascii(a, 0, 4), 'FORM'); assert.equal(v.getUint32(4, false), a.length - 8); assert.equal(ascii(a, 8, 8), 'AIFFCOMM');
    assert.equal(v.getUint16(20, false), 1); assert.equal(v.getUint32(22, false), 500); assert.equal(v.getUint16(26, false), 16); assert.equal(ascii(a, 38, 4), 'SSND');
    const d = C.decodePcm(a); assert.equal(d.rate, rate, 'rate ' + rate); close(d.channels[0], s, 1 / 32000, 'aiff ' + rate);
  }
});

test('sound edits: cut, speed, gain with a clip count, silence out, merge with a crossfade, mix turned down', () => {
  const rate = 1000, s = { rate, channels: [Float32Array.from({ length: 3000 }, (_, i) => i / 3000)] };
  const c = C.cut(s, 1, 2); assert.equal(c.channels[0].length, 1000); assert.ok(Math.abs(c.channels[0][0] - 1 / 3) < 1e-6);
  assert.equal(C.cut(s, 2.5, '').channels[0].length, 500);
  assert.equal(C.speed(s, 2).channels[0].length, 1500); assert.equal(C.speed(s, 0.5).channels[0].length, 6000);
  const g = C.gain({ rate, channels: [Float32Array.of(0.1, 0.6, -0.9)] }, 6.0206); assert.ok(Math.abs(g.channels[0][0] - 0.2) < 1e-4); assert.equal(g.channels[0][1], 1); assert.equal(g.channels[0][2], -1); assert.match(g.notes[1], /^2 samples clipped/);
  const quiet = new Float32Array(2000), loud = tone(500, rate, 50, 0.5), withGap = { rate, channels: [Float32Array.from([...loud, ...quiet, ...loud])] };
  const r = C.removeSilence(withGap); assert.ok(r.channels[0].length < 1400 && r.channels[0].length > 1000, 'length ' + r.channels[0].length); assert.match(r.notes[0], /^1 quiet stretch/);
  assert.equal(C.removeSilence({ rate, channels: [loud] }).channels[0].length, 500);
  const one = { rate, channels: [new Float32Array(1000).fill(0.5)] }, two = { rate, channels: [new Float32Array(1000).fill(-0.5)] };
  assert.equal(C.merge([one, two]).channels[0].length, 2000); const x = C.merge([one, two], 0.2); assert.equal(x.channels[0].length, 1800); assert.ok(Math.abs(x.channels[0][900]) < 0.01, 'middle of the crossfade');
  const m = C.mix([{ rate, channels: [new Float32Array(10).fill(0.8)] }, { rate, channels: [new Float32Array(20).fill(0.8)] }]);
  assert.equal(m.channels[0].length, 20); assert.ok(Math.abs(m.channels[0][0] - 0.98) < 1e-6); assert.ok(Math.abs(m.channels[0][15] - 0.49) < 1e-6); assert.match(m.notes[1], /turned down/);
  const st = C.merge([{ rate, channels: [new Float32Array(5).fill(0.1)] }, { rate: 2000, channels: [new Float32Array(10).fill(0.2), new Float32Array(10).fill(0.3)] }]);
  assert.equal(st.channels.length, 2); assert.equal(st.channels[0].length, 10); assert.equal(st.rate, 1000);
});

test('BMP: 24-bit, rows bottom-up and padded to 4 bytes, see-through on white', () => {
  const p = img(3, 2, (x, y) => (y === 0 ? [255, 0, 0, 255] : x === 0 ? [0, 0, 255, 0] : [0, 128, 0, 255])), b = C.bmp(p), v = dv(b);
  assert.equal(ascii(b, 0, 2), 'BM'); assert.equal(v.getUint32(2, true), b.length); assert.equal(v.getUint32(10, true), 54); assert.equal(v.getInt32(18, true), 3); assert.equal(v.getInt32(22, true), 2); assert.equal(v.getUint16(28, true), 24);
  assert.equal(b.length, 54 + 12 * 2);
  assert.deepEqual([...b.subarray(54, 57)], [255, 255, 255], 'bottom row first: a see-through pixel is white');
  assert.deepEqual([...b.subarray(57, 60)], [0, 128, 0], 'BGR');
  assert.deepEqual([...b.subarray(66, 69)], [0, 0, 255], 'top row red, as BGR');
});

test('TIFF: little-endian, RGB when opaque, RGBA with ExtraSamples when not, the pixels where the strip says', () => {
  const read = (b) => { const v = dv(b), ifd = v.getUint32(4, true), n = v.getUint16(ifd, true), t = {}; for (let i = 0; i < n; i++) { const p = ifd + 2 + i * 12, id = v.getUint16(p, true), type = v.getUint16(p + 2, true), count = v.getUint32(p + 4, true); t[id] = type === 3 && count === 1 ? v.getUint16(p + 8, true) : v.getUint32(p + 8, true); } return t; };
  const o = C.tiff(img(2, 1, (x) => [x * 100, 50, 25, 255])), t = read(o);
  assert.deepEqual([...o.subarray(0, 4)], [0x49, 0x49, 42, 0]); assert.equal(t[256], 2); assert.equal(t[257], 1); assert.equal(t[277], 3); assert.equal(t[262], 2); assert.equal(t[338], undefined);
  assert.deepEqual([...o.subarray(t[273], t[273] + t[279])], [0, 50, 25, 100, 50, 25]);
  const a = C.tiff(img(1, 1, () => [9, 8, 7, 6])), ta = read(a); assert.equal(ta[277], 4); assert.equal(ta[338], 2); assert.deepEqual([...a.subarray(ta[273], ta[273] + 4)], [9, 8, 7, 6]);
});

// an independent GIF reader: the LZW decoder as the GIF89a specification describes it
function readGif(b) {
  assert.equal(ascii(b, 0, 6), 'GIF89a'); const w = b[6] | (b[7] << 8), h = b[8] | (b[9] << 8); let p = 13 + (b[10] & 0x80 ? 3 * (2 << (b[10] & 7)) : 0), clear = null;
  const pal = b.subarray(13, 13 + 768);
  while (b[p] === 0x21) { if (b[p + 1] === 0xf9 && b[p + 3] & 1) clear = b[p + 6]; p += 2; while (b[p]) p += b[p] + 1; p++; }
  assert.equal(b[p], 0x2c); p += 10; const min = b[p++], data = []; while (b[p]) { data.push(...b.subarray(p + 1, p + 1 + b[p])); p += b[p] + 1; } p++; assert.equal(b[p], 0x3b, 'the trailer');
  const CLR = 1 << min, END = CLR + 1, out = []; let size = min + 1, dict = [], prev = null, bit = 0;
  const reset = () => { dict = Array.from({ length: CLR }, (_, i) => [i]); dict.push(null, null); size = min + 1; prev = null; };
  reset();
  for (;;) {
    let code = 0; for (let i = 0; i < size; i++, bit++) code |= ((data[bit >> 3] >> (bit & 7)) & 1) << i;
    if (code === CLR) { reset(); continue; } if (code === END) break;
    let entry; if (code < dict.length && dict[code]) entry = dict[code]; else if (code === dict.length && prev) entry = [...prev, prev[0]]; else assert.fail('a bad LZW code ' + code + ' at bit ' + bit);
    out.push(...entry); if (prev) { dict.push([...prev, entry[0]]); if (dict.length === 1 << size && size < 12) size++; } prev = entry;
  }
  return { w, h, idx: out, pal, clear };
}

test('GIF: the LZW codes decode back to the same indexes, past the 4096-code reset; see-through kept', () => {
  // noise makes the dictionary fill and reset several times
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32;
  const noise = img(97, 83, () => [rnd() * 256, rnd() * 256, rnd() * 256, 255]), q = C.quantize(noise), g = readGif(Uint8Array.from(C.gif(noise)));
  assert.equal(g.w, 97); assert.equal(g.h, 83); assert.deepEqual(g.idx, [...q.idx]); assert.equal(g.clear, null);
  const flat = img(300, 200, () => [255, 0, 0, 255]), gf = readGif(C.gif(flat)); assert.equal(gf.idx.length, 60000); assert.ok(gf.idx.every((i) => i === gf.idx[0]));
  const k = gf.idx[0]; assert.deepEqual([...gf.pal.subarray(k * 3, k * 3 + 3)], [255, 0, 0]);
  const holes = readGif(C.gif(img(4, 4, (x, y) => (x === y ? [0, 0, 0, 0] : [255, 255, 255, 255])))); assert.equal(holes.clear, 255); assert.equal(holes.idx[0], 255); assert.equal(holes.idx[5], 255); assert.notEqual(holes.idx[1], 255);
  assert.equal(readGif(C.gif(img(1, 1, () => [0, 0, 0, 255]))).idx.length, 1);
});

test('GIF speed: every frame delay divided, the pictures untouched', () => {
  const still = C.gif(img(2, 2, () => [10, 20, 30, 255]));
  // an animation of 2 frames, 50 cs each, built from the still one
  const at = still.indexOf(0x2c), frame = still.subarray(at, still.length - 1), gce = [0x21, 0xf9, 4, 0, 50, 0, 0, 0];
  const anim = Uint8Array.from([...still.subarray(0, at), ...gce, ...frame, ...gce, ...frame, 0x3b]);
  const r = C.gifSpeed(anim, 2); assert.equal(r.frames, 2); assert.match(r.notes[0], /1\.00 s a loop becomes 0\.50 s/);
  const d = []; for (let i = 0; i < r.bytes.length - 5; i++) if (r.bytes[i] === 0x21 && r.bytes[i + 1] === 0xf9) d.push(r.bytes[i + 4] | (r.bytes[i + 5] << 8)); assert.deepEqual(d, [25, 25]);
  assert.equal(r.bytes.length, anim.length); assert.deepEqual(C.gifSpeed(anim, 100).bytes[at + 4], 5, 'the fastest is 10 times');
  assert.match(C.gifSpeed(still, 2).notes[0], /still GIF/); assert.throws(() => C.gifSpeed(Uint8Array.of(1, 2, 3, 4), 2), /not a GIF/);
});

test('words in: text, HTML (scripts out, entities in), RTF (tables out, Unicode and Windows-1252 in)', () => {
  assert.deepEqual(C.textParas('one\ntwo'), ['one', 'two']); assert.deepEqual(C.textParas('a b\nc\n\n d '), ['a b\nc', 'd']);
  const h = C.htmlParas('<html><head><title>T &amp; U</title><style>p{}</style></head><body><h1>Head</h1><script>bad()</script><p>a&nbsp;b &eacute; &#233; &#x41;</p><ul><li>x</li><li>y</li></ul></body></html>');
  assert.equal(h.title, 'T & U'); assert.deepEqual(h.paras, ['Head', 'a b é é A', 'x', 'y']);
  const r = C.rtfParas('{\\rtf1\\ansi{\\fonttbl{\\f0 Times;}}{\\*\\generator x;}\\f0 Caf\\\'e9 \\u8364?5\\par {\\b bold} \\\'93q\\\'94\\par\\pard Last}');
  assert.deepEqual(r.paras, ['Café €5', 'bold “q”', 'Last']);
});

test('words out and back: TXT, HTML, RTF, DOCX and EPUB keep the title and every paragraph', async () => {
  const doc = { title: 'A <Title> & more', paras: ['First line, é and “quotes”.', 'Second {braces} \\ back', 'Third\nwith a break'] };
  assert.equal(new TextDecoder().decode(C.txtOf(doc)), doc.title + '\n\n' + doc.paras.join('\n\n') + '\n');
  const h = C.htmlParas(new TextDecoder().decode(C.htmlOf(doc))); assert.equal(h.title, doc.title); assert.deepEqual(h.paras, [doc.title, ...doc.paras]);
  assert.deepEqual(C.rtfParas(new TextDecoder().decode(C.rtfOf(doc))).paras, [doc.title, ...doc.paras]);
  const d = await C.docxParas(await C.docxBytesOf(doc));
  assert.equal(d.paras[0], doc.title); assert.equal(d.paras[1], doc.paras[0]); assert.equal(d.paras.length, 4);
  const ep = C.epubOf(doc, new Date('2026-10-29T12:00:00Z')), files = await unzip(ep);
  assert.equal(files[0].name, 'mimetype'); assert.equal(ascii(ep, 30, 8), 'mimetype'); assert.equal(ascii(ep, 38, 20), 'application/epub+zip');
  assert.deepEqual(files.map((f) => f.name).sort(), ['META-INF/container.xml', 'OEBPS/content.opf', 'OEBPS/nav.xhtml', 'OEBPS/text.xhtml', 'OEBPS/toc.ncx', 'mimetype']);
  const back = await C.epubParas(ep); assert.equal(back.title, doc.title); assert.deepEqual(back.paras, [doc.title, ...doc.paras]);
  assert.match(new TextDecoder().decode(files.find((f) => f.name === 'OEBPS/content.opf').data), /<meta property="dcterms:modified">2026-10-29T12:00:00Z<\/meta>/);
});

test('PDF out: A4 pages with pdf-lib, the title set, words it cannot draw counted, long text runs onto more pages', async () => {
  const one = await C.pdfOf(L, { title: 'Hello', paras: ['A short line.', 'Snow ☃ man'] });
  assert.equal(one.pages, 1); assert.equal(one.lost, 1); const p = await L.PDFDocument.load(one.bytes); assert.equal(p.getTitle(), 'Hello'); assert.equal(Math.round(p.getPage(0).getWidth()), 595);
  const long = await C.pdfOf(L, { title: '', paras: Array.from({ length: 120 }, (_, i) => 'Paragraph ' + i + ' ' + 'word '.repeat(40)) });
  assert.ok(long.pages > 5, long.pages + ' pages'); assert.equal(long.lost, 0);
  assert.deepEqual(C.winAnsi('a\tb€'), { text: 'a    b€', lost: 0 });
});

test('download names: the new ending, unique, no unsafe characters', () => {
  const taken = new Set();
  assert.equal(C.outName('song.mp3', 'wav', taken), 'song.wav'); assert.equal(C.outName('song.flac', 'wav', taken), 'song (2).wav');
  assert.equal(C.outName('a/b:c?.png', 'jpg'), 'a_b_c_.jpg'); assert.equal(C.outName('', 'txt'), 'file.txt');
  for (const t of ['wav', 'aiff', 'jpg', 'png', 'gif', 'bmp', 'tiff', 'pdf', 'txt', 'html', 'rtf', 'docx', 'epub']) assert.ok(C.MIME[t], t);
});

test('the asks that open the converter, and the ones that stay with the photo, PDF and unit pages', async () => {
  const { converterAskOf } = await import('../void-live-deploy/lib/converter-ask.js');
  assert.equal(converterAskOf('mp4 to mp3'), '/converter/?q=mp4%20to%20mp3');
  assert.equal(converterAskOf('convert my pdf to word'), '/converter/?q=pdf%20to%20docx');
  assert.equal(converterAskOf('Cut an MP3'), '/converter/?q=cut%20mp3');
  assert.equal(converterAskOf('file converter'), '/converter/');
  for (const a of ['png to jpg', 'jpg to pdf', 'merge pdf', '5 km to miles', 'unit converter', 'translate hello to french', '']) assert.equal(converterAskOf(a), '', a);
  const S = (await import('../void-live-deploy/skills/converter.js')).default;
  for (const a of S.examples) assert.ok(S.match(a.toLowerCase(), a), 'example ' + a);
  for (const a of S.nearMisses) assert.ok(!S.match(a.toLowerCase(), a), 'near miss ' + a);
});

test('the skill card says the same tool count as the catalog', async () => {
  const { TOOL_COUNT } = await import('../void-live-deploy/skills/converter.js');
  assert.equal(TOOL_COUNT, C.CATALOG.length);
});

test('the toolkit router sends a converter ask to /converter/ and leaves the others where they were', async () => {
  const { routeAsk } = await import('../void-live-deploy/lib/toolkit.js');
  assert.equal(routeAsk('mp4 to mp3'), '/converter/?q=mp4%20to%20mp3');
  assert.equal(routeAsk('merge audio'), '/converter/?q=merge%20audio');
  assert.notEqual(routeAsk('100 c to f').split('?')[0], '/converter/');
  assert.notEqual(routeAsk('png to jpg').split('?')[0], '/converter/');
});
