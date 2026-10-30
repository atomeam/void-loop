// the sound files Verse writes on the device beside WAV and AIFF: FLAC (its own lossless encoder, pure) and Ogg Opus (.ogg and .opus: the
// browser's own Opus encoder, in Verse's own Ogg pages). Every byte is written here; nothing is uploaded.
import { opusHead, opusHeadOf } from './video-mux.js';

// ---- bits ---------------------------------------------------------------------------------------------------------------------------------
class Bits {
  constructor(n = 1 << 16) { this.b = new Uint8Array(n); this.p = 0; this.acc = 0; this.k = 0; }
  grow(n) { if (this.p + n > this.b.length) { const c = new Uint8Array(Math.max(this.b.length * 2, this.p + n + 1024)); c.set(this.b.subarray(0, this.p)); this.b = c; } }
  /** n bits of v, high bit first (in pieces of 16 at most, so the store stays a 32-bit integer) */
  put(v, n) {
    if (n > 16) { this.put(Math.floor(v / 65536) & ((1 << (n - 16)) - 1), n - 16); v &= 0xffff; n = 16; }
    this.acc = (this.acc << n) | (v & ((1 << n) - 1)); this.k += n; if (this.p + 4 > this.b.length) this.grow(4);
    while (this.k >= 8) { this.k -= 8; this.b[this.p++] = (this.acc >>> this.k) & 255; } this.acc &= (1 << this.k) - 1;
  }
  align() { if (this.k) this.put(0, 8 - this.k); }
  bytes() { return this.b.subarray(0, this.p); }
}

// ---- checks -------------------------------------------------------------------------------------------------------------------------------
const table = (poly, bits) => Uint32Array.from({ length: 256 }, (_, i) => { let c = i << (bits - 8); for (let k = 0; k < 8; k++) c = c & (1 << (bits - 1)) ? (c << 1) ^ poly : c << 1; return c & (bits === 32 ? 0xffffffff : (1 << bits) - 1); });
const T8 = table(0x07, 8), T16 = table(0x8005, 16), T32 = table(0x04c11db7, 32);
export const crc8 = (b) => { let c = 0; for (const x of b) c = T8[c ^ x]; return c; };
export const crc16 = (b) => { let c = 0; for (const x of b) c = ((c << 8) ^ T16[(c >> 8) ^ x]) & 0xffff; return c; };
/** the Ogg page check: CRC-32, polynomial 0x04c11db7, not reflected, starts at 0 */
export const crc32ogg = (b) => { let c = 0; for (const x of b) c = ((c << 8) ^ T32[((c >>> 24) ^ x) & 255]) >>> 0; return c >>> 0; };

/** MD5 of bytes (RFC 1321): FLAC keeps the MD5 of the samples so a player can check the file */
export function md5(bytes) {
  const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21], K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);
  const n = bytes.length, total = ((n + 8) >>> 6) + 1, w = new Uint32Array(total * 16);
  for (let i = 0; i < n; i++) w[i >> 2] |= bytes[i] << ((i % 4) * 8);
  w[n >> 2] |= 0x80 << ((n % 4) * 8); w[total * 16 - 2] = (n * 8) >>> 0; w[total * 16 - 1] = Math.floor(n / 2 ** 29);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let o = 0; o < w.length; o += 16) {
    let a = a0, b = b0, c = c0, d = d0;
    for (let i = 0; i < 64; i++) {
      let f, g; const r = i >> 4;
      if (r === 0) { f = (b & c) | (~b & d); g = i; } else if (r === 1) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; } else if (r === 2) { f = b ^ c ^ d; g = (3 * i + 5) % 16; } else { f = c ^ (b | ~d); g = (7 * i) % 16; }
      const t = d; d = c; c = b; const x = (a + f + K[i] + w[o + g]) >>> 0, s = S[r * 4 + (i % 4)]; b = (b + ((x << s) | (x >>> (32 - s)))) >>> 0; a = t;
    }
    a0 = (a0 + a) >>> 0; b0 = (b0 + b) >>> 0; c0 = (c0 + c) >>> 0; d0 = (d0 + d) >>> 0;
  }
  const out = new Uint8Array(16); [a0, b0, c0, d0].forEach((v, k) => { for (let j = 0; j < 4; j++) out[k * 4 + j] = (v >>> (8 * j)) & 255; }); return out;
}

