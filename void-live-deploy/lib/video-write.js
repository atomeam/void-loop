// Video written on this device (2026-10-30, /converter/): a video the browser can play is played once, muted, and each picture it shows is
// coded by the browser's own encoder (WebCodecs VideoEncoder: H.264 or VP9 for MP4, VP9 or VP8 for WebM); the sound is read whole and
// coded with AudioEncoder (AAC where the browser has it, else Opus). /lib/video-mux.js writes the file. Where the browser has no
// VideoEncoder, MediaRecorder records the playing video instead, and the notes say so. Browser only. Nothing is uploaded.
import { mp4, webm, webmWithDuration, avcCodecs, bitrateOf, evenSize } from './video-mux.js';

const wait = (el, ev, ms = 30000) => new Promise((res, rej) => { const tm = setTimeout(() => rej(new Error('the video did not open in time.')), ms); el.addEventListener(ev, () => { clearTimeout(tm); res(); }, { once: true }); el.addEventListener('error', () => { clearTimeout(tm); rej(new Error('this browser cannot play this video, so Verse cannot read it.')); }, { once: true }); });
const supported = async (C, cfg) => { try { return !!(await C.isConfigSupported(cfg)).supported; } catch (_) { return false; } };
const NAME = { avc1: 'H.264', vp09: 'VP9', vp8: 'VP8', av01: 'AV1', 'mp4a.40.2': 'AAC', opus: 'Opus' };
const nameOf = (c) => NAME[c] || NAME[String(c).slice(0, 4)] || c;
export const canEncode = () => typeof VideoEncoder === 'function' && typeof VideoFrame === 'function';

/** the sound of a file at 48 kHz (what Opus and AAC are coded at), or null when it has none the browser can read */
export async function soundOf48(file) {
  const C = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!C) return null;
  try { const b = await file.arrayBuffer(); return await new C(2, 1, 48000).decodeAudioData(b); } catch (_) { return null; }
}

async function pickVideo(container, width, height, bitrate) {
  const list = container === 'mp4' ? [...avcCodecs(width, height), 'vp09.00.41.08'] : ['vp09.00.41.08', 'vp8'];
  for (const codec of list) { const cfg = { codec, width, height, bitrate, framerate: 30, ...(codec.startsWith('avc1') ? { avc: { format: 'avc' } } : {}) }; if (await supported(VideoEncoder, cfg)) return cfg; }
  throw new Error('this browser cannot code ' + (container === 'mp4' ? 'H.264 or VP9' : 'VP9 or VP8') + ' video at ' + width + ' x ' + height + '.');
}
async function pickAudio(container, channels) {
  if (typeof AudioEncoder !== 'function') return null;
  const list = container === 'mp4' ? ['mp4a.40.2', 'opus'] : ['opus'];
  for (const codec of list) { const cfg = { codec, sampleRate: 48000, numberOfChannels: channels, bitrate: 128000 }; if (await supported(AudioEncoder, cfg)) return cfg; }
  return null;
}

/** code an AudioBuffer (48 kHz) as AAC or Opus samples. from and to: seconds of the sound to keep. */
export async function encodeSound(buf, cfg, from = 0, to = Infinity) {
  const out = []; let desc = null, error = null;
  const enc = new AudioEncoder({ output: (c, meta) => { const d = new Uint8Array(c.byteLength); c.copyTo(d); out.push({ data: d, t: c.timestamp, d: c.duration || 0, key: true }); if (meta && meta.decoderConfig && meta.decoderConfig.description) desc = new Uint8Array(meta.decoderConfig.description.buffer || meta.decoderConfig.description); }, error: (e) => { error = e; } });
  enc.configure(cfg);
  const ch = cfg.numberOfChannels, a = Math.max(0, Math.floor(from * 48000)), b = Math.min(buf.length, Math.ceil(Math.min(to, buf.duration) * 48000)), step = 48000;
  const planes = Array.from({ length: ch }, (_, k) => buf.getChannelData(Math.min(k, buf.numberOfChannels - 1)));
  for (let at = a; at < b; at += step) {
    const n = Math.min(step, b - at), data = new Float32Array(n * ch);
    for (let k = 0; k < ch; k++) data.set(planes[k].subarray(at, at + n), k * n);
    const ad = new AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: n, numberOfChannels: ch, timestamp: Math.round((at - a) / 48 * 1000), data });
    enc.encode(ad); ad.close();
    if (enc.encodeQueueSize > 20) await new Promise((r) => enc.addEventListener('dequeue', r, { once: true }));
  }
  await enc.flush(); enc.close(); if (error) throw error;
  return { codec: cfg.codec, rate: 48000, channels: ch, bitrate: cfg.bitrate, description: desc, samples: out };
}

/** play the video once and code every picture shown. opts: { container: 'mp4' | 'webm', quality, maxSide, onProgress(fraction) }.
 *  Returns { bytes, notes, width, height, seconds, frames }. */
