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
  // the smallest power-of-two width from 8 bits up that holds the value (8, 16, 32, 64, 128, 256 ... at any size, the tower gate's 'signed reading')
  const widths = []; for (let w = 8; w <= Math.max(64, bits * 2); w *= 2) widths.push(w);
  if (!neg) for (const w of widths) if (bits <= w) { const top = 1n << BigInt(w - 1); signed = { width: w, value: mag >= top ? mag - (1n << BigInt(w)) : mag, unsigned: mag }; break; }
  if (neg) for (const w of widths) if (mag <= (1n << BigInt(w - 1))) { signed = { width: w, value: n, unsigned: (1n << BigInt(w)) + n, twos: ((1n << BigInt(w)) + n).toString(2).padStart(w, '0') }; break; }
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
/** the stage card for a number typed in base 2, 8, 10 or 16: "<digits> <base> to <decimal, or binary from decimal>", only when the ask
 *  reads back to the same number; '' otherwise (the example stays). Pure. */
const WORD = { 2: 'binary', 8: 'octal', 10: 'decimal', 16: 'hex' };
export function baseAsk(text, base) {
  const c = clean(text), w = WORD[base]; if (!c || !w || c.negative || c.digits.length > 200 || (c.base && c.base !== base)) return '';
  const ask = c.digits + ' ' + w + ' to ' + (base === 10 ? 'binary' : 'decimal'), p = parseAsk(ask); if (!p) return '';
  const a = convert(c.digits, base, 10), b = convert(p.value, p.from, 10);
  return a.ok && b.ok && a.out === b.out ? ask : '';
}
/** what an ask wants: { value, from (0 = by prefix or decimal), to } or null. A bare number with a prefix or no source base is read as decimal unless it carries 0x/0b/0o. Pure. */
export function parseAsk(text) {
  const t = String(text || '').trim().replace(/[?.!]+$/, '').replace(/\s+/g, ' ');
  for (const [re, pick] of PATTERNS) { const m = re.exec(t); if (!m) continue; const [value, fromWord, toWord] = pick(m), to = baseOf(toWord), from = fromWord ? baseOf(fromWord) : 0; if (to && (from || !fromWord)) return { value, from: from || 0, to }; }
  return null;
}

/**
 * Fractions, exactly (hextobinary.com's fraction and floating-point box): a number with a point is a fraction num / den, den a power of
 * its base, and is written in another base digit by digit, the remainders remembered so a fraction that repeats is caught (0.1 decimal is
 * 0.0(0011) in binary, the bracket repeating for ever), never rounded. Pure.
 */
export function parseReal(text, base) {
  const t = String(text == null ? '' : text).trim().toLowerCase().replace(/[\s_,]/g, ''); if (!t) return null;
  const neg = t.startsWith('-'), body = t.replace(/^[-+]/, ''), m = /^([0-9a-z]*)\.([0-9a-z]*)$/.exec(body); if (!m || (!m[1] && !m[2])) return null;
  const i = m[1] ? parse(m[1], base) : 0n, f = m[2] ? parse(m[2], base) : 0n; if (i === null || f === null) return null;
  const den = BigInt(base) ** BigInt(m[2].length), num = i * den + f; return { neg, num, den };
}
/** a fraction written in a base: { int, digits (after the point, as a string), repeat (where the repeating part starts, or -1), cut (true when
 *  `max` digits were reached first) }; text() gives "0.0(0011)". Pure. */
export function formatReal({ neg, num, den }, base, max = 48) {
  const b = BigInt(base), int = num / den; let r = num % den, digits = ''; const seen = new Map();
  while (r !== 0n && digits.length < max) { if (seen.has(r)) break; seen.set(r, digits.length); r *= b; digits += DIGITS[Number(r / den)]; r %= den; }
  const repeat = r !== 0n && seen.has(r) ? seen.get(r) : -1, cut = r !== 0n && repeat < 0;
  const head = (neg && (int !== 0n || digits) ? '-' : '') + format(int, base);
  return { int: head, digits, repeat, cut, text: head + (digits ? '.' + (repeat >= 0 ? digits.slice(0, repeat) + '(' + digits.slice(repeat) + ')' : digits) : '') };
}
/** the working for one number into decimal: each digit times its place value, and the sum. [{ digit, value, power, term }]. Pure. */
export function stepsToDecimal(digits, base) {
  const d = String(digits).toLowerCase(), n = d.length;
  return [...d].map((c, i) => { const v = DIGITS.indexOf(c), p = n - 1 - i; return { digit: c, value: v, power: p, term: BigInt(v) * BigInt(base) ** BigInt(p) }; });
}
/** the working out of decimal into a base: divide by the base, keep the remainder, until nothing is left; read the remainders bottom up. Pure. */
export function stepsFromDecimal(n, base) {
  const out = [], b = BigInt(base); let x = n < 0n ? -n : n; if (x === 0n) return [{ n: 0n, q: 0n, r: 0 }];
  while (x > 0n) { out.push({ n: x, q: x / b, r: Number(x % b) }); x /= b; } return out;
}
/** the working for a fraction's part after the point: multiply by the base, the whole part is the next digit. Up to `max` steps. Pure. */
export function stepsFraction({ num, den }, base, max = 8) {
  const out = [], b = BigInt(base); let r = num % den;
  for (let i = 0; i < max && r !== 0n; i++) { const x = r * b; out.push({ num: r, den, times: x, digit: DIGITS[Number(x / den)] }); r = x % den; } return out;
}