// ---- FLAC ---------------------------------------------------------------------------------------------------------------------------------
const s16 = (x) => { const y = Math.max(-1, Math.min(1, x)); return Math.round(y < 0 ? y * 32768 : y * 32767); };
const BLOCK = 4096;
/** the residual of a fixed predictor of order 0 to 4 (FLAC's own set) */
function fixedResidual(x, order) {
  const n = x.length, r = new Int32Array(Math.max(0, n - order));
  for (let i = order; i < n; i++) {
    r[i - order] = order === 0 ? x[i] : order === 1 ? x[i] - x[i - 1] : order === 2 ? x[i] - 2 * x[i - 1] + x[i - 2]
      : order === 3 ? x[i] - 3 * x[i - 1] + 3 * x[i - 2] - x[i - 3] : x[i] - 4 * x[i - 1] + 6 * x[i - 2] - 4 * x[i - 3] + x[i - 4];
  }
  return r;
}
const zig = (v) => (v >= 0 ? 2 * v : -2 * v - 1);
/** the bit count of m residuals whose zigzag values add up to sum, coded with the best Rice parameter: m(k+1) plus sum/2^k, near enough to
 *  choose by. The parameter goes in ks[at]. */
function riceBits(sum, m, ks, at) {
  if (!m) { ks[at] = 0; return 0; }
  const mean = Math.floor(sum / m), g = mean > 0 ? Math.min(14, 31 - Math.clz32(Math.min(mean, 0x7fffffff))) : 0, big = sum >= 4294967296; // loud noise can pass 2^32
  let bk = 0, bb = Infinity;
  for (let k = g > 0 ? g - 1 : 0; k <= g + 1 && k <= 14; k++) { const bits = m * (k + 1) + (big ? Math.floor(sum / 2 ** k) : sum >>> k); if (bits < bb) { bb = bits; bk = k; } }
  ks[at] = bk; return bb;
}
/** the partition order (0 to 6) and Rice parameters that code a residual in the fewest bits; one pass for the sums, then each order from them */
function partitionOf(r, block, order) {
  let top = 0; while (top < 6 && block % (2 << top) === 0 && (block >> (top + 1)) > order) top++;
  const parts = 1 << top, len = block >> top, sums = new Float64Array(parts);
  for (let p = 0; p < parts; p++) { const from = p === 0 ? 0 : p * len - order, to = (p + 1) * len - order; let s = 0; for (let i = from; i < to; i++) s += zig(r[i]); sums[p] = s; }
  let best = null;
  for (let po = top, cur = sums; po >= 0; po--) {
    const n = 1 << po, l = block >> po, ks = new Uint8Array(n); let bits = 0;
    for (let p = 0; p < n; p++) bits += 4 + riceBits(cur[p], l - (p === 0 ? order : 0), ks, p);
    if (!best || bits < best.bits) best = { po, ks, bits, len: l };
    if (po) { const up = new Float64Array(n >> 1); for (let p = 0; p < n >> 1; p++) up[p] = cur[2 * p] + cur[2 * p + 1]; cur = up; }
  }
  return best;
}
/** the cheapest way to code one channel of one block: constant, verbatim or a fixed predictor */
function subframeOf(x, bps) {
  if (x.every((v) => v === x[0])) return { type: 'constant', bits: 8 + bps, x };
  let best = { type: 'verbatim', bits: 8 + bps * x.length, x };
  for (let order = 0; order <= Math.min(4, x.length - 1); order++) {
    const r = fixedResidual(x, order), part = partitionOf(r, x.length, order); if (!part) continue;
    const bits = 8 + order * bps + 6 + part.bits; if (bits < best.bits) best = { type: 'fixed', order, r, part, bits, x };
  }
  return best;
}
function writeSubframe(w, s, bps) {
  if (s.type === 'constant') { w.put(0, 8); w.put(s.x[0] & ((1 << bps) - 1), bps); return; }
  if (s.type === 'verbatim') { w.put(0b00000010, 8); for (const v of s.x) w.put(v & ((1 << bps) - 1), bps); return; }
  w.put(0b00010000 | (s.order << 1), 8);
  for (let i = 0; i < s.order; i++) w.put(s.x[i] & ((1 << bps) - 1), bps);
  w.put(0, 2); w.put(s.part.po, 4);
  const { po, ks, len } = s.part;
  for (let p = 0; p < (1 << po); p++) {
    const k = ks[p], from = p === 0 ? 0 : p * len - s.order, to = (p + 1) * len - s.order; w.put(k, 4);
    for (let i = from; i < to; i++) { const u = zig(s.r[i]); let q = u >>> k; while (q >= 16) { w.put(0, 16); q -= 16; } w.put(1, q + 1); if (k) w.put(u & ((1 << k) - 1), k); }
  }
}
/** the frame number as FLAC writes it: the UTF-8 shape, up to 31 bits */
function utf8Num(n) {
  if (n < 0x80) return [n];
  const out = []; let len = n < 0x800 ? 2 : n < 0x10000 ? 3 : n < 0x200000 ? 4 : n < 0x4000000 ? 5 : 6;
  for (let i = len - 1; i > 0; i--) { out.unshift(0x80 | (n & 0x3f)); n = Math.floor(n / 64); }
  out.unshift(((0xff00 >> len) & 0xff) | n); return out;
}

