/**
 * base64: RFC 4648 Base64 and Base64URL, exact (the tower's base64encode.org floor). Text becomes bytes in the character set asked (UTF-8 by
 * default, so an emoji or an accent comes back exactly; also UTF-16, the ISO-8859 family, the Windows code pages, KOI8, Mac, DOS code pages
 * and EBCDIC), bytes become Base64 in the standard alphabet (+ /) or the URL-safe one (- _), with or without = padding, optionally wrapped at
 * 76 characters (MIME). Decoding takes either alphabet, padded or not, ignores line breaks and spaces, takes a data: URL whole, and says
 * plainly what is wrong (the character and where it is) instead of giving garbage. Pure, no btoa/atob (they are Latin-1 only), no network:
 * single-byte sets are read with the browser's own TextDecoder (and written with the reverse of it), the few it lacks (EBCDIC 037, DOS 437
 * and 850, ISO-8859-16) are tables here; Shift_JIS, EUC-JP, ISO-2022-JP, GBK, GB18030, Big5 and EUC-KR are written both ways too, from the
 * browser's own decoder swept once and inverted in memory (multiTable), with no table carried and nothing fetched. Tests: tools/base64.test.mjs.
 */
const STD = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const URL_SAFE = STD.slice(0, 62) + '-_';

// every character set offered, grouped as the page shows them: [id, label]; the name in messages is the label before " (" or ", "
export const CHARSET_GROUPS = Object.freeze([
  { group: 'Unicode', sets: [['utf-8', 'UTF-8'], ['utf-16le', 'UTF-16LE'], ['utf-16be', 'UTF-16BE']] },
  { group: 'Western', sets: [['ascii', 'US-ASCII'], ['latin1', 'ISO-8859-1 (Latin-1)'], ['windows-1252', 'Windows-1252 (Western)'], ['iso-8859-15', 'ISO-8859-15 (Latin-9, with €)'],
    ['macintosh', 'Mac OS Roman'], ['iso-8859-14', 'ISO-8859-14 (Celtic)'], ['iso-8859-10', 'ISO-8859-10 (Nordic)']] },
  { group: 'Central European and Baltic', sets: [['iso-8859-2', 'ISO-8859-2 (Latin-2)'], ['windows-1250', 'Windows-1250 (Central European)'], ['iso-8859-16', 'ISO-8859-16 (South-East European)'],
    ['iso-8859-3', 'ISO-8859-3 (South European)'], ['iso-8859-4', 'ISO-8859-4 (Baltic)'], ['iso-8859-13', 'ISO-8859-13 (Baltic)'], ['windows-1257', 'Windows-1257 (Baltic)']] },
  { group: 'Cyrillic', sets: [['iso-8859-5', 'ISO-8859-5 (Cyrillic)'], ['windows-1251', 'Windows-1251 (Cyrillic)'], ['koi8-r', 'KOI8-R (Russian)'], ['koi8-u', 'KOI8-U (Ukrainian)'],
    ['ibm866', 'CP866 (DOS Cyrillic)'], ['x-mac-cyrillic', 'Mac Cyrillic']] },
  { group: 'Greek, Turkish, Hebrew, Arabic', sets: [['iso-8859-7', 'ISO-8859-7 (Greek)'], ['windows-1253', 'Windows-1253 (Greek)'], ['iso-8859-9', 'ISO-8859-9 (Turkish)'],
    ['windows-1254', 'Windows-1254 (Turkish)'], ['iso-8859-8', 'ISO-8859-8 (Hebrew)'], ['windows-1255', 'Windows-1255 (Hebrew)'], ['iso-8859-6', 'ISO-8859-6 (Arabic)'], ['windows-1256', 'Windows-1256 (Arabic)']] },
  { group: 'Asian', sets: [['windows-874', 'Windows-874 (Thai)'], ['iso-8859-11', 'ISO-8859-11 (Thai)'], ['windows-1258', 'Windows-1258 (Vietnamese)']] },
  { group: 'Asian, multi-byte', multi: true, sets: [['shift_jis', 'Shift_JIS (CP932, Japanese)'], ['euc-jp', 'EUC-JP (Japanese)'], ['iso-2022-jp', 'ISO-2022-JP (Japanese)'],
    ['gbk', 'GBK (CP936, Chinese)'], ['gb18030', 'GB18030 (Chinese)'], ['big5', 'Big5 (CP950, Chinese)'], ['euc-kr', 'EUC-KR (CP949, Korean)']] },
  { group: 'EBCDIC and DOS', sets: [['ibm037', 'EBCDIC 037 (IBM, US and Canada)'], ['cp437', 'CP437 (DOS, US)'], ['cp850', 'CP850 (DOS, Western Europe)']] },
]);
/** every character set by id: its label ('utf-8': 'UTF-8', 'latin1': 'ISO-8859-1 (Latin-1)', ...). */
export const CHARSETS = Object.freeze(Object.fromEntries(CHARSET_GROUPS.flatMap((g) => g.sets)));
const MULTI = new Set(CHARSET_GROUPS.filter((g) => g.multi).flatMap((g) => g.sets.map((s) => s[0])));
/** whether text can be written in this character set here: every one of them, both ways. */
export const canEncode = (cs) => !!CHARSETS[cs];
const nameOf = (cs) => (CHARSETS[cs] || cs).split(/ \(|, /)[0];

// the sets TextDecoder lacks (or that WHATWG reads as another set), as tables checked against the Unicode consortium's mapping files
// (VENDORS/MICSFT CP037, CP437, CP850; ISO8859/8859-16), the same table read in both directions
const ASCII = String.fromCharCode(...Array.from({ length: 128 }, (_, i) => i)), C1 = String.fromCharCode(...Array.from({ length: 32 }, (_, i) => 128 + i));
const TABLES = {
  ibm037: '\x00\x01\x02\x03\x9c\x09\x86\x7f\x97\x8d\x8e\x0b\x0c\x0d\x0e\x0f\x10\x11\x12\x13\x9d\x85\x08\x87\x18\x19\x92\x8f\x1c\x1d\x1e\x1f\x80\x81\x82\x83\x84\x0a\x17\x1b\x88\x89\x8a\x8b\x8c\x05\x06\x07\x90\x91\x16\x93\x94\x95\x96\x04\x98\x99\x9a\x9b\x14\x15\x9e\x1a \xa0âäàáãåçñ¢.<(+|&éêëèíîïìß!$*);¬-/ÂÄÀÁÃÅÇÑ¦,%_>?øÉÊËÈÍÎÏÌ`:#@\x27="Øabcdefghi«»ðýþ±°jklmnopqrªºæ¸Æ¤µ~stuvwxyz¡¿ÐÝÞ®^£¥·©§¶¼½¾[]¯¨´×{ABCDEFGHI\xadôöòóõ}JKLMNOPQR¹ûüùúÿ\x5c÷STUVWXYZ²ÔÖÒÓÕ0123456789³ÛÜÙÚ\x9f',
  cp437: ASCII + 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■\xa0',
  cp850: ASCII + 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´\xad±‗¾¶§÷¸°¨·¹³²■\xa0',
  'iso-8859-16': ASCII + C1 + '\xa0ĄąŁ€„Š§š©Ș«Ź\xadźŻ°±ČłŽ”¶·žčș»ŒœŸżÀÁÂĂÄĆÆÇÈÉÊËÌÍÎÏĐŃÒÓÔŐÖŚŰÙÚÛÜĘȚßàáâăäćæçèéêëìíîïđńòóôőöśűùúûüęțÿ',
};
// WHATWG reads iso-8859-9 as windows-1254 and iso-8859-11 as windows-874: the same letters, but 0x80 to 0x9F are control characters
const WITH_C1 = { 'iso-8859-9': 'windows-1254', 'iso-8859-11': 'windows-874' };
const tables = new Map(), reverses = new Map();
// the 256 characters a single-byte set gives each byte ('' where a byte has none), or null for a set that is not single-byte here
function table(cs) {
  if (tables.has(cs)) return tables.get(cs);
  let t = null;
  if (TABLES[cs]) t = Array.from(TABLES[cs]);
  else if (cs === 'latin1') t = Array.from(ASCII + C1 + String.fromCharCode(...Array.from({ length: 96 }, (_, i) => 160 + i)));
  else if (cs === 'ascii') t = Array.from(ASCII).concat(Array(128).fill(''));
  else if (CHARSETS[cs] && !MULTI.has(cs) && !/^utf-/.test(cs)) {
    try { const d = new TextDecoder(WITH_C1[cs] || cs); t = Array.from({ length: 256 }, (_, i) => { const c = d.decode(Uint8Array.of(i)); return c === '\ufffd' ? '' : c; }); } catch (_) { t = null; }
    if (t && WITH_C1[cs]) for (let i = 128; i < 160; i++) t[i] = String.fromCharCode(i);
  }
  tables.set(cs, t); return t;
}
function reverse(cs) {
  if (reverses.has(cs)) return reverses.get(cs);
  const t = table(cs), m = new Map(); if (t) t.forEach((c, i) => { if (c && !m.has(c)) m.set(c, i); });
  reverses.set(cs, m); return m;
}

// the multi-byte Asian sets, written with no table carried in the page and nothing fetched: on first use every valid byte sequence of the set is
// read once with the browser's own TextDecoder and the result inverted (code point -> bytes), kept in memory. The sequences swept are the set's
// own lead and trail byte ranges (WHATWG Encoding); where one character has two codes, the one the WHATWG encoder writes is kept.
const LEADS = {
  shift_jis: { leads: [[0x81, 0x9f], [0xe0, 0xfc]], trails: [[0x40, 0x7e], [0x80, 0xfc]], singles: [[0xa1, 0xdf]], late: [0xed, 0xee] }, // NEC-selected IBM rows: the IBM codes (FA-FC) win
  'euc-jp': { leads: [[0xa1, 0xfe]], trails: [[0xa1, 0xfe]], kana: true }, // JIS X 0212 (8F xx xx) is decode only in every encoder
  gbk: { leads: [[0x81, 0xfe]], trails: [[0x40, 0x7e], [0x80, 0xfe]], singles: [[0x80, 0x80]] },
  gb18030: { leads: [[0x81, 0xfe]], trails: [[0x40, 0x7e], [0x80, 0xfe]], four: true },
  big5: { leads: [[0xa1, 0xfe]], trails: [[0x40, 0x7e], [0xa1, 0xfe]], last: [0x2550, 0x255e, 0x2561, 0x256a, 0x5341, 0x5345] }, // HKSCS (81-A0) is decode only, as in WHATWG
  'euc-kr': { leads: [[0x81, 0xfe]], trails: [[0x41, 0xfe]] },
};
const multis = new Map();
const each = (ranges, f) => { for (const [a, b] of ranges) for (let x = a; x <= b; x++) f(x); };
/** the code point -> bytes map of a multi-byte set (built once, a fraction of a second), or null for a set that is not one. */
export function multiTable(cs) {
  if (multis.has(cs)) return multis.get(cs);
  const spec = LEADS[cs === 'iso-2022-jp' ? 'euc-jp' : cs]; if (!spec) return null;
  const d = new TextDecoder(cs === 'iso-2022-jp' ? 'euc-jp' : cs), m = new Map(), late = new Set(spec.late || []), last = new Set(spec.last || []);
  const put = (bytes) => { const s = d.decode(Uint8Array.from(bytes)); if (!s || s.includes('�')) return; const cps = Array.from(s); if (cps.length !== 1) return; const cp = cps[0].codePointAt(0); if (!m.has(cp) || last.has(cp)) m.set(cp, bytes); };
  for (let i = 0; i < 0x80; i++) put([i]); // ASCII as the decoder reads it (one ICU build swaps 1C and 7F in Shift_JIS; browsers do not)
  if (spec.singles) each(spec.singles, (b) => put([b]));
  if (spec.kana) each([[0xa1, 0xdf]], (b) => put([0x8e, b]));
  const sweep = (lead) => each(spec.trails, (t) => put([lead, t]));
  each(spec.leads, (l) => { if (!late.has(l)) sweep(l); }); for (const l of late) sweep(l);
  if (spec.four) { // GB18030's four-byte codes: the BMP part read in one pass (39,420 codes, one character each); the rest is the standard's arithmetic
    const buf = new Uint8Array(39420 * 4); for (let p = 0; p < 39420; p++) buf.set(gbFour(p), p * 4);
    const s = d.decode(buf); if (s.length === 39420) for (let p = 0; p < 39420; p++) { const cp = s.charCodeAt(p); if (!m.has(cp)) m.set(cp, Array.from(buf.subarray(p * 4, p * 4 + 4))); }
  }
  let out = m;
  if (cs === 'iso-2022-jp') { out = new Map(); for (const [cp, b] of m) if (b.length === 1) out.set(cp, b); else if (b.length === 2 && b[0] >= 0xa1) out.set(cp, [b[0] - 0x80, b[1] - 0x80]); } // EUC-JP's JIS X 0208, less 0x80 a byte (half-width kana, 8E xx, has no place in it)
  multis.set(cs, out); return out;
}
// a GB18030 four-byte pointer as its bytes (GB18030-2005: b1 81-FE, b2 30-39, b3 81-FE, b4 30-39)
function gbFour(p) { const b4 = p % 10; p = (p - b4) / 10; const b3 = p % 126; p = (p - b3) / 126; const b2 = p % 10; return [(p - b2) / 10 + 0x81, b2 + 0x30, b3 + 0x81, b4 + 0x30]; }
function multiToBytes(t, cs) {
  const m = multiTable(cs), out = []; let at = 0, jis = false;
  for (const ch of t) {
    at++; const cp = ch.codePointAt(0);
    let b = cs === 'iso-2022-jp' && (cp === 0x1b || cp === 0x0e || cp === 0x0f) ? null : m.get(cp);
    if (!b && cs === 'gb18030' && cp >= 0x10000) b = gbFour(cp - 0x10000 + 189000); // every supplementary character, in order from 90 30 81 30
    if (!b) return { ok: false, error: '“' + ch + '” (character ' + at + ') is not in ' + nameOf(cs) + ': choose UTF-8 to encode it' };
    if (cs === 'iso-2022-jp') { const two = b.length === 2; if (two !== jis) { out.push(0x1b, two ? 0x24 : 0x28, 0x42); jis = two; } } // ESC $ B into JIS X 0208, ESC ( B back to ASCII
    for (const x of b) out.push(x);
  }
  if (jis) out.push(0x1b, 0x28, 0x42);
  return { ok: true, bytes: Uint8Array.from(out) };
}

/** the bytes of a text in a character set: { ok, bytes } or { ok: false, error } naming the first character the set cannot hold (never a silent
 *  '?'). Pure. */
export function textToBytes(text, charset = 'utf-8') {
  const t = String(text ?? '');
  if (charset === 'utf-16le' || charset === 'utf-16be') {
    const out = new Uint8Array(t.length * 2), be = charset === 'utf-16be';
    for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); out[2 * i + (be ? 1 : 0)] = c & 255; out[2 * i + (be ? 0 : 1)] = c >> 8; }
    return { ok: true, bytes: out };
  }
  if (MULTI.has(charset)) return multiToBytes(t, charset);
  const tb = table(charset);
  if (tb) {
    const rev = reverse(charset), out = new Uint8Array(t.length); let n = 0, at = 0;
    for (const ch of t) {
      at++; const k = rev.get(ch);
      if (k === undefined) return { ok: false, error: '“' + ch + '” (character ' + at + ') is not in ' + nameOf(charset) + ': choose UTF-8 to encode it' };
      out[n++] = k;
    }
    return { ok: true, bytes: out.slice(0, n) };
  }
  return { ok: true, bytes: new TextEncoder().encode(t) };
}
/** the text that bytes hold in a character set: { ok, text } or { ok: false, error } when they are not valid text in it. Pure. */
export function bytesToText(bytes, charset = 'utf-8') {
  const b = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes || []);
  if (charset === 'utf-16le' || charset === 'utf-16be') {
    if (b.length % 2) return { ok: false, error: b.length + ' bytes is an odd number, so they are not UTF-16 text' };
    const be = charset === 'utf-16be'; let s = '';
    for (let i = 0; i < b.length; i += 2) s += String.fromCharCode(be ? (b[i] << 8) | b[i + 1] : b[i] | (b[i + 1] << 8));
    return { ok: true, text: s };
  }
  const tb = table(charset);
  if (tb) {
    const parts = [];
    for (let i = 0; i < b.length; i++) {
      const c = tb[b[i]];
      if (!c) return { ok: false, error: 'byte ' + (i + 1) + ' (0x' + b[i].toString(16).padStart(2, '0') + ') has no character in ' + nameOf(charset) + ': choose another character set, or see the bytes in hex' };
      parts.push(c);
    }
    return { ok: true, text: parts.join('') };
  }
  const cs = CHARSETS[charset] && MULTI.has(charset) ? charset : 'utf-8';
  try { return { ok: true, text: new TextDecoder(cs, { fatal: true, ignoreBOM: cs === 'utf-8' }).decode(b) }; } catch (_) {
    return { ok: false, error: 'the ' + b.length + ' decoded bytes are not ' + nameOf(cs) + ' text (a file, binary data, or another character set?): see them in hex, or download them' };
  }
}

