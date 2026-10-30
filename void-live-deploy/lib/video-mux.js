// Video files written by Verse itself (2026-10-30, /converter/): an MP4 writer and a WebM writer for the coded frames and sound that the
// browser's own encoders (WebCodecs) make on this device. Pure: no DOM, the same in the browser and in node tests. Nothing is uploaded.
// MP4 (ISO/IEC 14496-12): the index (moov) before the data, so a player can start at once; one sample to a chunk; H.264 (avc1, the
// encoder's avcC record) or VP9 (vp09, vpcC) video; AAC (mp4a, esds) or Opus (Opus, dOps) sound. WebM (Matroska subset): EBML header,
// one Segment with SeekHead, Info, Tracks, Cues and Clusters; a new Cluster at each video key frame, so every Cluster can be seeked to.
// A sample is { data: Uint8Array, t: microseconds, d: microseconds, key: bool }.

const te = new TextEncoder();
const cat = (parts) => { let n = 0; for (const p of parts) n += p.length; const o = new Uint8Array(n); let at = 0; for (const p of parts) { o.set(p, at); at += p.length; } return o; };
const u8 = (...v) => Uint8Array.from(v);
const u16 = (v) => u8((v >>> 8) & 255, v & 255);
const u24 = (v) => u8((v >>> 16) & 255, (v >>> 8) & 255, v & 255);
const u32 = (v) => u8((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
const u64 = (v) => cat([u32(Math.floor(v / 2 ** 32)), u32(v >>> 0)]);
const str = (s) => te.encode(s);

// ---- MP4 -------------------------------------------------------------------------------------------------------------------------------------
const box = (type, ...kids) => { const body = cat(kids); return cat([u32(8 + body.length), str(type), body]); };
const full = (type, version, flags, ...kids) => box(type, u8(version), u24(flags), ...kids);
const MATRIX = cat([0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000].map(u32));
const zeros = (n) => new Uint8Array(n);

/** the esds box of an AAC track, from the encoder's AudioSpecificConfig */
function esds(asc, bitrate = 128000) {
  const desc = (tag, body) => cat([u8(tag, body.length), body]); // every part here is under 128 bytes
  const dsi = desc(0x05, asc), dcd = desc(0x04, cat([u8(0x40, 0x15), u24(0), u32(bitrate), u32(bitrate), dsi])), sl = desc(0x06, u8(0x02));
  return full('esds', 0, 0, desc(0x03, cat([u16(0), u8(0), dcd, sl])));
}
/** dOps (Opus in ISO BMFF): big-endian, unlike the OpusHead it is read from */
export function opusHeadOf(desc, channels = 2, rate = 48000) {
  const b = desc && desc.length >= 19 && String.fromCharCode(...desc.subarray(0, 8)) === 'OpusHead' ? desc : null;
  if (b) return { channels: b[9], preSkip: b[10] | (b[11] << 8), rate: (b[12] | (b[13] << 8) | (b[14] << 16) | (b[15] << 24)) >>> 0, gain: (b[16] | (b[17] << 8)) << 16 >> 16, family: b[18] };
  return { channels, preSkip: 312, rate, gain: 0, family: 0 };
}
/** an OpusHead for a WebM track when the encoder gives none */
export function opusHead(h) { return cat([str('OpusHead'), u8(1, h.channels, h.preSkip & 255, h.preSkip >> 8), u8(h.rate & 255, (h.rate >> 8) & 255, (h.rate >> 16) & 255, (h.rate >>> 24) & 255), u8(h.gain & 255, (h.gain >> 8) & 255, 0)]); }
const dOps = (h) => box('dOps', u8(0, h.channels), u16(h.preSkip), u32(h.rate), u16(h.gain & 0xffff), u8(0));

function vp9Of(codec) { const m = String(codec).match(/^vp09\.(\d+)\.(\d+)\.(\d+)/); return { profile: m ? +m[1] : 0, level: m ? +m[2] : 41, depth: m ? +m[3] : 8 }; }
function videoEntry(v) {
  const head = cat([zeros(6), u16(1), u16(0), u16(0), zeros(12), u16(v.width), u16(v.height), u32(0x00480000), u32(0x00480000), u32(0), u16(1), cat([u8(5), str('Verse'), zeros(26)]), u16(0x18), u16(0xffff)]);
  if (/^avc1|^avc3/.test(v.codec)) return box('avc1', head, box('avcC', v.description));
  if (/^vp09/.test(v.codec)) { const p = vp9Of(v.codec); return box('vp09', head, full('vpcC', 1, 0, u8(p.profile, p.level, (p.depth << 4) | (1 << 1) | 0, 1, 1, 1), u16(0))); }
  throw new Error('Verse cannot put ' + v.codec + ' video in an MP4.');
}
function audioEntry(a) {
  const head = (rate) => cat([zeros(6), u16(1), zeros(8), u16(a.channels), u16(16), u16(0), u16(0), u32((rate >= 65536 ? 0 : rate) * 65536)]);
  if (/^mp4a/.test(a.codec)) return box('mp4a', head(a.rate), esds(a.description || u8(0x11, 0x90), a.bitrate));
  if (a.codec === 'opus') return box('Opus', head(48000), dOps(opusHeadOf(a.description, a.channels, a.rate)));
  if (a.codec === 'alac') return box('alac', head(a.rate), full('alac', 0, 0, a.description)); // the 24-byte ALACSpecificConfig
  throw new Error('Verse cannot put ' + a.codec + ' sound in an MP4.');
}
// stts: the length of each sample, run-length coded
function stts(durs) { const runs = []; for (const d of durs) { const r = runs[runs.length - 1]; if (r && r[1] === d) r[0]++; else runs.push([1, d]); } return full('stts', 0, 0, u32(runs.length), ...runs.map(([n, d]) => cat([u32(n), u32(d)]))); }
// sample lengths in the track's time scale, from the microsecond times (the last one keeps its own d)
function ticks(samples, scale) {
  const at = samples.map((s) => Math.round(s.t * scale / 1e6)), end = Math.round((samples[samples.length - 1].t + (samples[samples.length - 1].d || 0)) * scale / 1e6);
  return at.map((x, i) => Math.max(1, (i + 1 < at.length ? at[i + 1] : Math.max(end, x + 1)) - x));
}
function trak(id, kind, info, samples, offsets, movieMs) {
  const scale = kind === 'vide' ? 90000 : (info.codec === 'opus' ? 48000 : info.rate), durs = ticks(samples, scale), total = durs.reduce((a, b) => a + b, 0);
  const tkhd = full('tkhd', 0, 3, u32(0), u32(0), u32(id), u32(0), u32(movieMs), zeros(8), u16(0), u16(0), u16(kind === 'soun' ? 0x0100 : 0), u16(0), MATRIX, u32((kind === 'vide' ? info.width : 0) * 65536), u32((kind === 'vide' ? info.height : 0) * 65536));
  const mdhd = full('mdhd', 0, 0, u32(0), u32(0), u32(scale), u32(total), u16(0x55c4), u16(0));
  const hdlr = full('hdlr', 0, 0, u32(0), str(kind), zeros(12), str(kind === 'vide' ? 'Verse video\0' : 'Verse sound\0'));
  const head = kind === 'vide' ? full('vmhd', 0, 1, zeros(8)) : full('smhd', 0, 0, zeros(4));
  const dinf = box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1)));
  const keys = samples.map((s, i) => (s.key ? i + 1 : 0)).filter(Boolean);
  const stbl = box('stbl',
    full('stsd', 0, 0, u32(1), kind === 'vide' ? videoEntry(info) : audioEntry(info)),
    stts(durs),
    ...(kind === 'vide' && keys.length < samples.length ? [full('stss', 0, 0, u32(keys.length), ...keys.map(u32))] : []),
    full('stsc', 0, 0, u32(1), u32(1), u32(1), u32(1)),
    full('stsz', 0, 0, u32(0), u32(samples.length), ...samples.map((s) => u32(s.data.length))),
    full('co64', 0, 0, u32(samples.length), ...offsets.map(u64)));
  return box('trak', tkhd, box('mdia', mdhd, hdlr, box('minf', head, dinf, stbl)));
}
/** an MP4 file from coded video samples (and sound samples, if any). video: { codec, width, height, description, samples };
 *  audio: { codec: 'mp4a.40.2' | 'opus' | 'alac', rate, channels, description, bitrate, samples } or null. opts.qt: a QuickTime MOV (the same
 *  boxes, the QuickTime brand). opts.m4a: the M4A brand, for a sound-only file. Pure. */
