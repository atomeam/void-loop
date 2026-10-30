// MP3 files changed on the device without coding the sound again, so nothing is lost: the cover picture in the ID3 tag. Pure.
// ID3v2.3 and v2.4 tags (id3.org/id3v2.3.0, id3.org/id3v2.4.0-structure) keep their own frames; a v2.2 tag keeps its common text.

const ascii = (b, at, n) => String.fromCharCode(...b.subarray(at, at + n));
const syncsafe = (b, at) => ((b[at] & 127) << 21) | ((b[at + 1] & 127) << 14) | ((b[at + 2] & 127) << 7) | (b[at + 3] & 127);
const be32 = (b, at) => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
const putSyncsafe = (n) => [(n >>> 21) & 127, (n >>> 14) & 127, (n >>> 7) & 127, n & 127];
const putBe32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const cat = (parts) => { const o = new Uint8Array(parts.reduce((a, p) => a + p.length, 0)); let k = 0; for (const p of parts) { o.set(p, k); k += p.length; } return o; };
// FF 00 back to FF: the tag was written with unsynchronisation
const unsync = (b) => { const o = []; for (let i = 0; i < b.length; i++) { o.push(b[i]); if (b[i] === 0xff && b[i + 1] === 0) i++; } return Uint8Array.from(o); };
const V22 = { TT2: 'TIT2', TP1: 'TPE1', TP2: 'TPE2', TAL: 'TALB', TYE: 'TYER', TRK: 'TRCK', TPA: 'TPOS', TCO: 'TCON', TCM: 'TCOM', COM: 'COMM' };

/** the first MPEG audio frame header at or after `at`: { at, version, layer, bytes } or null. Two frames in a row must agree. */
export function firstFrame(b, at = 0) {
  for (let i = at; i + 4 <= b.length; i++) {
    const h = header(b, i); if (!h) continue;
    const n = header(b, i + h.bytes); if (n && n.version === h.version && n.layer === h.layer && n.rate === h.rate) return { at: i, ...h };
    if (i + h.bytes === b.length) return { at: i, ...h };
  }
  return null;
}
const RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
const KBPS1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], KBPS2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
/** a Layer III frame header at `i`: { version (3: MPEG-1, 2: MPEG-2, 0: MPEG-2.5), layer, rate, kbps, channels, bytes } or null */
export function header(b, i) {
  if (i + 4 > b.length || b[i] !== 0xff || (b[i + 1] & 0xe0) !== 0xe0) return null;
  const version = (b[i + 1] >> 3) & 3, layer = (b[i + 1] >> 1) & 3, bi = b[i + 2] >> 4, ri = (b[i + 2] >> 2) & 3, pad = (b[i + 2] >> 1) & 1;
  if (version === 1 || layer !== 1 || bi === 0 || bi === 15 || ri === 3) return null;
  const rate = RATES[version][ri], kbps = (version === 3 ? KBPS1 : KBPS2)[bi], bytes = Math.floor((version === 3 ? 144 : 72) * kbps * 1000 / rate) + pad;
  return { version, layer: 3, rate, kbps, channels: (b[i + 3] >> 6) === 3 ? 1 : 2, bytes, samples: version === 3 ? 1152 : 576 };
}