/** the newline a choice names: 'crlf' (Windows) or '\r\n' gives CR LF, anything else LF (Unix). Pure. */
export const eolOf = (e) => (e === 'crlf' || e === '\r\n' ? '\r\n' : '\n');
/** bytes as Base64: { url: URL-safe alphabet, pad: '=' padding (default true), wrap: line length, 0 for none, eol: 'lf' or 'crlf' between wrapped lines }. Pure. */
export function encodeBytes(bytes, { url = false, pad = true, wrap = 0, eol = 'lf' } = {}) {
  const b = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes || []), A = url ? URL_SAFE : STD, parts = [];
  let chunk = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0), left = b.length - i;
    chunk += A[(n >> 18) & 63] + A[(n >> 12) & 63] + (left > 1 ? A[(n >> 6) & 63] : pad ? '=' : '') + (left > 2 ? A[n & 63] : pad ? '=' : '');
    if (chunk.length >= 8192) { parts.push(chunk); chunk = ''; }
  }
  parts.push(chunk); const s = parts.join('');
  return wrap > 0 ? (s.match(new RegExp('.{1,' + wrap + '}', 'g')) || []).join(eolOf(eol)) : s;
}
/** a text as Base64 (its bytes in `charset`, UTF-8 by default): { ok, base64, bytes } or { ok: false, error }. With `lines`, each line (split at
 *  LF, CR LF or CR) is encoded on its own and the results joined with `eol`, as base64encode.org's "Encode each line separately". Pure. */