export function mp4(video, audio = null, opts = {}) {
  const tracks = [video && video.samples.length && { kind: 'vide', info: video, samples: video.samples }, audio && audio.samples.length && { kind: 'soun', info: audio, samples: audio.samples }].filter(Boolean);
  if (!tracks.length) throw new Error('nothing to write: no video and no sound.');
  // the order of the data: by time, so a player reads sound and pictures together
  const order = tracks.flatMap((tr, k) => tr.samples.map((s, i) => ({ k, i, t: s.t }))).sort((a, b) => a.t - b.t || a.k - b.k);
  const endMs = Math.max(...tracks.map((tr) => { const l = tr.samples[tr.samples.length - 1]; return Math.ceil((l.t + (l.d || 0)) / 1000); }));
  const ftyp = opts.qt ? box('ftyp', str('qt  '), u32(0x200), str('qt  ')) : opts.m4a ? box('ftyp', str('M4A '), u32(0), str('M4A '), str('mp42'), str('isom')) : box('ftyp', str('isom'), u32(0x200), str('isom'), str('iso2'), str(tracks.some((t) => /^avc/.test(t.info.codec)) ? 'avc1' : 'iso6'), str('mp41'));
  const moovOf = (offs) => box('moov', full('mvhd', 0, 0, u32(0), u32(0), u32(1000), u32(endMs), u32(0x00010000), u16(0x0100), zeros(10), MATRIX, zeros(24), u32(tracks.length + 1)),
    ...tracks.map((tr, k) => trak(k + 1, tr.kind, tr.info, tr.samples, offs[k], endMs)));
  const blank = tracks.map((tr) => tr.samples.map(() => 0)), size = moovOf(blank).length; // co64: the index is the same size whatever the offsets
  const dataLen = order.reduce((a, o) => a + tracks[o.k].samples[o.i].data.length, 0), big = dataLen + 8 > 0xffffffff;
  let at = ftyp.length + size + (big ? 16 : 8); const offs = tracks.map(() => []);
  for (const o of order) { offs[o.k][o.i] = at; at += tracks[o.k].samples[o.i].data.length; }
  const mdatHead = big ? cat([u32(1), str('mdat'), u64(dataLen + 16)]) : cat([u32(dataLen + 8), str('mdat')]);
  return cat([ftyp, moovOf(offs), mdatHead, ...order.map((o) => tracks[o.k].samples[o.i].data)]);
}

