// AVI written on this device (2026-10-30, /converter/): the H.264 pictures the browser's VideoEncoder made (the avcC form) become an AVI 1.0
// file (RIFF, the hdrl headers, the movi chunks, the idx1 index) with the sound as 16-bit PCM, which every AVI player reads. The pictures
// go in as Annex B (start codes), with the SPS and PPS before each key picture, as the H264 handler expects. An AVI has a fixed picture
// rate, so each picture takes the slot its time gives it, and an empty chunk holds the last picture where the video had a gap. Pure: no DOM.

const enc = new TextEncoder();
const fcc = (s) => enc.encode(s);
const s16 = (x) => { const y = Math.max(-1, Math.min(1, x)); return Math.round(y < 0 ? y * 32768 : y * 32767); }; // as lib/converter.js wav()
export const AVI_LIMIT = 0x7fff0000; // AVI 1.0: the offsets in idx1 are 32-bit, and players read a RIFF of up to 2 GB

/** the SPS and PPS of an avcC record, and the size of its NAL lengths */
export function avcParams(avcC) {
  const b = avcC, nalLen = (b[4] & 3) + 1, sps = [], pps = []; let p = 6;
  const nSps = b[5] & 31; for (let i = 0; i < nSps; i++) { const n = (b[p] << 8) | b[p + 1]; sps.push(b.subarray(p + 2, p + 2 + n)); p += 2 + n; }
  const nPps = b[p++]; for (let i = 0; i < nPps; i++) { const n = (b[p] << 8) | b[p + 1]; pps.push(b.subarray(p + 2, p + 2 + n)); p += 2 + n; }
  return { nalLen, sps, pps };
}
const START = new Uint8Array([0, 0, 0, 1]);
/** one picture from length-prefixed NAL units to Annex B; a key picture gets the SPS and PPS first */
export function annexB(data, prm, key) {
  const parts = []; if (key) for (const x of [...prm.sps, ...prm.pps]) parts.push(START, x);
  for (let p = 0; p < data.length;) {
    let n = 0; for (let k = 0; k < prm.nalLen; k++) n = n * 256 + data[p + k]; p += prm.nalLen;
    if (n <= 0 || p + n > data.length) throw new Error('a picture from the encoder is not whole.');
    parts.push(START, data.subarray(p, p + n)); p += n;
  }
  const out = new Uint8Array(parts.reduce((a, x) => a + x.length, 0)); let at = 0; for (const x of parts) { out.set(x, at); at += x.length; } return out;
}

class W {
  constructor() { this.parts = []; this.size = 0; }
  put(b) { this.parts.push(b); this.size += b.length; }
  u32(...v) { const b = new Uint8Array(4 * v.length), d = new DataView(b.buffer); v.forEach((x, i) => d.setUint32(4 * i, x >>> 0, true)); this.put(b); }
  u16(...v) { const b = new Uint8Array(2 * v.length), d = new DataView(b.buffer); v.forEach((x, i) => d.setUint16(2 * i, x & 0xffff, true)); this.put(b); }
  bytes() { const o = new Uint8Array(this.size); let at = 0; for (const x of this.parts) { o.set(x, at); at += x.length; } return o; }
}
const chunk = (id, body) => { const w = new W(); w.put(fcc(id)); w.u32(body.length); w.put(body); if (body.length & 1) w.put(new Uint8Array(1)); return w.bytes(); };
const list = (type, ...kids) => { const w = new W(); for (const k of kids) w.put(k); return chunk('LIST', concat([fcc(type), w.bytes()])); };
const concat = (xs) => { const o = new Uint8Array(xs.reduce((a, x) => a + x.length, 0)); let at = 0; for (const x of xs) { o.set(x, at); at += x.length; } return o; };
const body = (fn) => { const w = new W(); fn(w); return w.bytes(); };

/** video: { codec 'avc1...', width, height, description (avcC), samples: [{ data, t (us), key }] }; rate: pictures a second; sound: { rate,
 *  channels: [Float32Array] } or null. Returns { bytes, rate, pictures, gaps }. */