export function encodeText(text, opts = {}) {
  if (opts.lines) {
    const out = [], all = []; let n = 0;
    for (const line of String(text ?? '').split(/\r\n|\n|\r/)) { n++; const r = textToBytes(line, opts.charset); if (!r.ok) return { ...r, error: 'line ' + n + ': ' + r.error }; out.push(encodeBytes(r.bytes, opts)); all.push(r.bytes); }
    const bytes = new Uint8Array(all.reduce((a, b) => a + b.length, 0)); let o = 0; for (const b of all) { bytes.set(b, o); o += b.length; }
    return { ok: true, base64: out.join(eolOf(opts.eol)), bytes, lines: n };
  }
  const r = textToBytes(text, opts.charset); if (!r.ok) return r;
  return { ok: true, base64: encodeBytes(r.bytes, opts), bytes: r.bytes };
}
/** Base64 read one line at a time (each line its own Base64, as "Encode each line separately" writes it), the texts joined with `eol`:
 *  { ok, text, bytes, lines } or { ok: false, error } naming the line. Pure. */
export function decodeLines(input, charset = 'utf-8', eol = 'lf') {
  const texts = [], all = []; let n = 0;
  for (const line of String(input ?? '').split(/\r\n|\n|\r/)) { n++; const r = decodeText(line, charset); if (!r.ok) return { ...r, error: 'line ' + n + ': ' + r.error }; texts.push(r.text); all.push(r.bytes); }
  const bytes = new Uint8Array(all.reduce((a, b) => a + b.length, 0)); let o = 0; for (const b of all) { bytes.set(b, o); o += b.length; }
  return { ok: true, text: texts.join(eolOf(eol)), bytes, lines: n, alphabet: 'standard', padded: false };
}