// ---- WebM ------------------------------------------------------------------------------------------------------------------------------------
const idBytes = (id) => { const o = []; let x = id; while (x > 0) { o.unshift(x & 255); x = Math.floor(x / 256); } return Uint8Array.from(o); };
function vsize(n) { for (let len = 1; len <= 8; len++) { if (n < 2 ** (7 * len) - 1) { const o = new Uint8Array(len); let x = n; for (let i = len - 1; i >= 0; i--) { o[i] = x & 255; x = Math.floor(x / 256); } o[0] |= 1 << (8 - len); return o; } } throw new Error('too big'); }
const el = (id, ...kids) => { const body = cat(kids); return cat([idBytes(id), vsize(body.length), body]); };
const uint = (id, v, width = 0) => { const o = []; let x = v; do { o.unshift(x & 255); x = Math.floor(x / 256); } while (x > 0); while (o.length < width) o.unshift(0); return el(id, Uint8Array.from(o)); };
const flt = (id, v) => { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, v); return el(id, b); };
const txt = (id, s) => el(id, str(s));
const ID = { EBML: 0x1a45dfa3, Segment: 0x18538067, SeekHead: 0x114d9b74, Seek: 0x4dbb, SeekID: 0x53ab, SeekPosition: 0x53ac, Info: 0x1549a966, Tracks: 0x1654ae6b, Cues: 0x1c53bb6b, Cluster: 0x1f43b675 };

