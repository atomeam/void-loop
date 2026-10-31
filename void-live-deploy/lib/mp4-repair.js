// Repair MP4 and Repair M4A (2026-10-30, /converter/): a damaged MP4, MOV, 3GP or M4A made playable again on this device. Nothing is coded
// again: Verse copies the coded pictures and sound as they are and writes a new index (the moov box) for them. Pure: no DOM, the same in the
// browser and in node tests. Four ways, tried in this order:
//  1. 'index'     the file's own index is whole, but the file is cut short: keep every sample whose bytes are all in the file.
//  2. 'fragments' a fragmented file (moof boxes, as OBS and many recorders write): keep every whole fragment.
//  3. 'reference' the index is gone or empty (a recording stopped by a flat battery or a crash): read the data (mdat) picture by picture with
//                 the settings of a good video from the same phone or camera. Each H.264 or H.265 picture is found by its NAL units and
//                 checked against the frame number and picture order of the one before it. PCM and AMR sound between the pictures is kept.
//                 AAC and Opus frames do not say where they end, so that sound cannot be found again without the index: it is left out.
//  4. 'in-band'   no good video: the H.264 or H.265 settings (SPS and PPS) are found in the data itself, where the camera wrote them there.
import { avcParams } from './avi.js';

const te = new TextEncoder();
const cat = (parts) => { let n = 0; for (const p of parts) n += p.length; const o = new Uint8Array(n); let at = 0; for (const p of parts) { o.set(p, at); at += p.length; } return o; };
const u8 = (...v) => Uint8Array.from(v);
const u16 = (v) => u8((v >>> 8) & 255, v & 255);
const u24 = (v) => u8((v >>> 16) & 255, (v >>> 8) & 255, v & 255);
const u32 = (v) => u8((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
const u64 = (v) => cat([u32(Math.floor(v / 2 ** 32)), u32(v >>> 0)]);
const str = (s) => te.encode(s);
const zeros = (n) => new Uint8Array(n);
const box = (type, ...kids) => { const body = cat(kids); return body.length + 8 > 0xffffffff ? cat([u32(1), str(type), u64(body.length + 16), body]) : cat([u32(8 + body.length), str(type), body]); };
const full = (type, version, flags, ...kids) => box(type, u8(version), u24(flags), ...kids);
const MATRIX = cat([0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000].map(u32));

// ---- reading boxes ---------------------------------------------------------------------------------------------------------------------------
const r16 = (b, p) => (b[p] << 8) | b[p + 1];
const r24 = (b, p) => (b[p] << 16) | (b[p + 1] << 8) | b[p + 2];
const r32 = (b, p) => b[p] * 16777216 + ((b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]);
const r64 = (b, p) => r32(b, p) * 4294967296 + r32(b, p + 4);
const s32 = (b, p) => r32(b, p) | 0;
const name4 = (b, p) => String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3]);
const NAME = /^[\x20-\x7e\xa9]{4}$/;

/** the boxes from start to end: { type, start, body, end, size, whole }; it stops at the first one that is not a box, or that the end cuts.
 *  top: a size of 0 runs to the end of the file. */
export function boxesIn(b, start = 0, end = b.length, top = false) {
  const out = []; let p = start;
  while (p + 8 <= end) {
    const type = name4(b, p + 4); if (!NAME.test(type)) break;
    let size = r32(b, p), hdr = 8;
    if (size === 1) { if (p + 16 > end) break; size = r64(b, p + 8); hdr = 16; } else if (size === 0) size = (top ? b.length : end) - p;
    if (size < hdr) break;
    const e = p + size; out.push({ type, start: p, body: p + hdr, end: Math.min(e, end), size, whole: e <= end });
    if (e > end) break; p = e;
  }
  return out;
}
const kid = (b, bx, type) => (bx ? boxesIn(b, bx.body, bx.end).find((x) => x.type === type && x.whole) : undefined);
const kids = (b, bx, type) => (bx ? boxesIn(b, bx.body, bx.end).filter((x) => x.type === type && x.whole) : []);

// the sample tables of a stbl box, each entry count held to what the box has room for
function tablesOf(b, stbl) {
  const get = (t) => kid(b, stbl, t), room = (bx, at, w) => Math.max(0, Math.floor((bx.end - at) / w));
  const T = { size: 0, count: 0, sizes: null, chunk: [], stsc: [], stts: [], ctts: null, sync: null };
  const sz = get('stsz'), z2 = get('stz2');
  if (sz) {
    T.size = r32(b, sz.body + 4); T.count = r32(b, sz.body + 8);
    if (!T.size) { T.count = Math.min(T.count, room(sz, sz.body + 12, 4)); T.sizes = new Uint32Array(T.count); for (let i = 0; i < T.count; i++) T.sizes[i] = r32(b, sz.body + 12 + 4 * i); }
  } else if (z2) {
    const f = b[z2.body + 7]; T.count = Math.min(r32(b, z2.body + 8), room(z2, z2.body + 12, f / 8)); T.sizes = new Uint32Array(T.count);
    for (let i = 0; i < T.count; i++) T.sizes[i] = f === 16 ? r16(b, z2.body + 12 + 2 * i) : f === 8 ? b[z2.body + 12 + i] : (b[z2.body + 12 + (i >> 1)] >> (i & 1 ? 0 : 4)) & 15;
  }
  const co = get('stco') || get('co64');
  if (co) { const w = co.type === 'co64' ? 8 : 4, n = Math.min(r32(b, co.body + 4), room(co, co.body + 8, w)); for (let i = 0; i < n; i++) T.chunk.push(w === 8 ? r64(b, co.body + 8 + 8 * i) : r32(b, co.body + 8 + 4 * i)); }
  const sc = get('stsc'); if (sc) for (let i = 0, n = Math.min(r32(b, sc.body + 4), room(sc, sc.body + 8, 12)); i < n; i++) T.stsc.push([r32(b, sc.body + 8 + 12 * i), r32(b, sc.body + 12 + 12 * i)]);
  const ts = get('stts'); if (ts) for (let i = 0, n = Math.min(r32(b, ts.body + 4), room(ts, ts.body + 8, 8)); i < n; i++) T.stts.push([r32(b, ts.body + 8 + 8 * i), r32(b, ts.body + 12 + 8 * i)]);
  const ct = get('ctts'); if (ct) { T.ctts = []; for (let i = 0, n = Math.min(r32(b, ct.body + 4), room(ct, ct.body + 8, 8)); i < n; i++) T.ctts.push([r32(b, ct.body + 8 + 8 * i), s32(b, ct.body + 12 + 8 * i)]); }
  const ss = get('stss'); if (ss) { const n = Math.min(r32(b, ss.body + 4), room(ss, ss.body + 8, 4)); T.sync = new Uint32Array(n); for (let i = 0; i < n; i++) T.sync[i] = r32(b, ss.body + 8 + 4 * i); }
  return T;
}

// the format of a sound sample entry (ISO and QuickTime versions 0, 1 and 2): bytes and samples in one packet
function soundOf(b, en) {
  const e = en.start + 8; if (en.end < e + 28) return null;
  const v = r16(b, e + 8), ch = r16(b, e + 16), bits = r16(b, e + 18); let rate = r32(b, e + 24) / 65536, bpf = (ch * bits) / 8, spp = 1, channels = ch;
  if (v === 1 && en.end >= e + 44) { spp = r32(b, e + 28) || 1; bpf = r32(b, e + 36) || bpf; }
  if (v === 2 && en.end >= e + 64) { rate = new DataView(b.buffer, b.byteOffset + e + 32, 8).getFloat64(0); channels = r32(b, e + 40); bpf = r32(b, e + 56) || bpf; spp = r32(b, e + 60) || 1; }
  if (en.type === 'ulaw' || en.type === 'alaw') { bpf = channels; spp = 1; }
  return { channels, bits, rate, bpf, spp, version: v };
}

