// The sound of the music pages (/metronome/, /piano/, /tuner/, /bpm/, /chords/, /music/): everything is made here from oscillators and noise with Web Audio,
// so there is no sample file to load and nothing to license. Browser only; the numbers come from lib/music-tools.js. Tests: tools/music-page.mjs (a real browser).
import { INSTRUMENTS, freqOfMidi } from '/lib/music-tools.js';

let ctx = null, master = null, wet = null, reverbOn = false, noiseBuf = null;
/** the shared audio context, made on first use (a press or a tap lets it start); null when the browser has none. */
export function audio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx; }
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (!AC) return null;
  ctx = new AC({ latencyHint: 'interactive' }); master = ctx.createGain(); master.gain.value = 0.8;
  const comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // a small room: noise that fades away, mixed in when the reverb is on
  const len = Math.floor(ctx.sampleRate * 1.4), ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const ch = ir.getChannelData(c); for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3; }
  const conv = ctx.createConvolver(); conv.buffer = ir; wet = ctx.createGain(); wet.gain.value = 0; master.connect(conv); conv.connect(wet); wet.connect(comp);
  return ctx;
}
export const setVolume = (v) => { audio(); if (master) master.gain.value = Math.max(0, Math.min(1, v)); };
export const setReverb = (on) => { reverbOn = !!on; audio(); if (wet) wet.gain.value = reverbOn ? 0.35 : 0; };
export const now = () => (ctx ? ctx.currentTime : 0);

const env = (g, t, peak, attack, decay, end = 0.0001) => { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(end, t + attack + decay); };
const osc = (type, f, t, dur, peak, dest, fEnd) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (fEnd) o.frequency.exponentialRampToValueAtTime(fEnd, t + dur); env(g, t, peak, 0.001, dur); o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05); return o; };
const noise = (t, dur, peak, type, freq, dest) => { const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; env(g, t, peak, 0.001, dur); s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05); };