/** the ID3v2 tag at the start: { version, end (the first byte after it), frames: [{ id, flags, data }], dropped } or null */
export function readTag(b) {
  if (b.length < 10 || ascii(b, 0, 3) !== 'ID3') return null;
  const version = b[3], flags = b[5], size = syncsafe(b, 6), end = 10 + size + (version === 4 && flags & 0x10 ? 10 : 0);
  let body = b.subarray(10, Math.min(b.length, 10 + size));
  if (flags & 0x80 && version < 4) body = unsync(body);
  let p = 0; const frames = []; let dropped = 0;
  if (flags & 0x40) p = version === 4 ? syncsafe(body, 0) : 4 + be32(body, 0);
  const idLen = version === 2 ? 3 : 4, headLen = version === 2 ? 6 : 10;
  while (p + headLen <= body.length && body[p] !== 0) {
    const id = ascii(body, p, idLen), n = version === 2 ? (body[p + 3] << 16) | (body[p + 4] << 8) | body[p + 5] : version === 4 ? syncsafe(body, p + 4) : be32(body, p + 4);
    if (!/^[A-Z0-9]+$/.test(id) || p + headLen + n > body.length) break;
    let data = body.subarray(p + headLen, p + headLen + n), fl = version === 2 ? 0 : (body[p + 8] << 8) | body[p + 9];
    if (version === 4 && fl & 0x02) { data = unsync(data); fl &= ~0x02; }
    if (version === 4 && fl & 0x01) { data = data.subarray(4); fl &= ~0x01; }
    p += headLen + n;
    if (version === 2) { if (V22[id]) frames.push({ id: V22[id], flags: 0, data }); else dropped++; continue; }
    // compressed or encrypted frames cannot be carried into a new tag as they are
    if ((version === 3 && fl & 0x00c0) || (version === 4 && fl & 0x000c)) { dropped++; continue; }
    frames.push({ id, flags: 0, data });
  }
  return { version, end, frames, dropped };
}

/** an ID3v2 tag (v2.3, or v2.4 when the file had v2.4) with these frames */
export function writeTag(frames, version = 3) {
  const parts = frames.map((f) => cat([new TextEncoder().encode(f.id), Uint8Array.from(version === 4 ? putSyncsafe(f.data.length) : putBe32(f.data.length)), Uint8Array.of(0, 0), f.data]));
  const body = cat(parts);
  return cat([Uint8Array.of(0x49, 0x44, 0x33, version, 0, 0, ...putSyncsafe(body.length)), body]);
}

/** an APIC frame body: the front cover (picture type 3), with its MIME type and no description */
export function apic(picture, mime) {
  return cat([Uint8Array.of(0), new TextEncoder().encode(mime), Uint8Array.of(0, 3, 0), picture]);
}

/** the MP3 with `picture` (JPEG or PNG bytes) as its front cover: { bytes, notes }. The sound is the same bytes as before. */
export function addCover(mp3, picture, mime) {
  if (mime !== 'image/jpeg' && mime !== 'image/png') throw new Error('the cover must be a JPEG or a PNG picture.');
  const tag = readTag(mp3), audioAt = tag ? Math.min(tag.end, mp3.length) : 0, first = firstFrame(mp3, audioAt);
  if (!first || first.at - audioAt > 65536) throw new Error('this is not an MP3: no MPEG audio frames were found.');
  const kept = tag ? tag.frames.filter((f) => f.id !== 'APIC') : [], replaced = tag ? tag.frames.length - kept.length : 0;
  const version = tag && tag.version === 4 ? 4 : 3, out = cat([writeTag([...kept, { id: 'APIC', flags: 0, data: apic(picture, mime) }], version), mp3.subarray(audioAt)]);
  const notes = [replaced ? 'the cover picture it had was replaced' : 'a cover picture added', (picture.length / 1024).toFixed(0) + ' KB picture (' + mime.slice(6).toUpperCase() + ')', 'the sound is untouched: the same MP3 frames, not coded again'];
  if (kept.length) notes.push(kept.length + ' other tag field' + (kept.length === 1 ? '' : 's') + ' kept (title, artist and the rest)');
  if (tag && tag.dropped) notes.push(tag.dropped + ' tag field' + (tag.dropped === 1 ? '' : 's') + ' Verse cannot carry over were left out');
  return { bytes: out, notes };
}