function editsOf(b, elst) {
  const v = b[elst.body], out = []; let p = elst.body + 8;
  for (let i = 0, n = r32(b, elst.body + 4); i < n && p + (v ? 20 : 12) <= elst.end; i++) {
    if (v) { out.push({ dur: r64(b, p), t: r32(b, p + 8) === 0xffffffff && r32(b, p + 12) === 0xffffffff ? -1 : r64(b, p + 8), rate: r32(b, p + 16) }); p += 20; }
    else { out.push({ dur: r32(b, p), t: s32(b, p + 4), rate: r32(b, p + 8) }); p += 12; }
  }
  return out;
}

/** one track of a moov: what the new index copies, and its sample tables */
function trackOf(b, trak) {
  const tkhd = kid(b, trak, 'tkhd'), mdia = kid(b, trak, 'mdia'), mdhd = kid(b, mdia, 'mdhd'), hdlr = kid(b, mdia, 'hdlr'), minf = kid(b, mdia, 'minf'), stbl = kid(b, minf, 'stbl');
  if (!tkhd || !mdhd || !hdlr || !stbl || tkhd.end - tkhd.body < 64) return null;
  const tv = b[tkhd.body], mv = b[mdhd.body], scale = r32(b, mdhd.body + (mv ? 20 : 12)), stsd = kid(b, stbl, 'stsd');
  if (!scale || !stsd) return null;
  const entry = boxesIn(b, stsd.body + 8, stsd.end)[0]; if (!entry || !entry.whole) return null;
  const mhd = boxesIn(b, minf.body, minf.end).find((x) => x.whole && /^(vmhd|smhd|gmhd|nmhd|hmhd|sthd)$/.test(x.type));
  const elst = kid(b, kid(b, trak, 'edts'), 'elst'), tref = kid(b, trak, 'tref'), udta = kid(b, trak, 'udta'), kind = name4(b, hdlr.body + 8);
  return {
    id: r32(b, tkhd.body + (tv ? 20 : 12)), kind, scale, lang: r16(b, mdhd.body + (mv ? 32 : 20)), flags: r24(b, tkhd.body + 1) || 3,
    tail: b.slice(tkhd.end - 60, tkhd.end), hdlr: b.slice(hdlr.start, hdlr.end), mhd: mhd ? b.slice(mhd.start, mhd.end) : null,
    stsd: b.slice(stsd.start, stsd.end), codec: entry.type, entry: b.slice(entry.start, entry.end), audio: kind === 'soun' ? soundOf(b, entry) : null,
    tref: tref ? b.slice(tref.start, tref.end) : null, udta: udta ? b.slice(udta.start, udta.end) : null, edits: elst ? editsOf(b, elst) : null, T: tablesOf(b, stbl),
  };
}

const PCM = /^(sowt|twos|lpcm|in24|in32|fl32|fl64|raw |ulaw|alaw|NONE)$/;
// a track whose samples are all one size and one length (PCM sound): kept as chunks, not one entry a sample
function unitOf(t) {
  const T = t.T; if (!(T.size > 0) || T.ctts || T.sync || T.stts.length !== 1 || !T.count) return null;
  const qt = T.size === 1 && t.audio && t.audio.bpf > 1; // QuickTime: each sample is one PCM frame of bpf bytes, though stsz says 1
  const step = qt ? t.audio.bpf : T.size, per = qt ? t.audio.spp : 1;
  return { size: T.size, dur: T.stts[0][1], step, per, bytes: (n) => (n / per) * step, count: (len) => Math.floor(len / step) * per };
}

// the samples in decoding order, from the start while all of a sample's bytes are in the file
function samplesOf(T, fileLen) {
  const S = { n: 0, off: [], len: [], dur: [], cto: [], key: [] }; let s = 0;
  for (let c = 0, e = 0; c < T.chunk.length && s < T.count; c++) {
    while (e + 1 < T.stsc.length && T.stsc[e + 1][0] <= c + 1) e++;
    const spc = T.stsc.length ? T.stsc[e][1] : 0; let at = T.chunk[c];
    for (let k = 0; k < spc && s < T.count; k++, s++) { const L = T.size || T.sizes[s]; S.off.push(at); S.len.push(L); at += L; }
  }
  let i = 0, d = 0; for (const [n, x] of T.stts) for (let k = 0; k < n && i < s; k++) { S.dur[i++] = x; d = x; } while (i < s) S.dur[i++] = d;
  i = 0; if (T.ctts) for (const [n, x] of T.ctts) for (let k = 0; k < n && i < s; k++) S.cto[i++] = x; while (i < s) S.cto[i++] = 0;
  const key = T.sync ? new Set(T.sync) : null; for (let j = 0; j < s; j++) S.key.push(key ? (key.has(j + 1) ? 1 : 0) : 1);
  while (S.n < s && S.off[S.n] + S.len[S.n] <= fileLen) S.n++;
  return S;
}
// the chunks of a track of one-size samples, while their bytes are in the file (the cut chunk keeps the samples that are whole)
function chunksOf(T, U, fileLen) {
  const out = []; let s = 0;
  for (let c = 0, e = 0; c < T.chunk.length && s < T.count; c++) {
    while (e + 1 < T.stsc.length && T.stsc[e + 1][0] <= c + 1) e++;
    const n = Math.min(T.stsc.length ? T.stsc[e][1] : 0, T.count - s), off = T.chunk[c], len = U.bytes(n); if (!n) continue;
    if (off + len <= fileLen) { out.push({ off, len, n }); s += n; continue; }
    const m = off < fileLen ? Math.min(n, U.count(fileLen - off)) : 0; if (m > 0) out.push({ off, len: U.bytes(m), n: m });
    break;
  }
  return out;
}
const total = (t) => (t.s ? t.s.n : t.chunks.reduce((a, c) => a + c.n, 0));
const durOf = (t) => { if (!t.s) return total(t) * t.unit.dur; let d = 0; for (let i = 0; i < t.s.n; i++) d += t.s.dur[i]; return d; };
// where the last picture leaves the screen: a B-frame stream shows its pictures later than it decodes them, by the composition offsets
const showEnd = (t) => { if (!t.s) return durOf(t); let d = 0, e = 0; for (let i = 0; i < t.s.n; i++) { e = Math.max(e, d + t.s.cto[i] + t.s.dur[i]); d += t.s.dur[i]; } return Math.max(d, e); };

