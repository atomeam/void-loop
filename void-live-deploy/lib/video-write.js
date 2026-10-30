// Video written on this device (2026-10-30, /converter/): a video the browser can play is played once, muted, and each picture it shows is
// drawn on a canvas (turned, resized, blurred, brightened, put on a background, with a text or a picture on it) and coded by the browser's own
// encoder (WebCodecs VideoEncoder: H.264 or VP9 for MP4 and MOV, VP9 or VP8 for WebM and MKV). The sound is read whole, edited with the sound
// edits of /lib/converter.js (cut, speed, volume, join, mix) and coded with AudioEncoder (AAC where the browser has it, else Opus).
// /lib/video-mux.js writes the file. Pictures, a GIF, the pages of a PDF or a sound with a picture become a video the same way, with no
// playing. Where the browser has no VideoEncoder, MediaRecorder records the playing video instead (plain conversion only), and the notes say
// so. An AVI holds the H.264 pictures and the sound as 16-bit PCM (/lib/avi.js). A 3GP holds H.264 and AAC only, so it has no sound where the browser has no AAC encoder. An FLV holds the H.264 pictures and AAC sound, or 16-bit PCM
// at 44.1 kHz where the browser has no AAC encoder (/lib/flv.js). Browser only. Nothing is uploaded.
import { avi } from './avi.js';
import { flv, PCM_RATE } from './flv.js';
import { mp4, webm, webmWithDuration, avcCodecs, bitrateOf, evenSize } from './video-mux.js';
import { cut, speed as speedOf, gain as gainOf, merge, mix, resample } from './converter.js';
import { blend, KINDS as TRANSITION_KINDS, TRANSITIONS } from './transition.js';

const wait = (el, ev, ms = 30000) => new Promise((res, rej) => { const tm = setTimeout(() => rej(new Error('the video did not open in time.')), ms); el.addEventListener(ev, () => { clearTimeout(tm); res(); }, { once: true }); el.addEventListener('error', () => { clearTimeout(tm); rej(new Error('this browser cannot play this video, so Verse cannot read it.')); }, { once: true }); });
const supported = async (C, cfg) => { try { return !!(await C.isConfigSupported(cfg)).supported; } catch (_) { return false; } };
const NAME = { avc1: 'H.264', vp09: 'VP9', vp8: 'VP8', av01: 'AV1', 'mp4a.40.2': 'AAC', opus: 'Opus' };
const nameOf = (c) => NAME[c] || NAME[String(c).slice(0, 4)] || c;
const RATE = 48000; // Opus and AAC are coded at 48 kHz
const ISO = { mp4: 'mp4', mov: 'mp4', '3gp': '3gp', webm: 'webm', mkv: 'webm', avi: 'avi', flv: 'flv' }; // which writer: the ISO boxes (3GP: the same boxes, H.264 and AAC only), the Matroska elements, the RIFF chunks or the FLV tags
export const CONTAINERS = Object.keys(ISO);
export const canEncode = () => typeof VideoEncoder === 'function' && typeof VideoFrame === 'function';
const silence = (sec) => ({ rate: RATE, channels: [new Float32Array(Math.max(1, Math.round(sec * RATE)))], notes: [] });

/** the sound of a file at 48 kHz as { rate, channels, notes }, or null when it has none the browser can read */
export async function soundOf48(file) {
  const C = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!C) return null;
  try { const b = await new C(2, 1, RATE).decodeAudioData(await file.arrayBuffer()); return { rate: RATE, channels: Array.from({ length: b.numberOfChannels }, (_, k) => b.getChannelData(k)), notes: [] }; } catch (_) { return null; }
}

async function pickVideo(container, width, height, bitrate, fps) {
  const kind = ISO[container], iso = kind === 'mp4', h264only = kind === 'avi' || kind === 'flv' || kind === '3gp', list = h264only ? avcCodecs(width, height, fps) : iso ? [...avcCodecs(width, height, fps), 'vp09.00.41.08'] : ['vp09.00.41.08', 'vp8'];
  for (const codec of list) { const cfg = { codec, width, height, bitrate, framerate: fps, ...(codec.startsWith('avc1') ? { avc: { format: 'avc' } } : {}) }; if (await supported(VideoEncoder, cfg)) return cfg; }
  throw new Error('this browser cannot code ' + (h264only ? 'H.264 (an ' + container.toUpperCase() + ' from Verse holds H.264 only)' : iso ? 'H.264 or VP9' : 'VP9 or VP8') + ' video at ' + width + ' x ' + height + '.');
}
async function pickAudio(container, channels) {
  if (typeof AudioEncoder !== 'function') return null;
  for (const codec of ISO[container] === 'mp4' ? ['mp4a.40.2', 'opus'] : ISO[container] === '3gp' ? ['mp4a.40.2'] : ['opus']) { const cfg = { codec, sampleRate: RATE, numberOfChannels: channels, bitrate: 128000 }; if (await supported(AudioEncoder, cfg)) return cfg; }
  return null;
}

/** code a sound ({ rate: 48000, channels }) as AAC or Opus samples */
export async function encodeSound(s, cfg) {
  const out = []; let desc = null, error = null;
  const enc = new AudioEncoder({ output: (c, meta) => { const d = new Uint8Array(c.byteLength); c.copyTo(d); out.push({ data: d, t: c.timestamp, d: c.duration || 0, key: true }); if (meta && meta.decoderConfig && meta.decoderConfig.description) desc = new Uint8Array(meta.decoderConfig.description.buffer || meta.decoderConfig.description); }, error: (e) => { error = e; } });
  enc.configure(cfg);
  const ch = cfg.numberOfChannels, n = s.channels[0].length, planes = Array.from({ length: ch }, (_, k) => s.channels[Math.min(k, s.channels.length - 1)]);
  for (let at = 0; at < n; at += RATE) {
    const m = Math.min(RATE, n - at), data = new Float32Array(m * ch);
    for (let k = 0; k < ch; k++) data.set(planes[k].subarray(at, at + m), k * m);
    const ad = new AudioData({ format: 'f32-planar', sampleRate: RATE, numberOfFrames: m, numberOfChannels: ch, timestamp: Math.round(at / 48 * 1000), data });
    enc.encode(ad); ad.close();
    if (enc.encodeQueueSize > 20) await new Promise((r) => enc.addEventListener('dequeue', r, { once: true }));
  }
  await enc.flush(); enc.close(); if (error) throw error;
  return { codec: cfg.codec, rate: RATE, channels: ch, bitrate: cfg.bitrate, description: desc, samples: out };
}