// ---- the frames, and a cut on frame lines ----------------------------------------------------------------------------------------------------
// the side information is 17 or 32 bytes (MPEG-1 mono or not) and 9 or 17 (MPEG-2 and 2.5): Layer III, ISO/IEC 11172-3 and 13818-3
const sideLen = (h) => (h.version === 3 ? (h.channels === 1 ? 17 : 32) : (h.channels === 1 ? 9 : 17));
const crcOn = (b, at) => (b[at + 1] & 1) === 0;
/** CRC-16 (polynomial 0x8005, start 0xFFFF) over the last 2 header bytes and the side information, as a protected frame carries it */
export function frameCrc(b, at, h) {
  let c = 0xffff; const feed = (x) => { for (let k = 7; k >= 0; k--) { const bit = ((c >> 15) ^ (x >> k)) & 1; c = ((c << 1) & 0xffff) ^ (bit ? 0x8005 : 0); } };
  feed(b[at + 2]); feed(b[at + 3]); for (let i = 0; i < sideLen(h); i++) feed(b[at + 6 + i]); return c;
}
/** the Xing or Info frame an encoder writes first (frame count, bytes, seek table, and LAME's encoder delay and padding), or null */
export function xingOf(b, f) {
  const at = f.at + 4 + (crcOn(b, f.at) ? 2 : 0) + sideLen(f), id = ascii(b, at, 4);
  if (id === 'Xing' || id === 'Info') {
    const flags = be32(b, at + 4); let p = at + 8, frames = null;
    if (flags & 1) { frames = be32(b, p); p += 4; }
    if (flags & 2) p += 4;
    if (flags & 4) p += 100;
    if (flags & 8) p += 4;
    const lame = /^(LAME|Lavc|Lavf|GOGO)/.test(ascii(b, p, 4)) && p + 24 <= f.at + f.bytes;
    return { id, frames, flags, lameAt: lame ? p - f.at : null, delay: lame ? (b[p + 21] << 4) | (b[p + 22] >> 4) : null, padding: lame ? ((b[p + 22] & 15) << 8) | b[p + 23] : null };
  }
  if (ascii(b, f.at + 36, 4) === 'VBRI') return { id: 'VBRI', frames: be32(b, f.at + 36 + 14), delay: null, padding: null };
  return null;
}
/** every audio frame of the MP3: { tag (the ID3v2 bytes), frames: [{ at, bytes, samples }], rate, xing, tail (an ID3v1 tag), skipped } */
export function framesOf(b) {
  const tag = readTag(b), from = tag ? Math.min(tag.end, b.length) : 0, first = firstFrame(b, from);
  if (!first || first.at - from > 65536) throw new Error('this is not an MP3: no MPEG audio frames were found.');
  const tailAt = b.length >= 128 && ascii(b, b.length - 128, 3) === 'TAG' ? b.length - 128 : b.length;
  const list = []; let i = first.at, skipped = 0;
  while (i < tailAt) {
    const h = header(b, i);
    if (h && i + h.bytes <= tailAt && h.rate === first.rate) { list.push({ at: i, bytes: h.bytes, samples: h.samples }); i += h.bytes; continue; }
    const next = firstFrame(b.subarray(0, tailAt), i + 1); if (!next || next.rate !== first.rate) break;
    skipped += next.at - i; i = next.at;
  }
  const xing = xingOf(b, first);
  return { tag: b.subarray(0, from), frames: xing ? list.slice(1) : list, rate: first.rate, version: first.version, xing, xingFrame: xing ? list[0] : null, tail: b.subarray(tailAt), skipped };
}
/** the side information of a frame zeroed but for main_data_begin: no sound bits, so the frame plays as silence.
 * main_data_begin is set to all the bytes the frames before it hold (511 at most), and the body stays as it was,
 * so the decoder keeps every byte for the frames after it (the bit reservoir). With 0 there, a decoder drops what it holds. */