// ---- the bit reader and the H.264 and H.265 settings --------------------------------------------------------------------------------------
// bytes that are not what they claim to be run the reader out (a RangeError): that is a no, and any other error is a bug, so it goes on
const short = (e) => { if (!(e instanceof RangeError)) throw e; };
class Bits {
  constructor(b) { this.b = b; this.p = 0; }
  u(n) { let v = 0; for (let i = 0; i < n; i++) { const x = this.b[this.p >> 3]; if (x === undefined) throw new RangeError('short'); v = v * 2 + ((x >> (7 - (this.p & 7))) & 1); this.p++; } return v; }
  ue() { let z = 0; while (!this.u(1)) if (++z > 31) throw new RangeError('ue'); return z ? 2 ** z - 1 + this.u(z) : 0; }
  se() { const k = this.ue(); return k & 1 ? (k + 1) / 2 : -k / 2; }
}
// the RBSP of a NAL unit from byte 'from': the emulation prevention bytes (00 00 03) taken out, up to max bytes
function unescape(b, from, max) {
  const o = new Uint8Array(Math.max(0, Math.min(max, b.length - from))); let n = 0, z = 0;
  for (let p = from; p < b.length && n < o.length; p++) { const x = b[p]; if (z >= 2 && x === 3) { z = 0; continue; } o[n++] = x; z = x === 0 ? z + 1 : 0; }
  return o.subarray(0, n);
}
const HIGH = new Set([100, 110, 122, 244, 44, 83, 86, 118, 128, 138, 139, 134, 135]);
/** an H.264 sequence parameter set (the NAL unit, with its header) */
export function avcSps(nal) {
  const r = new Bits(unescape(nal, 1, 1024)), profile = r.u(8), compat = r.u(8), level = r.u(8), id = r.ue(); let chroma = 1, sep = 0;
  if (id > 31) throw new RangeError('sps id');
  if (HIGH.has(profile)) {
    chroma = r.ue(); if (chroma > 3) throw new RangeError('chroma'); if (chroma === 3) sep = r.u(1); r.ue(); r.ue(); r.u(1);
    if (r.u(1)) for (let i = 0; i < (chroma !== 3 ? 8 : 12); i++) if (r.u(1)) { let last = 8, next = 8; for (let j = 0; j < (i < 6 ? 16 : 64); j++) { if (next) next = (last + r.se() + 256) % 256; last = next || last; } }
  }
  const fnBits = r.ue() + 4, pocType = r.ue(); let pocBits = 0;
  if (fnBits > 16 || pocType > 2) throw new RangeError('sps');
  if (pocType === 0) { pocBits = r.ue() + 4; if (pocBits > 16) throw new RangeError('poc'); } else if (pocType === 1) { r.u(1); r.se(); r.se(); for (let i = 0, n = r.ue(); i < n; i++) r.se(); }
  r.ue(); r.u(1); const wm = r.ue() + 1, hm = r.ue() + 1, fmo = r.u(1); if (!fmo) r.u(1); r.u(1);
  let crop = [0, 0, 0, 0]; if (r.u(1)) crop = [r.ue(), r.ue(), r.ue(), r.ue()];
  let fps = 0;
  try { if (r.u(1)) { if (r.u(1) && r.u(8) === 255) r.u(32); if (r.u(1)) r.u(1); if (r.u(1)) { r.u(4); if (r.u(1)) r.u(24); } if (r.u(1)) { r.ue(); r.ue(); } if (r.u(1)) { const n = r.u(32), ts = r.u(32); if (n && ts) fps = ts / (2 * n); } } } catch (e) { short(e); /* the timing is optional */ }
  const cx = chroma === 0 || sep || chroma === 3 ? 1 : 2, cy = (chroma === 1 && !sep ? 2 : 1) * (2 - fmo);
  if (wm > 1024 || hm > 1024) throw new RangeError('size');
  return { id, profile, compat, level, chroma, sep, fnBits, pocType, pocBits, frameMbsOnly: fmo, mbs: wm * hm * (2 - fmo), width: wm * 16 - cx * (crop[0] + crop[1]), height: (2 - fmo) * hm * 16 - cy * (crop[2] + crop[3]), fps };
}
function avcPps(nal, spsOf) {
  const r = new Bits(unescape(nal, 1, 16)), id = r.ue(), sid = r.ue(), sps = spsOf.get(sid);
  if (!sps || id > 255) return null; r.u(1); return { id, sps, bfpo: r.u(1) };
}
function ptl(r, maxSub) {
  r.u(8); r.u(32); r.u(32); r.u(16); r.u(8); const p = [], l = [];
  for (let i = 0; i < maxSub; i++) { p.push(r.u(1)); l.push(r.u(1)); }
  if (maxSub > 0) for (let i = maxSub; i < 8; i++) r.u(2);
  for (let i = 0; i < maxSub; i++) { if (p[i]) { r.u(32); r.u(32); r.u(24); } if (l[i]) r.u(8); }
}
/** an H.265 sequence parameter set (the NAL unit, with its 2-byte header) */
export function hevcSps(nal) {
  const r = new Bits(unescape(nal, 2, 512)); r.u(4); const maxSub = r.u(3), nest = r.u(1); ptl(r, maxSub);
  const id = r.ue(), chroma = r.ue(); let sep = 0; if (id > 15 || chroma > 3) throw new RangeError('sps'); if (chroma === 3) sep = r.u(1);
  const w = r.ue(), h = r.ue(); let cw = [0, 0, 0, 0]; if (r.u(1)) cw = [r.ue(), r.ue(), r.ue(), r.ue()];
  const bdl = r.ue() + 8, bdc = r.ue() + 8, pocBits = r.ue() + 4;
  for (let i = r.u(1) ? 0 : maxSub; i <= maxSub; i++) { r.ue(); r.ue(); r.ue(); }
  const ctb = r.ue() + 3 + r.ue();
  if (!w || !h || w > 16888 || h > 16888 || pocBits > 16 || ctb < 4 || ctb > 6 || bdl > 16) throw new RangeError('sps');
  const size = 1 << ctb, ctbs = Math.ceil(w / size) * Math.ceil(h / size), sw = chroma === 1 || chroma === 2 ? 2 : 1, sh = chroma === 1 ? 2 : 1;
  return { id, chroma, sep, width: w - sw * (cw[0] + cw[1]), height: h - sh * (cw[2] + cw[3]), pocBits, ctbs, addrBits: Math.ceil(Math.log2(ctbs)), depth: [bdl, bdc], maxSub, nest };
}
function hevcPps(nal, spsOf) {
  const r = new Bits(unescape(nal, 2, 16)), id = r.ue(), sid = r.ue(), sps = spsOf.get(sid);
  if (!sps || id > 63) return null; return { id, sps, dep: r.u(1), out: r.u(1), extra: r.u(3) };
}

