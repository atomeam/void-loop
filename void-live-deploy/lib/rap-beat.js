// The rap beat (owner, 2026-10-30: "the beats are terrible"): hip-hop production made in the browser for each style of lib/rap.js, from the
// composed piece beatFor() gives (lib/compose.js: its chords, bass line, melody and drum steps). No sample is used, nothing is copied: every
// sound is synthesised here with Web Audio.
//   - drums: a kick with a pitch drop and a click, saturated; a snare with a body and a snap, or a three-burst clap for trap, drill and melodic;
//     closed and open hats with accents, humanised, and trap rolls (32nds and triplets) at the end of a measure; a crash where the rap starts
//   - bass: a sliding 808 (sine with a soft clip, so a phone speaker hears its harmonics) on the kicks for trap, drill and melodic; a round
//     sub bass for boom bap and conscious
//   - music: seventh chords on an electric piano with tremolo, tape wobble and vinyl crackle (boom bap, conscious); a dark pad with a bell or a
//     pluck (trap, drill); a wide pad with a plucked arpeggio (melodic)
//   - the mix: swing on the off 16ths (boom bap most), the music ducked under each kick, a reverb send, then a bus compressor, a soft clip and
//     a limiter. The first measure is the intro (hats, and the music opening up through a filter), the last is the outro (the music alone).
// beatEvents() is pure (the times, sounds and velocities, tested in tools/rap-sound.test.mjs); produce() builds the sound on any
// BaseAudioContext (an OfflineAudioContext renders it to a buffer, lib/rap-song.js).
import { hz, SCALES } from './compose.js';

/** how late the off 16th of each pair is played: 0.5 is straight, 0.58 is the swing of a 90s boom bap groove */
export const SWING = Object.freeze({ 'boom bap': 0.58, conscious: 0.56, melodic: 0.54, trap: 0.5, drill: 0.5 });
const PARENT = { 'minor pentatonic': 'minor', 'major pentatonic': 'major' };
const EIGHT08 = new Set(['trap', 'drill', 'melodic']);

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** a chord as a seventh chord with a ninth, from the piece's own scale: [root, 3rd, 5th, 7th, 9th] in midi. Pure. */
export function seventhOf(beat, chord) {
  const sc = SCALES[PARENT[beat.scale] || beat.scale] || SCALES.minor;
  const deg = (i) => beat.tonic + sc[((i % 7) + 7) % 7] + 12 * Math.floor(i / 7);
  let d = 0; for (let i = -7; i < 14; i++) if (deg(i) === chord.root) { d = i; break; }
  return [0, 2, 4, 6, 8].map((k) => deg(d + k));
}

/** the seconds a 16th step starts at, with swing on the off steps. Pure. */
export const stepTime = (step, sp, swing = 0.5) => step * sp + (step % 2 === 1 ? (swing - 0.5) * 2 * sp : 0);

/** every sound of the beat over `measures` measures, from the start of the intro: { sp, swing, measure, events, kicks }. events are
 *  { t, kind, vel, midi?, dur?, from?, notes?, pan? } sorted by t; kinds: kick, snare, clap, hat, ohat, crash, 808, sub, keys, pad, bell,
 *  pluck. kicks are the kick times (the music is ducked under them). Pure. */