function quiet(b, at, room) {
  const h = header(b, at), crc = crcOn(b, at), s = at + 4 + (crc ? 2 : 0), r = Math.min(room, h.version === 3 ? 511 : 255);
  b.fill(0, s, s + sideLen(h));
  if (h.version === 3) { b[s] = r >> 1; b[s + 1] = (r & 1) << 7; } else b[s] = r;
  if (crc) { const c = frameCrc(b, at, h); b[at + 4] = c >> 8; b[at + 5] = c & 255; }
}
const bodyLen = (b, at) => { const h = header(b, at); return h.bytes - 4 - (crcOn(b, at) ? 2 : 0) - sideLen(h); };
// main_data_begin: how many bytes back, in frames before this one, its sound starts (9 bits in MPEG-1, 8 in MPEG-2)
const mainDataBegin = (b, at) => { const h = header(b, at), s = at + 4 + (crcOn(b, at) ? 2 : 0); return h.version === 3 ? (b[s] << 1) | (b[s + 1] >> 7) : b[s]; };

// CRC-16/ARC (polynomial 0xA001, reflected, start 0), as the LAME tag protects the frame
const arc = (b, n) => { let c = 0; for (let i = 0; i < n; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xa001 : c >>> 1; } return c; };
/** an Info or Xing frame for these frames: the frame count, the byte count and a seek table, in a frame like the one the file had.
 * With `lame` ({ delay, padding }) the LAME tag is kept too, with a new start delay and end padding, so a player plays the exact samples asked for. */
/** the LAME tag's two CRCs made right again: the music CRC (CRC-16/ARC over the frames after the tag frame) and the tag CRC (over the first 190 bytes of the tag frame) */
function lameCrcs(xf, music) {
  const h = header(xf, 0), at = 4 + (crcOn(xf, 0) ? 2 : 0) + sideLen(h), flags = be32(xf, at + 4);
  let t = at + 8 + (flags & 1 ? 4 : 0) + (flags & 2 ? 4 : 0) + (flags & 4 ? 100 : 0) + (flags & 8 ? 4 : 0);
  if (t + 36 > xf.length) return;
  const mc = arc(music, music.length); xf[t + 32] = mc >> 8; xf[t + 33] = mc & 255;
  xf[t + 34] = xf[t + 35] = 0; const w = new Uint8Array(Math.max(190, xf.length)); w.set(xf); const c = arc(w, 190); xf[t + 34] = c >> 8; xf[t + 35] = c & 255;
}
function xingFrame(b, m, frames, lame) {
  const xf = m.xingFrame, out = b.slice(xf.at, xf.at + xf.bytes), h = header(out, 0), at = 4 + (crcOn(out, 0) ? 2 : 0) + sideLen(h), la = m.xing.lameAt;
  const tag = lame && la ? out.slice(la, la + 36) : null, quality = tag && m.xing.flags & 8 ? out.slice(la - 4, la) : new Uint8Array(4);
  out.fill(0, 4); const total = xf.bytes + frames.reduce((a, f) => a + f.bytes, 0), put = (p, n) => out.set(putBe32(n), p);
  out.set(new TextEncoder().encode(m.xing.id), at); put(at + 4, tag ? 15 : 7); put(at + 8, frames.length); put(at + 12, total);
  let acc = xf.bytes; const starts = frames.map((f) => { const s = acc; acc += f.bytes; return s; });
  for (let k = 0; k < 100; k++) out[at + 16 + k] = frames.length ? Math.min(255, Math.floor(256 * starts[Math.min(frames.length - 1, Math.floor(k * frames.length / 100))] / total)) : 0;
  if (tag) {
    const t = at + 120; out.set(quality, t - 4); out.set(tag, t);
    out[t + 21] = (lame.delay >> 4) & 255; out[t + 22] = ((lame.delay & 15) << 4) | ((lame.padding >> 8) & 15); out[t + 23] = lame.padding & 255; put(t + 28, total);
  }
  return out;
}

/** the MP3 from `from` to `to` seconds, with no new coding: { bytes, notes, from, to }.
 * With a LAME tag (most MP3s have one) the cut is exact to the sample: Verse keeps a few frames more at the start, so the decoder
 * fills its bit reservoir and its overlap, and the tag's start delay and end padding tell the player to skip them. With no tag it cuts on frame lines. */