// the NAL unit header and the start of a slice, for each codec. head(b, p, L): null when the bytes at p cannot be the header of a NAL unit of
// length L. A context holds the parameter sets; fork() copies it, so sets read from bytes that turn out not to be video are not kept.
function avcCtx(sps = new Map(), pps = new Map()) {
  return {
    hevc: false, sps, pps,
    fork() { return avcCtx(new Map(sps), new Map(pps)); },
    head(b, p, L) {
      const x = b[p], t = x & 31, ref = (x >> 5) & 3;
      if (x & 0x80 || !t || (t >= 16 && t <= 18) || t > 21) return null;
      if ((t === 5 && !ref) || ((t === 6 || (t >= 9 && t <= 12)) && ref)) return null;
      if ((t === 9 && L !== 2) || ((t === 10 || t === 11) && L !== 1) || (t !== 10 && t !== 11 && L < 2)) return null;
      return { t, ref, vcl: t === 1 || t === 5, open: t === 6 || t === 7 || t === 8 || t === 9 || (t >= 13 && t <= 15), key: t === 5, ps: t === 7 || t === 8 };
    },
    param(nal) { try { const t = nal[0] & 31; if (t === 7) { const s = avcSps(nal); sps.set(s.id, s); } else if (t === 8) { const q = avcPps(nal, sps); if (q) pps.set(q.id, q); } } catch (e) { short(e); /* not a set Verse can read */ } },
    slice(nal, h) {
      const r = new Bits(unescape(nal, 1, 48)), firstMb = r.ue(), type = r.ue(), q = pps.get(r.ue());
      if (type > 9 || !q) return null; const s = q.sps; if (s.sep) r.u(2);
      const frameNum = r.u(s.fnBits); let field = 0, bottom = 0, lsb = 0;
      if (!s.frameMbsOnly && (field = r.u(1))) bottom = r.u(1);
      if (h.t === 5) { if (frameNum || (type % 5 !== 2 && type % 5 !== 4)) return null; r.ue(); }
      if (s.pocType === 0) lsb = r.u(s.pocBits);
      if (firstMb >= s.mbs) return null;
      return { first: firstMb === 0, addr: firstMb, ppsId: q.id, frameNum, field, bottom, lsb, sps: s };
    },
  };
}
function hevcCtx(sps = new Map(), pps = new Map()) {
  return {
    hevc: true, sps, pps,
    fork() { return hevcCtx(new Map(sps), new Map(pps)); },
    head(b, p, L) {
      const x = b[p], y = b[p + 1], t = (x >> 1) & 63, layer = ((x & 1) << 5) | (y >> 3), tid = (y & 7) - 1;
      if (x & 0x80 || tid < 0 || layer > 1 || L < 2) return null;
      const vcl = t <= 9 || (t >= 16 && t <= 21);
      if ((t < 32 && !vcl) || (t >= 41 && t <= 47)) return null;
      if (((t >= 16 && t <= 21) || t === 32 || t === 33) && tid) return null;
      if ((t === 36 || t === 37) !== (L === 2)) return null;
      return { t, tid, upper: layer > 0, vcl, open: !layer && ((t >= 32 && t <= 35) || t === 39), key: t >= 16 && t <= 21, ps: !layer && t >= 32 && t <= 34 };
    },
    param(nal) { try { const t = (nal[0] >> 1) & 63; if (t === 33) { const s = hevcSps(nal); sps.set(s.id, s); } else if (t === 34) { const q = hevcPps(nal, sps); if (q) pps.set(q.id, q); } } catch (e) { short(e); /* not a set Verse can read */ } },
    slice(nal, h) {
      const r = new Bits(unescape(nal, 2, 48)), first = r.u(1); if (h.key) r.u(1);
      const q = pps.get(r.ue()); if (!q) return null; const s = q.sps;
      if (!first) { if (q.dep) r.u(1); const addr = r.u(s.addrBits); return addr && addr < s.ctbs ? { first: false, addr, ppsId: q.id } : null; }
      for (let i = 0; i < q.extra; i++) r.u(1);
      const type = r.ue(); if (type > 2 || (h.key && type !== 2)) return null;
      if (q.out) r.u(1); if (s.sep) r.u(2);
      return { first: true, addr: 0, ppsId: q.id, lsb: h.t === 19 || h.t === 20 ? 0 : r.u(s.pocBits), sps: s };
    },
  };
}

// ---- walking the data ----------------------------------------------------------------------------------------------------------------------
// The state after each picture: H.264 keeps the last reference frame_num and the POC of the last reference picture (type 0); H.265 the POC of
// the last picture of temporal layer 0. step(st, a) gives the state after picture a, or null when a cannot follow st.
function step(st, a) {
  const s = a.s, n = st ? st.n + 1 : 0;
  if (!st && !a.key) return null; // the walk starts at a key picture
  if (!a.ctx.hevc) {
    const S = s.sps;
    if (!a.key && s.frameNum !== st.refNum && s.frameNum !== (st.refNum + 1) % 2 ** S.fnBits) return null;
    let msb = 0, plsb = a.key ? 0 : st.lsb, pmsb = a.key ? 0 : st.msb, poc = 2 * n;
    if (S.pocType === 0) {
      const m = 2 ** S.pocBits, l = s.lsb; msb = l < plsb && plsb - l >= m / 2 ? pmsb + m : l > plsb && l - plsb > m / 2 ? pmsb - m : pmsb; poc = msb + l;
      if (a.h.ref) { pmsb = msb; plsb = l; }
    }
    return { n, refNum: a.h.ref ? s.frameNum : st ? st.refNum : 0, msb: pmsb, lsb: plsb, poc, period: a.key ? (st ? st.period + 1 : 0) : st.period, skip: false };
  }
  const S = s.sps, m = 2 ** S.pocBits, t = a.h.t, noRasl = a.key && (t <= 20 || !st);
  let msb = 0;
  if (!noRasl) { const pl = ((st.tid0 % m) + m) % m, pm = st.tid0 - pl; msb = s.lsb < pl && pl - s.lsb >= m / 2 ? pm + m : s.lsb > pl && s.lsb - pl > m / 2 ? pm - m : pm; }
  const poc = msb + s.lsb;
  if (!a.key && Math.abs(poc - st.poc) > 64) return null;
  const skipRasl = a.key ? noRasl && t !== 19 && t !== 20 : st.skipRasl;
  const tid0 = a.h.tid === 0 && !(t >= 6 && t <= 9) && !(t <= 14 && t % 2 === 0) ? poc : st ? st.tid0 : poc;
  return { n, poc, tid0, skipRasl, period: noRasl ? (st ? st.period + 1 : 0) : st.period, skip: (t === 8 || t === 9) && skipRasl };
}

// one picture (an access unit) at p: its NAL units, up to where the next picture starts or the bytes stop being NAL units
function pictureAt(b, end, V, p, ctx0) {
  const { nalLen, maxLen } = V; let q = p, ctx = ctx0, pic = null, last = -1, pair = false;
  while (q + nalLen < end) {
    let L = 0; for (let k = 0; k < nalLen; k++) L = L * 256 + b[q + k];
    if (L < 1 || L > maxLen || q + nalLen + L > end) break;
    const h = ctx.head(b, q + nalLen, L); if (!h) break;
    const nal = b.subarray(q + nalLen, q + nalLen + L);
    if (h.vcl && !h.upper) {
      let s = null; try { s = ctx.slice(nal, h); } catch (e) { short(e); }
      if (!s) break;
      if (s.first) {
        if (!pic) { pic = { h, s }; last = 0; }
        else if (!ctx.hevc && !pair && pic.s.field && s.field && s.bottom !== pic.s.bottom && s.frameNum === pic.s.frameNum) { pair = true; last = 0; } // the second field of the frame
        else break;
      } else { if (!pic || s.ppsId !== pic.s.ppsId || s.addr <= last) break; last = s.addr; }
    } else if (h.vcl) { if (!pic) break; } // a slice of the second view (MV-HEVC) goes with the picture before it
    else if (h.open && pic) break;
    if (h.ps) { if (ctx === ctx0) ctx = ctx0.fork(); ctx.param(nal); }
    q += nalLen + L;
  }
  return pic ? { p, end: q, h: pic.h, s: pic.s, ctx, key: pic.h.key } : null;
}

// AMR frame lengths, with the 1-byte header, by frame type (0 for a type that is not used)
const AMR_NB = [13, 14, 16, 18, 20, 21, 27, 32, 6, 0, 0, 0, 0, 0, 0, 1], AMR_WB = [18, 24, 33, 37, 41, 47, 51, 59, 61, 6, 0, 0, 0, 0, 1, 1];

