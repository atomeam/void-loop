/**
 * arrange: a song with a shape (owner, 2026-10-24: music that "hits": quiet and loud sections, a drop that punches). "make a heavy metal song" is
 * not eight bars on one loop: it is a tension curve through sections, intro (piano-like pad and a lead), drop (drums, bass, chugging guitar),
 * breakdown (half-time, sparse and heavy), bridge (pulled back to pad, lead and bass) and climax (everything, double kick, crashes), each
 * with its own tracks, its own loudness, and the pad and lead ducked on every kick so the kick hits through them (sidechain, in the gain
 * automation itself). The same ask gives the same song. Made in the visitor's browser with Web Audio: no model, no server, no cost. With the
 * real instruments loaded (compose.js instrumentsFor; owner, 2026-10-30: "drums needs to sound like perfect studio quality") the drums are the
 * recorded acoustic kit and the pad is the recorded grand piano, both public domain; without them both are synthesised. No real singer's voice
 * or recording of a song is imitated; the guitar is detuned sawtooth pairs through a tanh waveshaper and a cabinet filter
 * (about 3.2 kHz low-pass with a bump near 100 Hz).
 * The piece has the same shape lib/compose.js makes (chords, bass, melody, drums as step arrays, bpm, bars) plus
 * `sections`, `guitar`, `pad` and `drums.crash`, so the piano roll, the notes text and the player's playhead work on it unchanged.
 * Tests: tools/arrange.test.mjs (the shape, in Node) and the browser section "music: a heavy ask" (renders it and measures each section's loudness).
 */
import { SCALES, hashOf, noteName, hz, wordsOf, wavBytes } from './compose.js';
import { chordOf, takeOf as pianoTake } from './rap-piano.js';
import { takeOf as drumTake } from './rap-kit.js';

/** the asks that want a heavy, shaped song rather than the default loop. Pure. */
export const HEAVY = /\b(heavy|metal|rock|punk|hardcore|screamo|industrial|aggressive|angry|rage|intense|brutal|breakdown|riff|mosh|thrash|djent|grunge)\b/i;
export const isHeavy = (ask) => HEAVY.test(String(ask || ''));

/** the form: each section's length in bars, its tension (0 quiet to 1 everything), the tracks that play and how deep the pad and lead are ducked by each kick. */
export const FORM = Object.freeze([
  { id: 'intro', bars: 4, tension: 0.2, tracks: ['pad', 'lead'], duck: 0 },
  { id: 'drop', bars: 8, tension: 0.75, tracks: ['drums', 'bass', 'guitar', 'pad'], duck: 0.7 },
  { id: 'breakdown', bars: 4, tension: 0.9, tracks: ['drums', 'bass', 'guitar'], duck: 0 },
  { id: 'bridge', bars: 4, tension: 0.3, tracks: ['pad', 'lead', 'bass'], duck: 0 },
  { id: 'climax', bars: 8, tension: 1, tracks: ['drums', 'bass', 'guitar', 'pad', 'lead'], duck: 0.7 },
]);

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, a) => a[Math.floor(r() * a.length) % a.length];
const SPB = 16;
const GUITAR = { drop: [[0, 2, 3, 6, 8, 10, 11, 14], [0, 3, 6, 8, 11, 14], [0, 2, 4, 6, 8, 10, 12, 14]], breakdown: [[0, 6, 8, 11], [0, 3, 8, 10], [0, 8, 11, 14]], climax: [[0, 2, 3, 4, 6, 8, 10, 11, 12, 14]] };
const KICK = { drop: [0, 3, 6, 8, 11, 14], breakdown: [0, 6, 8, 11], climax: [0, 2, 3, 6, 8, 10, 11, 14] };
const FILL = [8, 10, 12, 13, 14, 15];