export function beatEvents(beat, { measures = 10 } = {}) {
  const style = beat.rapStyle || 'boom bap', sp = 60 / beat.bpm / 4, swing = SWING[style] || 0.5, measure = 16 * sp, r = rng(beat.seed ^ 0x51ed270b);
  const of = (list, m) => list.filter((s) => Math.floor(s / 16) === m % 8).map((s) => s % 16);
  const ev = [], last = measures - 1, is808 = EIGHT08.has(style);
  const at = (m, step) => m * measure + stepTime(step, sp, swing);
  const humanise = (t) => t + (style === 'boom bap' || style === 'conscious' ? (r() - 0.5) * 0.006 : 0);
  for (let m = 0; m < measures; m++) {
    const intro = m === 0, outro = m === last && measures > 2, chord = beat.chords[m % beat.chords.length], tones = seventhOf(beat, chord);
    // music: every measure, intro and outro included
    const keys = tones.slice(0, 4).map((n) => (n < 52 ? n + 12 : n > 70 ? n - 12 : n));
    if (style === 'boom bap' || style === 'conscious') {
      const comp = style === 'conscious' ? [[0, 16]] : [[[0, 6], [6, 4], [10, 6]], [[0, 7], [10, 6]], [[0, 10], [10, 6]]][(beat.seed >>> (m % 3)) % 3];
      for (const [s, len] of comp) ev.push({ t: at(m, s), kind: 'keys', vel: s === 0 ? 0.9 : 0.7, notes: keys, dur: len * sp });
      if (style === 'conscious') for (const n of beat.melody.filter((x) => Math.floor(x.step / 16) === m % 8)) ev.push({ t: at(m, n.step % 16), kind: 'bell', vel: 0.35, midi: n.midi + 12, dur: n.len * sp });
    } else {
      ev.push({ t: at(m, 0), kind: 'pad', vel: style === 'melodic' ? 0.8 : 0.65, notes: keys.slice(0, 3).concat(keys[3] - 12 < 52 ? keys[3] : keys[3] - 12), dur: measure });
      if (style === 'melodic') { for (let s = 0; s < 16; s += 2) ev.push({ t: at(m, s), kind: 'pluck', vel: s % 4 === 0 ? 0.6 : 0.45, midi: tones[(s / 2) % 4] + 12, dur: 2 * sp }); }
      else for (const n of beat.melody.filter((x) => Math.floor(x.step / 16) === m % 8)) ev.push({ t: at(m, n.step % 16), kind: style === 'trap' ? 'bell' : 'pluck', vel: 0.5, midi: n.midi + (style === 'trap' ? 12 : 0), dur: Math.min(n.len, 4) * sp });
    }
    if (outro) continue; // the last measure: the music rings out alone
    // hats: in the intro too
    const hats = of(beat.drums.hat, m), roll = is808 && style !== 'melodic' && m % 2 === 1 && !intro;
    for (const s of hats) {
      if (roll && s >= 12) continue;
      ev.push({ t: humanise(at(m, s)), kind: s === 14 && style === 'boom bap' && m % 4 === 3 ? 'ohat' : 'hat', vel: (s % 4 === 0 ? 0.85 : s % 2 === 0 ? 0.65 : 0.5) * (0.9 + r() * 0.2), pan: s % 4 === 2 ? 0.18 : -0.12 });
    }
    if (roll) {
      // a roll over the last beat: 32nds on its first half, a triplet on its second (the hats a trap beat is known for)
      const base = m * measure + 12 * sp;
      for (let k = 0; k < 4; k++) ev.push({ t: base + k * sp / 2, kind: 'hat', vel: 0.45 + k * 0.08, pan: 0.1 });
      for (let k = 0; k < 3; k++) ev.push({ t: base + 2 * sp + k * 2 * sp / 3, kind: 'hat', vel: 0.55 + k * 0.1, pan: -0.1 });
    }
    if (intro) continue; // the intro: hats and the music opening up, no kick yet
    if (m === 1) ev.push({ t: at(m, 0), kind: 'crash', vel: 0.6 });
    const kicks = of(beat.drums.kick, m), bassNotes = beat.bass.filter((b) => Math.floor(b.step / 16) === m % 8);
    const rootOf = (s) => { let n = bassNotes[0] ? bassNotes[0].midi : chord.root - 12; for (const b of bassNotes) if (b.step % 16 <= s) n = b.midi; return n; };
    let prev = null;
    kicks.forEach((s, k) => {
      ev.push({ t: at(m, s), kind: 'kick', vel: s === 0 ? 1 : 0.85 });
      if (is808) {
        let note = rootOf(s); while (note > 39) note -= 12; while (note < 28) note += 12;
        const next = kicks[k + 1] == null ? 16 : kicks[k + 1], held = Math.min(next - s, 8) * sp;
        ev.push({ t: at(m, s), kind: '808', vel: style === 'melodic' ? 0.75 : 0.9, midi: note, dur: Math.max(held, 2 * sp), from: style === 'drill' && prev != null && prev !== note ? prev : null });
        prev = note;
      }
    });
    if (!is808) for (const b of bassNotes) { let note = b.midi; while (note > 45) note -= 12; while (note < 33) note += 12; ev.push({ t: at(m, b.step % 16), kind: 'sub', vel: 0.85, midi: note, dur: Math.min(b.len, 8) * sp }); }
    for (const s of of(beat.drums.snare, m)) ev.push({ t: at(m, s), kind: is808 ? 'clap' : 'snare', vel: 0.95 });
  }
  ev.sort((a, b) => a.t - b.t);
  return { sp, swing, measure, events: ev, kicks: ev.filter((e) => e.kind === 'kick').map((e) => e.t) };
}