/** samples (Float32 channels, -1 to 1) -> a 16-bit FLAC file with a real MD5. Pure. Mono and stereo use the best of left, right, mid and side. */
export function flac(channels, rate) {
  const c = Math.max(1, Math.min(8, channels.length)), n = channels[0] ? channels[0].length : 0, bps = 16;
  const pcm = Array.from({ length: c }, (_, k) => { const x = channels[k] || channels[0], o = new Int32Array(n); for (let i = 0; i < n; i++) o[i] = s16(x[i]); return o; });
  // the MD5 is of the samples as signed 16-bit little-endian, the channels interleaved
  const raw = new Uint8Array(n * c * 2); let at = 0; for (let i = 0; i < n; i++) for (let k = 0; k < c; k++) { const v = pcm[k][i]; raw[at++] = v & 255; raw[at++] = (v >> 8) & 255; }
  const frames = [], sizes = [];
  for (let start = 0, num = 0; start < n || (n === 0 && num === 0); start += BLOCK, num++) {
    const len = Math.min(BLOCK, n - start); if (len <= 0) break;
    const blk = pcm.map((x) => x.subarray(start, start + len));
    let assign = c - 1, subs = blk.map((x) => subframeOf(x, bps));
    if (c === 2) {
      const L = blk[0], R = blk[1], S = new Int32Array(len), M = new Int32Array(len);
      for (let i = 0; i < len; i++) { S[i] = L[i] - R[i]; M[i] = (L[i] + R[i]) >> 1; }
      const sl = subs[0], sr = subs[1], ss = subframeOf(S, bps + 1), sm = subframeOf(M, bps);
      const ways = [[1, [sl, sr], sl.bits + sr.bits], [8, [sl, ss], sl.bits + ss.bits], [9, [ss, sr], ss.bits + sr.bits], [10, [sm, ss], sm.bits + ss.bits]];
      const best = ways.reduce((a, b) => (b[2] < a[2] ? b : a)); assign = best[0]; subs = best[1];
    }
    const w = new Bits(len * c * 3 + 64);
    w.put(0xfff8, 16); w.put(len === BLOCK ? 12 : 7, 4); w.put(0, 4); w.put(assign, 4); w.put(4, 3); w.put(0, 1);
    for (const x of utf8Num(num)) w.put(x, 8);
    if (len !== BLOCK) w.put(len - 1, 16);
    w.put(crc8(w.bytes()), 8);
    subs.forEach((s, k) => writeSubframe(w, s, bps + ((assign === 8 && k === 1) || (assign === 9 && k === 0) || (assign === 10 && k === 1) ? 1 : 0)));
    w.align(); const crc = crc16(w.bytes()); w.put(crc, 16);
    const f = w.bytes().slice(); frames.push(f); sizes.push(f.length);
  }
  const info = new Bits(64);
  info.put(1, 1); info.put(0, 7); info.put(34, 24); // the last metadata block, STREAMINFO, 34 bytes
  info.put(n < BLOCK && n > 0 ? n : BLOCK, 16); info.put(n < BLOCK && n > 0 ? n : BLOCK, 16);
  info.put(sizes.length ? Math.min(...sizes) : 0, 24); info.put(sizes.length ? Math.max(...sizes) : 0, 24);
  info.put(Math.round(rate), 20); info.put(c - 1, 3); info.put(bps - 1, 5); info.put(Math.floor(n / 2 ** 32), 4); info.put(Math.floor(n / 2 ** 16) & 0xffff, 16); info.put(n & 0xffff, 16);
  const head = info.bytes(), sum = md5(raw), total = 4 + head.length + 16 + sizes.reduce((a, b) => a + b, 0), out = new Uint8Array(total);
  out.set([0x66, 0x4c, 0x61, 0x43], 0); out.set(head, 4); out.set(sum, 4 + head.length); let p = 4 + head.length + 16; for (const f of frames) { out.set(f, p); p += f.length; }
  return out;
}