// the sound between the pictures: PCM in whole frames, AMR frame by frame. take(p, x) keeps what fits in [p, x) and says if all of it fit.
function soundWalker(b, t, kind) {
  if (kind === 'pcm') {
    const U = unitOf(t); if (!U) return null; const chunks = [];
    const perStep = (U.per * U.dur) / t.scale; let secs = 0;
    return {
      chunks, unit: U, secs: () => secs,
      // a gap longer than the sound can be (cap, in seconds) holds pictures the walk lost: keep only the sound that ends at the next picture
      take(p, x, cap = Infinity) {
        let k = Math.floor((x - p) / U.step); const all = k * perStep <= cap + 1e-9; if (!all) k = Math.max(0, Math.floor(cap / perStep));
        if (k > 0) { chunks.push({ off: all ? p : x - k * U.step, len: k * U.step, n: k * U.per }); secs += k * perStep; }
        return all && (x - p) % U.step === 0;
      },
    };
  }
  const sizes = t.codec === 'sawb' ? AMR_WB : AMR_NB, d = boxesIn(t.entry, 36, t.entry.length).find((x) => x.type === 'damr' && x.whole);
  const fps = (d && t.entry[d.body + 8]) || 1, dur = mostOf(t.T.stts) || (t.codec === 'sawb' ? 320 : 160) * fps, S = { n: 0, off: [], len: [], dur: [], cto: [], key: [] };
  const push = (o, l, du) => { S.off.push(o); S.len.push(l); S.dur.push(du); S.cto.push(0); S.key.push(1); S.n++; };
  let secs = 0; const per = dur / fps / t.scale;
  return {
    s: S, secs: () => secs,
    take(p, x, cap = Infinity) {
      let q = p, k = 0, from = p, left = Math.floor(cap / per + 1e-9);
      while (q < x && left > 0) { const h = b[q], z = h & 0x83 ? 0 : sizes[(h >> 3) & 15]; if (!z || q + z > x) break; q += z; left--; secs += per; if (++k === fps) { push(from, q - from, dur); from = q; k = 0; } }
      if (k) push(from, q - from, Math.round((dur * k) / fps));
      return q === x;
    },
  };
}
const mostOf = (runs) => { const m = new Map(); for (const [n, x] of runs) m.set(x, (m.get(x) || 0) + n); let best = 0, c = -1; for (const [x, n] of m) if (n > c) { best = x; c = n; } return best; };

// how far the sound may run ahead of the pictures: a camera writes the sound in chunks of up to about a second next to the pictures of the same time
const LEAD = 2;
/** walk the data [start, end): the pictures (V: codec context, nalLen, maxLen, spc) and the sound between them (A). Returns the video samples,
 *  with the picture order of each, and how many gaps were not all sound. */
function walk(b, start, end, V, A) {
  const vs = { n: 0, off: [], len: [], dur: [], cto: [], key: [], poc: [], per: [] }; let p = start, st = null, ctx = V && V.ctx, rough = 0, dropped = 0, lead = null;
  const take = (a, s1) => { ctx = a.ctx; st = s1; if (!s1.skip) { vs.off.push(a.p); vs.len.push(a.end - a.p); vs.key.push(a.key ? 1 : 0); vs.poc.push(s1.poc); vs.per.push(s1.period); vs.n++; } else dropped++; p = a.end; };
  const tryAt = (x) => {
    const a = pictureAt(b, end, V, x, ctx); if (!a) return null; const s1 = step(st, a); if (!s1) return null;
    if (V.spc >= 2 && a.end + V.nalLen < end) { const nx = pictureAt(b, end, V, a.end, a.ctx); if (!nx || !step(s1, nx)) return null; } // a chunk holds more than 1 picture: the next must follow
    return { a, s1 };
  };
  if (!V) { if (A) A.take(start, end); return { vs, rough, dropped }; }
  while (p < end) {
    if (st) { const a = pictureAt(b, end, V, p, ctx), s1 = a && step(st, a); if (s1) { take(a, s1); continue; } }
    // the next picture that continues the stream: after lost pictures that is the next key picture, as frame_num (H.264) and the picture
    // order (H.265) show the loss
    let hit = null;
    for (let x = p; x + V.nalLen + 2 < end && !hit; x++) { if (b[x] === 0 && V.nalLen === 4 && b[x + 1] > (V.maxLen >>> 16)) continue; hit = tryAt(x); }
    const to = hit ? hit.a.p : end;
    if (to > p) {
      // the sound may run as far ahead of the pictures as it did at the gaps before, and a quarter second more; until a gap is seen, LEAD
      const ahead = lead === null ? LEAD : Math.min(LEAD, lead + 0.25), ok = A && A.take(p, to, (vs.n * V.dur) / V.scale + ahead - A.secs());
      if (ok) lead = Math.max(lead || 0, A.secs() - (vs.n * V.dur) / V.scale);
      else rough++;
    }
    if (!hit) break;
    take(hit.a, hit.s1);
  }
  return { vs, rough, dropped };
}

// ---- the settings of a sample entry --------------------------------------------------------------------------------------------------------
function paramsOf(entry) {
  const c = boxesIn(entry, 86, entry.length).find((x) => x.whole && (x.type === 'avcC' || x.type === 'hvcC')); if (!c) return null;
  const d = entry.subarray(c.body, c.end), sets = [];
  if (c.type === 'avcC') { const q = avcParams(d); return { hevc: false, nalLen: q.nalLen, sets: [...q.sps, ...q.pps] }; }
  let p = 23; for (let i = 0, n = d[22]; i < n && p + 3 <= d.length; i++) { const cnt = r16(d, p + 1); p += 3; for (let k = 0; k < cnt && p + 2 <= d.length; k++) { const L = r16(d, p); sets.push(d.subarray(p + 2, p + 2 + L)); p += 2 + L; } }
  return { hevc: true, nalLen: (d[21] & 3) + 1, sets };
}
const ctxOf = (prm) => { const c = prm.hevc ? hevcCtx() : avcCtx(); for (const s of prm.sets) c.param(s); for (const s of prm.sets) c.param(s); return c; };

// where the data is: the mdat box, to the end of the file when its size was never written or is too large
function dataOf(b, top) {
  const m = top.find((x) => x.type === 'mdat');
  if (m) {
    const declared = m.start + m.size;
    const end = !m.whole || declared >= b.length || !boxesIn(b, declared, b.length, true).length || m.end - m.body < 16 ? b.length : m.end;
    return { start: m.body, end };
  }
  for (let p = 4; p + 4 <= Math.min(b.length, 1 << 24); p++) if (b[p] === 0x6d && b[p + 1] === 0x64 && b[p + 2] === 0x61 && b[p + 3] === 0x74) return { start: p + 4 + (r32(b, p - 4) === 1 ? 8 : 0), end: b.length };
  return { start: 0, end: b.length };
}

// ---- writing --------------------------------------------------------------------------------------------------------------------------------
const runs = (xs, n) => { const out = []; for (let i = 0; i < n; i++) { const r = out[out.length - 1]; if (r && r[1] === xs[i]) r[0]++; else out.push([1, xs[i]]); } return out; };
const vEntry = (type, w, h, cfg) => box(type, zeros(6), u16(1), u16(0), u16(0), zeros(12), u16(w), u16(h), u32(0x00480000), u32(0x00480000), u32(0), u16(1), u8(5), str('Verse'), zeros(26), u16(0x18), u16(0xffff), cfg);

