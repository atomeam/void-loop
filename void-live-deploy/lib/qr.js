// A QR code encoder, made here so a code never needs the network (owner, 2026-10-18: the spectators card shows its link as a QR code for phones;
// "make a qr code for ..." in skills/util.js draws with it too, since 2026-10-30). Byte mode (UTF-8), versions 1 to 40, error correction L, M, Q or H, the mask with
// the lowest penalty, as ISO/IEC 18004 lays it out. Pure: qrMatrix()
// gives the modules, qrSvg() an SVG made of numbers only. A text past what version 40 holds gives null, never a broken code.

const ECL = { L: 0, M: 1, Q: 2, H: 3 }, FORMAT = [1, 0, 3, 2]; // index by ECL; FORMAT is the two format bits of each level
const ECC_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];
const BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

/** how many modules of a version carry data and error correction (everything but the function patterns). Pure. */
export function rawModules(ver) {
  let n = (16 * ver + 128) * ver + 64;
  if (ver >= 2) { const a = Math.floor(ver / 7) + 2; n -= (25 * a - 10) * a - 55; if (ver >= 7) n -= 36; }
  return n;
}
/** how many 8-bit data codewords a version holds at a level. Pure. */
export const dataCodewords = (ver, e) => Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[e][ver] * BLOCKS[e][ver];
/** the alignment pattern centres of a version. Pure. */
export function alignAt(ver) {
  if (ver === 1) return [];
  const n = Math.floor(ver / 7) + 2, step = Math.floor((ver * 8 + n * 3 + 5) / (n * 4 - 4)) * 2, out = [6];
  for (let pos = ver * 4 + 10; out.length < n; pos -= step) out.splice(1, 0, pos);
  return out;
}
const gmul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z & 0xff; };
function divisor(deg) {
  const r = new Array(deg).fill(0); r[deg - 1] = 1; let root = 1;
  for (let i = 0; i < deg; i++) { for (let j = 0; j < deg; j++) { r[j] = gmul(r[j], root); if (j + 1 < deg) r[j] ^= r[j + 1]; } root = gmul(root, 2); }
  return r;
}
function remainder(data, div) {
  const r = new Array(div.length).fill(0);
  for (const b of data) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= gmul(c, f); }); }
  return r;
}

/** the modules of the QR code for `text`: { size, version, ecl, mask, modules: boolean[size][size] (true = dark) }, or null when it does not fit.
 *  ecl: the lowest level wanted ('M' by default); a higher one is used when it fits the same version. Pure. */
