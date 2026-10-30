// Verse makes music (owner, 2026-10-17: "void should also learn how to make music"). An original short piece, composed here from a seed and
// played with Web Audio: no model call, no paid service, no tune copied from anywhere. Since 2026-10-30 (owner: "needs real beats and music ...
// not just rap all music") it plays on real recordings when they load: a Steinway grand piano (lib/rap-piano.js) and a recorded drum kit or a
// TR-808 (lib/rap-kit.js), both free (CC0 and free sets, sounds/*/CREDITS.md); without them it is synthesised as before. The same ask always gives the same piece
// (the seed is a hash of the ask's own words). The mood word picks the tempo, the scale and the instruments; everything the card says about the
// piece (key, tempo, bars, chords) is read back from the values that were composed, never described from memory.
// Pure but for the two audio functions, which take any AudioContext-shaped object (a real one, an OfflineAudioContext, or a test's fake).
import { chordOf, takeOf as pianoTake, loadPiano } from './rap-piano.js';
import { takeOf as drumTake, loadKit } from './rap-kit.js';
const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], 'minor pentatonic': [0, 3, 5, 7, 10], 'major pentatonic': [0, 2, 4, 7, 9] };
const PARENT = { 'minor pentatonic': 'minor', 'major pentatonic': 'major' }; // chords are built on the seven-note scale a pentatonic comes from
const PROG = { major: [[0, 4, 5, 3], [0, 5, 3, 4], [0, 3, 4, 3], [0, 2, 3, 4]], minor: [[0, 5, 2, 6], [0, 3, 6, 4], [0, 5, 6, 4], [0, 6, 5, 6]], dorian: [[0, 3, 0, 4]], phrygian: [[0, 1, 0, 6]] };
// mood words -> how the piece is made. First match in this order wins; bpm is [low, high], the seed picks inside it.
const MOODS = [
  { id: 'lullaby', re: /\b(lullab\w*|sleep\w*|bedtime|baby|goodnight|dream\w*)\b/, bpm: [58, 70], scales: ['major pentatonic', 'major'], style: 'soft', lead: 'sine', bars: 8 },
  { id: 'rainy', re: /\b(rain\w*|storm\w*|grey|gray|sad|lonely|melanchol\w*|blue|cry\w*|autumn|quiet|calm|gentle|chill\w*|lofi|lo-fi|relax\w*)\b/, bpm: [66, 82], scales: ['minor', 'minor pentatonic', 'dorian'], style: 'soft', lead: 'triangle', bars: 8 },
  { id: 'dark', re: /\b(dark|scary|spooky|creepy|halloween|haunt\w*|ghost\w*|night\w*|witch\w*|horror)\b/, bpm: [76, 92], scales: ['phrygian', 'minor'], style: 'slow', lead: 'sawtooth', bars: 8 },
  { id: 'epic', re: /\b(epic|battle|hero\w*|adventure|quest|dragon\w*|war|castle)\b/, bpm: [96, 118], scales: ['dorian', 'minor'], style: 'drive', lead: 'sawtooth', bars: 8 },
  { id: 'happy', re: /\b(happy|sunny|sun|summer|party|dance|dancing|joy\w*|fun|cheer\w*|birthday|celebrat\w*|morning|spring|bright)\b/, bpm: [108, 128], scales: ['major', 'major pentatonic'], style: 'dance', lead: 'square', bars: 8 },
  { id: 'beat', re: /\b(beats?|hip[- ]?hop|trap|rap|drums?|groove|boom[- ]?bap)\b/, bpm: [82, 96], scales: ['minor pentatonic', 'minor'], style: 'beat', lead: 'triangle', bars: 8 },
];
const FILL = new Set(['make', 'me', 'a', 'an', 'the', 'some', 'please', 'compose', 'write', 'create', 'generate', 'for', 'about', 'song', 'songs', 'tune', 'music', 'melody', 'of', 'to', 'and', 'my', 'new', 'little', 'short', 'can', 'you', 'i', 'want', 'would', 'like', 'could']);