export function cutMp3(b, from, to) {
  const m = framesOf(b), n = m.frames.length, S = n ? m.frames[0].samples : 1152, rate = m.rate, ms = (k) => Math.round(1000 * k / rate);
  const lame = !!(m.xing && m.xing.id !== 'VBRI' && m.xing.lameAt), lead = lame ? m.xing.delay + 529 : 0;
  // a player that reads the tag skips the encoder delay and the 529 samples a decoder holds back, and the padding at the end
  const total = n * S - (lame ? m.xing.delay + m.xing.padding : 0);
  const a = Math.max(0, Math.round(rate * (+from || 0))), z = to === '' || to == null || !isFinite(+to) ? total : Math.min(total, Math.round(rate * +to));
  if (!(z > a)) throw new Error('the end must be after the start (the sound is ' + (total / rate).toFixed(2) + ' s).');
  const A = a + lead, Z = z + lead; // as samples of the frames themselves
  // the start delay is 12 bits (4095 at most): that is room for 3 frames more at 1152 samples a frame, 7 at 576
  const ka = lame ? Math.max(0, Math.floor(A / S) - Math.floor((4095 + 529) / S) + 1) : Math.floor(A / S), kz = Math.min(n, Math.ceil(Z / S));
  const kept = m.frames.slice(ka, kz), body = new Uint8Array(kept.reduce((s, f) => s + f.bytes, 0)); let p = 0;
  for (const f of kept) { body.set(b.subarray(f.at, f.at + f.bytes), p); p += f.bytes; }
  // a frame whose sound starts in a frame that was cut away cannot be decoded: it is made quiet. A frame reaches back 511 bytes at most, so only the first few can be hit.
  let last = -1;
  if (ka > 0) for (let i = 0, at = 0, room = 0; i < kept.length && room < (m.version === 3 ? 511 : 255); at += kept[i].bytes, i++) {
    if (mainDataBegin(body, at) > room) { quiet(body, at, room); last = i; }
    room += bodyLen(body, at);
  }
  const delay = A - ka * S - 529, padding = kz * S + 529 - Z, notes = [];
  // a quiet frame sounds wrong, and so do the 576 samples that overlap it and the 512 the synthesis filter holds; the start delay skips them when it reaches past them
  const bad = last < 0 ? 0 : Math.max(0, (last + 1) * S + 576 + 512 - (lame ? delay + 529 : 0));
  const xing = m.xing && m.xing.id !== 'VBRI' ? xingFrame(b, m, kept, lame ? { delay, padding } : null) : new Uint8Array(0);
  if (lame) lameCrcs(xing, body);
  const s0 = lame ? a : Math.max(0, ka * S), s1 = lame ? z : Math.min(total, kz * S);
  notes.push('kept ' + (s0 / rate).toFixed(3) + ' s to ' + (s1 / rate).toFixed(3) + ' s (' + ((s1 - s0) / rate).toFixed(3) + ' s), ' + kept.length + ' of ' + n + ' MP3 frames');
  notes.push(lame ? 'the sound is not coded again: the cut is exact to the sample in a player that reads the LAME tag, as browsers do; a player that does not can play up to ' + ms(delay + 529) + ' ms more at the start'
    : 'the sound is not coded again: the file has no LAME tag, so Verse cut on frame lines, ' + ms(S) + ' ms apart');
  if (bad) notes.push('about ' + ms(bad) + ' ms at the start are quiet or faint: the frames there kept part of the sound in frames before the cut');
  if (m.xing && m.xing.id === 'VBRI') notes.push('the VBRI table (from a Fraunhofer encoder) is left out, because it no longer fits; players count the frames');
  if (m.skipped) notes.push(m.skipped + ' bytes that were not MP3 frames were left out');
  return { bytes: cat([m.tag, xing, body, m.tail]), notes, from: s0 / rate, to: s1 / rate };
}

