// EPUB edits on the device (/converter/): the change of a book's cover. Pure: no DOM; the page passes in the picture, already in the format
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
  const order = [{ name: 'mimetype', data: te.encode('application/epub+zip') }, ...files.filter((f) => f.name !== 'mimetype')], parts = [], dir = []; let off = 0;
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