// ---- Ogg Opus -----------------------------------------------------------------------------------------------------------------------------
const le32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
function page(packets, { granule, serial, seq, bos = false, eos = false, cont = false }) {
  const lace = []; for (const p of packets) { let n = p.length; while (n >= 255) { lace.push(255); n -= 255; } lace.push(n); }
  const body = packets.reduce((a, p) => a + p.length, 0), b = new Uint8Array(27 + lace.length + body), v = new DataView(b.buffer);
  b.set([0x4f, 0x67, 0x67, 0x53, 0, (cont ? 1 : 0) | (bos ? 2 : 0) | (eos ? 4 : 0)], 0);
  v.setUint32(6, granule % 2 ** 32, true); v.setUint32(10, Math.floor(granule / 2 ** 32), true); v.setUint32(14, serial, true); v.setUint32(18, seq, true);
  b[26] = lace.length; b.set(lace, 27); let p = 27 + lace.length; for (const x of packets) { b.set(x, p); p += x.length; }
  v.setUint32(22, crc32ogg(b), true); return b;
}
/** Opus packets ({ data, d } with d in microseconds, from AudioEncoder) -> an Ogg Opus file (RFC 7845). Pure. */
export function oggOpus(audio, opts = {}) {
  const h = opusHeadOf(audio.description, audio.channels, opts.inputRate || 48000), head = opusHead({ ...h, rate: opts.inputRate || h.rate });
  const vendor = new TextEncoder().encode('Verse'), tags = new Uint8Array([...new TextEncoder().encode('OpusTags'), ...le32(vendor.length), ...vendor, ...le32(0)]);
  const serial = opts.serial >>> 0 || 0x56657273, pages = [page([head], { granule: 0, serial, seq: 0, bos: true }), page([tags], { granule: 0, serial, seq: 1 })];
  const total = opts.samples != null ? h.preSkip + opts.samples : null; // the true end, so a player drops the padding of the last packet
  // a page's granule counts every sample decoded to the end of its last packet, the pre-skip samples included (RFC 7845 section 4)
  let granule = 0, seq = 2, group = [], segs = 0, size = 0;
  const flush = (last) => { if (!group.length) return; pages.push(page(group, { granule: last && total != null ? Math.min(granule, total) : granule, serial, seq: seq++, eos: last })); group = []; segs = 0; size = 0; };
  audio.samples.forEach((s, i) => {
    const need = Math.floor(s.data.length / 255) + 1; if (segs + need > 255 || size > 4000) flush(false);
    group.push(s.data); segs += need; size += s.data.length; granule += Math.round(((s.d || 20000) * 48000) / 1e6);
    if (i === audio.samples.length - 1) flush(true);
  });
  if (!audio.samples.length) pages.push(page([], { granule: h.preSkip, serial, seq: seq++, eos: true }));
  const out = new Uint8Array(pages.reduce((a, p) => a + p.length, 0)); let p = 0; for (const x of pages) { out.set(x, p); p += x.length; } return out;
}

// ---- in the browser: Opus needs 48 kHz and the browser's AudioEncoder -----------------------------------------------------------------
/** a sound at 48 kHz, resampled by the browser's own audio engine (better than a straight line between samples) */
export async function to48(s) {
  if (s.rate === 48000) return s;
  const n = s.channels[0].length, C = window.OfflineAudioContext || window.webkitOfflineAudioContext, m = Math.max(1, Math.ceil(n * 48000 / s.rate));
  const ctx = new C(s.channels.length, m, 48000), b = ctx.createBuffer(s.channels.length, n, s.rate);
  s.channels.forEach((c, k) => b.copyToChannel(c, k)); const src = ctx.createBufferSource(); src.buffer = b; src.connect(ctx.destination); src.start();
  const out = await ctx.startRendering(); return { rate: 48000, channels: Array.from({ length: out.numberOfChannels }, (_, k) => out.getChannelData(k)), notes: s.notes || [] };
}
/** a sound -> an Ogg Opus file at the bit rate given, with the browser's own Opus encoder; { bytes, notes } */
export async function opusFile(s, encodeSound, bitrate = 128000) {
  if (typeof AudioEncoder !== 'function') throw new Error('this browser has no audio encoder, so it cannot write Opus; WAV, AIFF and FLAC work here.');
  const ch = Math.min(2, s.channels.length), cfg = { codec: 'opus', sampleRate: 48000, numberOfChannels: ch, bitrate };
  let ok = false; try { ok = !!(await AudioEncoder.isConfigSupported(cfg)).supported; } catch (_) {}
  if (!ok) throw new Error('this browser cannot code Opus; WAV, AIFF and FLAC work here.');
  const s48 = await to48(s), audio = await encodeSound(s48, cfg), notes = ['Opus at ' + bitrate / 1000 + ' kbps, coded by this browser'];
  if (s.channels.length > 2) notes.push('the first 2 of ' + s.channels.length + ' channels');
  return { bytes: oggOpus(audio, { inputRate: Math.round(s.rate), samples: s48.channels[0].length }), notes };
}