/** a WebM file from coded video samples (VP8, VP9 or AV1) and sound samples (Opus), either of which may be missing. opts.mkv: a Matroska
 *  MKV (WebM is a part of Matroska: the same elements, the matroska doctype). Pure. */
export function webm(video, audio = null, opts = {}) {
  const hasV = !!(video && video.samples.length), hasA = !!(audio && audio.samples.length);
  if (!hasV && !hasA) throw new Error('nothing to write: no video and no sound.');
  const vId = { vp8: 'V_VP8', av01: 'V_AV1' }[hasV ? String(video.codec).slice(0, 4) : ''] || (hasV && /^vp09/.test(video.codec) ? 'V_VP9' : '');
  if (hasV && !vId) throw new Error('Verse cannot put ' + video.codec + ' video in a WebM.');
  if (hasA && audio.codec !== 'opus') throw new Error('Verse cannot put ' + audio.codec + ' sound in a WebM.');
  const vn = 1, an = hasV ? 2 : 1, head = hasA ? opusHeadOf(audio.description, audio.channels, audio.rate) : null;
  const ebml = el(ID.EBML, uint(0x4286, 1), uint(0x42f7, 1), uint(0x42f2, 4), uint(0x42f3, 8), txt(0x4282, opts.mkv ? 'matroska' : 'webm'), uint(0x4287, 4), uint(0x4285, 2));
  const all = [...(hasV ? video.samples.map((s) => ({ ...s, n: vn, v: true })) : []), ...(hasA ? audio.samples.map((s) => ({ ...s, n: an, v: false })) : [])].sort((a, b) => a.t - b.t || (a.v ? -1 : 1));
  const endMs = Math.max(...all.map((s) => (s.t + (s.d || 0)) / 1000));
  const info = el(ID.Info, uint(0x2ad7b1, 1000000), txt(0x4d80, 'Verse'), txt(0x5741, 'Verse (a-to-mind.com/converter/)'), flt(0x4489, endMs));
  const tracks = el(ID.Tracks,
    ...(hasV ? [el(0xae, uint(0xd7, vn), uint(0x73c5, vn), uint(0x83, 1), uint(0x9c, 0), txt(0x86, vId), el(0xe0, uint(0xb0, video.width), uint(0xba, video.height)))] : []),
    ...(hasA ? [el(0xae, uint(0xd7, an), uint(0x73c5, an), uint(0x83, 2), uint(0x9c, 0), txt(0x86, 'A_OPUS'), el(0x63a2, audio.description && audio.description.length >= 19 ? audio.description : opusHead(head)), uint(0x56aa, Math.round(head.preSkip / 48000 * 1e9)), uint(0x56bb, 80000000), el(0xe1, flt(0xb5, 48000), uint(0x9f, head.channels)))] : []));
  // clusters: a new one at each video key frame (only sound: every 5 s), and never longer than 30 s, as a block's time is 16 bits of ms
  const clusters = []; let cur = null;
  for (const s of all) {
    const ms = Math.round(s.t / 1000);
    if (!cur || (hasV ? s.v && s.key : ms - cur.ms >= 5000) || ms - cur.ms > 30000) { cur = { ms, blocks: [], cue: !hasV || (s.v && s.key) }; clusters.push(cur); }
    cur.blocks.push(el(0xa3, vsize(s.n), u16((ms - cur.ms) & 0xffff), u8(s.key || !s.v ? 0x80 : 0), s.data));
  }
  const cbytes = clusters.map((c) => el(ID.Cluster, uint(0xe7, c.ms), ...c.blocks));
  const cuesOf = (pos) => el(ID.Cues, ...clusters.map((c, i) => [c, i]).filter(([c]) => c.cue).map(([c, i]) => el(0xbb, uint(0xb3, c.ms, 8), el(0xb7, uint(0xf7, hasV ? vn : an), uint(0xf1, pos[i], 8)))));
  const seekOf = (pInfo, pTracks, pCues) => el(ID.SeekHead, ...[[ID.Info, pInfo], [ID.Tracks, pTracks], [ID.Cues, pCues]].map(([id, p]) => el(0x4dbb, el(0x53ab, idBytes(id)), uint(0x53ac, p, 8))));
  const zero = clusters.map(() => 0), seekLen = seekOf(0, 0, 0).length, cuesLen = cuesOf(zero).length; // fixed-width numbers: the sizes do not move
  const pInfo = seekLen, pTracks = pInfo + info.length, pCues = pTracks + tracks.length, first = pCues + cuesLen, pos = []; let at = first;
  for (const c of cbytes) { pos.push(at); at += c.length; }
  const body = cat([seekOf(pInfo, pTracks, pCues), info, tracks, cuesOf(pos), ...cbytes]);
  return cat([ebml, idBytes(ID.Segment), vsize(body.length), body]);
}

