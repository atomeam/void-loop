// EPUB edits on the device (/converter/): the change of a book's cover, the merge of 2 or more books into one, and the compression of a book or a comic (CBZ). Pure: no DOM; the page passes in the picture, already in the format
// the book needs, so the same code runs in node tests. A book is read with its own zip directory and written again with the mimetype first and
// stored, as the EPUB container standard (OCF) asks. Every file the edit does not touch keeps its bytes exactly.
import { unzip, crc32, xml } from './translate-docs.js';

const te = new TextEncoder(), td = new TextDecoder();
const pipe = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

/** the attributes of one XML start tag, as an object (names as written). */
export function attrs(tag) {
  const o = {}; for (const m of tag.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) o[m[1]] = m[2] != null ? m[2] : m[3]; return o;
}
const dirOf = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/') + 1) : '');
/** a path inside the zip from a link written in a file at `from` ("../images/a.jpg" from "EPUB/text/c1.xhtml" is "EPUB/images/a.jpg"). */
export function resolve(from, href) {
  const out = []; for (const s of (dirOf(from) + decodeURIComponent(href.split('#')[0])).split('/')) { if (s === '..') out.pop(); else if (s !== '.' && s !== '') out.push(s); }
  return out.join('/');
}

/** an EPUB's parts: { files: [{ name, data }], opfPath, opf, version, items: [{ tag, id, href, type, props, path }] }. */
export async function readBook(bytes) {
  let files; try { files = await unzip(bytes); } catch (e) { throw new Error('not an EPUB file (' + ((e && e.message) || e) + ')'); }
  const get = (n) => files.find((f) => f.name === n), cont = get('META-INF/container.xml');
  if (!cont) throw new Error('not an EPUB file (no META-INF/container.xml)');
  const opfPath = (td.decode(cont.data).match(/full-path\s*=\s*"([^"]+)"/) || [])[1], opfF = opfPath && get(opfPath);
  if (!opfF) throw new Error('the EPUB has no package file');
  const opf = td.decode(opfF.data), version = attrs((opf.match(/<package\b[^>]*>/) || [''])[0]).version || '2.0';
  const items = [...opf.matchAll(/<item\b[^>]*>/g)].map((m) => { const a = attrs(m[0]); return { tag: m[0], id: a.id, href: a.href, type: a['media-type'], props: (a.properties || '').split(/\s+/).filter(Boolean), path: a.href ? resolve(opfPath, a.href) : '' }; });
  return { files, opfPath, opf, version, items };
}

/** files [{ name, data }] -> EPUB bytes: the mimetype first and stored, the rest deflated where that makes them smaller. */
export async function writeBook(files) {
  return packZip([{ name: 'mimetype', data: te.encode('application/epub+zip') }, ...files.filter((f) => f.name !== 'mimetype')]);
}
// files [{ name, data }] -> zip bytes in that order, each deflated where that makes it smaller (a file named mimetype is always stored)
async function packZip(order) {
  const parts = [], dir = []; let off = 0;
  for (const f of order) {
    const name = te.encode(f.name), data = f.data, crc = crc32(data);
    const packed = f.name === 'mimetype' || typeof CompressionStream !== 'function' ? data : await pipe(data, new CompressionStream('deflate-raw'));
    const keep = packed.length < data.length, body = keep ? packed : data, method = keep ? 8 : 0;
    const h = new Uint8Array(30 + name.length), hv = new DataView(h.buffer);
    hv.setUint32(0, 0x04034b50, true); hv.setUint16(4, 20, true); hv.setUint16(6, 0x0800, true); hv.setUint16(8, method, true); hv.setUint16(12, 0x21, true);
    hv.setUint32(14, crc, true); hv.setUint32(18, body.length, true); hv.setUint32(22, data.length, true); hv.setUint16(26, name.length, true); h.set(name, 30);
    const c = new Uint8Array(46 + name.length), cv = new DataView(c.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(10, method, true); cv.setUint16(14, 0x21, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, body.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, name.length, true); cv.setUint32(42, off, true); c.set(name, 46);
    parts.push(h, body); dir.push(c); off += h.length + body.length;
  }
  const dsize = dir.reduce((n, c) => n + c.length, 0), end = new Uint8Array(22), ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, order.length, true); ev.setUint16(10, order.length, true); ev.setUint32(12, dsize, true); ev.setUint32(16, off, true);
  const all = new Uint8Array(off + dsize + 22); let p = 0; for (const x of [...parts, ...dir, end]) { all.set(x, p); p += x.length; }
  return all;
}

