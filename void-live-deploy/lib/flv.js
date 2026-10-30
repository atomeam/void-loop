// FLV written on this device (2026-10-30, /converter/): the H.264 pictures the browser's VideoEncoder made (the avcC form, which FLV keeps
// as it is) and the sound become an FLV file: the header, an onMetaData tag, the AVC sequence header, then the pictures and the sound in
// time order, each tag followed by its size. The sound is AAC where the browser codes it, else 16-bit PCM at 44.1 kHz (FLV writes no
// 48 kHz PCM). Pure: no DOM.

const enc = new TextEncoder();
const s16 = (x) => { const y = Math.max(-1, Math.min(1, x)); return Math.round(y < 0 ? y * 32768 : y * 32767); }; // as lib/converter.js wav()
const cat = (xs) => { const o = new Uint8Array(xs.reduce((a, x) => a + x.length, 0)); let at = 0; for (const x of xs) { o.set(x, at); at += x.length; } return o; };
const u8 = (...v) => new Uint8Array(v);
const u16 = (v) => u8((v >> 8) & 255, v & 255);
const u32 = (v) => u8((v >>> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255);
const f64 = (v) => { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, v); return b; };
export const PCM_RATE = 44100; // the highest rate FLV can name for PCM
const PCM_CHUNK = 4096; // sound frames in one tag (about 93 ms)

/** an AMF0 onMetaData script body */
export function metaData(entries) {
  const name = enc.encode('onMetaData'), keys = Object.keys(entries);
  const parts = [u8(2), u16(name.length), name, u8(8), u32(keys.length)];
  for (const k of keys) { const kb = enc.encode(k), v = entries[k]; parts.push(u16(kb.length), kb, typeof v === 'boolean' ? u8(1, v ? 1 : 0) : cat([u8(0), f64(v)])); }
  parts.push(u8(0, 0, 9));
  return cat(parts);
}
/** one tag: type, size, time in ms (24 bits, then the 8 high bits), stream 0, the data, then the size of the tag */
function tag(type, ms, data) {
  const t = Math.max(0, Math.round(ms)), n = data.length;
  return cat([u8(type, (n >> 16) & 255, (n >> 8) & 255, n & 255, (t >> 16) & 255, (t >> 8) & 255, t & 255, (t >>> 24) & 255, 0, 0, 0), data, u32(11 + n)]);
}

/** video: { codec 'avc1...', width, height, description (avcC), samples: [{ data, t (us), key }] }; rate: pictures a second;
 *  aac: { codec 'mp4a.40.2', rate, channels, description (AudioSpecificConfig), samples: [{ data, t (us) }] } or null;
 *  pcm: { rate: 44100, channels: [Float32Array] } or null (used when there is no aac). Returns { bytes, sound: 'aac' | 'pcm' | null }. */
export function flv(video, rate, aac = null, pcm = null) {
  if (!/^avc1/.test(video.codec)) throw new Error('Verse writes FLV with H.264 pictures only, and this browser gave ' + video.codec + '.');
  if (!video.description) throw new Error('the video encoder gave no H.264 set-up record, so Verse cannot write the FLV.');
  if (aac && !aac.description) throw new Error('the sound encoder gave no AAC set-up record, so Verse cannot write the FLV.');
  if (pcm && Math.round(pcm.rate) !== PCM_RATE) throw new Error('FLV holds PCM at 44.1 kHz at most, and this sound is ' + pcm.rate + ' Hz.');
  const s = video.samples, t0 = s.length ? s[0].t : 0, last = s[s.length - 1], vSecs = s.length ? (last.t - t0 + (last.d || 1e6 / rate)) / 1e6 : 0;
  const sound = aac ? 'aac' : pcm ? 'pcm' : null, ch = aac ? aac.channels : pcm ? Math.min(2, pcm.channels.length) : 0;
  const aFlag = sound === 'aac' ? 0xaf : 0x3e | (ch === 2 ? 1 : 0); // AAC (always named 44 kHz, 16-bit, stereo); PCM little end, 44 kHz, 16-bit
  const tags = []; // [ms, order, bytes]: at one time the sound goes first
  for (const x of s) tags.push([(x.t - t0) / 1000, 1, tag(9, (x.t - t0) / 1000, cat([u8(x.key ? 0x17 : 0x27, 1, 0, 0, 0), x.data]))]);
  let aSecs = 0;
  if (sound === 'aac') {
    const a0 = aac.samples.length ? aac.samples[0].t : 0;
    for (const x of aac.samples) tags.push([(x.t - a0) / 1000, 0, tag(8, (x.t - a0) / 1000, cat([u8(aFlag, 1), x.data]))]);
    const al = aac.samples[aac.samples.length - 1]; aSecs = al ? (al.t - a0 + (al.d || 0)) / 1e6 : 0;
  } else if (sound === 'pcm') {
    const n = pcm.channels[0].length; aSecs = n / PCM_RATE;
    for (let a = 0; a < n; a += PCM_CHUNK) {
      const m = Math.min(PCM_CHUNK, n - a), b = new Uint8Array(m * ch * 2), d = new DataView(b.buffer);
      for (let i = 0; i < m; i++) for (let k = 0; k < ch; k++) d.setInt16((i * ch + k) * 2, s16(pcm.channels[Math.min(k, pcm.channels.length - 1)][a + i]), true);
      tags.push([(a / PCM_RATE) * 1000, 0, tag(8, (a / PCM_RATE) * 1000, cat([u8(aFlag), b]))]);
    }
  }
  tags.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const secs = Math.max(vSecs, aSecs);
  const meta = { duration: secs, width: video.width, height: video.height, framerate: rate, videocodecid: 7 };
  if (sound) Object.assign(meta, { audiocodecid: sound === 'aac' ? 10 : 3, audiosamplerate: sound === 'aac' ? aac.rate : PCM_RATE, audiosamplesize: 16, stereo: ch === 2 });
  const head = u8(0x46, 0x4c, 0x56, 1, sound ? 5 : 1, 0, 0, 0, 9, 0, 0, 0, 0); // 'FLV', version 1, sound and pictures, 9 bytes, first tag size 0
  const setup = [tag(18, 0, metaData(meta)), tag(9, 0, cat([u8(0x17, 0, 0, 0, 0), video.description]))];
  if (sound === 'aac') setup.push(tag(8, 0, cat([u8(aFlag, 0), aac.description])));
  const end = tag(9, vSecs * 1000, u8(0x17, 2, 0, 0, 0)); // the AVC end of sequence
  return { bytes: cat([head, ...setup, ...tags.map((x) => x[2]), end]), sound, seconds: secs };
}