export function avi(video, rate, sound = null) {
  if (!/^avc1/.test(video.codec)) throw new Error('Verse writes AVI with H.264 pictures only, and this browser gave ' + video.codec + '.');
  const prm = avcParams(video.description), fps = Math.max(1, Math.min(240, rate || 30)), scale = 1000, rateN = Math.round(fps * scale);
  const s = video.samples, t0 = s.length ? s[0].t : 0;
  // the slot of each picture: its time at the fixed rate, never before the slot after the last one; the slots between are held
  const frames = []; let last = -1, gaps = 0;
  for (const x of s) {
    const slot = Math.max(last + 1, Math.round(((x.t - t0) / 1e6) * fps));
    for (let k = last + 1; k < slot; k++) { frames.push(null); gaps++; }
    frames.push({ data: annexB(x.data, prm, x.key), key: !!x.key }); last = slot;
  }
  const n = frames.length, secs = n / fps;
  // the sound, cut into a chunk for each second, put between the pictures by time
  const ch = sound ? Math.min(2, sound.channels.length) : 0, sr = sound ? Math.round(sound.rate) : 0, align = 2 * ch;
  const pcm = []; if (sound) {
    const total = sound.channels[0].length;
    for (let a = 0; a < total; a += sr) {
      const m = Math.min(sr, total - a), b = new Uint8Array(m * align), d = new DataView(b.buffer);
      for (let i = 0; i < m; i++) for (let k = 0; k < ch; k++) d.setInt16((i * ch + k) * 2, s16(sound.channels[Math.min(k, sound.channels.length - 1)][a + i]), true);
      pcm.push({ at: a / sr, data: b });
    }
  }
  const audioBytes = pcm.reduce((x, c) => x + c.data.length, 0), maxV = Math.max(0, ...frames.map((f) => (f ? f.data.length : 0))), maxA = Math.max(0, ...pcm.map((c) => c.data.length));
  // movi and idx1: the offsets count from the 'movi' word
  const movi = new W(), idx = new W(); movi.put(fcc('movi'));
  const add = (id, data, key) => { idx.put(fcc(id)); idx.u32(key ? 0x10 : 0, movi.size, data.length); movi.put(chunk(id, data)); };
  let ai = 0;
  for (let i = 0; i < n; i++) {
    while (ai < pcm.length && pcm[ai].at <= i / fps) { add('01wb', pcm[ai].data, true); ai++; }
    const f = frames[i]; add('00dc', f ? f.data : new Uint8Array(0), f ? f.key : false);
  }
  while (ai < pcm.length) { add('01wb', pcm[ai].data, true); ai++; }
  const avih = body((w) => { w.u32(Math.round(1e6 / fps), Math.round((movi.size / Math.max(secs, 1e-3))), 0, 0x10 | 0x100, n, 0, sound ? 2 : 1, Math.max(maxV, maxA) + 8, video.width, video.height, 0, 0, 0, 0); });
  const vStrh = body((w) => { w.put(fcc('vids')); w.put(fcc('H264')); w.u32(0); w.u16(0, 0); w.u32(0, scale, rateN, 0, n, maxV + 8, 0xffffffff, 0); w.u16(0, 0, video.width, video.height); });
  const vStrf = body((w) => { w.u32(40, video.width, video.height); w.u16(1, 24); w.put(fcc('H264')); w.u32(video.width * video.height * 3, 0, 0, 0, 0); });
  const strls = [list('strl', chunk('strh', vStrh), chunk('strf', vStrf))];
  if (sound) {
    const aStrh = body((w) => { w.put(fcc('auds')); w.u32(0, 0); w.u16(0, 0); w.u32(0, align, sr * align, 0, audioBytes / align, maxA + 8, 0xffffffff, align); w.u16(0, 0, 0, 0); });
    const aStrf = body((w) => { w.u16(1, ch); w.u32(sr, sr * align); w.u16(align, 16, 0); });
    strls.push(list('strl', chunk('strh', aStrh), chunk('strf', aStrf)));
  }
  const hdrl = list('hdrl', chunk('avih', avih), ...strls), moviList = chunk('LIST', movi.bytes()), idx1 = chunk('idx1', idx.bytes());
  const riffBody = concat([fcc('AVI '), hdrl, moviList, idx1]);
  if (riffBody.length + 8 > AVI_LIMIT) throw new Error('this video is ' + Math.round(riffBody.length / 2 ** 20) + ' MB as an AVI, more than the 2 GB an AVI 1.0 file can hold. Make it shorter, smaller or an MP4.');
  return { bytes: chunk('RIFF', riffBody), rate: fps, pictures: n, gaps };
}