// side information bits: read and write n bits at bit p of the side information that starts at byte s
const getBits = (b, s, p, n) => { let v = 0; for (let i = 0; i < n; i++) v = (v << 1) | ((b[s + ((p + i) >> 3)] >> (7 - ((p + i) & 7))) & 1); return v; };
const setBits = (b, s, p, n, v) => { for (let i = 0; i < n; i++) { const q = p + i, m = 1 << (7 - (q & 7)); if ((v >> (n - 1 - i)) & 1) b[s + (q >> 3)] |= m; else b[s + (q >> 3)] &= ~m; } };
// where each granule's global_gain is, in bits from the start of the side information: { at, granules }
function gainBits(h) {
  const ch = h.channels;
  if (h.version === 3) { const head = 9 + (ch === 1 ? 5 : 3) + 4 * ch, at = []; for (let g = 0; g < 2; g++) for (let c = 0; c < ch; c++) at.push(head + (g * ch + c) * 59 + 21); return at; }
  const head = 8 + (ch === 1 ? 1 : 2), at = []; for (let c = 0; c < ch; c++) at.push(head + c * 63 + 21); return at;
}
/** the MP3 louder or quieter with no new coding: each granule's global_gain (8 bits, a step is 2^(1/4), 1.505 dB) moves by the same number of steps.
 * This is what MP3Gain does. The sound loses nothing; dB is rounded to whole steps. { bytes, notes, steps, factor } */
export function gainMp3(b, db) {
  const m = framesOf(b), steps = Math.round((+db || 0) / (6.020599913 / 4)), out = b.slice(); let clamped = 0, granules = 0;
  for (const f of m.frames) {
    const h = header(out, f.at), crc = crcOn(out, f.at), s = f.at + 4 + (crc ? 2 : 0);
    for (const p of gainBits(h)) { const g = getBits(out, s, p, 8), n = g + steps; granules++; if (n < 0 || n > 255) clamped++; setBits(out, s, p, 8, Math.max(0, Math.min(255, n))); }
    if (crc) { const c = frameCrc(out, f.at, h); out[f.at + 4] = c >> 8; out[f.at + 5] = c & 255; }
  }
  const factor = 2 ** (steps / 4), dB = 20 * Math.log10(factor), notes = [];
  if (m.xing && m.xing.lameAt) {
    const xf = out.subarray(m.xingFrame.at, m.xingFrame.at + m.xingFrame.bytes), t = m.xing.lameAt, v = new DataView(xf.buffer, xf.byteOffset);
    const peak = v.getFloat32(t + 11); if (peak > 0) v.setFloat32(t + 11, peak * factor);
    for (const r of [t + 15, t + 17]) { const w = v.getUint16(r); if (w >> 13) { const val = (w & 0x200 ? -1 : 1) * (w & 0x1ff) - Math.round(dB * 10), a = Math.min(511, Math.abs(val)); v.setUint16(r, (w & 0xfc00) | (val < 0 ? 0x200 : 0) | a); } }
    const a = m.frames.length ? m.frames[0].at : 0, z = m.frames.length ? m.frames.at(-1).at + m.frames.at(-1).bytes : 0;
    lameCrcs(xf, out.subarray(a, z));
  }
  notes.push((steps >= 0 ? '+' : '') + dB.toFixed(2) + ' dB (' + factor.toFixed(3) + ' times the level): ' + Math.abs(steps) + ' steps of 1.505 dB in each of ' + granules + ' granules');
  notes.push('the sound is not coded again, so it loses nothing: only the level number of each piece changes, as MP3Gain does');
  if (clamped) notes.push(clamped + ' granules were already at the ' + (steps > 0 ? 'top' : 'bottom') + ' of the level range and moved less');
  if (m.skipped) notes.push(m.skipped + ' bytes that were not MP3 frames were kept as they were');
  const tag = readTag(b), rg = tag && tag.frames.some((f) => f.id === 'TXXX' && /REPLAYGAIN/i.test(new TextDecoder().decode(f.data).replace(/\0/g, '')));
  if (rg) notes.push('the tag has ReplayGain values from before: a player that uses them can make it quieter again');
  return { bytes: out, notes, steps, factor };
}
