// A rap as a finished song (owner, 2026-10-30: "improve verse spoken voice so it sound good rapping , also the beats are terrible it should also
// start making music videos for its songs"). Two stems, made in this browser at 48 kHz: the beat (lib/rap-beat.js produce(): drums with swing,
// 808 or sub bass, chords, a mix bus) and Verse's voice (each bar said by the site's own text-to-speech route, /api/rapvoice, then cut into
// syllables and put on the beat's grid by lib/rap-voice.js). The vocal goes through its own chain: a high-pass, a presence lift, a compressor,
// an eighth-note delay and a short room, with the rhyme word doubled left and right and the ad-libs on their own thinner track to the right. The stems play live (the page mixes them, the Beat slider
// sets the beat's level), save as one stereo WAV, and are the sound of the music video (lib/rap-video.js). Nothing about the visitor is sent:
// only the rap's own bars go to the voice route, one at a time.
import { beatFor, timingOf, lengthOf } from './rap.js';
import { produce, impulseOf } from './rap-beat.js';
import { loadKit, kitFor } from './rap-kit.js';
import { loadPiano } from './rap-piano.js';
import { buildVocal, fetchVoice, shadowsOf } from './rap-voice.js';
import { master, isPlain, TUNE0 } from './rap-ears.js';

export const RATE = 48000;
export const TAIL = 1.5; // seconds after the last measure, for the reverb and the delay to ring out
const OACof = (win) => (win && (win.OfflineAudioContext || win.webkitOfflineAudioContext)) || null;

/** the song's plan, from the rap and its settings: { beat, timing, measure, measures, seconds }. A `tune` from Verse's ears (lib/rap-ears.js
 *  tuneFor) sets the beat's tempo and swing before the bars are timed, so the voice lands on the new grid. Pure. */
export function planOf(r, s, tune = null) {
  const beat0 = beatFor(s), beat = tune && (tune.bpm || tune.swing != null) ? { ...beat0, ...(tune.bpm ? { bpm: tune.bpm } : {}), ...(tune.swing != null ? { swing: tune.swing } : {}) } : beat0, timing = timingOf(r, beat, s.flow), measure = 240 / beat.bpm, measures = Math.max(2, Math.ceil(lengthOf(timing, beat) / measure - 1e-9));
  return { beat, timing, measure, measures, seconds: measures * measure + TAIL };
}

/** a stereo 16-bit WAV from two channels. Pure. */
export function wavStereo(L, R, rate = RATE) {
  const n = Math.min(L.length, R.length), buf = new ArrayBuffer(44 + n * 4), v = new DataView(buf), w = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) { const x = Math.max(-1, Math.min(1, (c ? R : L)[i])); v.setInt16(44 + i * 4 + c * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true); }
  return new Uint8Array(buf);
}

/** the beat stem and the vocal stem summed, with the beat at `beatLevel`, then brought under full scale (a gain to the peak, then a soft
 *  knee above 0.9 so no sample clips). vocal may be null. Returns [L, R]. Pure. */
export function mixStems(beat, vocal, { beatLevel = 0.8, vocalLevel = 1 } = {}) {
  const n = beat[0].length, L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { L[i] = beat[0][i] * beatLevel + (vocal ? vocal[0][i] * vocalLevel : 0); R[i] = beat[1][i] * beatLevel + (vocal ? vocal[1][i] * vocalLevel : 0); }
  let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const g = peak > 0.98 ? 0.98 / peak : 1, knee = (x) => { const a = Math.abs(x); return a <= 0.9 ? x : Math.sign(x) * (0.9 + 0.1 * Math.tanh((a - 0.9) / 0.1)); };
  for (let i = 0; i < n; i++) { L[i] = knee(L[i] * g); R[i] = knee(R[i] * g); }
  return [L, R];
}

/** the recorded drum kit for the plan's style (lib/rap-kit.js), decoded; null when it cannot load, so the beat falls back to its synthesised
 *  drums. `ctx` decodes it (any context: the buffers play in every context). */
export function drumsFor(beat, ctx, { win = globalThis, fetchFn = null } = {}) {
  if (!ctx || typeof ctx.decodeAudioData !== 'function') return Promise.resolve(null);
  return loadKit(kitFor(beat), { fetchFn: fetchFn || ((u) => win.fetch(u)), decode: (bytes) => ctx.decodeAudioData(bytes) }).catch(() => null);
}

/** the recorded grand piano (lib/rap-piano.js), decoded; null when it cannot load, so the keys fall back to the electric piano. */
export function pianoFor(ctx, { win = globalThis, fetchFn = null } = {}) {
  if (!ctx || typeof ctx.decodeAudioData !== 'function') return Promise.resolve(null);
  return loadPiano({ fetchFn: fetchFn || ((u) => win.fetch(u)), decode: (bytes) => ctx.decodeAudioData(bytes) }).catch(() => null);
}

/** render the beat stem offline: [L, R] at RATE, the plan's length, with the recorded kit and piano when they load. null without
 *  OfflineAudioContext. */
