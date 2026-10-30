// The music video for a rap (owner, 2026-10-30: "it should also start making music videos for its songs"). Made in this browser from the
// song lib/rap-song.js renders: 1280 x 720 at 30 pictures a second, in Verse's deep space look. A star field drifts, the nebula breathes on
// every kick, a ring around the section name moves with the song's spectrum, the title shows through the count-in, and the bar being rapped
// is drawn large with each word lighting as it is said (the rhyme word in the key colour), the bar before and the bar after dimmed. The
// pictures are coded by the browser's own encoder (WebCodecs, H.264 where it has it, else VP9), the song as AAC or Opus with the converter's
// sound coder (lib/video-write.js encodeSound), and lib/video-mux.js writes one MP4 to play here or download. Nothing is uploaded.
import { mp4, avcCodecs, bitrateOf } from './video-mux.js';
import { encodeSound } from './video-write.js';
import { endWordOf, schemeOf, STYLES } from './rap.js';
import { mixStems, evenWords, RATE } from './rap-song.js';
import { beatEvents } from './rap-beat.js';

export const W = 1280, H = 720, FPS = 30, BANDS = 48;
const KEY = '158,178,255', INK = '242,244,251', FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const canMakeVideo = (g = globalThis) => typeof g.VideoEncoder === 'function' && typeof g.VideoFrame === 'function' && typeof g.AudioEncoder === 'function' && (typeof g.OffscreenCanvas === 'function' || !!g.document);

/** in-place radix-2 FFT of re/im (length a power of 2). Pure apart from writing its arrays. */
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const p = i + k, q = p + len / 2, tr = re[q] * cr - im[q] * ci, ti = re[q] * ci + im[q] * cr; re[q] = re[p] - tr; im[q] = im[p] - ti; re[p] += tr; im[p] += ti; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } }
  }
}

/** the song's loudness in `n` bands from 40 Hz to 12 kHz (log spaced), 0..1, around time t. Pure. */
export function bandsOf(L, R, rate, t, n = BANDS, size = 1024) {
  const re = new Float64Array(size), im = new Float64Array(size), at = Math.round(t * rate) - size / 2;
  for (let i = 0; i < size; i++) { const k = at + i, x = k >= 0 && k < L.length ? (L[k] + R[k]) / 2 : 0; re[i] = x * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1))); }
  fft(re, im);
  const out = new Float32Array(n), lo = Math.log(40), hi = Math.log(12000);
  for (let b = 0; b < n; b++) {
    const f0 = Math.exp(lo + (hi - lo) * b / n), f1 = Math.exp(lo + (hi - lo) * (b + 1) / n), k0 = Math.max(1, Math.floor(f0 * size / rate)), k1 = Math.max(k0 + 1, Math.ceil(f1 * size / rate));
    let m = 0; for (let k = k0; k < k1 && k < size / 2; k++) m = Math.max(m, Math.hypot(re[k], im[k]));
    out[b] = Math.max(0, Math.min(1, (20 * Math.log10(m / (size / 4) + 1e-9) + 60) / 60));
  }
  return out;
}

/** how hard the last kicks still hit at t: each kick a flash that dies away in about a tenth of a second. Pure. */
export function kickPulse(kicks, t) { let p = 0; for (const k of kicks) { if (k > t) break; const d = t - k; if (d < 0.6) p += Math.exp(-d / 0.11); } return Math.min(1, p); }

/** what the picture shows at t seconds: { phase: 'title' | 'bar' | 'outro', bar (index into timing, or -1), lit (words of that bar lit),
 *  progress 0..1 }. words: [{ bar, i, at }]. Pure. */
export function frameState(timing, words, seconds, t) {
  const first = timing.length ? timing[0].at : seconds, last = timing.length ? timing[timing.length - 1] : null;
  let bar = -1; for (let i = 0; i < timing.length; i++) if (timing[i].at <= t + 1e-6) bar = i;
  // the title holds until the first bar has started: a bar shown before its own start has no words to show
  const phase = bar < 0 || t < first - 0.05 ? 'title' : last && t > last.at + last.len + 0.4 ? 'outro' : 'bar';
  const lit = bar < 0 ? 0 : words.filter((w) => w.bar === timing[bar].bar && w.at <= t + 1e-6).length;
  return { phase, bar: phase === 'title' ? -1 : bar, lit, progress: Math.max(0, Math.min(1, t / Math.max(1e-6, seconds))) };
}

