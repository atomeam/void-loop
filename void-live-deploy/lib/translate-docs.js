// Documents for the translate page (/translate/, the tower's Google Translate floor): a .docx, .pptx or .xlsx is unzipped in the browser, the
// words in its XML text runs are translated paragraph by paragraph, and the same file is zipped back with every style, table, picture, slide
// and formula where it was. Nothing is uploaded but the words, in chunks under /api/translate's 5,000-character cap; nothing is stored.
// How the best do it (Google, DeepL, onlinedoctranslator): translate whole paragraphs (a sentence split over three runs is one sentence), put
// the translation in the paragraph's first run and empty the rest. A paragraph keeps its own style; bold on one word inside a paragraph
// takes the first run's look. A .pdf is read page by page (pdf.js on the device, the page does it) and comes back as a .docx with one page
// per page: the words keep their pages and paragraphs, not the PDF's exact layout. Pure but for DecompressionStream/CompressionStream,
// which browsers and Node 18+ both have.

const te = new TextEncoder(), td = new TextDecoder();

// ---- zip ------------------------------------------------------------------------------------------------------------------------------
let CRC = null;
/** CRC-32 (the zip one). Pure. */
export function crc32(bytes) {
  if (!CRC) { CRC = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; } }
  let c = 0xffffffff; for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
const pipe = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

/** a zip's files: [{ name, data }] in the zip's own order (stored and deflated entries; no zip64, no encryption). */
export async function unzip(input) {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input), v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let e = -1; for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('not a zip file');
  const count = v.getUint16(e + 10, true); let p = v.getUint32(e + 16, true); const out = [];
  for (let k = 0; k < count; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('a broken zip directory');
    const flags = v.getUint16(p + 8, true), method = v.getUint16(p + 10, true), size = v.getUint32(p + 20, true);
    const nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), at = v.getUint32(p + 42, true);
    const name = td.decode(b.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
    if (flags & 1) throw new Error('the file is password-protected');
    const start = at + 30 + v.getUint16(at + 26, true) + v.getUint16(at + 28, true), raw = b.subarray(start, start + size);
    if (name.endsWith('/')) continue;
    out.push({ name, data: method === 0 ? raw.slice() : method === 8 ? await pipe(raw, new DecompressionStream('deflate-raw')) : (() => { throw new Error('an unknown zip method ' + method); })() });
  }
  return out;
}

/** files [{ name, data }] -> zip bytes, deflated (stored where the browser cannot deflate). */
export async function zip(files) {
  const parts = [], dir = []; let off = 0;
  const canDeflate = typeof CompressionStream === 'function';
  for (const f of files) {
    const name = te.encode(f.name), data = f.data instanceof Uint8Array ? f.data : te.encode(String(f.data)), crc = crc32(data);
    const packed = canDeflate ? await pipe(data, new CompressionStream('deflate-raw')) : data, method = canDeflate ? 8 : 0;
    const h = new Uint8Array(30 + name.length), hv = new DataView(h.buffer);
    hv.setUint32(0, 0x04034b50, true); hv.setUint16(4, 20, true); hv.setUint16(6, 0x0800, true); hv.setUint16(8, method, true); hv.setUint16(12, 0x21, true);
    hv.setUint32(14, crc, true); hv.setUint32(18, packed.length, true); hv.setUint32(22, data.length, true); hv.setUint16(26, name.length, true); h.set(name, 30);
    const c = new Uint8Array(46 + name.length), cv = new DataView(c.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(10, method, true); cv.setUint16(14, 0x21, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, packed.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, name.length, true); cv.setUint32(42, off, true); c.set(name, 46);
    parts.push(h, packed); dir.push(c); off += h.length + packed.length;
  }
  const dsize = dir.reduce((n, c) => n + c.length, 0), end = new Uint8Array(22), ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true); ev.setUint32(12, dsize, true); ev.setUint32(16, off, true);
  const all = new Uint8Array(off + dsize + 22); let p = 0; for (const x of [...parts, ...dir, end]) { all.set(x, p); p += x.length; }
  return all;
}