export function qrMatrix(text, { ecl = 'M' } = {}) {
  const bytes = [...new TextEncoder().encode(String(text == null ? '' : text))];
  let e = ECL[ecl] != null ? ECL[ecl] : 1, ver = 0;
  const bitsFor = (v) => 4 + (v <= 9 ? 8 : 16) + bytes.length * 8;
  for (let v = 1; v <= 40; v++) if (bitsFor(v) <= dataCodewords(v, e) * 8) { ver = v; break; }
  if (!ver) return null;
  for (let h = e + 1; h <= 3; h++) if (bitsFor(ver) <= dataCodewords(ver, h) * 8) e = h;
  // the data bits: byte mode, the count, the bytes, a terminator, then the pad bytes
  const bits = [], put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(4, 4); put(bytes.length, ver <= 9 ? 8 : 16); for (const b of bytes) put(b, 8);
  const cap = dataCodewords(ver, e) * 8;
  put(0, Math.min(4, cap - bits.length)); put(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8);
  const data = []; for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; data.push(b); }
  // error correction, block by block, then interleaved
  const nb = BLOCKS[e][ver], eccLen = ECC_PER_BLOCK[e][ver], raw = Math.floor(rawModules(ver) / 8), nShort = nb - (raw % nb), shortLen = Math.floor(raw / nb), div = divisor(eccLen);
  const blocks = []; for (let i = 0, k = 0; i < nb; i++) { const d = data.slice(k, k + shortLen - eccLen + (i < nShort ? 0 : 1)); k += d.length; const ec = remainder(d, div); if (i < nShort) d.push(0); blocks.push(d.concat(ec)); }
  const words = []; for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - eccLen || j >= nShort) words.push(b[i]); });
  // the function patterns
  const size = ver * 4 + 17, m = Array.from({ length: size }, () => new Array(size).fill(false)), fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, dark) => { m[y][x] = !!dark; fn[y][x] = true; };
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy)); if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
  }
  const al = alignAt(ver), last = al.length - 1;
  al.forEach((ax, i) => al.forEach((ay, j) => { if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }));
  const format = (mask) => {
    const d = (FORMAT[e] << 3) | mask; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((d << 10) | r) ^ 0x5412, bit = (i) => ((b >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
  };
  format(0);
  if (ver >= 7) {
    let r = ver; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const b = (ver << 12) | r;
    for (let i = 0; i < 18; i++) { const dark = ((b >>> i) & 1) === 1, a = size - 11 + (i % 3), c = Math.floor(i / 3); set(a, c, dark); set(c, a, dark); }
  }
  // the codewords, in the zigzag
  let n = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let v = 0; v < size; v++) for (let j = 0; j < 2; j++) {
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - v : v;
      if (!fn[y][x] && n < words.length * 8) { m[y][x] = ((words[n >>> 3] >>> (7 - (n & 7))) & 1) === 1; n++; }
    }
  }
  // the mask with the lowest penalty
  const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0, (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0];
  const apply = (k) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[k](x, y)) m[y][x] = !m[y][x]; };
  let best = 0, bestScore = Infinity;
  for (let k = 0; k < 8; k++) { apply(k); format(k); const s = penalty(m); if (s < bestScore) { bestScore = s; best = k; } apply(k); }
  apply(best); format(best);
  return { size, version: ver, ecl: Object.keys(ECL)[e], mask: best, modules: m };
}

const FINDER = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
/** ISO 18004's four penalty rules over a grid (runs, 2x2 blocks, finder-like patterns, dark balance). Pure. */
export function penalty(m) {
  const size = m.length; let s = 0, dark = 0;
  const line = (get) => {
    let run = 1, out = 0; const row = [];
    for (let i = 0; i < size; i++) row.push(get(i));
    for (let i = 1; i <= size; i++) { if (i < size && row[i] === row[i - 1]) run++; else { if (run >= 5) out += 3 + run - 5; run = 1; } }
    const padded = [0, 0, 0, 0].concat(row.map(Number), [0, 0, 0, 0]);
    for (let i = 0; i + 11 <= padded.length; i++) {
      let f = true, r = true; for (let j = 0; j < 11; j++) { if (padded[i + j] !== FINDER[j]) f = false; if (padded[i + j] !== FINDER[10 - j]) r = false; }
      if (f) out += 40; if (r) out += 40;
    }
    return out;
  };
  for (let y = 0; y < size; y++) s += line((x) => m[y][x]);
  for (let x = 0; x < size; x++) s += line((y) => m[y][x]);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (m[y][x]) dark++;
    if (x + 1 < size && y + 1 < size && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) s += 3;
  }
  const total = size * size; s += Math.max(0, Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return s;
}

/** the modules as one SVG path, dark on white with a `margin`-module quiet zone; only numbers go into it. Pure. */
export function qrSvg(q, { margin = 4, label = 'QR code' } = {}) {
  if (!q || !q.modules) return '';
  const n = q.size + margin * 2; let d = '';
  q.modules.forEach((row, y) => { let x = 0; while (x < q.size) { if (!row[x]) { x++; continue; } let w = 1; while (x + w < q.size && row[x + w]) w++; d += 'M' + (x + margin) + ' ' + (y + margin) + 'h' + w + 'v1h-' + w + 'z'; x += w; } });
  const safe = String(label).replace(/[^A-Za-z0-9 .,:'-]/g, '');
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n + ' ' + n + '" shape-rendering="crispEdges" role="img" aria-label="' + safe + '"><rect width="' + n + '" height="' + n + '" fill="#fff"/><path fill="#000" d="' + d + '"/></svg>';
}