/** the heavy song an ask names: same ask, same song; null for an ask that is not a heavy one. Pure. */
export function arrange(ask, variation = 0) {
  if (!isHeavy(ask)) return null;
  const words = wordsOf(ask), seed = hashOf((words.join(' ') || 'heavy') + '|heavy|' + variation), r = rng(seed);
  const scale = pick(r, ['phrygian', 'minor']), tonic = 38 + Math.floor(r() * 8), bpm = 92 + Math.floor(r() * 26), cs = SCALES[scale];
  const prog = scale === 'phrygian' ? [0, 1, 0, 6] : pick(r, [[0, 5, 2, 6], [0, 6, 5, 6], [0, 3, 6, 4]]);
  const deg = (i, oct = 0) => tonic + cs[((i % 7) + 7) % 7] + 12 * (Math.floor(i / 7) + oct);
  const sections = []; let bar = 0; for (const f of FORM) { sections.push({ ...f, tracks: [...f.tracks], from: bar, fromStep: bar * SPB, steps: f.bars * SPB }); bar += f.bars; }
  const bars = bar, steps = bars * SPB, secOf = (b) => sections.find((s) => b >= s.from && b < s.from + s.bars), has = (s, t) => s.tracks.includes(t);
  const chords = [], bass = [], guitar = [], pad = [], melody = [], kick = [], snare = [], hat = [], crash = [];
  const pat = {}; for (const k of Object.keys(GUITAR)) pat[k] = pick(r, GUITAR[k]);
  for (let b = 0; b < bars; b++) {
    const s = secOf(b), d = prog[b % prog.length], root = deg(d), tones = [deg(d), deg(d + 2), deg(d + 4)], base = b * SPB, last = b === s.from + s.bars - 1, first = b === s.from;
    const third = tones[1] - tones[0], fifth = tones[2] - tones[1];
    chords.push({ bar: b, root, name: noteName(root).replace(/-?\d+$/, '') + (third === 3 ? (fifth === 4 ? 'm' : 'dim') : (fifth === 3 ? '' : 'aug')), tones });
    if (has(s, 'pad')) for (const m of tones) pad.push({ step: base, midi: m + 12, len: SPB });
    const riff = pat[s.id];
    if (has(s, 'guitar') && riff) for (const st of riff) {
      if (last && st >= 14) continue; // the last bar of a section leaves room for the fill and the hit
      guitar.push({ step: base + st, midi: root, len: st === 0 || (s.id === 'climax' && st === 8) ? 3 : 1, open: st === 0 || (s.id === 'climax' && st === 8) });
    }
    if (has(s, 'bass')) {
      if (riff && has(s, 'guitar')) for (const st of riff) { if (!(last && st >= 14)) bass.push({ step: base + st, midi: root - 12, len: st === 0 ? 3 : 1 }); }
      else bass.push({ step: base, midi: root - 12, len: 14, soft: true }); // the bridge: one long, quiet note a bar under the pad
    }
    if (has(s, 'drums')) {
      for (const st of KICK[s.id]) if (!(last && st >= 14)) kick.push(base + st);
      if (s.id === 'breakdown') snare.push(base + 8); else for (const st of [4, 12]) snare.push(base + st);
      if (s.id !== 'breakdown') for (let st = 0; st < SPB; st += 2) hat.push(base + st);
      if (first || (s.id === 'climax' && (b - s.from) % 4 === 0)) crash.push(base);
      if (last) for (const st of FILL) snare.push(base + st);
    } else if (s.id === 'intro' && last) for (const st of FILL) snare.push(base + st); // the build into the first drop
  }
  // the lead: a two-bar motif on the scale, soft in the intro, slow and long in the bridge, loud in the climax, ending at home
  const at = (i) => tonic + 12 + cs[((i % 7) + 7) % 7] + 12 * Math.floor(i / 7);
  const rhythms = [[0, 4, 8, 12], [0, 6, 8, 14], [0, 3, 8, 11], [0, 8]]; const motif = []; let pos = pick(r, [0, 2, 4]);
  for (let b = 0; b < 2; b++) { const rh = pick(r, rhythms); rh.forEach((st, k) => { pos = Math.max(-2, Math.min(9, pos + pick(r, [-2, -1, -1, 0, 1, 1, 2]))); const next = rh[k + 1] == null ? SPB : rh[k + 1]; motif.push({ step: b * SPB + st, i: pos, len: Math.max(1, Math.min(next - st, 8)) }); }); }
  for (const s of sections) if (has(s, 'lead')) for (let rep = 0; rep < s.bars / 2; rep++) for (const n of motif) {
    const long = s.id === 'bridge'; melody.push({ step: s.fromStep + rep * 2 * SPB + n.step, midi: at(long ? n.i - 3 : n.i), len: long ? Math.min(SPB, n.len * 2) : n.len });
  }
  const end = melody[melody.length - 1]; if (end) { end.midi = at(0); end.len = 12; }
  const key = noteName(tonic).replace(/-?\d+$/, ''), title = (words.slice(0, 3).join(' ') || 'heavy').replace(/^./, (c) => c.toUpperCase());
  return { title, ask: String(ask || '').slice(0, 120), seed, mood: 'heavy', moodAsked: true, style: 'heavy', lead: 'sawtooth', key, tonic, scale, bpm, bars, stepsPerBar: SPB, steps,
    seconds: Math.round(steps * (60 / bpm / 4) * 10) / 10, chords, bass, melody, guitar, pad, drums: { kick, snare, hat, crash }, sections };
}