// ---- the words in Office XML ----------------------------------------------------------------------------------------------------------
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
export const unxml = (s) => String(s).replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e.toLowerCase()]));
export const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// which parts of which file hold words, and the tags that make a paragraph and a run of text
export const OFFICE = {
  docx: [{ file: /^word\/(?:document|header\d*|footer\d*|footnotes|endnotes|comments)\.xml$/, para: 'w:p', text: 'w:t', skip: [] }],
  pptx: [{ file: /^ppt\/(?:slides\/slide\d+|notesSlides\/notesSlide\d+|diagrams\/data\d+)\.xml$/, para: 'a:p', text: 'a:t', skip: [] }],
  xlsx: [{ file: /^xl\/sharedStrings\.xml$/, para: 'si', text: 't', skip: ['rPh', 'phoneticPr'] }, { file: /^xl\/worksheets\/sheet\d+\.xml$/, para: 'is', text: 't', skip: ['rPh'] }],
};
export const kindOf = (name) => { const m = String(name || '').toLowerCase().match(/\.(docx|pptx|xlsx|pdf)$/); return m ? m[1] : ''; };

/** the paragraphs in one XML part: [{ text, segs: [{ start, end, open: [a, b] }] }], a paragraph's text the runs' text joined. Pure.
 *  Nested paragraphs (a text box inside a paragraph) are their own paragraphs; a run belongs to the innermost one. */
