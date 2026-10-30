/**
 * pdf-tools: the PDF tools of /pdf/ and its pages, all on the device (owner, 2026-10-26: "everything the sites have", PDF tools floor). A file is read
 * and written here in the browser by pdf-lib (MIT, vendored at /vendor/pdf-lib-1.17.1/) and pdf.js (Apache-2.0, /vendor/pdfjs-6.4.299/); nothing is
 * uploaded. `engine(PDFLib)` takes the pdf-lib namespace (the global PDFLib in the browser, the vendored file in node tests), so every
 * function here is tested in node (tools/pdf-tools.test.mjs). Pages are counted 1-based in what people type and 0-based inside.
 * What it does not do, and why: no password protection or unlocking (pdf-lib cannot encrypt), no Office conversion or OCR (those need a server),
 * no editing of existing text (a PDF holds no paragraphs to edit).
 */

/** "1-3, 5, 8-" -> [0,1,2,4,7,...] against n pages; "even", "odd" and "last" work; out-of-range numbers are dropped; order and repeats kept. Pure. */
export function parsePages(spec, n) {
  const out = [], s = String(spec == null ? '' : spec).toLowerCase().replace(/\s+/g, '');
  if (!s) return [];
  for (const part of s.split(',')) {
    if (!part) continue;
    if (part === 'even' || part === 'odd') { for (let i = 1; i <= n; i++) if ((i % 2 === 0) === (part === 'even')) out.push(i - 1); continue; }
    if (part === 'all') { for (let i = 0; i < n; i++) out.push(i); continue; }
    const m = /^(\d+|last)?(?:-(\d+|last)?)?$/.exec(part); if (!m || (!m[1] && !m[2])) continue;
    const num = (x, d) => (x === 'last' ? n : x ? +x : d);
    if (!part.includes('-')) { const a = num(m[1]); if (a >= 1 && a <= n) out.push(a - 1); continue; }
    let a = num(m[1], 1), b = num(m[2], n); if (a > b) [a, b] = [b, a];
    for (let i = Math.max(1, a); i <= Math.min(n, b); i++) out.push(i - 1);
  }
  return out;
}
/** page groups for a split: "1-3;4-6" -> [[0,1,2],[3,4,5]]; every N -> chunks; each -> one page each. Pure. */
export function splitGroups(n, { ranges, every, each } = {}) {
  if (each) return Array.from({ length: n }, (_, i) => [i]);
  if (every > 0) { const k = Math.floor(every), g = []; for (let i = 0; i < n; i += k) g.push(Array.from({ length: Math.min(k, n - i) }, (_, j) => i + j)); return g; }
  return String(ranges || '').split(/[;\n]/).map((r) => parsePages(r, n)).filter((g) => g.length);
}
/** a byte count as people read it ("1.4 MB"). Pure. */
export const sizeText = (b) => (b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(b < 10240 ? 1 : 0) + ' KB' : (b / 1048576).toFixed(b < 10485760 ? 2 : 1) + ' MB');
/** page sizes in points for images to PDF (portrait). Pure. */
export const PAGE_SIZES = Object.freeze({ a4: [595.28, 841.89], letter: [612, 792], a5: [419.53, 595.28], legal: [612, 1008] });
/** the type of an image from its first bytes: 'jpg', 'png' or '' (anything else is converted through a canvas by the page). Pure. */
export function imageKind(b) {
  if (b && b[0] === 0xff && b[1] === 0xd8) return 'jpg';
  if (b && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  return '';
}
/** a minimal ZIP (stored, no compression) of [{ name, bytes }], for many page pictures in one download. Pure. */
export function zip(files) {
  const te = new TextEncoder(), crcT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = crcT[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const parts = [], central = []; let off = 0;
  for (const f of files) {
    const name = te.encode(f.name), data = f.bytes, c = crc(data);
    const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint32(14, c, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
    parts.push(new Uint8Array(h.buffer), name, data);
    const d = new DataView(new ArrayBuffer(46)); d.setUint32(0, 0x02014b50, true); d.setUint16(4, 20, true); d.setUint16(6, 20, true); d.setUint16(8, 0x0800, true); d.setUint32(16, c, true); d.setUint32(20, data.length, true); d.setUint32(24, data.length, true); d.setUint16(28, name.length, true); d.setUint32(42, off, true);
    central.push(new Uint8Array(d.buffer), name); off += 30 + name.length + data.length;
  }
  const cl = central.reduce((s, p) => s + p.length, 0), e = new DataView(new ArrayBuffer(22)); e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cl, true); e.setUint32(16, off, true);
  const all = [...parts, ...central, new Uint8Array(e.buffer)], out = new Uint8Array(all.reduce((s, p) => s + p.length, 0)); let o = 0; for (const p of all) { out.set(p, o); o += p.length; }
  return out;
}

/** the tools, over a pdf-lib namespace. Every tool takes bytes and returns bytes (or a list of { name, bytes }). */
export function engine(L) {
  const { PDFDocument, degrees, rgb, StandardFonts } = L;
  const open = (bytes) => PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
  const save = (doc) => doc.save({ useObjectStreams: true });
  const pageCount = async (bytes) => (await open(bytes)).getPageCount();
  /** one new PDF from a list of page entries { doc: index into docs, page: 0-based, rotate?: extra degrees }. */
  async function assemble(docsBytes, entries) {
    const out = await PDFDocument.create(), docs = await Promise.all(docsBytes.map(open));
    for (const e of entries) {
      const src = docs[e.doc]; if (!src || e.page < 0 || e.page >= src.getPageCount()) continue;
      const [p] = await out.copyPages(src, [e.page]); if (e.rotate) p.setRotation(degrees((((p.getRotation().angle + e.rotate) % 360) + 360) % 360)); out.addPage(p);
    }
    return save(out);
  }
  /** merge: whole files, in the order given; each can name its pages ("1-3") */
  async function merge(files) {
    const docs = files.map((f) => f.bytes), entries = [];
    for (let i = 0; i < files.length; i++) { const n = await pageCount(docs[i]), idx = files[i].pages ? parsePages(files[i].pages, n) : Array.from({ length: n }, (_, k) => k); for (const page of idx) entries.push({ doc: i, page }); }
    return assemble(docs, entries);
  }
  /** split: ranges "1-3;4-6", every N pages, or each page: [{ name, bytes }] */
  async function split(bytes, opts, base = 'part') {
    const n = await pageCount(bytes), groups = splitGroups(n, opts), out = [];
    for (let g = 0; g < groups.length; g++) out.push({ name: base + '-' + (g + 1) + '.pdf', bytes: await assemble([bytes], groups[g].map((page) => ({ doc: 0, page }))) });
    return out;
  }
  const extract = async (bytes, spec) => { const n = await pageCount(bytes), idx = parsePages(spec, n); if (!idx.length) throw new Error('No such pages'); return assemble([bytes], idx.map((page) => ({ doc: 0, page }))); };
  async function remove(bytes, spec) {
    const n = await pageCount(bytes), gone = new Set(parsePages(spec, n)); if (!gone.size) throw new Error('No such pages'); if (gone.size >= n) throw new Error('That would remove every page');
    return assemble([bytes], Array.from({ length: n }, (_, page) => page).filter((p) => !gone.has(p)).map((page) => ({ doc: 0, page })));
  }
  /** rotate the pages named by spec (all when empty) by deg (90, 180, 270 or -90), keeping every other page as it is */
  async function rotate(bytes, spec, deg) {
    const doc = await open(bytes), n = doc.getPageCount(), idx = new Set(spec ? parsePages(spec, n) : Array.from({ length: n }, (_, i) => i));
    doc.getPages().forEach((p, i) => { if (idx.has(i)) p.setRotation(degrees((((p.getRotation().angle + deg) % 360) + 360) % 360)); });
    return save(doc);
  }
  /** reverse the page order */
  const reverse = async (bytes) => { const n = await pageCount(bytes); return assemble([bytes], Array.from({ length: n }, (_, i) => ({ doc: 0, page: n - 1 - i }))); };
  /** images to one PDF: items { bytes, kind: 'jpg'|'png' }; size 'fit' makes each page the picture's size; margin in points */
  async function imagesToPdf(items, { size = 'a4', landscape = false, margin = 0 } = {}) {
    const doc = await PDFDocument.create();
    for (const it of items) {
      const img = it.kind === 'png' ? await doc.embedPng(it.bytes) : await doc.embedJpg(it.bytes);
      if (size === 'fit') { const p = doc.addPage([img.width, img.height]); p.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height }); continue; }
      let [w, h] = PAGE_SIZES[size] || PAGE_SIZES.a4; if (landscape) [w, h] = [h, w];
      const p = doc.addPage([w, h]), k = Math.min((w - 2 * margin) / img.width, (h - 2 * margin) / img.height), dw = img.width * k, dh = img.height * k;
      p.drawImage(img, { x: (w - dw) / 2, y: (h - dh) / 2, width: dw, height: dh });
    }
    return save(doc);
  }
  /** page numbers: pos 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-...'; format 'n' | 'n of N' | 'Page n'; start at `start` */
  async function numberPages(bytes, { pos = 'bottom-center', start = 1, format = 'n', size = 11, skipFirst = false } = {}) {
    const doc = await open(bytes), font = await doc.embedFont(StandardFonts.Helvetica), pages = doc.getPages(), total = pages.length + start - 1;
    pages.forEach((p, i) => {
      if (skipFirst && i === 0) return;
      const num = i + start, t = format === 'n of N' ? num + ' of ' + total : format === 'Page n' ? 'Page ' + num : String(num), w = font.widthOfTextAtSize(t, size), { width, height } = p.getSize();
      const x = pos.endsWith('left') ? 36 : pos.endsWith('right') ? width - 36 - w : (width - w) / 2, y = pos.startsWith('top') ? height - 36 : 28;
      p.drawText(t, { x, y, size, font, color: rgb(0.2, 0.2, 0.2) });
    });
    return save(doc);
  }
  /** a text watermark across every page (or the named ones) at an angle with opacity */
  async function watermark(bytes, text, { opacity = 0.25, size = 64, angle = 45, spec = '' } = {}) {
    const doc = await open(bytes), font = await doc.embedFont(StandardFonts.HelveticaBold), pages = doc.getPages(), idx = new Set(spec ? parsePages(spec, pages.length) : pages.map((_, i) => i));
    const clean = String(text).replace(/[^\x20-\x7e -ÿ]/g, '?');
    pages.forEach((p, i) => {
      if (!idx.has(i)) return; const { width, height } = p.getSize(), w = font.widthOfTextAtSize(clean, size), rad = (angle * Math.PI) / 180;
      p.drawText(clean, { x: width / 2 - (w / 2) * Math.cos(rad), y: height / 2 - (w / 2) * Math.sin(rad) - size / 3, size, font, rotate: degrees(angle), opacity, color: rgb(0.45, 0.45, 0.5) });
    });
    return save(doc);
  }
  /** crop margins (points) off the named pages (all when empty) by setting the page's crop box */
  async function crop(bytes, { top = 0, right = 0, bottom = 0, left = 0 } = {}, spec = '') {
    const doc = await open(bytes), pages = doc.getPages(), idx = new Set(spec ? parsePages(spec, pages.length) : pages.map((_, i) => i));
    pages.forEach((p, i) => { if (!idx.has(i)) return; const { x, y, width, height } = p.getMediaBox(), w = width - left - right, h = height - top - bottom; if (w < 10 || h < 10) throw new Error('That crops the whole page away'); p.setCropBox(x + left, y + bottom, w, h); });
    return save(doc);
  }
  /** document information: read it, or set title, author, subject, keywords */
  async function info(bytes, set) {
    const doc = await open(bytes);
    if (set) { if (set.title != null) doc.setTitle(set.title); if (set.author != null) doc.setAuthor(set.author); if (set.subject != null) doc.setSubject(set.subject); if (set.keywords != null) doc.setKeywords(String(set.keywords).split(',').map((s) => s.trim()).filter(Boolean)); return save(doc); }
    return { pages: doc.getPageCount(), title: doc.getTitle() || '', author: doc.getAuthor() || '', subject: doc.getSubject() || '', keywords: doc.getKeywords() || '' };
  }
  /** a lossless tidy: object streams on and metadata kept; honest about being small when the file was already packed */
  const optimize = async (bytes) => save(await open(bytes));
  return { assemble, merge, split, extract, remove, rotate, reverse, imagesToPdf, numberPages, watermark, crop, info, optimize, pageCount };
}