// ---- the sound ---------------------------------------------------------------------------------------------------------------------------
function noise(ctx, seconds, seed) { const r = rng(seed), b = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * seconds)), ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1; return b; }
/** a reverb's impulse: stereo noise that dies away over `seconds` */
export function impulseOf(ctx, seconds = 1.6, decay = 3, seed = 7) {
  const n = Math.floor(ctx.sampleRate * seconds), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const r = rng(seed + c), d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / n, decay); }
  return b;
}
function crackle(ctx, seconds, seed) {
  const r = rng(seed), b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) { d[i] = (r() - 0.5) * 0.004; if (r() < 0.0006) d[i] += (r() < 0.5 ? -1 : 1) * (0.1 + r() * 0.35); }
  return b;
}
/** a soft clip curve: tanh(drive x), scaled so a full input stays full */
export function clipCurve(drive = 1.5, n = 2048) { const c = new Float32Array(n), k = Math.tanh(drive); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(drive * x) / k; } return c; }
const env = (g, t, peak, atk, dec, floor = 0.0001) => { g.gain.setValueAtTime(floor, t); g.gain.linearRampToValueAtTime(peak, t + atk); g.gain.exponentialRampToValueAtTime(floor, t + atk + dec); };

/** build the beat on `ctx` from t0 into `dest`: the whole song's beat, `measures` long (intro and outro included). Returns { seconds, kicks }. */
export function produce(ctx, beat, { measures = 10, t0 = 0, dest = ctx.destination } = {}) {
  const style = beat.rapStyle || 'boom bap', plan = beatEvents(beat, { measures }), nz = noise(ctx, 2, beat.seed), lofi = style === 'boom bap' || style === 'conscious';
  const node = (type, props = {}) => { const n = type === 'gain' ? ctx.createGain() : type === 'filter' ? ctx.createBiquadFilter() : type === 'shaper' ? ctx.createWaveShaper() : type === 'comp' ? ctx.createDynamicsCompressor() : type === 'pan' ? (ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain()) : ctx.createConvolver(); for (const [k, v] of Object.entries(props)) { if (n[k] && typeof n[k] === 'object' && 'value' in n[k]) n[k].value = v; else n[k] = v; } return n; };
  // the master: bus compressor, soft clip, limiter
  const out = node('gain', { gain: 0.9 }); out.connect(dest);
  const limit = node('comp', { threshold: -2, knee: 0, ratio: 20, attack: 0.001, release: 0.08 }); limit.connect(out);
  const clip = node('shaper', { curve: clipCurve(1.3), oversample: '2x' }); clip.connect(limit);
  const glue = node('comp', { threshold: -16, knee: 6, ratio: 3, attack: 0.008, release: 0.18 }); glue.connect(clip);
  const master = node('gain', { gain: 0.85 }); master.connect(glue);
  const drums = node('gain', { gain: 0.9 }); drums.connect(master);
  const kickBus = node('shaper', { curve: clipCurve(2.2) }); const kickGain = node('gain', { gain: 0.9 }); kickBus.connect(kickGain); kickGain.connect(drums);
  const bass = node('gain', { gain: 0.75 }); bass.connect(master);
  const bassClip = node('shaper', { curve: clipCurve(2.6) }), bassLp = node('filter', { type: 'lowpass', frequency: 900, Q: 0.4 }); bassClip.connect(bassLp); bassLp.connect(bass);
  const duck = node('gain', { gain: 1 }), musicLp = node('filter', { type: 'lowpass', frequency: 16000, Q: 0.5 }), music = node('gain', { gain: lofi ? 0.55 : 0.5 });
  music.connect(musicLp); musicLp.connect(duck); duck.connect(master);
  const verb = node('conv'); verb.buffer = impulseOf(ctx, style === 'melodic' ? 2.4 : 1.6, 3, beat.seed); const verbRet = node('gain', { gain: 0.3 }); verb.connect(verbRet); verbRet.connect(master);
  const send = (src, amount) => { const g = node('gain', { gain: amount }); src.connect(g); g.connect(verb); };
  const total = measures * plan.measure;
  // the intro: the music opens up through a low-pass filter over the first measure
  musicLp.frequency.setValueAtTime(420, t0); musicLp.frequency.exponentialRampToValueAtTime(16000, t0 + plan.measure);
  // the music ducks under each kick (a sidechain), so the kick and the 808 come through
  let free = t0;
  for (const k of plan.kicks) { const t = t0 + k; if (t < free) continue; duck.gain.setValueAtTime(1, t); duck.gain.linearRampToValueAtTime(0.55, t + 0.01); duck.gain.linearRampToValueAtTime(1, t + 0.16); free = t + 0.165; }
  // the keys' tremolo and the tape's wobble
  const keysBus = node('gain', { gain: 1 }); keysBus.connect(music); send(keysBus, lofi ? 0.18 : 0.25);
  const trem = ctx.createOscillator(), tremDepth = node('gain', { gain: 0.12 }); trem.frequency.value = 4.2; trem.connect(tremDepth); tremDepth.connect(keysBus.gain); trem.start(t0); trem.stop(t0 + total + 1);
  const wob = ctx.createOscillator(), wobDepth = node('gain', { gain: lofi ? 7 : 3 }); wob.frequency.value = 0.55; wob.connect(wobDepth); wob.start(t0); wob.stop(t0 + total + 1);
  if (lofi) { const v = ctx.createBufferSource(); v.buffer = crackle(ctx, 3, beat.seed); v.loop = true; const hp = node('filter', { type: 'bandpass', frequency: 2400, Q: 0.6 }), g = node('gain', { gain: 0.5 }); v.connect(hp); hp.connect(g); g.connect(master); v.start(t0); v.stop(t0 + total); }
  const osc = (type, f, t, stop, detune = 0) => { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (detune) o.detune.value = detune; o.start(t); o.stop(stop); return o; };
  const burst = (t, dur, f, type, q, gain, dst, rate = 1) => { const s = ctx.createBufferSource(); s.buffer = nz; s.playbackRate.value = rate; const fl = node('filter', { type, frequency: f, Q: q }), g = node('gain'); env(g, t, gain, 0.001, dur); s.connect(fl); fl.connect(g); g.connect(dst); s.start(t, dur > 0.4 ? 0 : (t * 7.13) % 1.2, dur + 0.05); return g; };
  for (const e of plan.events) {
    const t = t0 + e.t;
    if (e.kind === 'kick') {
      const o = osc('sine', style === 'boom bap' || style === 'conscious' ? 150 : 175, t, t + 0.5), g = node('gain');
      o.frequency.exponentialRampToValueAtTime(52, t + 0.055); o.frequency.exponentialRampToValueAtTime(44, t + 0.3);
      env(g, t, e.vel, 0.002, EIGHT08.has(style) ? 0.24 : 0.42); o.connect(g); g.connect(kickBus);
      burst(t, 0.012, 3200, 'highpass', 0.7, 0.35 * e.vel, kickBus);
    } else if (e.kind === 'snare') {
      const body = osc('triangle', 200, t, t + 0.2), bg = node('gain'); body.frequency.exponentialRampToValueAtTime(160, t + 0.08); env(bg, t, 0.45 * e.vel, 0.001, 0.08); body.connect(bg); bg.connect(drums);
      send(burst(t, 0.17, 1900, 'bandpass', 0.7, 0.55 * e.vel, drums), 0.25); burst(t, 0.09, 5200, 'highpass', 0.8, 0.3 * e.vel, drums);
    } else if (e.kind === 'clap') {
      const s = ctx.createBufferSource(); s.buffer = nz; const f = node('filter', { type: 'bandpass', frequency: 1150, Q: 1.1 }), g = node('gain');
      g.gain.setValueAtTime(0.0001, t);
      for (const d of [0, 0.011, 0.022]) { g.gain.setValueAtTime(0.7 * e.vel, t + d); g.gain.exponentialRampToValueAtTime(0.08, t + d + 0.009); }
      g.gain.setValueAtTime(0.6 * e.vel, t + 0.033); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      s.connect(f); f.connect(g); g.connect(drums); send(g, 0.35); s.start(t, 0.3, 0.3);
    } else if (e.kind === 'hat' || e.kind === 'ohat') {
      const p = node('pan', { pan: e.pan || 0 }); p.connect(drums);
      burst(t, e.kind === 'ohat' ? 0.26 : 0.035, 7600, 'highpass', 0.9, (e.kind === 'ohat' ? 0.22 : 0.26) * e.vel, p, 1.2);
    } else if (e.kind === 'crash') {
      send(burst(t, 1.6, 6000, 'highpass', 0.5, 0.2 * e.vel, drums, 0.9), 0.3);
    } else if (e.kind === '808') {
      const o = osc('sine', hz(e.from != null ? e.from : e.midi), t, t + e.dur + 0.1), g = node('gain');
      if (e.from != null) o.frequency.exponentialRampToValueAtTime(hz(e.midi), t + 0.12); else { o.frequency.setValueAtTime(hz(e.midi) * 1.05, t); o.frequency.exponentialRampToValueAtTime(hz(e.midi), t + 0.04); }
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(e.vel, t + 0.004); g.gain.setValueAtTime(e.vel, t + e.dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + e.dur + 0.08);
      o.connect(g); g.connect(bassClip);
    } else if (e.kind === 'sub') {
      const o = osc('sine', hz(e.midi), t, t + e.dur + 0.1), o2 = osc('triangle', hz(e.midi), t, t + e.dur + 0.1), g = node('gain'), g2 = node('gain', { gain: 0.25 });
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(e.vel * 0.8, t + 0.012); g.gain.setValueAtTime(e.vel * 0.7, t + Math.max(0.02, e.dur - 0.06)); g.gain.exponentialRampToValueAtTime(0.0001, t + e.dur + 0.06);
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(bassLp);
    } else if (e.kind === 'keys') {
      // an electric piano: a sine with a short bright tine on top, a little detuned body, a tremolo and the tape's wobble
      for (const n of e.notes) {
        const f = hz(n), end = t + e.dur + 0.35, a = osc('sine', f, t, end), b = osc('sine', f * 2, t, end), c = osc('triangle', f, t, end, 5), g = node('gain'), gb = node('gain'), gc = node('gain', { gain: 0.22 });
        for (const x of [a, b, c]) wobDepth.connect(x.detune);
        const v = 0.085 * e.vel; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.005); g.gain.exponentialRampToValueAtTime(v * 0.45, t + 0.6); g.gain.setValueAtTime(v * 0.45, t + Math.max(0.61, e.dur)); g.gain.exponentialRampToValueAtTime(0.0001, end);
        env(gb, t, 0.35 * v, 0.002, 0.25);
        a.connect(g); c.connect(gc); gc.connect(g); b.connect(gb); gb.connect(keysBus); g.connect(keysBus);
      }
    } else if (e.kind === 'pad') {
      for (const n of e.notes) for (const side of [-1, 1]) {
        const o = osc('sawtooth', hz(n), t, t + e.dur + 0.8, side * 9), lp = node('filter', { type: 'lowpass', frequency: style === 'drill' ? 700 : 1100, Q: 0.6 }), g = node('gain'), p = node('pan', { pan: side * 0.55 });
        const v = 0.022 * e.vel; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.35); g.gain.setValueAtTime(v, t + e.dur); g.gain.exponentialRampToValueAtTime(0.0001, t + e.dur + 0.7);
        o.connect(lp); lp.connect(g); g.connect(p); p.connect(keysBus);
      }
    } else if (e.kind === 'bell') {
      const f = hz(e.midi), end = t + 1.4, g = node('gain');
      for (const [k, amp, dec] of [[1, 1, 1.2], [2.76, 0.35, 0.4], [5.4, 0.12, 0.15]]) { const o = osc('sine', f * k, t, end), gg = node('gain'); env(gg, t, amp * 0.07 * e.vel, 0.002, dec); o.connect(gg); gg.connect(g); }
      g.connect(keysBus); send(g, 0.35);
    } else if (e.kind === 'pluck') {
      const o = osc('sawtooth', hz(e.midi), t, t + 0.6), lp = node('filter', { type: 'lowpass', frequency: 3200, Q: 2 }), g = node('gain');
      lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(380, t + 0.22);
      env(g, t, 0.06 * e.vel, 0.002, 0.4); o.connect(lp); lp.connect(g); g.connect(keysBus);
    }
  }
  return { seconds: total, kicks: plan.kicks, plan };
}