export async function renderBeat(plan, { win = globalThis, kitFetch = null } = {}) {
  const OAC = OACof(win); if (!OAC) return null;
  const ctx = new OAC(2, Math.ceil(plan.seconds * RATE), RATE);
  const [kit, piano] = await Promise.all([drumsFor(plan.beat, ctx, { win, fetchFn: kitFetch }), pianoFor(ctx, { win, fetchFn: kitFetch })]);
  produce(ctx, plan.beat, { measures: plan.measures, t0: 0, kit, piano });
  const b = await ctx.startRendering();
  return [b.getChannelData(0), b.getChannelData(1)];
}

/** the vocal chain, rendered offline from the placed vocal (main and dub, mono at RATE): [L, R]. */
async function renderVocal(v, plan, OAC) {
  const n = Math.ceil(plan.seconds * RATE), ctx = new OAC(2, n, RATE), mk = (k, p = {}) => { const x = k === 'g' ? ctx.createGain() : k === 'f' ? ctx.createBiquadFilter() : k === 'c' ? ctx.createDynamicsCompressor() : k === 'd' ? ctx.createDelay(2) : ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain(); for (const [a, b] of Object.entries(p)) { if (x[a] && typeof x[a] === 'object' && 'value' in x[a]) x[a].value = b; else x[a] = b; } return x; };
  const buf = (data) => { const b = ctx.createBuffer(1, data.length, RATE); b.getChannelData(0).set(data); const s = ctx.createBufferSource(); s.buffer = b; return s; };
  const hp = mk('f', { type: 'highpass', frequency: 100, Q: 0.7 }), body = mk('f', { type: 'peaking', frequency: 220, Q: 1, gain: -2 }), presence = mk('f', { type: 'peaking', frequency: 3000, Q: 0.9, gain: 3 }), air = mk('f', { type: 'highshelf', frequency: 9000, gain: 2 });
  const comp = mk('c', { threshold: -20, knee: 6, ratio: 4, attack: 0.003, release: 0.12 }), level = mk('g', { gain: 1.1 }), out = mk('g', { gain: 1 });
  hp.connect(body); body.connect(presence); presence.connect(air); air.connect(comp); comp.connect(level); level.connect(out); out.connect(ctx.destination);
  // an eighth-note delay, darkened on each repeat, and a short room
  const eighth = 30 / plan.beat.bpm, dl = mk('d', { delayTime: eighth }), fb = mk('g', { gain: 0.25 }), dlp = mk('f', { type: 'lowpass', frequency: 3000 }), dret = mk('g', { gain: 0.12 });
  level.connect(dl); dl.connect(dlp); dlp.connect(fb); fb.connect(dl); dlp.connect(dret); dret.connect(out);
  const room = ctx.createConvolver(); room.buffer = impulseOf(ctx, 0.9, 4, plan.beat.seed ^ 5); const rret = mk('g', { gain: 0.12 }); level.connect(room); room.connect(rret); rret.connect(out);
  const main = buf(v.main); main.connect(hp); main.start(0);
  // Verse's haunting signature: the lead an octave down, dark and close under every word; the lead an octave up, only in a long dark hall,
  // so a ghost sings each line back from far off; and that hall on the lead itself, low and wide
  const { low, halo } = shadowsOf(v.main, RATE);
  const hall = ctx.createConvolver(); hall.buffer = impulseOf(ctx, 3.2, 2.2, plan.beat.seed ^ 11);
  const pre = mk('d', { delayTime: 0.045 }), dark = mk('f', { type: 'lowpass', frequency: 3800, Q: 0.5 }), hret = mk('g', { gain: 0.16 });
  pre.connect(hall); hall.connect(dark); dark.connect(hret); hret.connect(out);
  const hsend = mk('g', { gain: 0.5 }); level.connect(hsend); hsend.connect(pre);
  { const s = buf(low), lp = mk('f', { type: 'lowpass', frequency: 1600, Q: 0.6 }), g = mk('g', { gain: 0.22 }); s.connect(lp); lp.connect(g); g.connect(hp); s.start(0); }
  { const s = buf(halo), thin = mk('f', { type: 'highpass', frequency: 2600, Q: 0.6 }), g = mk('g', { gain: 0.35 }); s.connect(thin); thin.connect(g); g.connect(pre); s.start(0); }
  // the double: the rhyme words again, a little late on each side, each lag drifting slowly (a chorus) so the two never lock
  for (const [pan, lag] of [[-0.35, 0.015], [0.35, 0.024]]) { const d = buf(v.dub), p = mk('p', { pan }), g = mk('g', { gain: 0.5 }), late = mk('d', { delayTime: lag }); if (ctx.createOscillator) { const lfo = ctx.createOscillator(), depth = mk('g', { gain: 0.004 }); lfo.frequency.value = pan < 0 ? 0.23 : 0.31; lfo.connect(depth); depth.connect(late.delayTime); lfo.start(0); } d.connect(late); late.connect(g); g.connect(p); p.connect(hp); d.start(0); }
  // the ad-lib track: thinner, quieter and off to the right, behind the lead the way a hype voice sits on a record
  if (v.adlib) { const a = buf(v.adlib), thin = mk('f', { type: 'highpass', frequency: 260, Q: 0.7 }), g = mk('g', { gain: 0.55 }), p = mk('p', { pan: 0.55 }); a.connect(thin); thin.connect(g); g.connect(p); p.connect(hp); a.start(0); }
  const b = await ctx.startRendering();
  return [b.getChannelData(0), b.getChannelData(1)];
}