// ---- browser side: pdf-lib and pdf.js are loaded when a tool is first used ----
const LIB = '/vendor/pdf-lib-1.17.1/pdf-lib.min.js', PDFJS = '/vendor/pdfjs-6.4.299/build/pdf.min.js', PDFJS_WORKER = '/vendor/pdfjs-6.4.299/build/pdf.worker.min.js';
let libP = null, jsP = null;
/** pdf-lib's namespace, loaded once (a classic script: it sets the global PDFLib) */
export function loadLib() {
  if (typeof globalThis.PDFLib !== 'undefined') return Promise.resolve(globalThis.PDFLib);
  return (libP = libP || new Promise((res, rej) => { const s = document.createElement('script'); s.src = LIB; s.onload = () => res(globalThis.PDFLib); s.onerror = () => { libP = null; rej(new Error('The PDF tools did not load; check the connection once and they will work offline afterwards')); }; document.head.append(s); }));
}
export async function tools() { return engine(await loadLib()); }
/** pdf.js 6 calls Map.getOrInsert and getOrInsertComputed, which only the newest browsers have: the same two methods for the others */
export function polyfill() {
  for (const C of [Map, WeakMap]) {
    if (!C.prototype.getOrInsert) Object.defineProperty(C.prototype, 'getOrInsert', { value(k, v) { if (!this.has(k)) this.set(k, v); return this.get(k); }, configurable: true, writable: true });
    if (!C.prototype.getOrInsertComputed) Object.defineProperty(C.prototype, 'getOrInsertComputed', { value(k, f) { if (!this.has(k)) this.set(k, f(k)); return this.get(k); }, configurable: true, writable: true });
  }
}
/** pdf.js, loaded once */
export function loadJs() { polyfill(); return (jsP = jsP || import(PDFJS).then((m) => { m.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; return m; }).catch((e) => { jsP = null; throw e; })); }
/** a rendered page: canvas at `scale` of the page's natural size (1 = 72 dpi) */
export async function renderPage(pdfDoc, pageNo, scale) {
  const page = await pdfDoc.getPage(pageNo), vp = page.getViewport({ scale }), c = document.createElement('canvas');
  c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
  await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise; return c;
}
const toBlob = (c, type, q) => new Promise((res) => c.toBlob(res, type, q));
/** compress by redrawing every page as a JPEG picture at `dpi` and `quality` (text is no longer selectable): bytes, or null when no smaller */
export async function compressByPictures(bytes, { dpi = 110, quality = 0.6 } = {}, progress = () => {}) {
  const js = await loadJs(), L = await loadLib(), src = await js.getDocument({ data: bytes.slice() }).promise, out = await L.PDFDocument.create();
  for (let i = 1; i <= src.numPages; i++) {
    progress(i, src.numPages); const pg = await src.getPage(i), nat = pg.getViewport({ scale: 1 }), c = await renderPage(src, i, dpi / 72), jpg = new Uint8Array(await (await toBlob(c, 'image/jpeg', quality)).arrayBuffer());
    const img = await out.embedJpg(jpg), p = out.addPage([nat.width, nat.height]); p.drawImage(img, { x: 0, y: 0, width: nat.width, height: nat.height });
  }
  const res = await out.save({ useObjectStreams: true }); return res.length < bytes.length ? res : null;
}
/** every page (or the named ones) as a picture file: [{ name, bytes }] */
export async function pagesToImages(bytes, { type = 'image/png', dpi = 150, spec = '' } = {}, progress = () => {}) {
  const js = await loadJs(), src = await js.getDocument({ data: bytes.slice() }).promise, idx = spec ? parsePages(spec, src.numPages) : Array.from({ length: src.numPages }, (_, i) => i), out = [], ext = type === 'image/jpeg' ? 'jpg' : 'png';
  for (let k = 0; k < idx.length; k++) { progress(k + 1, idx.length); const c = await renderPage(src, idx[k] + 1, dpi / 72); out.push({ name: 'page-' + (idx[k] + 1) + '.' + ext, bytes: new Uint8Array(await (await toBlob(c, type, 0.92)).arrayBuffer()) }); }
  return out;
}
/** any picture the browser can show (WebP, GIF, BMP, HEIC where supported) as JPEG or PNG bytes, for images to PDF */
export async function toPdfImage(file) {
  const raw = new Uint8Array(await file.arrayBuffer()), kind = imageKind(raw); if (kind) return { bytes: raw, kind };
  const bmp = await createImageBitmap(file), c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0);
  return { bytes: new Uint8Array(await (await toBlob(c, 'image/jpeg', 0.92)).arrayBuffer()), kind: 'jpg' };
}
