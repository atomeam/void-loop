/**
 * baseconv: a number in any base, in every base at once (owner, 2026-10-24: back to the easy sites; hextobinary.com, Tranco 136,997, the next real tool in the
 * filtered scan, is a hex-to-binary box surrounded by ad, tag-manager, consent and maths-typesetting scripts). Exact for any size (BigInt), never a float:
 * "ffffffffffffffffffff" is 1208925819614629174706175, not a rounded guess. Gives binary, octal, decimal and hex together, grouped to be read (binary by
 * four, hex by two), what the same bits mean as a signed number in the smallest width that holds them (two's complement), and the bytes as text when they
 * are printable. Pure; the page, the card and the ask all use it.
 * Tests: tools/baseconv.test.mjs.
 */
export const NAMES = Object.freeze({ binary: 2, bin: 2, base2: 2, octal: 8, oct: 8, base8: 8, decimal: 10, dec: 10, base10: 10, denary: 10, hexadecimal: 16, hex: 16, base16: 16 });
const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
export const MAX_DIGITS = 4096;

/** the base a word names ("hex", "binary", "base 7"), or 0. Pure. */
export function baseOf(word) {
  const w = String(word || '').toLowerCase().trim().replace(/^base[\s-]*/, 'base');
  if (NAMES[w]) return NAMES[w]; const m = /^base(\d{1,2})$/.exec(w); return m && +m[1] >= 2 && +m[1] <= 36 ? +m[1] : 0;
}
/** the digits of a number as typed, cleaned: { digits, base?, negative } with a 0x / 0b / 0o prefix read as its base, spaces, underscores and commas dropped; null when empty. Pure. */
export function clean(text) {
  let t = String(text == null ? '' : text).trim().toLowerCase().replace(/[\s_,]/g, ''), negative = false, base;
  if (t.startsWith('-')) { negative = true; t = t.slice(1); } else if (t.startsWith('+')) t = t.slice(1);
  const p = /^0([xbo])/.exec(t); if (p && t.length > 2) { base = { x: 16, b: 2, o: 8 }[p[1]]; t = t.slice(2); }
  return t ? { digits: t, base, negative } : null;
}
/** a number from digits in a base, exact: a BigInt, or null when a digit does not belong to the base or there are too many. Pure. */
export function parse(digits, base) {
  if (!digits || digits.length > MAX_DIGITS || base < 2 || base > 36) return null;
  let n = 0n; const b = BigInt(base);
  for (const c of digits) { const d = DIGITS.indexOf(c); if (d < 0 || d >= base) return null; n = n * b + BigInt(d); }
  return n;
}
/** a number as digits in a base (lower case), with a minus for a negative. Pure. */
export function format(n, base) { return (n < 0n ? '-' : '') + (n < 0n ? -n : n).toString(base); }
/** grouped to be read: binary by four and hex by two (padded on the left with zeros), octal by three, decimal by three with commas; other bases as they are. Pure. */
export function group(digits, base) {
  const neg = String(digits).startsWith('-'), d = neg ? String(digits).slice(1) : String(digits); let out;
  const chunk = (str, size, pad, sep) => { const s = pad ? str.padStart(Math.ceil(str.length / size) * size, '0') : str, parts = []; for (let k = s.length; k > 0; k -= size) parts.unshift(s.slice(Math.max(0, k - size), k)); return parts.join(sep); };
  if (base === 2) out = chunk(d, 4, true, ' '); else if (base === 16) out = chunk(d, 2, true, ' '); else if (base === 8) out = chunk(d, 3, false, ' '); else if (base === 10) out = chunk(d, 3, false, ','); else out = d;
  return (neg ? '-' : '') + out;
}