/** a new file: ftyp, a new moov for the tracks, and an mdat with each kept sample's bytes copied from src, in the order they were in */
function write(src, ftyp, tracks, moovExtra = []) {
  const pieces = [];
  tracks.forEach((t, k) => { if (t.s) for (let i = 0; i < t.s.n; i++) pieces.push([t.s.off[i], t.s.len[i], k, i, 0]); else t.chunks.forEach((c, j) => pieces.push([c.off, c.len, k, -1 - j, 0])); });
  pieces.sort((a, z) => a[0] - z[0] || a[2] - z[2]);
  let pos = 0; for (const x of pieces) { x[4] = pos; pos += x[1]; }
  const dataLen = pos, big = dataLen > 0xfffffff0 - 1e7;
  // each track's chunks: samples that sit one after another in the new data, in decoding order
  const at = tracks.map((t) => (t.s ? new Array(t.s.n) : new Array(t.chunks.length)));
  for (const x of pieces) at[x[2]][x[3] >= 0 ? x[3] : -1 - x[3]] = x[4];
  const chunked = tracks.map((t, k) => {
    const off = [], cnt = [];
    if (t.s) { for (let i = 0; i < t.s.n; i++) { if (i && at[k][i] === at[k][i - 1] + t.s.len[i - 1]) cnt[cnt.length - 1]++; else { off.push(at[k][i]); cnt.push(1); } } }
    else t.chunks.forEach((c, j) => { off.push(at[k][j]); cnt.push(c.n); });
    return { off, cnt };
  });
  const msOf = (t) => Math.round((durOf(t) / t.scale) * 1000);
  const edited = tracks.map((t) => (t.edits && t.edits.length ? t.edits : null));
  const tkMs = tracks.map((t, k) => (edited[k] ? edited[k].reduce((a, e) => a + e.ms, 0) : msOf(t)));
  const movieMs = Math.max(0, ...tkMs), next = Math.max(0, ...tracks.map((t) => t.id)) + 1;
  const stbl = (t, k, base) => {
    const n = total(t), c = chunked[k], parts = [full('stsd', 0, 0, u32(1), t.entry)];
    const st = t.s ? runs(t.s.dur, t.s.n) : [[n, t.unit.dur]];
    parts.push(full('stts', 0, 0, u32(st.length), ...st.map(([a, d]) => cat([u32(a), u32(d)]))));
    if (t.s && t.s.cto.slice(0, t.s.n).some((x) => x)) { const r = runs(t.s.cto, t.s.n), neg = r.some(([, x]) => x < 0); parts.push(full('ctts', neg ? 1 : 0, 0, u32(r.length), ...r.map(([a, x]) => cat([u32(a), u32(x >>> 0)])))); }
    if (t.s && t.kind === 'vide') { const keys = []; for (let i = 0; i < t.s.n; i++) if (t.s.key[i]) keys.push(i + 1); if (keys.length < t.s.n) parts.push(full('stss', 0, 0, u32(keys.length), ...keys.map(u32))); }
    const sc = runs(c.cnt, c.cnt.length); let first = 1; const scE = sc.map(([a, x]) => { const e = cat([u32(first), u32(x), u32(1)]); first += a; return e; });
    parts.push(full('stsc', 0, 0, u32(scE.length), ...scE));
    parts.push(t.s ? full('stsz', 0, 0, u32(0), u32(n), ...t.s.len.slice(0, n).map(u32)) : full('stsz', 0, 0, u32(t.unit.size), u32(n)));
    parts.push(big ? full('co64', 0, 0, u32(c.off.length), ...c.off.map((o) => u64(o + base))) : full('stco', 0, 0, u32(c.off.length), ...c.off.map((o) => u32(o + base))));
    return box('stbl', ...parts);
  };
  const trak = (t, k, base) => {
    const d = durOf(t), mhd = t.mhd || (t.kind === 'vide' ? full('vmhd', 0, 1, zeros(8)) : t.kind === 'soun' ? full('smhd', 0, 0, zeros(4)) : full('nmhd', 0, 0));
    const mdhd = d > 0xffffffff ? full('mdhd', 1, 0, u64(0), u64(0), u32(t.scale), u64(d), u16(t.lang), u16(0)) : full('mdhd', 0, 0, u32(0), u32(0), u32(t.scale), u32(d), u16(t.lang), u16(0));
    const e = edited[k], edts = e ? [box('edts', full('elst', 0, 0, u32(e.length), ...e.map((x) => cat([u32(x.ms), u32(x.t >>> 0), u32(x.rate || 0x10000)]))))] : [];
    return box('trak', full('tkhd', 0, t.flags, u32(0), u32(0), u32(t.id), u32(0), u32(tkMs[k]), t.tail), ...(t.tref ? [t.tref] : []), ...edts,
      box('mdia', mdhd, t.hdlr, box('minf', mhd, box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1))), stbl(t, k, base))), ...(t.udta ? [t.udta] : []));
  };
  const moovOf = (base) => box('moov', full('mvhd', 0, 0, u32(0), u32(0), u32(1000), u32(movieMs), u32(0x00010000), u16(0x0100), zeros(10), MATRIX, zeros(24), u32(next)), ...tracks.map((t, k) => trak(t, k, base)), ...moovExtra);
  const head = big ? 16 : 8, size = moovOf(0).length, base = ftyp.length + size + head, moov = moovOf(base);
  const out = new Uint8Array(base + dataLen); out.set(ftyp, 0); out.set(moov, ftyp.length);
  out.set(big ? cat([u32(1), str('mdat'), u64(dataLen + 16)]) : cat([u32(dataLen + 8), str('mdat')]), ftyp.length + moov.length);
  for (const x of pieces) out.set(src.subarray(x[0], x[0] + x[1]), base + x[4]);
  return out;
}
const extOf = (ftyp, b) => { const m = ftyp ? name4(b, ftyp.body) : ''; return m === 'qt  ' ? 'mov' : /^3g/.test(m) ? '3gp' : /^M4[ABP] $/.test(m) ? 'm4a' : 'mp4'; };
const ISOM = box('ftyp', str('isom'), u32(0x200), str('isom'), str('iso2'), str('mp41'));
const secs = (x) => (Math.round(x * 10) / 10).toLocaleString('en-US');
const CODEC = { avc1: 'H.264', avc3: 'H.264', hvc1: 'H.265', hev1: 'H.265', mp4a: 'AAC', Opus: 'Opus', samr: 'AMR', sawb: 'AMR-WB', alac: 'ALAC', 'ac-3': 'AC-3', 'ec-3': 'E-AC-3' };
const codecName = (c) => CODEC[c] || (PCM.test(c) ? 'PCM' : c.trim());
const summary = (tracks) => tracks.map((t) => ({ kind: t.kind === 'vide' ? 'video' : t.kind === 'soun' ? 'sound' : 'other', codec: codecName(t.codec), samples: total(t), seconds: durOf(t) / t.scale }));