/** the line that says how the song is built, from its own sections. Pure. */
export const sectionsLine = (p) => (p.sections || []).map((s) => s.id + ' ' + s.bars).join(' · ') + ' (bars)';

/** the section strip under the piano roll: each section's name and a bar as tall as its tension. Pure; returns SVG markup. */
export function sectionsSvg(p, W = 320, y0 = 150) {
  let s = '';
  for (const sec of p.sections || []) {
    const x = (sec.fromStep / p.steps) * W, w = (sec.steps / p.steps) * W, h = 4 + sec.tension * 14;
    s += '<rect x="' + (x + 0.5).toFixed(1) + '" y="' + (y0 + 20 - h).toFixed(1) + '" width="' + (w - 1).toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2" fill="currentColor" opacity="' + (0.18 + sec.tension * 0.5).toFixed(2) + '"/>'
      + '<text x="' + (x + w / 2).toFixed(1) + '" y="' + (y0 + 18).toFixed(1) + '" font-size="7" text-anchor="middle" fill="currentColor" opacity=".85">' + sec.id + '</text>';
  }
  return s;
}

const curve = (k) => { const c = new Float32Array(2048); for (let i = 0; i < c.length; i++) { const x = (i / (c.length - 1)) * 2 - 1; c[i] = Math.tanh(k * x); } return c; };

