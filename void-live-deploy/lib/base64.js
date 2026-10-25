/**
 * base64: RFC 4648 Base64 and Base64URL, exact (the tower's base64encode.org floor). Text becomes bytes in the character set asked (UTF-8 by
 * default, so an emoji or an accent comes back exactly; also UTF-16LE and ISO-8859-1), bytes become Base64 in the standard alphabet (+ /) or
 * the URL-safe one (- _), with or without = padding, optionally wrapped at 76 characters (MIME). Decoding takes either alphabet, padded or not,
 * ignores line breaks and spaces, takes a data: URL whole, and says plainly what is wrong (the character and where it is) instead of giving
 * garbage. Pure, no btoa/atob (they are Latin-1 only). Tests: tools/base64.test.mjs.
 */
const STD = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const URL_SAFE = STD.slice(0, 62) + '-_';
export const CHARSETS = Object.freeze({ 'utf-8': 'UTF-8', 'utf-16le': 'UTF-16LE', latin1: 'ISO-8859-1 (Latin-1)' });

/** the bytes of a text in a character set: { ok, bytes } or { ok: false, error } (Latin-1 cannot hold every character). Pure. */
export function textToBytes(text, charset = 'utf-8') {
  const t = String(text ?? '');
  if (charset === 'utf-16le') { const out = new Uint8Array(t.length * 2); for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); out[2 * i] = c & 255; out[2 * i + 1] = c >> 8; } return { ok: true, bytes: out }; }
  if (charset === 'latin1') {
    const out = new Uint8Array(t.length);
    for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); if (c > 255) { const ch = String.fromCodePoint(t.codePointAt(i)); return { ok: false, error: '“' + ch + '” (character ' + (Array.from(t.slice(0, i)).length + 1) + ') is not in ISO-8859-1: choose UTF-8 to encode it' }; } out[i] = c; }
    return { ok: true, bytes: out };
  }
  return { ok: true, bytes: new TextEncoder().encode(t) };
}
/** the text that bytes hold in a character set: { ok, text } or { ok: false, error } when they are not valid text in it. Pure. */
export function bytesToText(bytes, charset = 'utf-8') {
  const b = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes || []);
  if (charset === 'latin1') { let s = ''; for (let i = 0; i < b.length; i += 4096) s += String.fromCharCode(...b.subarray(i, i + 4096)); return { ok: true, text: s }; }
  if (charset === 'utf-16le') {
    if (b.length % 2) return { ok: false, error: b.length + ' bytes is an odd number, so they are not UTF-16 text' };
    let s = ''; for (let i = 0; i < b.length; i += 2) s += String.fromCharCode(b[i] | (b[i + 1] << 8)); return { ok: true, text: s };
  }
  try { return { ok: true, text: new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(b) }; } catch (_) {
    return { ok: false, error: 'the ' + b.length + ' decoded bytes are not UTF-8 text (a file or binary data?): see them in hex, or download them' };
  }
}

/** bytes as Base64: { url: URL-safe alphabet, pad: '=' padding (default true), wrap: line length, 0 for none }. Pure. */
export function encodeBytes(bytes, { url = false, pad = true, wrap = 0 } = {}) {
  const b = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes || []), A = url ? URL_SAFE : STD, parts = [];
  let chunk = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0), left = b.length - i;
    chunk += A[(n >> 18) & 63] + A[(n >> 12) & 63] + (left > 1 ? A[(n >> 6) & 63] : pad ? '=' : '') + (left > 2 ? A[n & 63] : pad ? '=' : '');
    if (chunk.length >= 8192) { parts.push(chunk); chunk = ''; }
  }
  parts.push(chunk); const s = parts.join('');
  return wrap > 0 ? (s.match(new RegExp('.{1,' + wrap + '}', 'g')) || []).join('\n') : s;
}
/** a text as Base64 (its bytes in `charset`, UTF-8 by default): { ok, base64, bytes } or { ok: false, error }. Pure. */
export function encodeText(text, opts = {}) {
  const r = textToBytes(text, opts.charset); if (!r.ok) return r;
  return { ok: true, base64: encodeBytes(r.bytes, opts), bytes: r.bytes };
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
  if (tail && !/^={1,2}$/.test(tail)) return { ok: false, error: /[^=]/.test(tail) ? 'there is text after the = padding, which only ever comes at the very end' : 'too much = padding: there are at most two at the end' };
  if (body.length % 4 === 1) return { ok: false, error: 'it is ' + body.length + ' characters long, one too many or three too few: some of it is missing' };
  if (tail && (body.length + tail.length) % 4) return { ok: false, error: 'the = padding does not fit the length: with padding the length is a multiple of 4' };
  const out = new Uint8Array(Math.floor(body.length * 3 / 4)); let o = 0, bits = 0, acc = 0;
  for (let i = 0; i < body.length; i++) { acc = (acc << 6) | A.indexOf(body[i]); bits += 6; if (bits >= 8) { bits -= 8; out[o++] = (acc >> bits) & 255; } }
  const r = { ok: true, bytes: out, alphabet: url ? 'url' : 'standard', padded: !!tail, mime };
  if (bits && acc & ((1 << bits) - 1)) r.note = 'the last character carries leftover bits that are not zero; decoded anyway, but this text was not made by a standard encoder';
  return r;
}
// where body[i] sits in the text as typed (1-based, counted in characters people see), spaces and line breaks included
function positionIn(raw, body, i) { let k = -1; for (let j = 0, seen = 0; j < raw.length; j++) { if (/\s/.test(raw[j])) continue; if (seen === i) { k = j; break; } seen++; } return k < 0 ? i + 1 : Array.from(raw.slice(0, k)).length + 1; }

/** Base64 as text in `charset` (UTF-8 by default): { ok, text, bytes, ... } or { ok: false, error, bytes? } (bytes when they decode but are not text). Pure. */
export function decodeText(input, charset = 'utf-8') {
  const r = decodeBytes(input); if (!r.ok) return r;
  const t = bytesToText(r.bytes, charset);
  return t.ok ? { ...r, text: t.text } : { ...r, ok: false, error: t.error, binary: true };
}

/** bytes in hex, two digits each, a space between: "68 65 6c 6c 6f". Pure. */
export const hexOf = (bytes) => Array.from(bytes || [], (x) => x.toString(16).padStart(2, '0')).join(' ');
/** bytes as a data: URL (data:image/png;base64,...). Pure. */
export const dataUrl = (bytes, mime = 'application/octet-stream') => 'data:' + (mime || 'application/octet-stream') + ';base64,' + encodeBytes(bytes);
/** a byte count as people say it: 5 bytes, 1.2 KB, 3.4 MB. Pure. */
export function sizeOf(n) { return n < 1024 ? n + (n === 1 ? ' byte' : ' bytes') : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB'; }