// ---- the picture: where the source goes on the canvas, and what is drawn over it ---------------------------------------------------------
const fitIn = (sw, sh, W, H) => { const k = Math.min(W / sw, H / sh), w = sw * k, h = sh * k; return { x: (W - w) / 2, y: (H - h) / 2, w, h }; };
const cover = (sw, sh, W, H) => { const k = Math.max(W / sw, H / sh), w = sw * k, h = sh * k; return { x: (W - w) / 2, y: (H - h) / 2, w, h }; };
/** the output size: the first source's size, turned, then resized (opts.width; else opts.short, the most for the shorter side, as 720 in
 *  "720p"; else opts.maxSide), or the shape of a background (opts.shape) */
export function sizeOf(sw, sh, opts = {}) {
  const turned = opts.rotate === 90 || opts.rotate === 270, w = turned ? sh : sw, h = turned ? sw : sh;
  if (opts.shape) { const [a, b] = opts.shape, side = Math.max(w, h, 2); return evenSize(a >= b ? side : side * a / b, a >= b ? side * b / a : side, opts.maxSide || 1920); }
  if (opts.width) return evenSize(+opts.width, +opts.width * h / w);
  if (opts.short) { const k = Math.min(1, +opts.short / Math.min(w, h)); return evenSize(w * k, h * k); }
  return evenSize(w, h, opts.maxSide || 0);
}
/** draws one picture of a source (a video, a bitmap, a canvas) on x (W x H), with the edits of opts, at t seconds into the output */
export function drawFrame(x, src, sw, sh, W, H, opts, t) {
  x.save(); x.fillStyle = opts.color || '#000'; x.fillRect(0, 0, W, H);
  const turned = opts.rotate === 90 || opts.rotate === 270, r = fitIn(turned ? sh : sw, turned ? sw : sh, W, H);
  if (opts.shape && opts.backdrop === 'blur') { const c = cover(turned ? sh : sw, turned ? sw : sh, W, H); x.filter = 'blur(' + Math.round(W / 30) + 'px) brightness(0.7)'; place(x, src, c, opts.rotate); x.filter = 'none'; }
  if (opts.shape && opts.backdrop === 'picture' && opts.backdropPic) { const p = opts.backdropPic, c = cover(p.width, p.height, W, H); x.drawImage(p, c.x, c.y, c.w, c.h); }
  const f = [opts.blur ? 'blur(' + (opts.blur * W / 1000).toFixed(1) + 'px)' : '', opts.bright && opts.bright !== 100 ? 'brightness(' + opts.bright + '%)' : ''].filter(Boolean).join(' ');
  if (f) x.filter = f; place(x, src, r, opts.rotate); x.filter = 'none';
  for (const o of opts.over || []) over(x, W, H, o, t);
  x.restore();
}
function place(x, src, r, rot = 0) {
  x.save(); x.translate(r.x + r.w / 2, r.y + r.h / 2); x.rotate((rot || 0) * Math.PI / 180);
  const turned = rot === 90 || rot === 270, w = turned ? r.h : r.w, h = turned ? r.w : r.h; x.drawImage(src, -w / 2, -h / 2, w, h); x.restore();
}
// a text or a picture over the video: o = { text | pic, x, y (0-100, where its centre goes) or corner ('tl', 'tr', 'bl', 'br': 3% in from the
// edges), size (% of the width: the picture's width, the text's height), color, alpha (0-1), from, to (seconds; empty: all of it) }
function over(x, W, H, o, t) {
  if ((o.from != null && t < o.from) || (o.to != null && t > o.to)) return;
  x.save(); x.globalAlpha = o.alpha == null ? 1 : o.alpha;
  const px = Math.max(8, Math.round(W * (o.size || 6) / 100)), lines = o.pic ? [] : String(o.text || '').split('\n');
  if (!o.pic) { x.font = '600 ' + px + 'px system-ui, -apple-system, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; }
  const bw = o.pic ? W * (o.size || 25) / 100 : Math.min(W * 0.94, Math.max(...lines.map((l) => x.measureText(l).width), 1)), bh = o.pic ? bw * o.pic.height / o.pic.width : lines.length * px * 1.2;
  let cx = W * (o.x == null ? 50 : o.x) / 100, cy = H * (o.y == null ? 50 : o.y) / 100;
  if (o.corner) { const m = Math.round(Math.min(W, H) * 0.03); cx = o.corner[1] === 'l' ? m + bw / 2 : W - m - bw / 2; cy = o.corner[0] === 't' ? m + bh / 2 : H - m - bh / 2; }
  if (o.pic) x.drawImage(o.pic, cx - bw / 2, cy - bh / 2, bw, bh);
  else {
    x.lineJoin = 'round'; x.lineWidth = Math.max(2, px / 8); x.strokeStyle = 'rgba(0,0,0,.75)'; x.fillStyle = o.color || '#fff';
    lines.forEach((l, i) => { const y = cy + (i - (lines.length - 1) / 2) * px * 1.2; x.strokeText(l, cx, y, W * 0.94); x.fillText(l, cx, y, W * 0.94); });
  }
  x.restore();
}
// the same drawing for a still picture (the converter's Watermark Image)
export { over as drawOver };

// ---- the encoder --------------------------------------------------------------------------------------------------------------------------
async function encoder(container, W, H, quality, fps) {
  const cfg = await pickVideo(container, W, H, bitrateOf(W, H, fps, quality), fps), frames = []; let desc = null, error = null, lastKey = -Infinity;
  const enc = new VideoEncoder({ output: (c, meta) => { const d = new Uint8Array(c.byteLength); c.copyTo(d); frames.push({ data: d, t: c.timestamp, d: c.duration || 0, key: c.type === 'key' }); if (meta && meta.decoderConfig && meta.decoderConfig.description) desc = new Uint8Array(meta.decoderConfig.description.buffer || meta.decoderConfig.description); }, error: (e) => { error = e; } });
  enc.configure({ ...cfg, latencyMode: 'quality' });
  const cv = new OffscreenCanvas(W, H), x = cv.getContext('2d');
  return {
    cfg, x, enc, get error() { return error; },
    // code what is on the canvas at ts microseconds; a key frame every 2 s
    push(ts) { if (error) throw error; const key = ts - lastKey >= 2e6; if (key) lastKey = ts; const f = new VideoFrame(cv, { timestamp: ts }); enc.encode(f, { keyFrame: key }); f.close(); },
    async done() {
      await enc.flush(); enc.close(); if (error) throw error;
      if (!frames.length) throw new Error('no picture came out of this video.');
      frames.sort((a, b) => a.t - b.t); const n = frames.length, rate = n > 1 ? (n - 1) / ((frames[n - 1].t - frames[0].t) / 1e6) : fps;
      for (let i = 0; i < n - 1; i++) frames[i].d = frames[i + 1].t - frames[i].t; frames[n - 1].d = Math.round(1e6 / (rate || fps));
      return { video: { codec: cfg.codec, width: W, height: H, description: desc, samples: frames }, rate };
    },
  };
}
// the sound and the file, and the notes on both
async function finish(container, E, sound, extraNotes, say) {
  const { video, rate } = await E.done(), secs = (video.samples[video.samples.length - 1].t + video.samples[video.samples.length - 1].d) / 1e6;
  if (ISO[container] === 'avi') {
    say(0.995); const a = avi(video, rate, sound), ch = sound ? Math.min(2, sound.channels.length) : 0;
    const notes = [video.width + ' x ' + video.height + ' pixels', secs.toFixed(2) + ' s', a.pictures + ' pictures (' + a.rate.toFixed(1) + ' a second, the fixed rate an AVI has' + (a.gaps ? '; ' + a.gaps + ' held a picture for one more slot' : '') + ')', 'H.264 video', sound ? '16-bit PCM sound (' + (ch === 1 ? 'mono' : 'stereo') + ', 48 kHz), which every AVI player reads' : 'no sound'];
    return { bytes: a.bytes, notes: [...notes, ...extraNotes], width: video.width, height: video.height, seconds: secs, frames: a.pictures };
  }
  if (ISO[container] === 'flv') {
    // AAC where the browser codes it (FLV holds no Opus), else 16-bit PCM at 44.1 kHz, the highest rate FLV names for PCM
    const ch = sound ? Math.min(2, sound.channels.length) : 0, cfg = { codec: 'mp4a.40.2', sampleRate: RATE, numberOfChannels: ch, bitrate: 128000 };
    say(0.995); let aac = null;
    if (sound && typeof AudioEncoder === 'function' && await supported(AudioEncoder, cfg)) { const a = await encodeSound(sound, cfg); if (a.description && a.samples.length) aac = a; }
    const f = flv(video, rate, aac, sound && !aac ? resample(sound, PCM_RATE) : null);
    const notes = [video.width + ' x ' + video.height + ' pixels', secs.toFixed(2) + ' s', video.samples.length + ' pictures (' + rate.toFixed(1) + ' a second)', 'H.264 video',
      f.sound === 'aac' ? 'AAC sound' : f.sound === 'pcm' ? '16-bit PCM sound (' + (ch === 1 ? 'mono' : 'stereo') + ', 44.1 kHz): this browser cannot write AAC, and an FLV holds no Opus' : 'no sound'];
    return { bytes: f.bytes, notes: [...notes, ...extraNotes], width: video.width, height: video.height, seconds: secs, frames: video.samples.length };
  }
  const acfg = sound ? await pickAudio(container, Math.min(2, sound.channels.length)) : null;
  say(0.995); const audio = acfg ? await encodeSound(sound, acfg) : null;
  const bytes = ISO[container] === 'mp4' || ISO[container] === '3gp' ? mp4(video, audio, { qt: container === 'mov', gp: container === '3gp' }) : webm(video, audio, { mkv: container === 'mkv' });
  const notes = [video.width + ' x ' + video.height + ' pixels', secs.toFixed(2) + ' s', video.samples.length + ' pictures (' + rate.toFixed(1) + ' a second)', nameOf(video.codec) + ' video'];
  notes.push(audio ? nameOf(acfg.codec) + ' sound' + (ISO[container] === 'mp4' && acfg.codec === 'opus' ? ' (this browser cannot write AAC; most players play Opus' + (container === 'mov' ? ', QuickTime Player does not' : '') + ')' : '') : sound ? (container === '3gp' ? 'no sound: this browser cannot write AAC, the only sound a 3GP from Verse holds' : 'no sound: this browser cannot code sound') : 'no sound');
  return { bytes, notes: [...notes, ...extraNotes], width: video.width, height: video.height, seconds: secs, frames: video.samples.length };
}

// the slowest speed a browser plays a video at
const SLOWEST = 0.0625;

/** the length of one picture of a paused video near `at`, in seconds, read from the frame times the browser shows after a seek: the first
 *  frame, then small steps on until the next one. A still picture, or a browser that shows no frame while paused, gives 1/30. */
async function frameStep(v, at) {
  const shown = (t) => new Promise((res) => {
    let done = false; const tm = setTimeout(() => { if (!done) { done = true; res(null); } }, 1500);
    v.requestVideoFrameCallback((_, meta) => { if (!done) { done = true; clearTimeout(tm); res(meta.mediaTime); } });
    v.currentTime = Math.abs(v.currentTime - t) < 1e-6 ? t + 1e-4 : t;
  });
  const m0 = await shown(at); if (m0 == null) return { step: 1 / 30 };
  for (let k = 1; k <= 30; k++) { const m = await shown(m0 + k / 240); if (m == null) break; if (m > m0 + 1e-6) return { step: m - m0 }; }
  return { step: 1 / 30 };
}

// shows the picture of a paused video at t seconds (at most its last picture): done when the seek is over and the browser drew the picture,
// or a moment after the seek when the picture there is the one already drawn
function showAt(v, t) {
  const at = Math.max(0, Math.min(t, (isFinite(v.duration) ? v.duration : t) - 1e-3));
  return new Promise((res) => {
    let seeked = false, drawn = typeof v.requestVideoFrameCallback !== 'function', late = 0; const tm = setTimeout(res, 3000);
    const go = () => { if (seeked && drawn) { clearTimeout(tm); clearTimeout(late); res(); } };
    if (!drawn) v.requestVideoFrameCallback(() => { drawn = true; go(); });
    v.addEventListener('seeked', () => { seeked = true; go(); late = setTimeout(() => { drawn = true; go(); }, 150); }, { once: true });
    v.currentTime = Math.abs(v.currentTime - at) < 1e-6 ? at + 1e-4 : at;
  });
}
// the sound comes in over its first inS seconds and goes out over its last outS seconds
function fadeEdges(s, inS, outS) {
  const n = s.channels[0].length, a = Math.min(n, Math.round(inS * s.rate)), b = Math.min(n, Math.round(outS * s.rate));
  return { rate: s.rate, notes: s.notes || [], channels: s.channels.map((c) => { const o = Float32Array.from(c); for (let j = 0; j < a; j++) o[j] *= (j + 0.5) / a; for (let j = 0; j < b; j++) o[n - 1 - j] *= (j + 0.5) / b; return o; }) };
}

/** play one or more videos once, one after another, and code every picture shown, edited by opts. files: a File or a list of them (a merge).
 *  opts: { container: 'mp4' | 'mov' | '3gp' | 'webm' | 'mkv' | 'avi' | 'flv', quality, maxSide, width, rotate (0, 90, 180, 270), speed (0.25-4), from, to (seconds),
 *  blur, bright, shape ([w, h]), backdrop ('color' | 'blur' | 'picture'), backdropPic, color, over (texts and pictures), sound ('keep' |
 *  'none'), addSound ({ rate, channels }), addMode ('replace' | 'mix'), gainDb, shift (seconds the sound moves, minus: earlier),
 *  transition ({ kind (lib/transition.js), seconds (1-10), mode: 'join' (between the videos) | 'start' | 'end' | 'both' (from or to a plain
 *  colour) }), onProgress }.
 *  Returns { bytes, notes, width, height, seconds, frames }. */
export async function writeVideo(files, opts = {}) {
  const list = Array.isArray(files) ? files : [files], container = CONTAINERS.includes(opts.container) ? opts.container : 'mp4', say = opts.onProgress || (() => {});
  const rate = Math.max(0.25, Math.min(4, +opts.speed || 1)), vids = [], notes = [];
  const tr = opts.transition && TRANSITION_KINDS.includes(opts.transition.kind) ? { kind: opts.transition.kind, mode: ['start', 'end', 'both'].includes(opts.transition.mode) ? opts.transition.mode : 'join', seconds: Math.max(1, Math.min(10, +opts.transition.seconds || 3)) } : null;
  const trName = tr ? TRANSITIONS.find((t) => t[0] === tr.kind)[1] : '';
  if (opts.transition && !tr) throw new Error('no transition called ' + opts.transition.kind + '.');
  if (tr && tr.mode === 'join' && list.length < 2) throw new Error('a transition between videos needs 2 or more videos. For one video, pick a start or end transition.');
  try {
    for (const f of list) { const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = URL.createObjectURL(f); vids.push(v); await wait(v, 'loadeddata'); if (!v.videoWidth) throw new Error((list.length > 1 ? f.name + ': ' : '') + 'this file has no picture: it is a sound. Pick a video.'); }
    const plain = rate === 1 && !opts.from && opts.to == null && !opts.rotate && !opts.width && !opts.shape && !opts.blur && !(opts.bright && opts.bright !== 100) && !(opts.over || []).length && list.length === 1 && opts.sound !== 'none' && !opts.addSound && !opts.gainDb && !opts.shift && !tr;
    if (!canEncode()) { if (plain && ISO[container] === 'webm') return await record(vids[0], container, say); throw new Error('this browser has no video encoder (WebCodecs), so Verse cannot ' + (plain ? 'write ' + container.toUpperCase() : 'edit video') + ' here. Chrome, Edge and Safari 17 or later have one.'); }
    const { width: W, height: H } = sizeOf(vids[0].videoWidth, vids[0].videoHeight, opts), E = await encoder(container, W, H, opts.quality, 30);
    const durs = vids.map((v) => (isFinite(v.duration) ? v.duration : 0)), from = Math.max(0, +opts.from || 0);
    const ends = durs.map((d) => (opts.to != null && opts.to !== '' && isFinite(+opts.to) ? Math.min(d || Infinity, +opts.to) : d));
    if (from && ends[0] && from >= ends[0]) throw new Error('the start (' + from + ' s) is after the end of the video (' + ends[0].toFixed(2) + ' s).');
    const starts = vids.map((_, i) => (i ? 0 : from)), lens = ends.map((e, i) => Math.max(0, (e || 0) - starts[i]));
    // the transitions, in seconds of the source: x[i] joins video i to video i + 1. Each is kept shorter than the videos it joins, so that a
    // video in the middle still has its own picture between its two transitions; a video of no known length gets none, and that is said
    const x = vids.map(() => 0), want = tr ? tr.seconds * rate : 0;
    if (tr && tr.mode === 'join') for (let i = 0; i < vids.length - 1; i++) {
      if (!durs[i] || !durs[i + 1]) { notes.push('no transition after ' + list[i].name + ': this browser gives no length for ' + (durs[i] ? list[i + 1].name : list[i].name)); continue; }
      x[i] = Math.min(want, Math.max(0, lens[i] - (i ? x[i - 1] : 0) - 1 / 30), i + 1 < vids.length - 1 ? lens[i + 1] / 2 : lens[i + 1]);
      if (x[i] < want - 1e-6) notes.push('the transition after ' + list[i].name + ' is ' + (x[i] / rate).toFixed(2) + ' s, as long as the shorter video allows');
    }
    const total = (lens.reduce((a, l) => a + l, 0) - x.reduce((a, v) => a + v, 0)) / rate || 1;
    // a transition from or to a plain colour (one video): its length in seconds of the output, and the colour picture
    let edge = 0, flat = null;
    if (tr && tr.mode !== 'join') {
      if (!lens.reduce((a, l) => a + l, 0)) throw new Error('this browser gives no length for this video, so Verse cannot tell where its end is for the transition.');
      edge = Math.min(tr.seconds, tr.mode === 'both' ? total / 2 : total);
      if (edge < tr.seconds - 1e-6) notes.push('the transition is ' + edge.toFixed(2) + ' s, as long as this ' + total.toFixed(2) + ' s video allows');
      const c = new OffscreenCanvas(W, H).getContext('2d'); c.fillStyle = opts.color || '#000'; c.fillRect(0, 0, W, H); flat = c.getImageData(0, 0, W, H).data;
    }
    const mixed = tr ? new ImageData(W, H) : null;
    // puts on the canvas the transition picture between a and b (RGBA) at progress p (1: all a, 0: all b)
    const blendOnto = (a, b, p) => { blend(tr.kind, a, b, mixed.data, W, H, p); E.x.putImageData(mixed, 0, 0); };
    const sides = tr && tr.mode === 'join' ? [0, 1].map(() => new OffscreenCanvas(W, H).getContext('2d', { willReadFrequently: true })) : null;
    let offset = 0, skipped = 0; const kept = [];
    for (let i = 0; i < vids.length; i++) {
      // this video plays from after the transition into it to the start of the transition out of it
      const v = vids[i], a = starts[i] + (i ? x[i - 1] : 0), z = (ends[i] || Infinity) - x[i], { step } = await frameStep(v, a), start = offset;
      v.playbackRate = rate;
      let last = -1, lastTs = offset;
      await new Promise((resolve, reject) => {
        let over = false, held = 0; const stop = () => { if (!over) { over = true; clearTimeout(held); v.pause(); resolve(); } };
        // after a seek, the video plays only once the callback has drawn the picture the seek shows: a video that plays on 'seeked' can
        // move on before the callback runs, and the canvas then gets a later picture under the earlier time. A browser that shows no
        // picture after a seek plays after 3 s.
        const play = () => { if (held) { clearTimeout(held); held = 0; } if (!over) v.play().catch(reject); };
        const seekThenPlay = (t) => { v.requestVideoFrameCallback(onFrame); v.currentTime = t; held = setTimeout(play, 3000); };
        const onFrame = async (_, meta) => {
          try {
            if (over) return; const mt = meta.mediaTime;
            if (mt >= z) return stop();
            // pictures went by with no drawing: this device draws slower than the video plays. Go back to the last picture drawn and play
            // slower, so that every picture is drawn (the times come from the video, not the clock, so the result is the same, only slower)
            const ref = last >= 0 ? last : a - step, gap = mt > ref + step * 1.5; // before the first picture, the one at the start is due
            if (gap && v.playbackRate > SLOWEST) {
              v.pause(); v.playbackRate = Math.max(SLOWEST, v.playbackRate / 4); seekThenPlay(last >= 0 ? last + step / 2 : a); return;
            }
            if (gap) skipped += Math.max(0, Math.round((mt - ref) / step) - 1); // already at the slowest speed: the loss is counted and said
            if (mt > last) {
              last = mt; lastTs = offset + Math.max(0, (mt - a) / rate) * 1e6; const t = lastTs / 1e6;
              drawFrame(E.x, v, v.videoWidth, v.videoHeight, W, H, opts, t);
              // the start comes in from the colour; the end goes out to it
              if (edge && tr.mode !== 'end' && t < edge) blendOnto(flat, E.x.getImageData(0, 0, W, H).data, 1 - t / edge);
              else if (edge && tr.mode !== 'start' && t > total - edge) blendOnto(E.x.getImageData(0, 0, W, H).data, flat, 1 - (t - (total - edge)) / edge);
              E.push(Math.round(lastTs)); say(Math.min(0.99, t / total));
            }
            if (!v.ended) v.requestVideoFrameCallback(onFrame);
            if (held) play();
            // the encoder is behind: hold the video until it catches up, so no picture is dropped
            if (E.enc.encodeQueueSize > 4 && !v.ended) { v.pause(); while (E.enc.encodeQueueSize > 1) await new Promise((r) => E.enc.addEventListener('dequeue', r, { once: true })); if (!over) await v.play(); }
          } catch (e) { reject(e); }
        };
        v.addEventListener('ended', stop, { once: true });
        // from the start: the seek shows the first picture to the callback, then the video plays
        if (Math.abs(v.currentTime - a) > 1e-6) seekThenPlay(a); else { v.requestVideoFrameCallback(onFrame); play(); }
      });
      const end = Math.min(z, durs[i] || z), len = isFinite(end) ? Math.max(0, (end - a) / rate) : 0, shown = Math.max(len, (lastTs - offset) / 1e6 + 1 / 30); offset += shown * 1e6;
      // the transition into the next video: both are stepped to each picture's time and drawn, then the two pictures are blended
      if (x[i]) {
        const b = vids[i + 1], secs = x[i] / rate, n = Math.max(1, Math.round(secs * 30));
        v.pause(); b.pause();
        for (let k = 0; k < n; k++) {
          // each side is shown 1 ms after the picture's time: a time on a picture's edge, such as 2 + 3/30, can come out just before it
          const t = offset / 1e6 + k / 30, pics = [];
          for (const [s, side, at] of [[v, sides[0], end + k / 30 * rate], [b, sides[1], starts[i + 1] + k / 30 * rate]]) {
            await showAt(s, at + 1e-3); drawFrame(side, s, s.videoWidth, s.videoHeight, W, H, opts, t); pics.push(side.getImageData(0, 0, W, H).data);
          }
          blendOnto(pics[0], pics[1], 1 - k / n); E.push(Math.round(t * 1e6)); say(Math.min(0.99, t / total));
          if (E.enc.encodeQueueSize > 4) while (E.enc.encodeQueueSize > 1) await new Promise((r) => E.enc.addEventListener('dequeue', r, { once: true }));
        }
        offset += secs * 1e6;
      }
      // the sound of this video is all of it: the parts in the transitions overlap the next video's, so they are crossfaded
      kept.push({ a: starts[i], z: Math.min(ends[i] || Infinity, durs[i] || Infinity), len: lens[i] ? lens[i] / rate : (offset - start) / 1e6 });
    }
    if (tr && tr.mode === 'join' && x.some(Boolean)) notes.push('the ' + trName + ' transition between the videos' + (x.every((v, i) => i === x.length - 1 || v >= want - 1e-6) ? ', ' + tr.seconds + ' s' : ''));
    if (edge) notes.push('the ' + trName + ' transition ' + { start: 'into the video', end: 'out of the video', both: 'into and out of the video' }[tr.mode] + ' from ' + (opts.color || 'black') + ', ' + edge.toFixed(2).replace(/\.?0+$/, '') + ' s');
    // the sound: each file's, cut and sped up as the pictures were, one after another (a file with none is silent for its part); then the edits
    let sound = null;
    if (opts.sound !== 'none') {
      const own = []; for (const f of list) own.push(await soundOf48(f));
      if (own.some(Boolean)) {
        const parts = own.map((s, i) => { const { a, z, len } = kept[i]; let p = s ? cut(s, a, z) : silence(len * rate); if (rate !== 1) p = speedOf(p, rate); return p; });
        if (x.some(Boolean)) { sound = parts[0]; for (let i = 1; i < parts.length; i++) sound = merge([sound, parts[i]], x[i - 1] / rate); }
        else sound = parts.length > 1 ? merge(parts) : parts[0];
        if (rate !== 1) notes.push('the sound is ' + rate + ' times as fast too, so its pitch moves, as a tape does');
        if (edge) { sound = fadeEdges(sound, tr.mode !== 'end' ? edge : 0, tr.mode !== 'start' ? edge : 0); notes.push('the sound fades ' + { start: 'in', end: 'out', both: 'in and out' }[tr.mode] + ' with the picture'); }
      }
    }
    if (opts.addSound) {
      const len = offset / 1e6, add = cut(opts.addSound, 0, len);
      if (opts.addMode === 'mix' && sound) { sound = mix([sound, add]); notes.push('the new sound mixed with the video\'s own' + (sound.notes[1] && /turned down/.test(sound.notes[1]) ? ', ' + sound.notes[1] : '')); }
      else { sound = add; notes.push(opts.sound === 'none' || opts.addMode !== 'mix' ? 'the video\'s own sound replaced by the new one' : 'the new sound (the video had none)'); }
      const n = add.channels[0].length / RATE; if (n < len - 0.05) notes.push('the new sound is ' + n.toFixed(2) + ' s, shorter than the video: the rest is silent'); else if (opts.addSound.channels[0].length / RATE > len + 0.05) notes.push('the new sound is cut to the video\'s ' + len.toFixed(2) + ' s');
    }
    if (!sound && (opts.gainDb || opts.shift)) notes.push('this video has no sound, so there was no sound to ' + (opts.gainDb ? 'make louder' : 'move'));
    if (sound && opts.gainDb) { sound = gainOf(sound, +opts.gainDb); notes.push(...sound.notes); }
    if (sound && opts.shift) {
      const k = Math.round(Math.abs(+opts.shift) * RATE), n = sound.channels[0].length;
      sound = { rate: RATE, channels: sound.channels.map((c) => { const o = new Float32Array(n); if (+opts.shift > 0) o.set(c.subarray(0, Math.max(0, n - k)), Math.min(n, k)); else o.set(c.subarray(Math.min(n, k))); return o; }), notes: [] };
      notes.push('the sound moved ' + Math.abs(+opts.shift) + ' s ' + (+opts.shift > 0 ? 'later' : 'earlier'));
    }
    if (opts.sound === 'none' && !opts.addSound) notes.push('the sound taken out');
    if (skipped) notes.push(skipped + ' picture' + (skipped === 1 ? '' : 's') + ' of the video went by before this device could draw ' + (skipped === 1 ? 'it' : 'them') + ', so ' + (skipped === 1 ? 'it is' : 'they are') + ' not in the new video');
    return await finish(container, E, sound, notes, say);
  } finally { for (const v of vids) { v.pause(); URL.revokeObjectURL(v.src); v.removeAttribute('src'); v.load(); } }
}

/** a video from pictures with no playing: each picture { pic (a bitmap or a canvas), d (seconds) } shown for its time, at fps pictures a
 *  second, with an optional sound ({ rate, channels }, cut or padded with silence to the pictures' length when opts.fitSound is 'pictures';
 *  with opts.fitSound 'sound' the last picture is held to the end of the sound). Returns what writeVideo returns. */
export async function writeStill(pictures, opts = {}) {
  if (!canEncode()) throw new Error('this browser has no video encoder (WebCodecs), so Verse cannot make a video here. Chrome, Edge and Safari 17 or later have one.');
  if (!pictures.length) throw new Error('no picture to make a video of.');
  const container = CONTAINERS.includes(opts.container) ? opts.container : 'mp4', say = opts.onProgress || (() => {}), fps = opts.fps || 30, p0 = pictures[0].pic;
  const { width: W, height: H } = sizeOf(p0.width, p0.height, { maxSide: opts.maxSide || 1920, ...opts, rotate: 0 }), E = await encoder(container, W, H, opts.quality, fps);
  let sound = opts.sound || null; const notes = [];
  let total = pictures.reduce((a, p) => a + p.d, 0);
  if (sound && opts.fitSound === 'sound') { const len = sound.channels[0].length / RATE; if (len > total) pictures[pictures.length - 1].d += len - total; total = Math.max(total, len); }
  const n = Math.max(1, Math.round(total * fps)); let at = 0, i = 0, until = pictures[0].d;
  for (let k = 0; k < n; k++) {
    const t = k / fps; while (t >= until && i < pictures.length - 1) { i++; until += pictures[i].d; }
    if (k === 0 || i !== at || (opts.over || []).some((o) => o.from != null || o.to != null)) { drawFrame(E.x, pictures[i].pic, pictures[i].pic.width, pictures[i].pic.height, W, H, opts, t); at = i; }
    E.push(Math.round(t * 1e6)); say(Math.min(0.99, (k + 1) / n));
    if (E.enc.encodeQueueSize > 8) await new Promise((r) => E.enc.addEventListener('dequeue', r, { once: true }));
  }
  if (sound) { const len = sound.channels[0].length / RATE; sound = cut(sound, 0, total); if (len < total - 0.05) { const pad = new Float32Array(Math.round(total * RATE)); sound = { rate: RATE, channels: sound.channels.map((c) => { const o = pad.slice(); o.set(c); return o; }), notes: [] }; notes.push('the sound is ' + len.toFixed(2) + ' s, shorter than the pictures: the rest is silent'); } else if (len > total + 0.05) notes.push('the sound is cut to the pictures\' ' + total.toFixed(2) + ' s'); }
  return finish(container, E, sound, notes, say);
}

// ---- two videos at once: side by side, or one above the other -----------------------------------------------------------------------------
/** every picture a playing video shows, in order, from its start: the video plays muted and each picture is kept as a VideoFrame with its
 *  time until it is taken. The video waits while 6 pictures are not taken yet. A picture that goes by with no callback makes the video play
 *  slower and go back, as in writeVideo; at the slowest speed the loss is counted. step: the length of one picture, in seconds. */
function pictures(v, step) {
  const q = []; let last = -1, ended = false, stopped = false, error = null, wake = null, held = 0, waiting = false, handle = 0;
  const nudge = () => { if (wake) { const w = wake; wake = null; w(); } };
  const play = () => { if (held) { clearTimeout(held); held = 0; } if (!stopped) v.play().catch((e) => { error = e; nudge(); }); };
  const watch = () => { handle = v.requestVideoFrameCallback(onFrame); };
  const seekThenPlay = (t) => { watch(); v.currentTime = t; held = setTimeout(play, 3000); };
  const src = { skipped: 0 };
  function onFrame(_, meta) {
    if (stopped) return; const mt = meta.mediaTime;
    if (last >= 0 && mt > last + step * 1.5) {
      if (v.playbackRate > SLOWEST) { v.pause(); v.playbackRate = Math.max(SLOWEST, v.playbackRate / 4); seekThenPlay(last + step / 2); return; }
      src.skipped += Math.max(0, Math.round((mt - last) / step) - 1);
    }
    if (mt > last) { last = mt; q.push({ t: mt, f: new VideoFrame(v, { timestamp: Math.round(mt * 1e6) }) }); nudge(); }
    if (held) play();
    if (q.length >= 6 && !v.paused) { v.pause(); waiting = true; }
    if (!v.ended) watch();
  }
  v.addEventListener('ended', () => { ended = true; nudge(); }, { once: true });
  v.playbackRate = 1;
  if (Math.abs(v.currentTime) > 1e-6) seekThenPlay(0); else { watch(); play(); }
  /** the next picture without taking it, or null at the end */
  src.peek = async () => { while (!q.length) { if (error) throw error; if (ended || stopped) return null; if (waiting) { waiting = false; play(); } await new Promise((r) => { wake = r; }); } return q[0]; };
  src.take = () => { const x = q.shift(); if (waiting && q.length <= 2) { waiting = false; play(); } return x; };
  src.stop = () => { stopped = true; clearTimeout(held); if (handle && v.cancelVideoFrameCallback) v.cancelVideoFrameCallback(handle); v.pause(); for (const x of q.splice(0)) x.f.close(); nudge(); };
  return src;
}

const PLACE = { lr: ['on the left', 'on the right'], tb: ['at the top', 'at the bottom'] };
/** two videos played at the same time, side by side (layout 'lr') or one above the other ('tb'), as one video. The second is scaled to the
 *  height (lr) or width (tb) of the first. opts.length: 'longest' (the shorter video plays again from its start), '1-loop', '2-loop' (as long
 *  as video 1 or 2; the other plays again), '1-hold', '2-hold' (as long as video 1 or 2; the other plays once and then holds its last
 *  picture, its sound silent). opts.sound: 'mix' | '1' | '2'. With container, quality, onProgress as writeVideo. Returns what writeVideo
 *  returns. */
export async function writeSplit(files, opts = {}) {
  if (!files || files.length !== 2) throw new Error('a split screen video needs 2 videos.');
  const container = CONTAINERS.includes(opts.container) ? opts.container : 'mp4', say = opts.onProgress || (() => {}), layout = opts.layout === 'tb' ? 'tb' : 'lr';
  const length = ['longest', '1-loop', '2-loop', '1-hold', '2-hold'].includes(opts.length) ? opts.length : 'longest', soundOpt = ['mix', '1', '2'].includes(String(opts.sound)) ? String(opts.sound) : 'mix';
  if (!canEncode()) throw new Error('this browser has no video encoder (WebCodecs), so Verse cannot make a split screen video here. Chrome, Edge and Safari 17 or later have one.');
  const vids = [], sides = [], notes = [];
  try {
    for (const f of files) { const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = URL.createObjectURL(f); vids.push(v); await wait(v, 'loadeddata'); if (!v.videoWidth) throw new Error(f.name + ': this file has no picture: it is a sound. Pick a video.'); }
    const d = vids.map((v, i) => { if (!isFinite(v.duration) || !(v.duration > 0)) throw new Error(files[i].name + ': this browser gives no length for this video, so Verse cannot line the two up.'); return v.duration; });
    const total = length === 'longest' ? Math.max(...d) : d[+length[0] - 1], loops = Array(2).fill(!length.endsWith('hold')); // the side that sets the length never reaches its end
    // the size: video 1 as it is, video 2 scaled to its height (side by side) or width (one above the other); then all of it made smaller if
    // the encoder cannot take it so large
    const [w1, h1] = [vids[0].videoWidth, vids[0].videoHeight], [w2, h2] = [vids[1].videoWidth, vids[1].videoHeight];
    const a = layout === 'lr' ? [w1, h1, w2 * h1 / h2, h1] : [w1, h1, w1, h2 * w1 / w2], fullW = layout === 'lr' ? a[0] + a[2] : a[0], fullH = layout === 'lr' ? a[1] : a[1] + a[3];
    let E = null, W = 0, H = 0, err = null;
    for (const cap of [3840, 2560, 1920]) { ({ width: W, height: H } = evenSize(fullW, fullH, cap)); try { E = await encoder(container, W, H, opts.quality, 30); break; } catch (e) { err = e; } }
    if (!E) throw err;
    const k = layout === 'lr' ? H / a[1] : W / a[0], first = Math.round((layout === 'lr' ? a[0] : a[1]) * k);
    const cells = layout === 'lr' ? [[0, 0, first, H], [first, 0, W - first, H]] : [[0, 0, W, first], [0, first, W, H - first]];
    for (let i = 0; i < 2; i++) {
      const v = vids[i], { step } = await frameStep(v, 0), cell = new OffscreenCanvas(cells[i][2], cells[i][3]).getContext('2d');
      cell.fillStyle = '#000'; cell.fillRect(0, 0, cells[i][2], cells[i][3]);
      sides.push({ v, step, d: d[i], loop: loops[i], base: 0, shown: false, cell, src: pictures(v, step), skipped: 0 });
    }
    // the pictures due by `local` seconds into this play of the video are taken, and the last of them is drawn in the side's place
    const upTo = async (s, local) => {
      let got = null;
      for (;;) { const nx = await s.src.peek(); if (!nx || (s.shown && nx.t > local + 1e-4)) break; if (got) got.f.close(); got = s.src.take(); s.shown = true; }
      if (got) { s.cell.drawImage(got.f, 0, 0, s.cell.canvas.width, s.cell.canvas.height); got.f.close(); }
    };
    const n = Math.max(1, Math.round(total * 30));
    for (let j = 0; j < n; j++) {
      const t = j / 30;
      for (const s of sides) {
        let local = t - s.base;
        // the end of a looping video: it plays again from its start
        if (s.loop && local >= s.d - 1e-6) { s.skipped += s.src.skipped; s.src.stop(); s.base += s.d; local -= s.d; s.shown = false; s.src = pictures(s.v, s.step); }
        await upTo(s, local);
      }
      sides.forEach((s, i) => E.x.drawImage(s.cell.canvas, cells[i][0], cells[i][1]));
      E.push(Math.round(t * 1e6)); say(Math.min(0.99, (j + 1) / n));
      if (E.enc.encodeQueueSize > 4) while (E.enc.encodeQueueSize > 1) await new Promise((r) => E.enc.addEventListener('dequeue', r, { once: true }));
    }
    const fmt = (x) => x.toFixed(2) + ' s';
    notes.push(files[0].name + ' ' + PLACE[layout][0] + ', ' + files[1].name + ' ' + PLACE[layout][1] + (layout === 'lr' ? ', at the height of the first' : ', at the width of the first') + (W < fullW - 2 || H < fullH - 2 ? ', both made smaller to ' + W + ' x ' + H : ''));
    const other = length === 'longest' ? (d[0] >= d[1] ? 1 : 0) : +length[0] === 1 ? 1 : 0;
    if (length === 'longest') notes.push(d[0] === d[1] ? 'both ' + fmt(d[0]) + ' long' : 'as long as the longer video (' + fmt(total) + '); ' + files[other].name + ' (' + fmt(d[other]) + ') plays again from its start');
    else if (d[other] < total - 1e-3) notes.push('as long as ' + files[1 - other].name + ' (' + fmt(total) + '); ' + files[other].name + ' (' + fmt(d[other]) + ') ' + (loops[other] ? 'plays again from its start' : 'plays once, then holds its last picture and its sound stops'));
    else notes.push('as long as ' + files[1 - other].name + ' (' + fmt(total) + '); ' + files[other].name + ' (' + fmt(d[other]) + ') is cut there');
    // the sound: each video's, played again or ended as its pictures are, then mixed or one picked
    const N = Math.max(1, Math.round(total * RATE)), track = async (i) => {
      const s = await soundOf48(files[i]); if (!s) return null;
      const P = Math.max(1, Math.round(d[i] * RATE));
      return { rate: RATE, notes: [], channels: s.channels.map((c) => { const o = new Float32Array(N); for (let at = 0; at < N; at += P) { if (at && !loops[i]) break; o.set(c.subarray(0, Math.min(c.length, P, N - at)), at); } return o; }) };
    };
    const want = soundOpt === 'mix' ? [0, 1] : [+soundOpt - 1], got = []; for (const i of want) got.push([i, await track(i)]);
    const have = got.filter((x) => x[1]), heard = notes.length; let sound = null;
    if (have.length === 2) { sound = mix(have.map((x) => x[1])); notes.push('the sound of both videos, mixed' + (/turned down/.test(sound.notes[1] || '') ? ', ' + sound.notes[1] : '')); }
    else if (have.length === 1) { sound = have[0][1]; notes.push('the sound of ' + files[have[0][0]].name + (want.length === 2 ? ' only: ' + files[1 - have[0][0]].name + ' has no sound this browser can read' : ' only')); }
    else notes.push(want.length === 2 ? 'no sound: neither video has a sound this browser can read' : 'no sound: ' + files[want[0]].name + ' has none this browser can read');
    const skipped = sides.reduce((x, s) => x + s.skipped + s.src.skipped, 0);
    if (skipped) notes.push(skipped + ' picture' + (skipped === 1 ? '' : 's') + ' went by before this device could draw ' + (skipped === 1 ? 'it' : 'them') + ', so ' + (skipped === 1 ? 'it is' : 'they are') + ' not in the new video');
    const r = await finish(container, E, sound, notes, say);
    // a file that cannot hold the sound this browser codes (a 3GP with no AAC) says so; the line on whose sound it is then goes
    if (sound && r.notes.some((x) => /^no sound: /.test(x))) r.notes = r.notes.filter((x) => x !== notes[heard]);
    return r;
  } finally { for (const s of sides) s.src.stop(); for (const v of vids) { v.pause(); URL.revokeObjectURL(v.src); v.removeAttribute('src'); v.load(); } }
}

// no VideoEncoder: record the playing video with MediaRecorder (the browser picks the codecs; it takes as long as the video)
async function record(v, container, say) {
  const dur = isFinite(v.duration) ? v.duration : 0, types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  const type = typeof MediaRecorder === 'function' ? types.find((t) => MediaRecorder.isTypeSupported(t)) : null, cap = v.captureStream || v.mozCaptureStream;
  if (!type || !cap) throw new Error('this browser cannot write ' + container.toUpperCase() + ' video.');
  v.muted = false; v.volume = 0; const stream = cap.call(v), rec = new MediaRecorder(stream, { mimeType: type }), parts = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) parts.push(e.data); };
  const done = new Promise((r) => { rec.onstop = r; });
  const tick = setInterval(() => { if (dur) say(Math.min(0.99, v.currentTime / dur)); }, 500);
  rec.start(1000); await v.play(); await wait(v, 'ended', Math.max(60000, (dur + 30) * 1000)); rec.stop(); await done; clearInterval(tick);
  const raw = new Uint8Array(await new Blob(parts, { type }).arrayBuffer()), bytes = webmWithDuration(raw, dur * 1000);
  return { bytes, notes: [v.videoWidth + ' x ' + v.videoHeight + ' pixels', dur.toFixed(2) + ' s', 'recorded while it played: this browser has no video encoder, so the codecs are the ones it records with'], width: v.videoWidth, height: v.videoHeight, seconds: dur, frames: 0 };
}