// ---- the four ways -------------------------------------------------------------------------------------------------------------------------
function fromIndex(b, moov, top) {
  const mvhd = kid(b, moov, 'mvhd'), mscale = mvhd ? r32(b, mvhd.body + (b[mvhd.body] ? 20 : 12)) || 1000 : 1000, tracks = [];
  for (const tb of kids(b, moov, 'trak')) {
    const t = trackOf(b, tb); if (!t) continue;
    const U = unitOf(t);
    if (U) { t.unit = U; t.chunks = chunksOf(t.T, U, b.length); t.all = t.T.count; } else if (t.T.count > 2e7) continue; else { t.s = samplesOf(t.T, b.length); t.all = t.T.count; }
    tracks.push(t);
  }
  // fragments: each traf's samples go on the end of its track
  const mvex = kid(b, moov, 'mvex'), trex = new Map(), moofs = top.filter((x) => x.type === 'moof' && x.whole); let frags = 0, cut = 0;
  for (const x of kids(b, mvex, 'trex')) trex.set(r32(b, x.body + 4), { dur: r32(b, x.body + 12), size: r32(b, x.body + 16), flags: r32(b, x.body + 20) });
  for (const m of mvex ? moofs : []) {
    let whole = true;
    for (const traf of kids(b, m, 'traf')) {
      const th = kid(b, traf, 'tfhd'); if (!th) continue;
      const fl = r24(b, th.body + 1), id = r32(b, th.body + 4), dx = trex.get(id) || { dur: 0, size: 0, flags: 0 }, t = tracks.find((y) => y.id === id && y.s);
      let q = th.body + 8, base = m.start, dDur = dx.dur, dSize = dx.size, dFlags = dx.flags;
      if (fl & 1) { base = r64(b, q); q += 8; } if (fl & 2) q += 4; if (fl & 8) { dDur = r32(b, q); q += 4; } if (fl & 0x10) { dSize = r32(b, q); q += 4; } if (fl & 0x20) dFlags = r32(b, q);
      let pos = base;
      for (const tr of kids(b, traf, 'trun')) {
        const v = b[tr.body], f = r24(b, tr.body + 1), n = r32(b, tr.body + 4); let p = tr.body + 8, first = null; if (t) t.all += n;
        if (f & 1) { pos = base + s32(b, p); p += 4; } if (f & 4) { first = r32(b, p); p += 4; }
        const w = 4 * ((f & 0x100 ? 1 : 0) + (f & 0x200 ? 1 : 0) + (f & 0x400 ? 1 : 0) + (f & 0x800 ? 1 : 0));
        for (let i = 0; i < n && p + w <= tr.end; i++) {
          const dur = f & 0x100 ? r32(b, p) : dDur; if (f & 0x100) p += 4;
          const size = f & 0x200 ? r32(b, p) : dSize; if (f & 0x200) p += 4;
          const sf = f & 0x400 ? r32(b, p) : i === 0 && first !== null ? first : dFlags; if (f & 0x400) p += 4;
          const cto = f & 0x800 ? (v ? s32(b, p) : r32(b, p) > 0x7fffffff ? s32(b, p) : r32(b, p)) : 0; if (f & 0x800) p += 4;
          if (pos + size > b.length) { whole = false; break; }
          if (t) { const S = t.s; if (S.n < S.off.length) { for (const k of ['off', 'len', 'dur', 'cto', 'key']) S[k].length = S.n; } S.off.push(pos); S.len.push(size); S.dur.push(dur); S.cto.push(cto); S.key.push(t.kind === 'vide' ? (sf & 0x10000 ? 0 : 1) : 1); S.n++; }
          pos += size;
        }
      }
    }
    if (whole) frags++; else cut++;
  }
  const kept = tracks.filter((t) => total(t) > 0); if (!kept.length) return null;
  for (const t of kept) if (t.edits) { // the edits, in this file's ms; the one that shows the media ends where the media now ends
    const main = t.edits.filter((e) => e.t >= 0); if (main.length > 1) { t.edits = null; continue; }
    t.edits = t.edits.map((e) => ({ ms: e.t < 0 ? Math.round((e.dur / mscale) * 1000) : Math.max(0, Math.min(Math.round((e.dur / mscale) * 1000), Math.round(((showEnd(t) - e.t) / t.scale) * 1000))), t: e.t, rate: e.rate }));
  }
  const extra = boxesIn(b, moov.body, moov.end).filter((x) => x.whole && (x.type === 'udta' || x.type === 'meta')).map((x) => b.slice(x.start, x.end));
  const lost = kept.reduce((a, t) => a + t.all - total(t), 0), notes = [];
  const nf = frags + cut;
  if (nf) notes.push('A fragmented file: Verse joined its ' + nf.toLocaleString('en-US') + ' fragment' + (nf === 1 ? '' : 's') + ' into one file with a normal index' + (cut ? '. The end of the file cuts the last fragment, so Verse kept the samples of it whose bytes are all in the file.' : '.'));
  for (const t of tracks) if (!total(t) && t.all) notes.push('All of the ' + (t.kind === 'vide' ? 'video' : t.kind === 'soun' ? 'sound' : codecName(t.codec)) + ' was in the part of the file that is lost, so the repaired file has none.');
  if (lost) notes.push('The file is cut short: Verse kept every sample whose bytes are all in the file, and left out the ' + lost.toLocaleString('en-US') + ' the index lists past the end.');
  else if (!frags && !cut) notes.push('The index was whole and every sample is in the file. Verse wrote the index again; if the file still does not play, the damage is in the pictures or the sound themselves, which no index can mend.');
  return { tracks: kept, extra, how: frags || cut ? 'fragments' : 'index', notes };
}

function videoOf(t, maxFloor) {
  const prm = paramsOf(t.entry); if (!prm) return null;
  const S = samplesOf(t.T, Infinity); let max = 0; for (let i = 0; i < S.n; i++) max = Math.max(max, S.len[i]);
  const spcRuns = t.T.stsc.map((e, i) => [(i + 1 < t.T.stsc.length ? t.T.stsc[i + 1][0] : t.T.chunk.length + 1) - e[0], e[1]]);
  return { ctx: ctxOf(prm), nalLen: prm.nalLen, maxLen: Math.max(4 * max + 65536, maxFloor), spc: mostOf(spcRuns), dur: mostOf(t.T.stts) || 1, hevc: prm.hevc };
}

function rebuild(b, data, V, vt, at, kind) {
  if (V) V.scale = vt.scale;
  const A = at ? soundWalker(b, at, kind) : null, w = walk(b, data.start, data.end, V, A), tracks = [], notes = [];
  if (V && w.vs.n) {
    const s = w.vs, n = s.n, order = Array.from({ length: n }, (_, i) => i).sort((i, j) => s.per[i] - s.per[j] || s.poc[i] - s.poc[j] || i - j);
    const rank = new Int32Array(n); order.forEach((i, r) => { rank[i] = r; });
    let shift = 0, moved = false; for (let i = 0; i < n; i++) { shift = Math.max(shift, i - rank[i]); if (rank[i] !== i) moved = true; }
    for (let i = 0; i < n; i++) { s.dur[i] = V.dur; s.cto[i] = moved ? (rank[i] - i + shift) * V.dur : 0; }
    const t = { ...vt, id: 1, s, edits: moved && shift ? [{ ms: Math.round(((n * V.dur) / vt.scale) * 1000), t: shift * V.dur, rate: 0x10000 }] : null, tref: null, udta: null };
    tracks.push(t);
    notes.push('Verse found ' + n.toLocaleString('en-US') + ' ' + (V.hevc ? 'H.265' : 'H.264') + ' pictures (' + secs((n * V.dur) / vt.scale) + ' s) in the data and wrote a new index for them' + (w.dropped ? ', leaving out ' + w.dropped + ' that need pictures from before the start' : '') + '.');
    notes.push('Each picture gets the same time: ' + secs(vt.scale / V.dur) + ' a second' + (vt.ref ? ', as in the good video. A phone that changed its frame rate while it recorded plays a little faster or slower in places.' : '.'));
  }
  if (A && (A.s ? A.s.n : A.chunks.length)) {
    const t = { ...at, id: tracks.length + 1, tref: null, udta: null, edits: null, ...(A.s ? { s: A.s } : { chunks: A.chunks, unit: A.unit }) };
    tracks.push(t); notes.push(codecName(at.codec) + ' sound kept: ' + secs(durOf(t) / t.scale) + ' s.' + (w.rough ? ' In ' + w.rough + ' place' + (w.rough === 1 ? '' : 's') + ' the bytes between the pictures were not all sound, so you may hear a short click or a short gap there.' : ''));
  }
  return { tracks, notes, w };
}