/** a 32-bit hash of text (FNV-1a). Pure. */
export function hashOf(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, a) => a[Math.floor(r() * a.length) % a.length];
export const noteName = (m) => NOTE[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
export const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

/** the words of an ask that make the piece its own (filler out), lowercase. Pure. */
export function wordsOf(ask) { return String(ask || '').toLowerCase().replace(/[^a-z0-9' -]+/g, ' ').split(/\s+/).filter((w) => w && !FILL.has(w)); }
/** the mood an ask names, or null: { id, ... }. Pure. */
export function moodOf(ask) { const t = String(ask || '').toLowerCase(); return MOODS.find((m) => m.re.test(t)) || null; }

function drumsFor(style, r) {
  const rep = (steps, bars) => { const o = []; for (let b = 0; b < bars; b++) for (const s of steps) o.push(b * 16 + s); return o; };
  const bars = 8;
  const P = {
    soft: { kick: [0], snare: [], hat: [] },
    slow: { kick: [0, 10], snare: [8], hat: [4, 12] },
    drive: { kick: [0, 6, 8, 14], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
    dance: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] },
    beat: { kick: pick(r, [[0, 7, 10], [0, 3, 10], [0, 6, 10, 13]]), snare: [4, 12], hat: pick(r, [[0, 2, 4, 6, 8, 10, 12, 14], [0, 3, 4, 7, 8, 11, 12, 15]]) },
  }[style];
  return { kick: rep(P.kick, bars), snare: rep(P.snare, bars), hat: rep(P.hat, bars) };
}

/** compose the piece an ask names. Same ask, same piece. Returns
 *  { title, ask, seed, mood, style, lead, key, tonic, scale, bpm, bars, stepsPerBar, steps, seconds, chords: [{ bar, root, name, tones }], bass: [{ step, midi, len }], melody: [{ step, midi, len }], drums: { kick, snare, hat } }. Pure. */
export function compose(ask, variation = 0) {
  const words = wordsOf(ask), seed = hashOf((words.join(' ') || 'untitled') + '|' + variation), r = rng(seed);
  const mood = moodOf(ask) || pick(r, MOODS), asked = !!moodOf(ask);
  const scale = pick(r, mood.scales), tonic = 48 + Math.floor(r() * 12), bpm = Math.round(mood.bpm[0] + r() * (mood.bpm[1] - mood.bpm[0]));
  const chordScale = SCALES[PARENT[scale] || scale], prog = pick(r, PROG[PARENT[scale] || scale]);
  const bars = mood.bars, spb = 16, deg = (i, oct = 0) => tonic + chordScale[((i % 7) + 7) % 7] + 12 * (Math.floor(i / 7) + oct);
  const chords = [], bass = [];
  for (let b = 0; b < bars; b++) {
    const d = prog[b % prog.length], root = deg(d), tones = [deg(d), deg(d + 2), deg(d + 4)];
    const triad = (tones[1] - tones[0]) === 3 ? (tones[2] - tones[1] === 4 ? 'minor' : 'dim') : (tones[2] - tones[1] === 3 ? 'major' : 'aug');
    chords.push({ bar: b, root, name: noteName(root).replace(/-?\d+$/, '') + (triad === 'minor' ? 'm' : triad === 'dim' ? 'dim' : triad === 'aug' ? 'aug' : ''), tones });
    bass.push({ step: b * spb, midi: root - 12, len: mood.style === 'soft' ? 14 : 8 });
    if (mood.style !== 'soft') bass.push({ step: b * spb + 8, midi: (r() < 0.5 ? root : root + 7) - 12, len: 6 });
  }
  // melody: a two-bar motif on the scale (a walk, stepping mostly), played, varied once, played again, ending on the tonic
  const mel = SCALES[scale], at = (i) => tonic + 12 + mel[((i % mel.length) + mel.length) % mel.length] + 12 * Math.floor(i / mel.length);
  const rhythms = mood.style === 'soft' ? [[0, 4, 8, 12], [0, 6, 8], [0, 8], [0, 3, 8, 11]] : [[0, 2, 4, 8, 10, 12], [0, 4, 6, 8, 12, 14], [0, 3, 6, 8, 11, 14], [0, 4, 8, 10, 12]];
  const motif = []; let pos = pick(r, [0, 2, 4]);
  for (let b = 0; b < 2; b++) { const rh = pick(r, rhythms); rh.forEach((s, k) => { pos = Math.max(-2, Math.min(mel.length + 3, pos + pick(r, [-2, -1, -1, 0, 1, 1, 2]))); const next = rh[k + 1] == null ? spb : rh[k + 1]; motif.push({ step: b * spb + s, i: pos, len: Math.max(1, Math.min(next - s, mood.style === 'soft' ? 8 : 4)) }); }); }
  const melody = [];
  for (let rep = 0; rep < bars / 2; rep++) for (const n of motif) {
    const varied = rep % 2 === 1 && n.step % 5 === 0 ? n.i + pick(r, [-1, 1]) : n.i;
    melody.push({ step: rep * 2 * spb + n.step, midi: at(varied), len: n.len });
  }
  const last = melody[melody.length - 1]; if (last) { last.midi = at(0); last.len = 12; } // it ends at home
  const steps = bars * spb, seconds = Math.round(steps * (60 / bpm / 4) * 10) / 10;
  const key = noteName(tonic).replace(/-?\d+$/, '');
  const title = (words.slice(0, 3).join(' ') || mood.id).replace(/^./, (c) => c.toUpperCase());
  return { title, ask: String(ask || '').slice(0, 120), seed, mood: mood.id, moodAsked: asked, style: mood.style, lead: mood.lead, key, tonic, scale, bpm, bars, stepsPerBar: spb, steps, seconds, chords, bass, melody, drums: drumsFor(mood.style, r) };
}

/** the plain sentence about what was made, from the real values. Pure. */
export function describe(p) {
  const prog = p.chords.slice(0, 4).map((c) => c.name).join(' – ');
  return 'An original ' + p.mood + ' piece in ' + p.key + ' ' + p.scale + ', ' + p.bpm + ' beats a minute, ' + p.bars + ' bars (about ' + Math.round(p.seconds) + ' seconds), over ' + prog + '. '
    + (p.moodAsked ? '' : 'Your words named no mood, so it chose one. ') + 'Made here in your browser from the words of your ask: the same ask gives the same piece. Nothing was copied.';
}

/** the notes as text, bar by bar, to copy. Pure. */
export function notesText(p) {
  const L = [p.title + ' (Verse, ' + p.key + ' ' + p.scale + ', ' + p.bpm + ' bpm, ' + p.bars + ' bars; 16 steps a bar, step 1 first)', 'ask: ' + p.ask, ''];
  for (let b = 0; b < p.bars; b++) {
    const lo = b * p.stepsPerBar, hi = lo + p.stepsPerBar;
    const m = p.melody.filter((n) => n.step >= lo && n.step < hi).map((n) => noteName(n.midi) + '@' + (n.step - lo + 1) + 'x' + n.len).join(' ');
    const d = (k) => p.drums[k].filter((s) => s >= lo && s < hi).map((s) => s - lo + 1).join(',');
    L.push('bar ' + (b + 1) + ' ' + p.chords[b].name + ': ' + (m || '-') + (p.drums.kick.length ? ' | kick ' + (d('kick') || '-') + ' snare ' + (d('snare') || '-') + ' hat ' + (d('hat') || '-') : ''));
  }
  return L.join('\n');
}

/** 16-bit mono PCM WAV bytes from a Float32Array of samples. Pure. */
export function wavBytes(samples, rate) {
  const n = samples.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const x = Math.max(-1, Math.min(1, samples[i])); v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true); }
  return new Uint8Array(buf);
}

/** which real recordings a piece plays, by its style and lead: the piano always takes the chords, the bass on the soft pieces and the tune
 *  when the lead is a soft voice (sine or triangle); the drums are the acoustic kit, or the TR-808 for a beat. Pure. */
export function partsOf(p) {
  const soft = p.style === 'soft';
  return { chords: true, bass: soft, melody: p.lead === 'sine' || p.lead === 'triangle', kit: p.drums.kick.length ? (p.style === 'beat' ? '808' : 'kit') : null };
}
/** the MIDI notes the piano plays in a piece (the takes it needs). Pure. */
export function pianoNotesOf(p) {
  const parts = partsOf(p);
  return [...p.chords.flatMap((c) => c.tones), ...(parts.bass ? p.bass.map((b) => b.midi) : []), ...(parts.melody ? p.melody.map((n) => n.midi) : [])];
}
/** load the real instruments a piece plays, decoded by `ctx`: { piano, kit }, each null when it cannot load (the piece then synthesises
 *  that part). */
export async function instrumentsFor(p, ctx, { fetchFn = (u) => globalThis.fetch(u) } = {}) {
  if (!ctx || typeof ctx.decodeAudioData !== 'function') return { piano: null, kit: null };
  // a heavy song (lib/arrange.js) plays its pad on the piano and every drum on the acoustic kit
  const decode = (bytes) => ctx.decodeAudioData(bytes), kitName = p.sections ? 'kit' : partsOf(p).kit, notes = p.sections ? (p.pad || []).map((n) => n.midi) : pianoNotesOf(p);
  const [piano, kit] = await Promise.all([(notes.length ? loadPiano({ notes, fetchFn, decode }) : Promise.reject(new Error('no piano part'))).catch(() => null), kitName ? loadKit(kitName, { fetchFn, decode }).catch(() => null) : null]);
  return { piano, kit };
}
/** a plain sentence about what played, from what loaded. Pure. */
export function playedLine(p, { piano = null, kit = null } = {}) {
  const k = partsOf(p).kit, drums = !k ? '' : kit ? (k === '808' ? ' and a real TR-808' : ' and a real drum kit') : '';
  if (piano) return 'Played on a real grand piano' + drums + '.' + (k && !kit ? ' The recorded drums did not load, so the drums are synthesised.' : '');
  return 'The piano recordings did not load, so it is synthesised' + (kit ? ' over' + drums.replace(' and', '') : '') + '.';
}

/** play the piece on a context (real or offline) starting at t0 seconds; returns the seconds it lasts. With `piano` and `kit` (instrumentsFor)
 *  the piano and drum parts play the recordings; without them every part is synthesised (sine, triangle, square, sawtooth and noise). */
export function schedule(ctx, p, t0 = 0, { piano = null, kit = null } = {}) {
  const sp = 60 / p.bpm / 4, out = ctx.createGain(); out.gain.value = 0.5; out.connect(ctx.destination);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = p.lead === 'sine' || p.lead === 'triangle' ? 5000 : 2600; lp.connect(out);
  const r = rng(p.seed ^ 0x9e3779b9), nb = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * 0.5)), ctx.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = r() * 2 - 1;
  const note = (dest, type, midi, step, len, gain, atk = 0.01, rel = 0.12) => {
    const t = t0 + step * sp, d = len * sp, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = hz(midi); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + atk); g.gain.setValueAtTime(gain, t + Math.max(atk, d - rel)); g.gain.linearRampToValueAtTime(0.0001, t + d + rel);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + d + rel + 0.02);
  };
  const hit = (step, { freq, type, dur, gain, drop = 0 }) => {
    const t = t0 + step * sp;
    if (drop) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * drop), t + dur); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02); return; }
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = nb; f.type = type; f.frequency.value = freq; g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(out); s.start(t, 0, dur + 0.02);
  };
  const soft = p.style === 'soft', parts = partsOf(p), keys = !!(piano && piano.buffers && piano.buffers.size), drumKit = kit && kit.buffers && kit.buffers.size && parts.kit === kit.name ? kit : null;
  // a recorded piano note: the nearest take at its pitch, held for its length, the damper falling over 0.3 s
  const pianoNote = (midi, at, len, vel) => {
    const k = pianoTake(midi, vel), buf = piano.buffers.get(k.path); if (!buf) return;
    const s = ctx.createBufferSource(), g = ctx.createGain(), off = at + Math.min(Math.max(0.08, len), 2.6);
    s.buffer = buf; s.playbackRate.value = k.rate; g.gain.setValueAtTime(0.42 * k.gain, at); g.gain.setValueAtTime(0.42 * k.gain, off); g.gain.exponentialRampToValueAtTime(0.0001, off + 0.3);
    s.connect(g); g.connect(out); s.start(at); s.stop(off + 0.32);
  };
  if (keys) for (const c of p.chords) {
    const bar = p.stepsPerBar * sp, at = t0 + c.bar * bar, hits = soft || p.style === 'slow' ? [[0, 1, 0.62]] : [[0, 0.5, 0.72], [0.5, 0.5, 0.58]];
    for (const [from, len, vel] of hits) for (const n of chordOf({ t: at + from * bar, vel, notes: c.tones, dur: len * bar })) pianoNote(n.midi, n.t, n.dur, n.vel);
  } else for (const c of p.chords) for (const m of c.tones) note(out, 'sine', m, c.bar * p.stepsPerBar, p.stepsPerBar, soft ? 0.05 : 0.04, 0.08, 0.3);
  for (const b of p.bass) if (keys && parts.bass) pianoNote(b.midi, t0 + b.step * sp, b.len * sp, 0.7); else note(out, 'sine', b.midi, b.step, b.len, 0.2, 0.02, 0.1);
  for (const n of p.melody) if (keys && parts.melody) pianoNote(n.midi, t0 + n.step * sp, n.len * sp, 0.88); else note(lp, p.lead, n.midi, n.step, n.len, p.lead === 'sine' || p.lead === 'triangle' ? 0.16 : 0.07, 0.015, 0.15);
  if (drumKit) {
    // the recorded drums: round robins alternate, the off-beat hats a little softer
    const rr = {}, play = (voice, step, vel, gain) => { const n = rr[voice] = (rr[voice] ?? -1) + 1, k = drumTake(drumKit.name, voice, vel, n), buf = k && drumKit.buffers.get(k.path); if (!buf) return; const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = buf; g.gain.value = k.gain * gain; s.connect(g); g.connect(out); s.start(t0 + step * sp); };
    for (const s of p.drums.kick) play('kick', s, soft ? 0.6 : 1, 0.8);
    for (const s of p.drums.snare) play('snare', s, 1, 0.6);
    for (const s of p.drums.hat) play('hat', s, s % 4 === 0 ? 0.9 : 0.65, 0.4);
  } else {
    for (const s of p.drums.kick) hit(s, { freq: 140, dur: 0.18, gain: soft ? 0.25 : 0.55, drop: 0.3 });
    for (const s of p.drums.snare) hit(s, { freq: 1800, type: 'bandpass', dur: 0.14, gain: 0.22 });
    for (const s of p.drums.hat) hit(s, { freq: 7000, type: 'highpass', dur: 0.05, gain: 0.08 });
  }
  return p.steps * sp + (keys ? 2.4 : 0.6);
}

/** render the piece to WAV bytes in the browser (OfflineAudioContext, 22.05 kHz mono), on `instruments` (instrumentsFor) when given, or null
 *  when there is no offline audio. */
export async function renderWav(p, OAC = typeof OfflineAudioContext !== 'undefined' ? OfflineAudioContext : (typeof webkitOfflineAudioContext !== 'undefined' ? webkitOfflineAudioContext : null), instruments = {}) {
  if (!OAC) return null;
  const rate = 22050, secs = p.steps * (60 / p.bpm / 4) + (instruments.piano ? 2.6 : 0.8), ctx = new OAC(1, Math.ceil(secs * rate), rate);
  schedule(ctx, p, 0, instruments);
  const buf = await ctx.startRendering();
  return wavBytes(buf.getChannelData(0), rate);
}