/** a data: URL's parts ({ mime, body }), or null when the text is not one. Pure. */
export function dataUrlParts(text) {
  const m = /^\s*data:([^,]*?),([\s\S]*)$/i.exec(String(text || '')); if (!m) return null;
  const meta = m[1].split(';'); if (meta[meta.length - 1].toLowerCase() !== 'base64') return null;
  return { mime: meta.slice(0, -1).join(';') || 'text/plain', body: m[2] };
}

/**
 * Base64 (either alphabet, padded or not, spaces and line breaks ignored, a data: URL whole) as bytes:
 * { ok, bytes, alphabet: 'standard'|'url', padded, mime?, note? } or { ok: false, error } saying what is wrong and where. Pure.
 */
export function decodeBytes(input) {
  let s = String(input ?? ''), mime = null;
  const d = dataUrlParts(s); if (d) { s = d.body; mime = d.mime; }
  const raw = s;
  s = s.replace(/[\s]/g, '');
  if (!s) return { ok: true, bytes: new Uint8Array(0), alphabet: 'standard', padded: false, mime };
  const std = /[+/]/.test(s), url = /[-_]/.test(s);
  if (std && url) return { ok: false, error: 'it mixes the standard alphabet (+ /) with the URL-safe one (- _): a Base64 text uses one or the other' };
  const A = url ? URL_SAFE : STD;
  const eq = s.indexOf('=');
  const body = eq < 0 ? s : s.slice(0, eq), tail = eq < 0 ? '' : s.slice(eq);
  for (let i = 0; i < body.length; i++) {
    if (A.indexOf(body[i]) < 0) {
      const ch = String.fromCodePoint(body.codePointAt(i)), at = positionIn(raw, body, i);
      return { ok: false, error: '“' + ch + '” at character ' + at + ' is not a Base64 character (A to Z, a to z, 0 to 9, ' + (url ? '- and _' : '+ and /') + ', and = at the end)' };
    }
  }
  if (/[^=]/.test(tail)) return { ok: false, error: 'there is text after the = padding, which only ever comes at the very end' };
  if (body.length % 4 === 1) return { ok: false, error: 'it is ' + body.length + ' characters long, one too many or three too few: some of it is missing' };
  // padding of the wrong length (one = where two belong, three or more) says nothing the length does not: decoded, and said so
  const padOff = !!tail && (tail.length > 2 || (body.length + tail.length) % 4 !== 0);
  const out = new Uint8Array(Math.floor(body.length * 3 / 4)); let o = 0, bits = 0, acc = 0;
  for (let i = 0; i < body.length; i++) { acc = (acc << 6) | A.indexOf(body[i]); bits += 6; if (bits >= 8) { bits -= 8; out[o++] = (acc >> bits) & 255; } }
  const r = { ok: true, bytes: out, alphabet: url ? 'url' : 'standard', padded: !!tail, mime };
  if (bits && acc & ((1 << bits) - 1)) r.note = 'the last character carries leftover bits that are not zero; decoded anyway, but this text was not made by a standard encoder';
  if (padOff) r.note = (r.note ? r.note + '; ' : '') + 'the = padding at the end was the wrong length (' + tail.length + '); decoded anyway';
  return r;
}
// where body[i] sits in the text as typed (1-based, counted in characters people see), spaces and line breaks included
function positionIn(raw, body, i) { let k = -1; for (let j = 0, seen = 0; j < raw.length; j++) { if (/\s/.test(raw[j])) continue; if (seen === i) { k = j; break; } seen++; } return k < 0 ? i + 1 : Array.from(raw.slice(0, k)).length + 1; }