function fromReference(b, top, ref) {
  const rt = boxesIn(ref, 0, ref.length, true), rmoov = rt.find((x) => x.type === 'moov' && x.whole);
  if (!rmoov) throw new Error('The good video has no index either, so Verse cannot learn the settings from it. Pick a video from the same phone or camera that plays.');
  const all = kids(ref, rmoov, 'trak').map((x) => trackOf(ref, x)).filter(Boolean);
  const vt = all.find((t) => t.kind === 'vide' && /^(avc1|avc3|hvc1|hev1)$/.test(t.codec)), st = all.find((t) => t.kind === 'soun');
  const kind = st ? (PCM.test(st.codec) ? 'pcm' : st.codec === 'samr' || st.codec === 'sawb' ? 'amr' : 'none') : 'none';
  if (!vt && kind === 'none') {
    const c = all.find((t) => t.kind === 'vide') || st;
    throw new Error(c ? 'Verse rebuilds H.264 and H.265 video, and PCM and AMR sound, from the data. The good video has ' + codecName(c.codec) + (st && !vt && st.codec === 'mp4a' ? ': AAC frames do not say where they end, so a recording that lost its index cannot be rebuilt.' : ', which Verse cannot find in the data yet.') : 'The good video has no video or sound track Verse can use.');
  }
  const V = vt ? videoOf(vt, 1 << 20) : null; if (vt && !V) throw new Error('The good video does not hold its H.264 or H.265 settings (avcC or hvcC), so Verse cannot read the data with them.');
  if (vt) vt.ref = true;
  const data = dataOf(b, top), r = rebuild(b, data, V, vt, kind === 'none' ? null : st, kind);
  if (!r.tracks.length) throw new Error('Verse found no pictures or sound in this file that match the good video. Check that both come from the same phone or camera, with the same settings (size, frame rate, H.264 or H.265).');
  if (vt && !r.tracks.some((t) => t.kind === 'vide')) r.notes.unshift('No pictures were found that match the good video; only the sound is kept.');
  if (st && kind === 'none') r.notes.push('The ' + codecName(st.codec) + ' sound is left out: its frames do not say where they end, so Verse cannot find them in the data without the lost index. The video has no sound.');
  if (all.some((t) => t !== vt && t !== st)) r.notes.push('Other tracks of the recording (time code, data, a second sound) are left out.');
  return { tracks: r.tracks, how: 'reference', notes: r.notes };
}

// the H.264 or H.265 settings in the data itself: an SPS and a PPS next to each other (with a VPS before them for H.265), 4-byte lengths
function setsIn(b, start, end) {
  const lim = Math.min(end, start + 64 * 2 ** 20), at = (p) => r32(b, p);
  for (let p = start; p + 12 < lim; p++) {
    if (b[p] || b[p + 1]) continue; const L = at(p); if (L < 4 || L > 1024 || p + 4 + L + 6 > end) continue;
    const x = b[p + 4], q = p + 4 + L, L2 = at(q);
    if ((x & 0x9f) === 7 && x & 0x60 && L2 >= 2 && L2 < 256 && (b[q + 4] & 0x9f) === 8) {
      try { const s = avcSps(b.subarray(p + 4, q)), sps = b.slice(p + 4, q), pps = b.slice(q + 4, q + 4 + L2); return { hevc: false, s, sets: [sps, pps], cfg: box('avcC', u8(1, sps[1], sps[2], sps[3], 0xff, 0xe1), u16(sps.length), sps, u8(1), u16(pps.length), pps) }; } catch { continue; }
    }
    if (x === 0x40 && b[p + 5] === 0x01 && L2 >= 4 && L2 < 1024 && b[q + 4] === 0x42 && b[q + 5] === 0x01) {
      const q2 = q + 4 + L2, L3 = at(q2); if (L3 < 3 || L3 > 1024 || b[q2 + 4] !== 0x44 || b[q2 + 5] !== 0x01) continue;
      try {
        const vps = b.slice(p + 4, q), sps = b.slice(q + 4, q2), pps = b.slice(q2 + 4, q2 + 4 + L3), s = hevcSps(sps), rb = unescape(sps, 2, 16);
        const arr = (t, n) => cat([u8(0x80 | t), u16(1), u16(n.length), n]);
        const cfg = box('hvcC', u8(1), rb.subarray(1, 13), u16(0xf000), u8(0xfc), u8(0xfc | s.chroma), u8(0xf8 | (s.depth[0] - 8)), u8(0xf8 | (s.depth[1] - 8)), u16(0), u8(((s.maxSub + 1) << 3) | (s.nest << 2) | 3), u8(3), arr(32, vps), arr(33, sps), arr(34, pps));
        return { hevc: true, s, sets: [vps, sps, pps], cfg };
      } catch { continue; }
    }
  }
  return null;
}

function fromInBand(b, top) {
  const data = dataOf(b, top), f = setsIn(b, data.start, data.end);
  if (!f) throw new Error('This file lost its index, and its data does not hold the H.264 or H.265 settings. Add a good video from the same phone or camera (with the same size and frame rate), and Verse reads the data with its settings.');
  const fps = !f.hevc && f.s.fps >= 1 && f.s.fps <= 240 ? f.s.fps : 30, scale = 90000, dur = Math.round(scale / fps), w = f.s.width, h = f.s.height;
  const vt = { kind: 'vide', codec: f.hevc ? 'hvc1' : 'avc1', scale, lang: 0x55c4, flags: 3, tail: cat([zeros(16), MATRIX, u32(w * 65536), u32(h * 65536)]),
    hdlr: full('hdlr', 0, 0, u32(0), str('vide'), zeros(12), str('Verse video\0')), mhd: null, entry: vEntry(f.hevc ? 'hvc1' : 'avc1', w, h, f.cfg) };
  const ctx = ctxOf({ hevc: f.hevc, sets: f.sets }), V = { ctx, nalLen: 4, maxLen: 8 << 20, spc: 1, dur, hevc: f.hevc };
  const r = rebuild(b, data, V, vt, null, 'none');
  if (!r.tracks.length) throw new Error('Verse found the ' + (f.hevc ? 'H.265' : 'H.264') + ' settings in the data, but no picture that starts with a key frame. Add a good video from the same phone or camera.');
  r.notes.unshift('No good video given: Verse read the ' + (f.hevc ? 'H.265' : 'H.264') + ' settings (' + w + ' x ' + h + ') from the data itself.');
  r.notes.push('Sound is left out: with no good video, Verse does not know the sound format.' + (f.hevc || !f.s.fps ? ' The frame rate is not in a place Verse reads, so it is taken as 30 a second.' : ''));
  return { tracks: r.tracks, how: 'in-band', notes: r.notes };
}

/** repair(broken, reference?) -> { bytes, ext, how: 'index' | 'fragments' | 'reference' | 'in-band', notes: [..], tracks: [{ kind, codec, samples,
 *  seconds }] }. broken and reference are Uint8Arrays; reference, a good video from the same phone or camera, is used only when the broken
 *  file's own index is gone. Throws an Error with a plain message when nothing can be rebuilt. */
export function repair(broken, reference = null) {
  const b = broken, top = boxesIn(b, 0, b.length, true), ftyp = top.find((x) => x.type === 'ftyp' && x.whole && x.end - x.body >= 8), moov = top.find((x) => x.type === 'moov' && x.whole);
  let r = null;
  if (moov) { try { r = fromIndex(b, moov, top); } catch { r = null; } }
  if (!r) r = reference && reference.length ? fromReference(b, top, reference) : fromInBand(b, top);
  if (moov === undefined && top.some((x) => x.type === 'moov')) r.notes.unshift('The index (moov) at the end of the file is cut, so Verse read the data itself.');
  let ft = ftyp ? b.slice(ftyp.start, ftyp.end) : null, ext = extOf(ftyp, b);
  if (!ft && reference) { const rf = boxesIn(reference, 0, reference.length, true).find((x) => x.type === 'ftyp' && x.whole); if (rf) { ft = reference.slice(rf.start, rf.end); ext = extOf(rf, reference); } }
  if (!ft) { ft = ISOM; ext = 'mp4'; }
  return { bytes: write(b, ft, r.tracks, r.extra || []), ext, how: r.how, notes: r.notes, tracks: summary(r.tracks) };
}