/** Verse's voice for the whole rap: { stem: [L, R] | null, words, bars, voiced, note }. note says, in plain words, why a bar has no voice. */
/** `clips` may be the promise of an earlier fetchVoice for the same bars, so a retuned take re-times the voice it already has. */
export async function renderVoice(plan, { win = globalThis, fetchFn = (u) => win.fetch(u), onProgress = () => {}, flow = 'steady', clips: had = null } = {}) {
  const OAC = OACof(win); if (!OAC) return { stem: null, words: [], bars: [], voiced: 0, note: 'this browser cannot decode sound' };
  const { clips, adlibClips, note } = await (had || clipsOf(plan, { win, fetchFn, onProgress }));
  const v = buildVocal(clips, plan.timing, plan.beat, flow, RATE, plan.seconds, adlibClips);
  if (!v.voiced) return { stem: null, words: [], bars: [], voiced: 0, note: note || 'no bars came back' };
  return { stem: await renderVocal(v, plan, OAC), words: v.words, bars: v.bars, voiced: v.voiced, note };
}

/** Verse's voice for each bar of the plan, fetched and decoded once: { clips, adlibClips, note }. */
export function clipsOf(plan, { win = globalThis, fetchFn = (u) => win.fetch(u), onProgress = () => {} } = {}) {
  const OAC = OACof(win); if (!OAC) return Promise.resolve({ clips: [], adlibClips: [], note: 'this browser cannot decode sound' });
  const dec = new OAC(1, 1, RATE);
  const decode = async (bytes) => (await dec.decodeAudioData(bytes)).getChannelData(0);
  return fetchVoice(plan.timing.map((b) => b.text), { fetchFn, decode, onProgress });
}

/** the words' start times when there is no placed vocal (the browser's own voice, or none): each word evenly through its bar. Pure. */
export function evenWords(timing) {
  const out = [];
  for (const b of timing) { const ws = String(b.text).split(/\s+/).filter(Boolean); ws.forEach((_, i) => out.push({ bar: b.bar, i, at: b.at + (i / Math.max(1, ws.length)) * b.len * 0.9 })); }
  return out;
}

/** one song, made once and kept: song.beat() and song.voice() each render the first time they are asked and give the same answer after.
 *  opts.tune (from Verse's ears) retimes the beat and masters the mix; song.retune(tune) is the same rap with another tune, sharing the voice
 *  Verse already fetched, so a new take costs no new voice requests. A retune on the same tempo and swing (a new master alone) also shares the
 *  rendered beat, voice and unmastered mix, so it costs no rendering at all. */
export function songOf(r, s, opts = {}) {
  const tune = opts.tune && !isPlain(opts.tune) ? { ...TUNE0, ...opts.tune } : null, plan = planOf(r, s, tune), shared = opts.shared || null; let beatP = null, voiceP = null, rawP = null, clipsP = opts.clips || null;
  const clips = (onProgress) => (clipsP = clipsP || clipsOf(plan, { ...opts, onProgress }).catch(() => ({ clips: [], adlibClips: [], note: 'the voice did not load' })));
  const beat = () => (shared ? shared.beat() : (beatP = beatP || renderBeat(plan, opts).catch(() => null)));
  const voice = (onProgress) => (shared ? shared.voice(onProgress) : (voiceP = voiceP || renderVoice(plan, { ...opts, flow: s.flow, onProgress, clips: clips(onProgress) }).catch(() => ({ stem: null, words: [], bars: [], voiced: 0, note: 'the voice did not load' }))));
  /** the beat and the voice summed, before any master: [L, R], or null without offline audio. With the voice it is made once and kept. */
  const raw = (withVoice = true) => {
    if (!withVoice) return beat().then((b) => (b ? mixStems(b, null) : null));
    if (shared) return shared.raw(true);
    return (rawP = rawP || (async () => { const b = await beat(); if (!b) return null; const v = await voice(); return mixStems(b, v && v.stem); })());
  };
  const self = { beat, voice, raw };
  return {
    plan, tune, beat, voice, raw,
    /** the mixed song as [L, R] (the beat alone when there is no voice), mastered by the tune when there is one; null without offline audio */
    async mix(withVoice = true) { const m = await raw(withVoice); if (!m) return null; return tune ? master(m[0], m[1], RATE, tune) : m; },
    /** the whole song as a stereo WAV */
    async wav(withVoice = true) { const m = await this.mix(withVoice); return m ? wavStereo(m[0], m[1]) : null; },
    /** the same rap with another tune */
    retune(next) {
      const p = planOf(r, s, next && !isPlain(next) ? { ...TUNE0, ...next } : null), same = p.beat.bpm === plan.beat.bpm && p.beat.swing === plan.beat.swing;
      return songOf(r, s, { ...opts, tune: next, clips: clips(), shared: same ? (shared || self) : null });
    },
  };
}