/** the words of a bar broken into lines that fit maxW, as [[{ w, i, x, width }]]: measure(word) gives a word's width. Pure. */
export function linesOf(words, measure, maxW, space) {
  const lines = []; let cur = [], x = 0;
  words.forEach((w, i) => { const width = measure(w); if (cur.length && x + width > maxW) { lines.push(cur); cur = []; x = 0; } cur.push({ w, i, x, width }); x += width + space; });
  if (cur.length) lines.push(cur); return lines;
}

/** seeded stars: { x, y, z (depth 0.2..1), ph (twinkle phase) } */
function starsOf(seed, n = 240) { let s = seed >>> 0 || 1; const r = () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0) / 4294967296; return Array.from({ length: n }, () => ({ x: r() * W, y: r() * H, z: 0.2 + r() * 0.8, ph: r() * 6.28 })); }

/** draws one picture of the video on x at t. */
function draw(x, v, t) {
  const st = frameState(v.timing, v.words, v.seconds, t), pulse = kickPulse(v.kicks, t), bands = bandsOf(v.L, v.R, RATE, t);
  // deep space, a nebula that breathes on the kicks, the stars drifting at their depths
  x.globalCompositeOperation = 'source-over'; x.fillStyle = '#03040a'; x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = 'lighter';
  for (const [cx, cy, rad, col, a] of [[W * (0.3 + 0.05 * Math.sin(t * 0.07)), H * 0.35, 520, '96,64,210', 0.22], [W * (0.72 + 0.04 * Math.cos(t * 0.05)), H * 0.6, 560, '40,110,220', 0.2], [W * 0.5, H * (0.2 + 0.05 * Math.sin(t * 0.09)), 420, '190,70,170', 0.1]]) {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad * (1 + 0.06 * pulse)); g.addColorStop(0, 'rgba(' + col + ',' + (a + 0.18 * pulse).toFixed(3) + ')'); g.addColorStop(1, 'rgba(' + col + ',0)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  }
  for (const s of v.stars) { const px = ((s.x - t * 14 * s.z) % W + W) % W, a = Math.min(1, 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * 2 * s.z + s.ph)) + 0.3 * pulse * s.z); x.fillStyle = 'rgba(' + INK + ',' + a.toFixed(3) + ')'; x.fillRect(px, s.y, 1.6 * s.z + 0.4, 1.6 * s.z + 0.4); }
  x.globalCompositeOperation = 'source-over';
  // the ring: the spectrum around the section name, mirrored so it is whole
  const cx = W / 2, cy = 232, r0 = 96 + 10 * pulse;
  x.beginPath();
  for (let k = 0; k <= BANDS * 2; k++) { const b = bands[k < BANDS ? k : Math.max(0, BANDS * 2 - 1 - k)], ang = -Math.PI / 2 + (k / (BANDS * 2)) * Math.PI * 2, rr = r0 + 8 + b * 62; const px = cx + Math.cos(ang) * rr, py = cy + Math.sin(ang) * rr; if (k) x.lineTo(px, py); else x.moveTo(px, py); }
  x.closePath(); x.fillStyle = 'rgba(' + KEY + ',0.08)'; x.fill(); x.lineWidth = 2; x.strokeStyle = 'rgba(' + KEY + ',0.85)'; x.stroke();
  x.beginPath(); x.arc(cx, cy, r0, 0, Math.PI * 2); x.strokeStyle = 'rgba(' + INK + ',' + (0.18 + 0.3 * pulse).toFixed(3) + ')'; x.lineWidth = 1.5; x.stroke();
  x.textAlign = 'center'; x.textBaseline = 'middle';
  const label = st.phase === 'title' ? 'VERSE' : st.phase === 'outro' ? 'END' : String((v.timing[st.bar] || {}).section || '').toUpperCase();
  x.font = '600 20px ' + FONT; x.fillStyle = 'rgba(' + KEY + ',1)'; x.fillText(spaced(label), cx, cy);
  if (st.phase === 'title' || st.phase === 'outro') {
    const fade = st.phase === 'title' ? Math.min(1, t / 0.6) : Math.min(1, (t - (v.end + 0.4)) / 0.6);
    x.globalAlpha = Math.max(0, fade);
    x.font = '700 64px ' + FONT; x.fillStyle = 'rgb(' + INK + ')'; fit(x, v.title, W - 160); x.fillText(v.title, cx, H * 0.62);
    x.font = '400 24px ' + FONT; x.fillStyle = 'rgba(' + INK + ',0.7)'; x.fillText(st.phase === 'title' ? v.sub : 'Make yours at a-to-mind.com/rap', cx, H * 0.62 + 62);
    x.globalAlpha = 1;
  } else {
    const b = v.timing[st.bar], prev = v.timing[st.bar - 1], next = v.timing[st.bar + 1];
    x.font = '400 26px ' + FONT;
    if (prev) { x.fillStyle = 'rgba(' + INK + ',0.32)'; fit(x, prev.text, W - 200); x.fillText(prev.text, cx, 420); }
    if (next) { x.fillStyle = 'rgba(' + INK + ',0.26)'; x.font = '400 26px ' + FONT; fit(x, next.text, W - 200); x.fillText(next.text, cx, 640); }
    // the bar being rapped: each word lit as it is said, the rhyme word in the key colour, the word just said a little larger
    const ws = String(b.text).split(/\s+/).filter(Boolean), rhyme = v.rhymes[st.bar] ? v.endWords[st.bar] : '';
    let size = 50; x.font = '700 ' + size + 'px ' + FONT; let lines = linesOf(ws, (w) => x.measureText(w).width, W - 180, x.measureText(' ').width);
    while (lines.length > 2 && size > 30) { size -= 4; x.font = '700 ' + size + 'px ' + FONT; lines = linesOf(ws, (w) => x.measureText(w).width, W - 180, x.measureText(' ').width); }
    const lh = size * 1.25, top = 530 - ((lines.length - 1) * lh) / 2; x.textAlign = 'left';
    lines.forEach((line, li) => {
      const last = line[line.length - 1], width = last.x + last.width, left = cx - width / 2, y = top + li * lh;
      for (const w of line) {
        const on = w.i < st.lit, now = w.i === st.lit - 1, isRhyme = rhyme && w.i === ws.length - 1 && w.w.toLowerCase().replace(/[^a-z']/g, '').startsWith(rhyme);
        x.fillStyle = on ? (isRhyme ? 'rgb(' + KEY + ')' : 'rgb(' + INK + ')') : 'rgba(' + INK + ',0.34)';
        if (now) { x.save(); x.translate(left + w.x + w.width / 2, y); x.scale(1.06, 1.06); x.fillText(w.w, -w.width / 2, 0); x.restore(); } else x.fillText(w.w, left + w.x, y);
      }
    });
    x.textAlign = 'center';
  }
  // the progress line, the title and the mark
  x.fillStyle = 'rgba(' + INK + ',0.12)'; x.fillRect(60, H - 34, W - 120, 3); x.fillStyle = 'rgb(' + KEY + ')'; x.fillRect(60, H - 34, (W - 120) * st.progress, 3);
  x.font = '500 17px ' + FONT; x.textBaseline = 'alphabetic'; x.textAlign = 'left'; x.fillStyle = 'rgba(' + INK + ',0.6)'; x.fillText(v.title, 60, H - 46);
  x.textAlign = 'right'; x.fillText('a-to-mind.com/rap', W - 60, H - 46);
}
const spaced = (s) => s.split('').join(' ');
function fit(x, text, maxW) { let m = x.measureText(text).width; if (m <= maxW) return; const f = x.font.match(/(\d+)px/); if (!f) return; let px = +f[1]; while (m > maxW && px > 14) { px -= 2; x.font = x.font.replace(/\d+px/, px + 'px'); m = x.measureText(text).width; } }

async function pick(C, list) { for (const cfg of list) { try { if ((await C.isConfigSupported(cfg)).supported) return cfg; } catch (_) { /* the next one */ } } return null; }

/** the music video of a song (lib/rap-song.js songOf): { blob (video/mp4), name, seconds, video, audio, voiced }.
 *  onProgress(done 0..1, what) is called as it goes. Throws an Error with a plain message when the browser cannot make one. */
export async function makeVideo(r, s, song, { onProgress = () => {}, doc = globalThis.document, g = globalThis } = {}) {
  if (!canMakeVideo(g)) throw new Error('this browser cannot code video (it has no WebCodecs). Chrome, Edge and Safari 17 or later can.');
  onProgress(0, 'the beat');
  const beat = await song.beat(); if (!beat) throw new Error('this browser cannot render the beat.');
  onProgress(0.02, 'the voice');
  const voice = await song.voice(), [L, R] = mixStems(beat, voice.stem), plan = song.plan, timing = plan.timing;
  const texts = timing.map((b) => b.text), sc = schemeOf(texts), title = String(r.title || s.topic || 'A rap by Verse').slice(0, 80);
  const last = timing[timing.length - 1], v = {
    timing, seconds: plan.seconds, L, R, kicks: [...beatEvents(plan.beat, { measures: plan.measures }).kicks].sort((a, b) => a - b),
    words: voice.stem ? voice.words : evenWords(timing), stars: starsOf(plan.beat.seed || 7), title,
    sub: 'Verse · ' + ((STYLES[s.style] || STYLES['boom bap']).label) + ' · ' + plan.beat.bpm + ' BPM', end: last ? last.at + last.len : plan.seconds,
    rhymes: sc.letters, endWords: texts.map(endWordOf),
  };
  const vcfg = await pick(g.VideoEncoder, [...avcCodecs(W, H, FPS), 'vp09.00.41.08'].map((codec) => ({ codec, width: W, height: H, bitrate: bitrateOf(W, H, FPS, 'high'), framerate: FPS, ...(codec.startsWith('avc1') ? { avc: { format: 'avc' } } : {}) })));
  if (!vcfg) throw new Error('this browser cannot code H.264 or VP9 video at 1280 x 720.');
  const acfg = await pick(g.AudioEncoder, ['mp4a.40.2', 'opus'].map((codec) => ({ codec, sampleRate: RATE, numberOfChannels: 2, bitrate: 192000 })));
  if (!acfg) throw new Error('this browser cannot code AAC or Opus sound.');
  const cv = typeof g.OffscreenCanvas === 'function' ? new g.OffscreenCanvas(W, H) : Object.assign(doc.createElement('canvas'), { width: W, height: H }), x = cv.getContext('2d');
  const frames = []; let desc = null, error = null;
  const enc = new g.VideoEncoder({ output: (c, meta) => { const d = new Uint8Array(c.byteLength); c.copyTo(d); frames.push({ data: d, t: c.timestamp, d: c.duration || 0, key: c.type === 'key' }); if (meta && meta.decoderConfig && meta.decoderConfig.description) desc = new Uint8Array(meta.decoderConfig.description.buffer || meta.decoderConfig.description); }, error: (e) => { error = e; } });
  enc.configure({ ...vcfg, latencyMode: 'quality' });
  const n = Math.ceil(plan.seconds * FPS), step = 1e6 / FPS;
  for (let i = 0; i < n; i++) {
    if (error) throw error;
    draw(x, v, i / FPS);
    const f = new g.VideoFrame(cv, { timestamp: Math.round(i * step), duration: Math.round(step) }); enc.encode(f, { keyFrame: i % (FPS * 2) === 0 }); f.close();
    while (enc.encodeQueueSize > 6) await new Promise((res) => setTimeout(res, 4));
    if (i % 15 === 0) { onProgress(0.05 + 0.85 * i / n, 'the pictures'); await new Promise((res) => setTimeout(res, 0)); }
  }
  await enc.flush(); enc.close(); if (error) throw error;
  if (!frames.length) throw new Error('no picture came out of the encoder.');
  frames.sort((a, b) => a.t - b.t); for (let i = 0; i < frames.length - 1; i++) frames[i].d = frames[i + 1].t - frames[i].t; frames[frames.length - 1].d = Math.round(step);
  onProgress(0.92, 'the sound');
  const audio = await encodeSound({ rate: RATE, channels: [L, R] }, acfg);
  onProgress(0.98, 'the file');
  const bytes = mp4({ codec: vcfg.codec, width: W, height: H, description: desc, samples: frames }, audio);
  const name = (title + ' music video').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) + '.mp4';
  onProgress(1, 'done');
  return { blob: new Blob([bytes], { type: 'video/mp4' }), name, seconds: plan.seconds, video: vcfg.codec, audio: acfg.codec, voiced: voice.voiced, note: voice.note };
}