/** which character set bytes are most likely text in: a byte-order mark first, then UTF-8 when they are valid UTF-8, then UTF-16LE when every
 *  other byte is zero (ASCII stored two bytes a letter), else Latin-1 (every byte is some character). Pure. */
export function sniffCharset(bytes) {
  const b = bytes || new Uint8Array(0);
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return 'utf-8';
  if (b[0] === 0xff && b[1] === 0xfe) return 'utf-16le';
  try { new TextDecoder('utf-8', { fatal: true }).decode(b); } catch (_) {
    let odd = 0; for (let i = 1; i < b.length; i += 2) if (b[i] === 0) odd++;
    return b.length >= 2 && b.length % 2 === 0 && odd >= (b.length / 2) * 0.6 ? 'utf-16le' : 'latin1';
  }
  let odd = 0; for (let i = 1; i < b.length; i += 2) if (b[i] === 0) odd++;
  return b.length >= 4 && b.length % 2 === 0 && odd === b.length / 2 ? 'utf-16le' : 'utf-8';
}

/** Base64 as text in `charset` (UTF-8 by default; 'auto' reads it in the set sniffCharset finds and says which in `charset`): { ok, text, bytes, ... } or { ok: false, error, bytes? } (bytes when they decode but are not text). Pure. */
export function decodeText(input, charset = 'utf-8') {
  const r = decodeBytes(input); if (!r.ok) return r;
  const cs = charset === 'auto' ? sniffCharset(r.bytes) : charset, t = bytesToText(r.bytes, cs);
  return t.ok ? { ...r, text: t.text, charset: cs } : { ...r, ok: false, error: t.error, binary: true };
}