/** a value in every base at once, and what the bits mean: { value (BigInt), negative, bin, oct, dec, hex (grouped), plain (ungrouped), bits, signed: { width, value } | null, text } . Pure. */
export function all(n) {
  const neg = n < 0n, mag = neg ? -n : n, plain = { bin: format(n, 2), oct: format(n, 8), dec: format(n, 10), hex: format(n, 16).toUpperCase() };
  const bits = mag === 0n ? 1 : mag.toString(2).length; let signed = null;
  if (!neg) for (const w of [8, 16, 32, 64]) if (bits <= w) { const top = 1n << BigInt(w - 1); signed = { width: w, value: mag >= top ? mag - (1n << BigInt(w)) : mag, unsigned: mag }; break; }
  if (neg) for (const w of [8, 16, 32, 64]) if (mag <= (1n << BigInt(w - 1))) { signed = { width: w, value: n, unsigned: (1n << BigInt(w)) + n, twos: ((1n << BigInt(w)) + n).toString(2).padStart(w, '0') }; break; }
  let text = ''; if (!neg && mag > 0n) { const hex = mag.toString(16), padded = hex.length % 2 ? '0' + hex : hex, bytes = padded.match(/../g).map((h) => parseInt(h, 16)); if (bytes.length <= 64 && bytes.every((b) => b >= 32 && b < 127)) text = String.fromCharCode(...bytes); }
  return { value: n, negative: neg, plain, bin: group(plain.bin, 2), oct: group(plain.oct, 8), dec: group(plain.dec, 10), hex: group(plain.hex, 16), bits, signed, text };
}

/** convert one typed number from one base to another: { ok, from, to, input, out (plain digits), outGrouped, all } or { ok: false, why }; `from` 0 means by its prefix, else decimal. Pure. */
export function convert(text, from, to) {
  const c = clean(text); if (!c) return { ok: false, why: 'Type a number first.' };
  const base = c.base || from || 10, n = parse(c.digits, base);
  if (n === null) return { ok: false, why: c.digits.length > MAX_DIGITS ? 'That is too long (the limit is ' + MAX_DIGITS + ' digits).' : '"' + c.digits.slice(0, 40) + '" is not a base ' + base + ' number: ' + (base <= 10 ? 'digits 0 to ' + (base - 1) + ' only' : 'digits 0 to 9 and letters up to ' + DIGITS[base - 1]) + '.' };
  const v = c.negative ? -n : n, t = to || 10, raw = format(v, t), out = t === 16 ? raw.toUpperCase() : raw;
  return { ok: true, from: base, to: t, input: c.digits, out, outGrouped: group(out, t), all: all(v) };
}

// the asks: "ff hex to binary", "hex ff to binary", "1010 binary to decimal", "convert 255 to hex", "0xff in decimal", "255 in binary", "convert ff from hex to binary"
const B = '(binary|bin|octal|oct|decimal|dec|denary|hexadecimal|hex|base\\s*\\d{1,2})', V = '([-+]?(?:0[xbo])?[0-9a-fA-F_,]+)';
const PATTERNS = [
  [new RegExp('^(?:please\\s+)?(?:convert\\s+)?' + V + '\\s+' + B + '\\s+(?:to|into|in|as)\\s+' + B + '$', 'i'), (m) => [m[1], m[2], m[3]]],
  [new RegExp('^(?:please\\s+)?(?:convert\\s+)?' + B + '\\s+' + V + '\\s+(?:to|into|in|as)\\s+' + B + '$', 'i'), (m) => [m[2], m[1], m[3]]],
  [new RegExp('^(?:please\\s+)?convert\\s+' + V + '\\s+from\\s+' + B + '\\s+(?:to|into)\\s+' + B + '$', 'i'), (m) => [m[1], m[2], m[3]]],
  [new RegExp('^(?:please\\s+)?(?:convert\\s+|what\\s+is\\s+)?(0[xbo][0-9a-fA-F_]+|[-+]?\\d[\\d,_]*)\\s+(?:to|into|in|as)\\s+' + B + '\\??$', 'i'), (m) => [m[1], '', m[2]]],
];
/** what an ask wants: { value, from (0 = by prefix or decimal), to } or null. A bare number with a prefix or no source base is read as decimal unless it carries 0x/0b/0o. Pure. */
export function parseAsk(text) {
  const t = String(text || '').trim().replace(/[?.!]+$/, '').replace(/\s+/g, ' ');
  for (const [re, pick] of PATTERNS) { const m = re.exec(t); if (!m) continue; const [value, fromWord, toWord] = pick(m), to = baseOf(toWord), from = fromWord ? baseOf(fromWord) : 0; if (to && (from || !fromWord)) return { value, from: from || 0, to }; }
  return null;
}