/** play the song on a context (real or offline) from t0 seconds; returns the seconds it lasts. */
export function scheduleArranged(ctx, p, t0 = 0, { piano = null, kit = null } = {}) {
  const sp = 60 / p.bpm / 4, tension = (step) => { const s = p.sections.find((x) => step >= x.fromStep && step < x.fromStep + x.steps) || p.sections[0]; return 0.3 + 0.7 * s.tension; };
  // master: a limiter-like compressor so the loud sections never clip; the contrast between sections stays in the notes' own gains
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -8; comp.knee.value = 6; comp.ratio.value = 10; comp.attack.value = 0.003; comp.release.value = 0.12;
  const out = ctx.createGain(); out.gain.value = 0.9; out.connect(comp); comp.connect(ctx.destination);
  // the soft bus (pad, lead) is the one the kick ducks; the hard bus (guitar, bass, drums) is not
  const soft = ctx.createGain(); soft.gain.value = 1; soft.connect(out);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; lp.connect(soft);
  const bassLp = ctx.createBiquadFilter(); bassLp.type = 'lowpass'; bassLp.frequency.value = 420; bassLp.connect(out);
  // the guitar bus: drive, a hard tanh clip, then the cabinet: low-pass near 3.2 kHz with a resonant bump near 100 Hz, and a high-pass under the mud
  const drive = ctx.createGain(); drive.gain.value = 3; const shaper = ctx.createWaveShaper(); shaper.curve = curve(4); try { shaper.oversample = '4x'; } catch (_) { /* a context without oversampling */ }
  const cab = ctx.createBiquadFilter(); cab.type = 'lowpass'; cab.frequency.value = 3200; cab.Q.value = 0.7;
  const bump = ctx.createBiquadFilter(); bump.type = 'peaking'; bump.frequency.value = 100; bump.Q.value = 1.2; bump.gain.value = 5;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 60; const gOut = ctx.createGain(); gOut.gain.value = 0.3;
  drive.connect(shaper); shaper.connect(cab); cab.connect(bump); bump.connect(hp); hp.connect(gOut); gOut.connect(out);
  const nb = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * 1.5)), ctx.sampleRate), nd = nb.getChannelData(0), r = rng(p.seed ^ 0x9e3779b9); for (let i = 0; i < nd.length; i++) nd[i] = r() * 2 - 1;
  const tone = (dest, type, midi, step, len, gain, atk = 0.01, rel = 0.12, cents = 0) => {
    const t = t0 + step * sp, d = len * sp, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = hz(midi); if (cents) o.detune.value = cents;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + atk); g.gain.setValueAtTime(gain, t + Math.max(atk, d - rel)); g.gain.linearRampToValueAtTime(0.0001, t + d + rel);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + d + rel + 0.02);
  };
  const noise = (dest, type, freq, step, dur, gain) => {
    const t = t0 + step * sp, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = nb; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(dest); s.start(t, 0, dur + 0.02);
  };
  const keys = !!(piano && piano.buffers && piano.buffers.size), drumKit = kit && kit.buffers && kit.buffers.size && kit.name === 'kit' ? kit : null;
  const sample = (buf, at, rate, gain, dest, off = null) => {
    // start before stop: Web Audio throws InvalidStateError when stop() comes first, and the whole song then never plays
    const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = buf; s.playbackRate.value = rate; g.gain.setValueAtTime(gain, at);
    s.connect(g); g.connect(dest); s.start(at);
    if (off != null) { g.gain.setValueAtTime(gain, off); g.gain.exponentialRampToValueAtTime(0.0001, off + 0.3); s.stop(off + 0.32); }
    return s;
  };
  if (keys) { // the pad on the grand piano: each bar's chord rolled once, louder as the section's tension rises, held under the bar
    const bars = new Map(); for (const n of p.pad) { if (!bars.has(n.step)) bars.set(n.step, []); bars.get(n.step).push(n.midi); }
    for (const [step, notes] of bars) for (const n of chordOf({ t: t0 + step * sp, vel: 0.45 + 0.4 * (tension(step) - 0.3) / 0.7, notes, dur: p.stepsPerBar * sp })) {
      const k = pianoTake(n.midi, n.vel), buf = piano.buffers.get(k.path); if (buf) sample(buf, n.t, k.rate, 0.3 * k.gain, soft, n.t + Math.min(n.dur, 2.6));
    }
  } else for (const n of p.pad) tone(soft, 'sine', n.midi, n.step, n.len, 0.05, 0.08, 0.3);
  for (const n of p.melody) { const lead = p.sections.find((s) => n.step >= s.fromStep && n.step < s.fromStep + s.steps); tone(lp, lead && lead.id === 'climax' ? 'sawtooth' : 'triangle', n.midi, n.step, n.len, (lead && lead.id === 'climax' ? 0.07 : lead && lead.id === 'bridge' ? 0.1 : 0.15) * tension(n.step), 0.015, 0.15); }
  for (const n of p.bass) tone(bassLp, 'sawtooth', n.midi, n.step, n.len * 0.9, (n.soft ? 0.09 : 0.22) * tension(n.step), n.soft ? 0.05 : 0.005, 0.06);
  for (const n of p.guitar) { // two detuned sawtooths a note (about 12 cents either side), and the fifth under an open chord
    const g = 0.13 * tension(n.step), len = n.open ? n.len : 0.8;
    for (const c of [-12, 12]) { tone(drive, 'sawtooth', n.midi, n.step, len, g, 0.004, 0.03, c); if (n.open) tone(drive, 'sawtooth', n.midi + 7, n.step, len, g * 0.8, 0.004, 0.03, c); }
  }
  const dr = p.drums;
  if (drumKit) { // the recorded kit: the velocity follows the section's tension, so the breakdown and climax hit harder than the drop
    const rr = {}, hitOf = (voice, step, vel, gain) => { const n = rr[voice] = (rr[voice] ?? -1) + 1, k = drumTake('kit', voice, vel, n), buf = k && drumKit.buffers.get(k.path); if (buf) sample(buf, t0 + step * sp, 1, gain * k.gain, out); };
    for (const s of dr.kick) hitOf('kick', s, Math.min(1, 0.55 + 0.45 * tension(s)), 1);
    for (const s of dr.snare) hitOf('snare', s, Math.min(1, 0.5 + 0.5 * tension(s)), 0.8);
    for (const s of dr.hat) hitOf('hat', s, s % 4 === 0 ? 0.85 : 0.6, 0.35);
    for (const s of dr.crash) hitOf('crash', s, 1, 0.45);
  } else {
  for (const s of dr.kick) { const t = t0 + s * sp, o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(155, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.2); g.gain.setValueAtTime(0.95 * tension(s), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.26); noise(out, 'highpass', 3000, s, 0.02, 0.12); }
  for (const s of dr.snare) { noise(out, 'bandpass', 1800, s, 0.16, 0.5 * tension(s)); noise(out, 'highpass', 6000, s, 0.1, 0.12); }
  for (const s of dr.hat) noise(out, 'highpass', 7500, s, 0.04, 0.09 * tension(s));
  for (const s of dr.crash) noise(out, 'highpass', 5000, s, 1.1, 0.2);
  }
  // the sidechain: every kick in a section with `duck` dips the soft bus to about 30% in 10 ms and lets it back over about 120 ms
  soft.gain.setValueAtTime(1, 0);
  for (const s of dr.kick) {
    const sec = p.sections.find((x) => s >= x.fromStep && s < x.fromStep + x.steps); if (!sec || !sec.duck) continue;
    const t = t0 + s * sp, low = 1 - sec.duck; soft.gain.setValueAtTime(1, t); soft.gain.linearRampToValueAtTime(low, t + 0.01); soft.gain.linearRampToValueAtTime(1, t + 0.13);
  }
  return p.steps * sp + (keys || drumKit ? 2.4 : 1.2);
}
/** a plain sentence about what played in a heavy song, from what loaded. Pure. */
export function arrangedLine(p, { piano = null, kit = null } = {}) {
  const k = !!(kit && kit.name === 'kit'), pi = !!piano;
  if (k && pi) return 'The drums are a real recorded kit and the pad is a real grand piano; the guitar, bass and lead are synthesised.';
  if (k) return 'The drums are a real recorded kit; the piano did not load, so the pad, guitar, bass and lead are synthesised.';
  if (pi) return 'The pad is a real grand piano; the recorded drums did not load, so they are synthesised with the guitar, bass and lead.';
  return 'The recordings did not load, so every part is synthesised.';
}