export async function writeVideo(file, opts = {}) {
  const container = opts.container === 'webm' ? 'webm' : 'mp4', say = opts.onProgress || (() => {});
  const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; const url = URL.createObjectURL(file);
  try {
    v.src = url; await wait(v, 'loadeddata');
    if (!v.videoWidth) throw new Error('this file has no picture: it is a sound. Pick a video.');
    const dur = isFinite(v.duration) ? v.duration : 0, { width, height } = evenSize(v.videoWidth, v.videoHeight, opts.maxSide || 0);
    if (!canEncode()) return await record(v, container, dur, say);
    const vcfg = await pickVideo(container, width, height, bitrateOf(width, height, 30, opts.quality));
    const sound = await soundOf48(file), acfg = sound ? await pickAudio(container, Math.min(2, sound.numberOfChannels)) : null;
    const frames = []; let vdesc = null, error = null;
    const enc = new VideoEncoder({ output: (c, meta) => { const d = new Uint8Array(c.byteLength); c.copyTo(d); frames.push({ data: d, t: c.timestamp, d: c.duration || 0, key: c.type === 'key' }); if (meta && meta.decoderConfig && meta.decoderConfig.description) vdesc = new Uint8Array(meta.decoderConfig.description.buffer || meta.decoderConfig.description); }, error: (e) => { error = e; } });
    enc.configure({ ...vcfg, latencyMode: 'quality' });
    const cv = new OffscreenCanvas(width, height), x = cv.getContext('2d');
    let t0 = null, last = -1, lastKey = -Infinity, count = 0;
    await new Promise((resolve, reject) => {
      const onFrame = async (_, meta) => {
        try {
          if (error) throw error;
          const mt = meta.mediaTime;
          if (mt > last) {
            last = mt; if (t0 === null) t0 = mt;
            const ts = Math.round((mt - t0) * 1e6), key = ts - lastKey >= 2e6; if (key) lastKey = ts;
            x.drawImage(v, 0, 0, width, height); const f = new VideoFrame(cv, { timestamp: ts }); enc.encode(f, { keyFrame: key }); f.close(); count++;
            if (dur) say(Math.min(0.99, mt / dur));
          }
          if (!v.ended) v.requestVideoFrameCallback(onFrame);
          // the encoder is behind: hold the video until it catches up, so no picture is dropped
          if (enc.encodeQueueSize > 4 && !v.ended) { v.pause(); while (enc.encodeQueueSize > 1) await new Promise((r) => enc.addEventListener('dequeue', r, { once: true })); await v.play(); }
        } catch (e) { reject(e); }
      };
      v.addEventListener('ended', () => resolve(), { once: true });
      v.requestVideoFrameCallback(onFrame); v.play().catch(reject);
    });
    await enc.flush(); enc.close(); if (error) throw error;
    if (!frames.length) throw new Error('no picture came out of this video.');
    frames.sort((a, b) => a.t - b.t); const fps = frames.length > 1 ? (frames.length - 1) / ((frames[frames.length - 1].t - frames[0].t) / 1e6) : 30;
    frames[frames.length - 1].d = Math.round(1e6 / (fps || 30));
    const audio = sound && acfg ? await encodeSound(sound, acfg, 0, dur || sound.duration) : null;
    const video = { codec: vcfg.codec, width, height, description: vdesc, samples: frames };
    const bytes = container === 'mp4' ? mp4(video, audio) : webm(video, audio);
    const secs = (frames[frames.length - 1].t + frames[frames.length - 1].d) / 1e6;
    const notes = [width + ' x ' + height + ' pixels', secs.toFixed(2) + ' s', frames.length + ' pictures (' + fps.toFixed(1) + ' a second)', nameOf(vcfg.codec) + ' video'];
    notes.push(audio ? nameOf(acfg.codec) + ' sound' + (container === 'mp4' && acfg.codec === 'opus' ? ' (this browser cannot write AAC; most players play Opus)' : '') : sound ? 'no sound: this browser cannot code sound' : 'no sound: the video has none this browser can read');
    return { bytes, notes, width, height, seconds: secs, frames: frames.length };
  } finally { v.pause(); v.removeAttribute('src'); v.load(); URL.revokeObjectURL(url); }
}

// no VideoEncoder: record the playing video with MediaRecorder (the browser picks the codecs; it takes as long as the video)
async function record(v, container, dur, say) {
  const types = container === 'mp4' ? ['video/mp4;codecs=avc1,mp4a', 'video/mp4'] : ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  const type = typeof MediaRecorder === 'function' ? types.find((t) => MediaRecorder.isTypeSupported(t)) : null;
  const cap = v.captureStream || v.mozCaptureStream;
  if (!type || !cap) throw new Error('this browser cannot write ' + container.toUpperCase() + ' video.');
  v.muted = false; v.volume = 0; const stream = cap.call(v), rec = new MediaRecorder(stream, { mimeType: type }), parts = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) parts.push(e.data); };
  const done = new Promise((r) => { rec.onstop = r; });
  const tick = setInterval(() => { if (dur) say(Math.min(0.99, v.currentTime / dur)); }, 500);
  rec.start(1000); await v.play(); await wait(v, 'ended', Math.max(60000, (dur + 30) * 1000)); rec.stop(); await done; clearInterval(tick);
  const raw = new Uint8Array(await new Blob(parts, { type }).arrayBuffer()), bytes = container === 'webm' ? webmWithDuration(raw, dur * 1000) : raw;
  return { bytes, notes: [v.videoWidth + ' x ' + v.videoHeight + ' pixels', dur.toFixed(2) + ' s', 'recorded while it played: this browser has no video encoder, so the codecs are the ones it records with'], width: v.videoWidth, height: v.videoHeight, seconds: dur, frames: 0 };
}