export const CLICK_SOUNDS = Object.freeze({ click: 'Click', wood: 'Wood block', hihat: 'Hi-hat', cowbell: 'Cowbell', beep: 'Beep', rimshot: 'Rim shot', kick: 'Kick drum', tick: 'Soft tick', clap: 'Clap' });
/** one metronome click at audio time `t`: level 3 (strong), 2, 1, or 0.4 (a subdivision), as the chosen sound. */
export function click(t, level, sound = 'click', vol = 1) {
  if (!audio()) return; const hi = level >= 3, mid = level >= 2, p = Math.min(1, 0.25 + level * 0.25) * vol, pitch = hi ? 1.5 : mid ? 1.2 : 1;
  switch (sound) {
    case 'wood': osc('sine', 880 * pitch, t, 0.06, p, master); noise(t, 0.015, p * 0.4, 'bandpass', 2500, master); break;
    case 'hihat': noise(t, hi ? 0.11 : 0.05, p * 0.8, 'highpass', 7000, master); break;
    case 'cowbell': osc('square', 560 * pitch, t, 0.25, p * 0.25, master); osc('square', 845 * pitch, t, 0.25, p * 0.25, master); break;
    case 'beep': osc('sine', (hi ? 1320 : mid ? 990 : 880), t, 0.07, p * 0.7, master); break;
    case 'rimshot': noise(t, 0.04, p * 0.7, 'bandpass', 1800, master); osc('triangle', 1700 * pitch, t, 0.05, p * 0.4, master); break;
    case 'kick': osc('sine', 150 * pitch, t, 0.16, p, master, 45); break;
    case 'tick': osc('sine', 2400 * pitch, t, 0.018, p * 0.7, master); break;
    case 'clap': for (const d of [0, 0.012, 0.024]) noise(t + d, 0.05, p * 0.5, 'bandpass', 1500, master); break;
    default: osc('sine', 1500 * pitch, t, 0.03, p * 0.8, master); noise(t, 0.008, p * 0.3, 'highpass', 4000, master);
  }
}
/** says a number aloud with the browser's speech (the "voice count" option); a no-op when the browser cannot speak. */
export function say(text, lang = 'en') { try { const u = new SpeechSynthesisUtterance(String(text)); u.lang = lang; u.rate = 1.4; u.volume = 0.9; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (_) { /* no speech */ } }

const waves = new Map();
const waveFor = (name) => {
  if (waves.has(name)) return waves.get(name); const ins = INSTRUMENTS[name] || INSTRUMENTS.piano, n = ins.wave.length + 1, re = new Float32Array(n), im = new Float32Array(n);
  ins.wave.forEach((a, i) => { im[i + 1] = a; }); const w = ctx.createPeriodicWave(re, im); waves.set(name, w); return w;
};
/**
 * Starts a note as an instrument. Returns { release(t) } to let it go (a held key; the instrument's own release tail follows), so the sustain pedal can
 * hold it. `dur` (seconds) makes it stop on its own, as a sheet's notes do.
 */
export function startNote(midi, instrument = 'piano', vel = 0.8, t = null, dur = 0) {
  if (!audio()) return { release() {} }; const ins = INSTRUMENTS[instrument] || INSTRUMENTS.piano, t0 = t == null ? ctx.currentTime : t, f = freqOfMidi(midi);
  const g = ctx.createGain(), lp = ctx.createBiquadFilter(), oscs = []; lp.type = 'lowpass'; lp.frequency.value = Math.min(12000, f * 14 + 1500); lp.connect(g); g.connect(master);
  const peak = 0.34 * vel * (1 - Math.min(0.5, (midi - 60) / 120));
  const mk = (ratio, amp) => { const o = ctx.createOscillator(), og = ctx.createGain(); o.setPeriodicWave(waveFor(instrument)); o.frequency.value = f * ratio; og.gain.value = amp; o.connect(og); og.connect(lp); o.start(t0); oscs.push(o); };
  if (ins.inharmonic) { mk(1, 1); mk(2.76, 0.5); mk(5.4, 0.25); mk(8.93, 0.12); } else { mk(1, 1); if (instrument === 'strings' || instrument === 'choir') mk(1.004, 0.7); }
  const sus = ins.sustain * peak; g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(peak, t0 + ins.attack);
  if (ins.sustain > 0) g.gain.exponentialRampToValueAtTime(Math.max(0.0002, sus), t0 + ins.attack + ins.decay); else g.gain.exponentialRampToValueAtTime(0.0002, t0 + ins.attack + ins.decay);
  let ended = false;
  const release = (at = null) => { if (ended) return; ended = true; const r = at == null ? ctx.currentTime : at; try { g.gain.cancelScheduledValues(r); g.gain.setValueAtTime(Math.max(0.0002, g.gain.value || sus || 0.0002), r); g.gain.exponentialRampToValueAtTime(0.0001, r + ins.release); } catch (_) { /* a closed context */ } for (const o of oscs) { try { o.stop(r + ins.release + 0.05); } catch (_) { /* stopped */ } } };
  if (dur > 0) release(t0 + dur); else if (ins.sustain === 0) { for (const o of oscs) o.stop(t0 + ins.attack + ins.decay + ins.release + 0.2); }
  return { release };
}
/** a steady tone (a reference note for the tuner, a pitch pipe); returns { stop() }. */
export function tone(freq, type = 'sine') {
  if (!audio()) return { stop() {} }; const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime; o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.25, t + 0.05); o.connect(g); g.connect(master); o.start(t);
  return { stop() { const r = ctx.currentTime; g.gain.cancelScheduledValues(r); g.gain.setValueAtTime(g.gain.value, r); g.gain.linearRampToValueAtTime(0.0001, r + 0.08); o.stop(r + 0.1); } };
}
/** opens the microphone and calls onBlock(Float32Array, sampleRate) about 20 times a second; resolves { stop() } or rejects with the reason. Nothing is recorded or sent. */
export async function listen(onBlock, size = 4096) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('no microphone in this browser');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  const c = audio(); if (!c) { stream.getTracks().forEach((t) => t.stop()); throw new Error('no audio in this browser'); }
  const src = c.createMediaStreamSource(stream), an = c.createAnalyser(); an.fftSize = size * 2; src.connect(an); const buf = new Float32Array(size); let stopped = false;
  const loop = () => { if (stopped) return; an.getFloatTimeDomainData(buf); onBlock(buf, c.sampleRate); setTimeout(loop, 50); }; loop();
  return { stop() { stopped = true; stream.getTracks().forEach((t) => t.stop()); try { src.disconnect(); } catch (_) { /* gone */ } } };
}
/** keeps the screen awake while a metronome plays; returns a function that lets go. */
export async function keepAwake() { try { const l = await navigator.wakeLock.request('screen'); return () => l.release().catch(() => {}); } catch (_) { return () => {}; } }