/** render the song to samples in the browser (OfflineAudioContext, 22.05 kHz mono): { samples, rate }, or null with no offline audio. */
export async function renderArranged(p, OAC = typeof OfflineAudioContext !== 'undefined' ? OfflineAudioContext : (typeof webkitOfflineAudioContext !== 'undefined' ? webkitOfflineAudioContext : null), instruments = {}) {
  if (!OAC) return null;
  const real = instruments.piano || instruments.kit, rate = 22050, ctx = new OAC(1, Math.ceil((p.steps * (60 / p.bpm / 4) + (real ? 2.6 : 1.4)) * rate), rate); scheduleArranged(ctx, p, 0, instruments);
  const buf = await ctx.startRendering(); return { samples: buf.getChannelData(0), rate };
}
/** the song as WAV bytes, or null. */
export async function arrangedWav(p, OAC, instruments = {}) { const r = await renderArranged(p, OAC, instruments); return r ? wavBytes(r.samples, r.rate) : null; }

/** each section's loudness from rendered samples: [{ id, rms, db }] (db is 20 log10 of the RMS over the section's own time, full scale 0). Pure. */
export function sectionLoudness(samples, rate, p) {
  const sp = 60 / p.bpm / 4;
  return p.sections.map((s) => {
    const a = Math.floor(s.fromStep * sp * rate), b = Math.min(samples.length, Math.floor((s.fromStep + s.steps) * sp * rate)); let sum = 0;
    for (let i = a; i < b; i++) sum += samples[i] * samples[i];
    const rms = Math.sqrt(sum / Math.max(1, b - a)); return { id: s.id, rms, db: rms > 0 ? 20 * Math.log10(rms) : -120 };
  });
}