// ---- codecs ----------------------------------------------------------------------------------------------------------------------------------
/** the H.264 codec strings to try for a picture size, smallest level first (Constrained Baseline: no reordered frames) */
export function avcCodecs(width, height, fps = 30) {
  const mbs = Math.ceil(width / 16) * Math.ceil(height / 16), rate = mbs * fps;
  const levels = [[0x1f, 3600, 108000], [0x20, 5120, 216000], [0x28, 8192, 245760], [0x2a, 8704, 522240], [0x32, 22080, 589824], [0x33, 36864, 983040], [0x34, 36864, 2073600]];
  return levels.filter(([, m, r]) => mbs <= m && rate <= r).map(([l]) => 'avc1.42e0' + l.toString(16).padStart(2, '0')).slice(0, 2);
}
/** a bit rate for a picture size: bits per pixel per frame for each quality */
export const QUALITY = Object.freeze({ high: 0.14, medium: 0.08, small: 0.04 });
export function bitrateOf(width, height, fps = 30, quality = 'medium') { return Math.max(150000, Math.round(width * height * Math.min(60, fps || 30) * (QUALITY[quality] || QUALITY.medium))); }
/** an even picture size (H.264 and VP9 4:2:0 need even sides), no bigger than max on the long side */
export function evenSize(w, h, max = 0) { let W = w, H = h; if (max && Math.max(W, H) > max) { const k = max / Math.max(W, H); W = W * k; H = H * k; } return { width: Math.max(2, Math.round(W / 2) * 2), height: Math.max(2, Math.round(H / 2) * 2) }; }

/** a WebM that MediaRecorder wrote has no length in its Info, so players cannot seek it: put one in (ms). Returns the bytes as they
 *  were when the Info is not where a recorder puts it, or already has a length. Pure. */
export function webmWithDuration(bytes, ms) {
  const b = bytes, find = (id, from, to) => { const ib = idBytes(id); for (let i = from; i + ib.length <= to; i++) { let ok = true; for (let k = 0; k < ib.length; k++) if (b[i + k] !== ib[k]) { ok = false; break; } if (ok) return i; } return -1; };
  const readSize = (at) => { const first = b[at]; let len = 1; while (len <= 8 && !(first & (0x80 >> (len - 1)))) len++; if (len > 8) return null; let v = first & (0xff >> len); for (let k = 1; k < len; k++) v = v * 256 + b[at + k]; return { len, v }; };
  const at = find(ID.Info, 0, Math.min(b.length, 4096)); if (at < 0) return b;
  const sz = readSize(at + 4); if (!sz) return b;
  const start = at + 4 + sz.len, end = start + sz.v; if (end > b.length || find(0x4489, start, end) >= 0) return b;
  const info = el(ID.Info, b.subarray(start, end), flt(0x4489, ms));
  return cat([b.subarray(0, at), info, b.subarray(end)]);
}