const IMG = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };
const freeName = (taken, stem, ext) => { let n = stem + '.' + ext, k = 2; while (taken.has(n)) n = stem + '-' + k++ + '.' + ext; return n; };
const freeId = (taken, stem) => { let n = stem, k = 2; while (taken.has(n)) n = stem + '-' + k++; return n; };

/** the book's cover picture: the item with properties="cover-image" (EPUB 3), or the one <meta name="cover"> names (EPUB 2). */
export function coverOf(book) {
  const byProp = book.items.find((i) => i.props.includes('cover-image'));
  if (byProp) return byProp;
  const meta = [...book.opf.matchAll(/<meta\b[^>]*>/g)].map((m) => attrs(m[0])).find((a) => a.name === 'cover');
  return meta ? book.items.find((i) => i.id === meta.content && IMG[i.type]) || null : null;
}

/** the book with a new cover. `encode(mediaType)` gives the picture's bytes in that type ('image/jpeg' or 'image/png'): an old cover keeps its
 * own file and type, so every page that shows it shows the new picture; a book with no cover gets the picture, the cover marks of EPUB 2 and 3,
 * and a cover page first in the reading order. -> { bytes, notes } */
export async function changeCover(bytes, encode) {
  const book = await readBook(bytes), files = book.files.map((f) => ({ ...f })), old = coverOf(book), notes = []; let opf = book.opf;
  const hasMeta = /<meta\b[^>]*\bname\s*=\s*["']cover["']/.test(opf);
  if (old) {
    const type = IMG[old.type] ? (old.type === 'image/png' ? 'image/png' : 'image/jpeg') : null, f = files.find((x) => x.name === old.path);
    if (!f) throw new Error('the book names ' + old.href + ' as its cover, but that file is not in the book');
    if (old.type !== type) { // a GIF or WebP cover: written as a JPEG, under a new name, and the links to it changed
      const taken = new Set(files.map((x) => x.name)), name = freeName(taken, old.path.replace(/\.[^./]+$/, ''), 'jpg'), href = name.slice(dirOf(book.opfPath).length);
      opf = opf.replace(old.tag, old.tag.replace(/\bhref\s*=\s*(["'])[^"']*\1/, 'href="' + xml(href) + '"').replace(/\bmedia-type\s*=\s*(["'])[^"']*\1/, 'media-type="image/jpeg"'));
      const oldBase = old.path.slice(old.path.lastIndexOf('/') + 1), newBase = name.slice(name.lastIndexOf('/') + 1); let pages = 0;
      for (const x of files) if (/\.x?html?$/i.test(x.name)) { const s = td.decode(x.data); if (s.includes(oldBase)) { x.data = te.encode(s.split(oldBase).join(newBase)); pages++; } }
      f.name = name; notes.push('the old cover was ' + old.type.replace('image/', '').toUpperCase() + ', which not every reader shows: the new one is a JPEG' + (pages ? ', and ' + pages + ' page' + (pages > 1 ? 's' : '') + ' now link to it' : ''));
    }
    f.data = await encode(type);
    notes.unshift('the cover picture (' + f.name + ') is the new picture now');
    if (!hasMeta) opf = opf.replace(/<\/metadata>/, '<meta name="cover" content="' + xml(old.id) + '"/>\n</metadata>');
  } else {
    const epub3 = parseFloat(book.version) >= 3, base = dirOf(book.opfPath), taken = new Set(files.map((x) => x.name)), ids = new Set(book.items.map((i) => i.id));
    const img = freeName(taken, base + 'cover', 'jpg'); taken.add(img); const page = freeName(taken, base + 'cover', 'xhtml');
    const imgId = freeId(ids, 'cover-image'); ids.add(imgId); const pageId = freeId(ids, 'cover-page');
    const imgHref = img.slice(base.length), pageHref = page.slice(base.length);
    files.push({ name: img, data: await encode('image/jpeg') });
    files.push({ name: page, data: te.encode('<?xml version="1.0" encoding="utf-8"?>\n' + (epub3 ? '<!DOCTYPE html>\n' : '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">\n') + '<html xmlns="http://www.w3.org/1999/xhtml">\n<head><title>Cover</title><style>html,body{margin:0;padding:0;height:100%;text-align:center}img{max-width:100%;max-height:100%}</style></head>\n<body><img src="' + xml(imgHref) + '" alt="Cover"/></body>\n</html>\n') });
    opf = opf.replace(/<\/manifest>/, '<item id="' + imgId + '" href="' + xml(imgHref) + '" media-type="image/jpeg"' + (epub3 ? ' properties="cover-image"' : '') + '/>\n<item id="' + pageId + '" href="' + xml(pageHref) + '" media-type="application/xhtml+xml"/>\n</manifest>');
    opf = opf.replace(/(<spine\b[^>]*>)/, '$1\n<itemref idref="' + pageId + '"/>');
    if (!hasMeta) opf = opf.replace(/<\/metadata>/, '<meta name="cover" content="' + imgId + '"/>\n</metadata>');
    if (/<guide\b/.test(opf)) opf = opf.replace(/(<guide\b[^>]*>)/, '$1\n<reference type="cover" title="Cover" href="' + xml(pageHref) + '"/>');
    notes.push('the book had no cover: the picture is its cover now (' + img + '), with a cover page first in the reading order');
  }
  files.find((x) => x.name === book.opfPath).data = te.encode(opf);
  const was = new Map(book.files.map((x) => [x.name, x.data])), same = files.filter((x) => { const d = was.get(x.name); return d && d.length === x.data.length && d.every((v, i) => v === x.data[i]); }).length;
  notes.push(same + ' of the ' + book.files.length + ' files the book had are byte for byte as they were' + (opf !== book.opf ? ' (the package file names the cover)' : ''));
  return { bytes: await writeBook(files), notes };
}

// ---- Merge EPUB --------------------------------------------------------------------------------------------------------------------------
const NCX = 'application/x-dtbncx+xml', IDPF_OBF = 'http://www.idpf.org/2008/embedding', ADOBE_OBF = 'http://ns.adobe.com/pdf/enc#RC'; // void-review: ok (algorithm names in encryption.xml, never fetched)
const sha1 = async (b) => new Uint8Array(await crypto.subtle.digest('SHA-1', b));
const unent = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e.toLowerCase()]));
const plainText = (s) => unent(s.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
/** the book's unique identifier, the one font obfuscation uses as its key */
export function identifierOf(opf) {
  const uid = attrs((opf.match(/<package\b[^>]*>/) || [''])[0])['unique-identifier'];
  const ids = [...opf.matchAll(/<dc:identifier\b([^>]*)>([\s\S]*?)<\/dc:identifier>/g)], m = ids.find((x) => attrs('<x' + x[1] + '>').id === uid) || ids[0];
  return m ? unent(m[2]).trim() : '';
}
/** the font obfuscation of the IDPF (SHA-1 of the identifier, 1040 bytes) and of Adobe (the UUID's 16 bytes, 1024 bytes): the same XOR undoes it. */
export async function obfuscate(data, id, alg = IDPF_OBF) {
  let key, n;
  if (alg === IDPF_OBF) { key = await sha1(te.encode(id.replace(/[ \u0009\u000d\u000a]/g, ''))); n = 1040; }
  else { const hex = id.replace(/^urn:uuid:/i, '').replace(/[^0-9a-f]/gi, ''); if (hex.length !== 32) throw new Error('the book names Adobe font obfuscation, but its identifier is not a UUID'); key = Uint8Array.from(hex.match(/../g), (h) => parseInt(h, 16)); n = 1024; }
  const out = data.slice(); for (let i = 0; i < Math.min(n, out.length); i++) out[i] ^= key[i % key.length]; return out;
}
/** the parts of META-INF/encryption.xml: [{ alg, path }]. */
export function encryptedOf(files) {
  const f = files.find((x) => x.name === 'META-INF/encryption.xml'); if (!f) return [];
  return [...td.decode(f.data).matchAll(/<(?:\w+:)?EncryptedData\b[\s\S]*?<\/(?:\w+:)?EncryptedData>/g)].map((m) => ({ alg: attrs((m[0].match(/<(?:\w+:)?EncryptionMethod\b[^>]*>/) || [''])[0]).Algorithm || '', path: decodeURIComponent(attrs((m[0].match(/<(?:\w+:)?CipherReference\b[^>]*>/) || [''])[0]).URI || '') }));
}
// a table of contents as a tree [{ label, href, kids }], from an EPUB 3 nav document or an EPUB 2 NCX; each href made a path in the zip (with its #part)
function tocTree(s, from, kind) {
  const root = { kids: [] }, stack = [root]; const at = (href) => (href ? resolve(from, href) + (href.includes('#') ? href.slice(href.indexOf('#')) : '') : '');
  if (kind === 'nav') {
    const nav = (s.match(/<nav\b[^>]*epub:type\s*=\s*["'][^"']*\btoc\b[^"']*["'][^>]*>([\s\S]*?)<\/nav>/) || [])[1]; if (!nav) return [];
    for (const m of nav.matchAll(/<li\b[^>]*>|<\/li>|<a\b([^>]*)>([\s\S]*?)<\/a>|<span\b[^>]*>([\s\S]*?)<\/span>/g)) {
      if (m[0].startsWith('<li')) { const n = { label: '', href: '', kids: [] }; stack[stack.length - 1].kids.push(n); stack.push(n); }
      else if (m[0] === '</li>') { if (stack.length > 1) stack.pop(); }
      else if (stack.length > 1 && !stack[stack.length - 1].label) { const n = stack[stack.length - 1]; n.label = plainText(m[2] != null ? m[2] : m[3]); if (m[1] != null) n.href = at(unent(attrs('<a' + m[1] + '>').href || '')); }
    }
  } else {
    for (const m of s.matchAll(/<navPoint\b[^>]*>|<\/navPoint>|<text>([\s\S]*?)<\/text>|<content\b[^>]*>/g)) {
      if (m[0].startsWith('<navPoint')) { const n = { label: '', href: '', kids: [] }; stack[stack.length - 1].kids.push(n); stack.push(n); }
      else if (m[0] === '</navPoint>') { if (stack.length > 1) stack.pop(); }
      else if (stack.length > 1 && m[1] != null && !stack[stack.length - 1].label) stack[stack.length - 1].label = plainText(m[1]);
      else if (stack.length > 1 && m[0].startsWith('<content')) stack[stack.length - 1].href = at(unent(attrs(m[0]).src || ''));
    }
  }
  return root.kids;
}
const countToc = (t) => t.reduce((n, x) => n + 1 + countToc(x.kids), 0);
const hrefOf = (path) => path.split('/').map((s) => encodeURIComponent(s)).join('/');
const metaAll = (opf, tag) => [...opf.matchAll(new RegExp('<dc:' + tag + '\\b[^>]*>([\\s\\S]*?)<\\/dc:' + tag + '>', 'g'))].map((m) => unent(m[1]).trim()).filter(Boolean);

/** books [{ name, bytes }] -> one EPUB 3 book: each book's files in a folder of their own (b1/, b2/, ...), so every link inside a book still works;
 * one reading order, the books one after another; one table of contents with a part for each book. Obfuscated fonts are obfuscated again with
 * the new book's identifier. -> { bytes, notes } */
export async function mergeBooks(list, title = '', now = new Date()) {
  if (list.length < 2) throw new Error('pick 2 or more EPUB files to merge.');
  const id = 'urn:uuid:' + crypto.randomUUID(), files = [], items = [], spine = [], tree = [], creators = [], encOut = [], langs = [];
  let first = '', cover = '', dir = '', chapters = 0, fonts = 0;
  for (let k = 0; k < list.length; k++) {
    const name = list[k].name, pre = 'b' + (k + 1) + '/', p = 'b' + (k + 1) + '-'; let book;
    try { book = await readBook(list[k].bytes); } catch (e) { throw new Error(name + ': ' + e.message); }
    const enc = encryptedOf(book.files), bad = enc.find((e) => e.alg !== IDPF_OBF && e.alg !== ADOBE_OBF);
    if (bad) throw new Error(name + ': parts of this book are encrypted (DRM), so Verse cannot read them to merge.');
    const bookId = identifierOf(book.opf), encBy = new Map(enc.map((e) => [e.path, e.alg]));
    const bookTitle = metaAll(book.opf, 'title')[0] || name.replace(/\.epub$/i, '');
    if (!k) { first = bookTitle; dir = attrs((book.opf.match(/<spine\b[^>]*>/) || [''])[0])['page-progression-direction'] || ''; }
    for (const c of metaAll(book.opf, 'creator')) if (!creators.includes(c)) creators.push(c);
    for (const l of metaAll(book.opf, 'language')) if (!langs.includes(l)) langs.push(l);
    for (const f of book.files) {
      if (f.name === 'mimetype' || f.name.startsWith('META-INF/') || f.name === book.opfPath) continue;
      let data = f.data; const alg = encBy.get(f.name);
      if (alg) { data = await obfuscate(await obfuscate(data, bookId, alg), id, IDPF_OBF); encOut.push(pre + f.name); fonts++; }
      files.push({ name: pre + f.name, data });
    }
    const fixed = /<meta\b[^>]*property\s*=\s*["']rendition:layout["'][^>]*>\s*pre-paginated\s*</.test(book.opf), ids = new Set(book.items.map((i) => i.id));
    let navItem = null, ncxItem = null; const cv = coverOf(book);
    for (const it of book.items) {
      if (it.type === NCX) { ncxItem = it; continue; }
      if (it.props.includes('nav')) navItem = it;
      const props = it.props.filter((x) => x !== 'nav' && x !== 'cover-image'); if (!cover && cv && it.id === cv.id) { cover = p + it.id; props.push('cover-image'); }
      const a = attrs(it.tag), extra = ['fallback', 'media-overlay'].filter((x) => a[x] && ids.has(a[x])).map((x) => ' ' + x + '="' + p + xml(a[x]) + '"').join('');
      items.push('<item id="' + p + xml(it.id) + '" href="' + xml(hrefOf(pre + it.path)) + '" media-type="' + xml(it.type || 'application/octet-stream') + '"' + extra + (props.length ? ' properties="' + props.join(' ') + '"' : '') + '/>');
    }
    const refs = [...book.opf.matchAll(/<itemref\b[^>]*>/g)].map((m) => attrs(m[0])).filter((a) => ids.has(a.idref) && (!ncxItem || a.idref !== ncxItem.id));
    let start = '';
    for (const a of refs) {
      const props = (a.properties || '').split(/\s+/).filter(Boolean); if (fixed && !props.some((x) => x.startsWith('rendition:layout'))) props.push('rendition:layout-pre-paginated');
      spine.push('<itemref idref="' + p + xml(a.idref) + '"' + (a.linear === 'no' ? ' linear="no"' : '') + (props.length ? ' properties="' + props.join(' ') + '"' : '') + '/>');
      if (!start && a.linear !== 'no') start = pre + book.items.find((i) => i.id === a.idref).path; chapters++;
    }
    const src = navItem ? book.files.find((f) => f.name === navItem.path) : ncxItem ? book.files.find((f) => f.name === ncxItem.path) : null;
    const own = src ? tocTree(td.decode(src.data), src.name, navItem ? 'nav' : 'ncx') : [], fix = (t) => t.map((x) => ({ ...x, href: x.href ? pre + x.href : '', kids: fix(x.kids) }));
    tree.push({ label: bookTitle, href: start, kids: fix(own) });
  }
  const bookTitle = title.trim() || first + (list.length > 1 ? ' and ' + (list.length - 1) + ' more' : ''), when = now.toISOString().replace(/\.\d+Z$/, 'Z');
  const li = (t, d) => t.map((x) => d + '<li>' + (x.href ? '<a href="' + xml(hrefOf(x.href.split('#')[0]) + (x.href.includes('#') ? x.href.slice(x.href.indexOf('#')) : '')) + '">' + xml(x.label || 'Untitled') + '</a>' : '<span>' + xml(x.label || 'Untitled') + '</span>') + (x.kids.length ? '\n' + d + '<ol>\n' + li(x.kids, d + '  ') + d + '</ol>' : '') + '</li>\n').join('');
  // an NCX point needs a link: a heading with none (a <span> in the nav) takes its first entry's link
  let order = 0; const firstHref = (t) => { for (const x of t) { const h = x.href || firstHref(x.kids); if (h) return h; } return ''; };
  const np = (t) => t.map((x) => { const h = x.href || firstHref(x.kids); return h ? '<navPoint id="n' + ++order + '" playOrder="' + order + '"><navLabel><text>' + xml(x.label || 'Untitled') + '</text></navLabel><content src="' + xml(hrefOf(h.split('#')[0]) + (h.includes('#') ? h.slice(h.indexOf('#')) : '')) + '"/>' + np(x.kids) + '</navPoint>' : ''; }).join('\n');
  const t = xml(bookTitle), nav = '<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">\n<head><title>' + t + '</title></head>\n<body>\n<nav epub:type="toc" id="toc"><h1>' + t + '</h1>\n<ol>\n' + li(tree, '') + '</ol>\n</nav>\n</body>\n</html>\n';
  const ncx = '<?xml version="1.0" encoding="utf-8"?>\n<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">\n<head><meta name="dtb:uid" content="' + xml(id) + '"/></head>\n<docTitle><text>' + t + '</text></docTitle>\n<navMap>\n' + np(tree) + '\n</navMap>\n</ncx>\n';
  const opf = '<?xml version="1.0" encoding="utf-8"?>\n<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">\n<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n<dc:identifier id="id">' + xml(id) + '</dc:identifier>\n<dc:title>' + t + '</dc:title>\n' + creators.map((c) => '<dc:creator>' + xml(c) + '</dc:creator>\n').join('') + (langs.length ? langs : ['en']).map((l) => '<dc:language>' + xml(l) + '</dc:language>\n').join('') + '<meta property="dcterms:modified">' + when + '</meta>\n' + (cover ? '<meta name="cover" content="' + xml(cover) + '"/>\n' : '') + '</metadata>\n<manifest>\n<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>\n<item id="ncx" href="toc.ncx" media-type="' + NCX + '"/>\n' + items.join('\n') + '\n</manifest>\n<spine toc="ncx"' + (dir ? ' page-progression-direction="' + xml(dir) + '"' : '') + '>\n' + spine.join('\n') + '\n</spine>\n</package>\n';
  const container = '<?xml version="1.0" encoding="utf-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n<rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles>\n</container>\n';
  const out = [{ name: 'META-INF/container.xml', data: te.encode(container) }, { name: 'content.opf', data: te.encode(opf) }, { name: 'nav.xhtml', data: te.encode(nav) }, { name: 'toc.ncx', data: te.encode(ncx) }, ...files];
  if (encOut.length) out.splice(1, 0, { name: 'META-INF/encryption.xml', data: te.encode('<?xml version="1.0" encoding="utf-8"?>\n<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n' + encOut.map((u) => '<EncryptedData xmlns="http://www.w3.org/2001/04/xmlenc#"><EncryptionMethod Algorithm="' + IDPF_OBF + '"/><CipherData><CipherReference URI="' + xml(hrefOf(u)) + '"/></CipherData></EncryptedData>').join('\n') + '\n</encryption>\n') });
  const notes = [list.length + ' books in one, in the order you picked them: ' + chapters + ' parts of the reading order, ' + files.length + ' files', 'the table of contents has a part for each book, with ' + countToc(tree.flatMap((x) => x.kids)) + ' entries from the books\' own contents'];
  if (fonts) notes.push(fonts + ' obfuscated font' + (fonts > 1 ? 's' : '') + ' obfuscated again for the new book, as the font licence asks');
  if (cover) notes.push('the cover is the cover of the first book');
  return { bytes: await writeBook(out), notes, title: bookTitle };
}

const pct = (x) => (x < 1 ? x.toFixed(1) : String(Math.round(x))), kb = (n) => (n < 1024 * 1024 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1024 / 1024).toFixed(1) + ' MB');
const PIC = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
// each JPEG, PNG or WebP picture given to shrink, the new one kept only when smaller -> { files, pics, smaller, before, after }
async function shrinkAll(list, typeOf, shrink, side, skip = new Set()) {
  const files = []; let pics = 0, smaller = 0, before = 0, after = 0;
  for (const f of list) {
    const type = typeOf(f.name) || PIC[(f.name.split('.').pop() || '').toLowerCase()];
    if (!skip.has(f.name) && (type === 'image/jpeg' || type === 'image/png' || type === 'image/webp')) {
      pics++; let out = null; try { out = await shrink(f.data, type, side); } catch (_) { out = null; }
      if (out && out.length && out.length < f.data.length) { smaller++; before += f.data.length; after += out.length; files.push({ name: f.name, data: out }); continue; }
    }
    files.push(f);
  }
  return { files, pics, smaller, before, after };
}
const sizeNote = (a, b, same, what) => (same ? 'the ' + what + ' was already as small as Verse can make it, so it is the same file (' + kb(a) + ')' : kb(a) + ' became ' + kb(b) + ' (' + pct(100 - (100 * b) / a) + '% smaller)');
const picNote = (p, what) => (p.pics ? (p.pics === 1 ? (p.smaller ? 'the picture was' : 'the picture was not') : (p.smaller || 'none') + ' of the ' + p.pics + ' pictures were') + ' made smaller' + (p.smaller ? ' (' + kb(p.before) + ' to ' + kb(p.after) + ')' : '') : what + ' has no JPEG, PNG or WebP pictures to make smaller');
/** the book made smaller: every file packed again with deflate, and each JPEG, PNG or WebP picture given to `shrink(data, mediaType, maxSide)`, which
 * gives back the picture in the same type (made again, and no larger than maxSide pixels on its long side when maxSide > 0), or null. A picture is
 * changed only when the new one is smaller, and keeps its name and type, so no page or link changes. A fixed layout book places its pictures by
 * pixel, so its pictures keep their size (maxSide 0). Encrypted files (fonts with obfuscation, DRM) keep their bytes. -> { bytes, notes } */
export async function compressBook(bytes, shrink, { maxSide = 0 } = {}) {
  const book = await readBook(bytes), enc = new Set(encryptedOf(book.files).map((e) => e.path));
  const fixed = /<meta\b[^>]*property\s*=\s*["']rendition:layout["'][^>]*>\s*pre-paginated\s*</.test(book.opf);
  const typeOf = new Map(book.items.map((i) => [i.path, i.type])), p = await shrinkAll(book.files, (n) => typeOf.get(n), shrink, fixed ? 0 : maxSide, enc);
  let out = await writeBook(p.files); const same = out.length >= bytes.length; if (same) out = bytes;
  const notes = [sizeNote(bytes.length, out.length, same, 'book')];
  if (!same) {
    notes.push(picNote(p, 'the book'));
    notes.push('the words, pages, styles and fonts are byte for byte as they were; every file is packed again');
    if (fixed && p.pics) notes.push('a fixed layout book: its pictures keep their size in pixels, so each page looks as it did');
  }
  if (enc.size) notes.push(enc.size + ' encrypted file' + (enc.size > 1 ? 's keep their' : ' keeps its') + ' bytes');
  return { bytes: out, notes };
}

/** a comic book archive (CBZ: a zip of page pictures) made smaller: each JPEG, PNG or WebP page given to `shrink(data, mediaType, maxSide)` as
 * for an EPUB, kept only when smaller, under its own name and in its own place, so the pages stay in their order. Every other file (ComicInfo.xml)
 * keeps its bytes. -> { bytes, notes } */
export async function compressComic(bytes, shrink, { maxSide = 0 } = {}) {
  let list; try { list = await unzip(bytes); } catch (e) { throw new Error('not a CBZ file (' + ((e && e.message) || e) + ')'); }
  const p = await shrinkAll(list, () => '', shrink, maxSide);
  if (!p.pics) throw new Error('no JPEG, PNG or WebP pages in this file, so it is not a comic Verse can make smaller.');
  let out = await packZip(p.files); const same = out.length >= bytes.length; if (same) out = bytes;
  const notes = [sizeNote(bytes.length, out.length, same, 'comic')];
  if (!same) notes.push(picNote(p, 'the comic').replace(/picture/g, 'page'), 'the pages keep their names and their order; every other file is byte for byte as it was');
  return { bytes: out, notes };
}