export function paragraphsOf(src, { para, text, skip = [] }) {
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<(\/?)([A-Za-z_][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
  const paras = [], stack = []; let m, skipping = 0, inText = null;
  while ((m = re.exec(src))) {
    const [all, close, tag, , self] = m; if (!tag) continue;
    if (skip.includes(tag)) { if (!self) skipping += close ? -1 : 1; continue; }
    if (tag === para) { if (self) continue; if (close) stack.pop(); else { paras.push({ text: '', segs: [] }); stack.push(paras.length - 1); } continue; }
    if (tag === text && !skipping && stack.length) {
      if (self) continue;
      if (!close) inText = { start: m.index + all.length, open: [m.index, m.index + all.length] };
      else if (inText) { const p = paras[stack[stack.length - 1]], seg = { ...inText, end: m.index }; p.segs.push(seg); p.text += unxml(src.slice(seg.start, seg.end)); inText = null; }
    }
  }
  return paras.filter((p) => p.segs.length);
}
const worthy = (t) => /\p{L}/u.test(t);

/** one XML part with its paragraphs' translations put back: each paragraph's text in its first run (its spaces at the ends kept), the other
 *  runs emptied, xml:space="preserve" added to a w:t that needs it. tr(text) -> translation or undefined (left as it was). Pure. */
export function rebuildXml(src, paras, tr) {
  const edits = [];
  for (const p of paras) {
    const core = p.text.trim(); if (!worthy(core)) continue;
    const t = tr(core); if (t == null || t === core) continue;
    const lead = p.text.match(/^\s*/)[0], tail = p.text.match(/\s*$/)[0];
    p.segs.forEach((s, i) => {
      edits.push([s.start, s.end, i ? '' : xml(lead + t + tail)]);
      if (i === 0) { const open = src.slice(s.open[0], s.open[1]); if (/^<w:t\b/.test(open) && !/xml:space=/.test(open)) edits.push([s.open[1] - 1, s.open[1] - 1, ' xml:space="preserve"']); }
    });
  }
  edits.sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  let out = src; for (const [a, b, s] of edits) out = out.slice(0, a) + s + out.slice(b);
  return out;
}

/** an Office file's words and how to put them back: { kind, parts: [unique paragraph texts], rebuild(translations) -> zip bytes }. */
export async function readOffice(name, bytes) {
  const kind = kindOf(name), rules = OFFICE[kind]; if (!rules) throw new Error('not a .docx, .pptx or .xlsx file');
  const files = await unzip(bytes), found = [], seen = new Map();
  for (const f of files) {
    const rule = rules.find((r) => r.file.test(f.name)); if (!rule) continue;
    const src = td.decode(f.data), paras = paragraphsOf(src, rule);
    found.push({ f, src, paras });
    for (const p of paras) { const t = p.text.trim(); if (worthy(t) && !seen.has(t)) seen.set(t, seen.size); }
  }
  if (!found.length) throw new Error(kind === 'docx' ? 'no Word document inside the file' : kind === 'pptx' ? 'no slides inside the file' : 'no sheets inside the file');
  const parts = [...seen.keys()];
  return {
    kind, parts, files: found.length,
    rebuild: async (translated) => {
      const tr = (t) => (seen.has(t) ? translated[seen.get(t)] : undefined), changed = new Map(found.map(({ f, src, paras }) => [f.name, te.encode(rebuildXml(src, paras, tr))]));
      return zip(files.map((f) => ({ name: f.name, data: changed.get(f.name) || f.data })));
    },
  };
}

// ---- PDF in, .docx out ----------------------------------------------------------------------------------------------------------------
/** one page's lines -> paragraphs: lines run on until a blank line or a short line that ends a sentence; a hyphen at a line's end joins. Pure. */
export function pdfParagraphs(text) {
  const lines = String(text || '').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()), longest = Math.max(1, ...lines.map((l) => l.length));
  const out = []; let cur = '';
  const end = () => { if (cur.trim()) out.push(cur.trim()); cur = ''; };
  for (const l of lines) {
    if (!l) { end(); continue; }
    cur = !cur ? l : /[\p{L}]-$/u.test(cur) ? cur.slice(0, -1) + l : cur + ' ' + l;
    if (/[.!?:;。！？"”)]$/.test(l) && l.length < longest * 0.8) end();
  }
  end();
  return out;
}

/** pages of paragraphs -> a plain .docx (one page per page, a page break between), as zip bytes. */
export async function docxOf(pages, lang = '') {
  const p = (t) => '<w:p><w:r><w:t xml:space="preserve">' + xml(t) + '</w:t></w:r></w:p>', brk = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
  const rtl = /^(?:ar|fa|he|ur|ps|sd|yi)$/.test(lang);
  const body = pages.map((paras) => (paras.length ? paras : ['']).map((t) => (rtl ? p(t).replace('<w:p>', '<w:p><w:pPr><w:bidi/></w:pPr>') : p(t))).join('')).join(brk);
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main', R = 'http://schemas.openxmlformats.org/package/2006/relationships';
  return zip([
    { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="' + R + '"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { name: 'word/document.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="' + W + '"><w:body>' + body + '<w:sectPr/></w:body></w:document>' },
  ]);
}

// ---- chunks ---------------------------------------------------------------------------------------------------------------------------
/** texts -> batches for /api/translate (each joined by blank lines stays under max characters and maxParts pieces), a text longer than max
 *  cut at its sentences (or spaces) and joined again after: { batches: [[piece]], join(translatedPieces) -> translations }. Pure. */
export function batchesOf(texts, max = 4500, maxParts = 40) {
  const pieces = [], owner = [];
  texts.forEach((t, i) => {
    const s = String(t).replace(/\s*\n\s*/g, ' ').trim();
    if (s.length <= max) { pieces.push(s); owner.push(i); return; }
    let cur = '';
    for (let sent of s.split(/(?<=[.!?。！？])\s+/)) {
      while (sent.length > max) { const cut = sent.lastIndexOf(' ', max) > max / 2 ? sent.lastIndexOf(' ', max) : max; if (cur) { pieces.push(cur); owner.push(i); cur = ''; } pieces.push(sent.slice(0, cut)); owner.push(i); sent = sent.slice(cut).trim(); }
      if (cur && cur.length + 1 + sent.length > max) { pieces.push(cur); owner.push(i); cur = ''; }
      cur = cur ? cur + ' ' + sent : sent;
    }
    if (cur) { pieces.push(cur); owner.push(i); }
  });
  const batches = []; let b = [], len = 0;
  for (const p of pieces) { if (b.length && (len + 2 + p.length > max || b.length >= maxParts)) { batches.push(b); b = []; len = 0; } len += (b.length ? 2 : 0) + p.length; b.push(p); }
  if (b.length) batches.push(b);
  return {
    batches, pieces: pieces.length,
    join: (outs) => { const r = texts.map(() => []); outs.forEach((o, k) => r[owner[k]].push(o)); return r.map((x) => x.join(' ')); },
  };
}