/** how much of a file is read at a time: a whole number of 3-byte groups (no padding until the end) that is also a whole number of 76-character
 *  MIME lines (3 * 76 * 16384 bytes, 3.6 MB), so a file of any size is encoded a slice at a time and the slices join with nothing in between */
export const FILE_CHUNK = 3 * 76 * 16384;
/** a Blob or File as Base64, read with File.slice a chunk at a time: yields strings that, joined, equal encodeBytes of the whole (the same
 *  options; with wrap, the newline between two slices is put at the start of the next). `chunk` must be a multiple of 3 * wrap / 4 * 3. */
export async function* base64Chunks(blob, opts = {}, chunk = FILE_CHUNK) {
  for (let at = 0; at < blob.size; at += chunk) {
    const s = encodeBytes(new Uint8Array(await blob.slice(at, at + chunk).arrayBuffer()), opts);
    yield (at > 0 && opts.wrap > 0 ? eolOf(opts.eol) : '') + s;
  }
}

/** bytes in hex, two digits each, a space between: "68 65 6c 6c 6f". Pure. */
export const hexOf = (bytes) => Array.from(bytes || [], (x) => x.toString(16).padStart(2, '0')).join(' ');
/** bytes as a data: URL (data:image/png;base64,...). Pure. */
export const dataUrl = (bytes, mime = 'application/octet-stream') => 'data:' + (mime || 'application/octet-stream') + ';base64,' + encodeBytes(bytes);
/** a byte count as people say it: 5 bytes, 1.2 KB, 3.4 MB. Pure. */
/** the page's stage card: the text as "base64 decode <its UTF-8 Base64>", so the card holds the text exactly as typed and no keyword skill reads its words; '' when there is no text to carry. Pure. */
export function cardAsk(text, max = 1500) {
  const s = String(text ?? '');
  return s.trim() && Array.from(s).length <= max ? 'base64 decode ' + encodeBytes(new TextEncoder().encode(s)) : '';
}
export function sizeOf(n) { return n < 1024 ? n + (n === 1 ? ' byte' : ' bytes') : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB'; }
