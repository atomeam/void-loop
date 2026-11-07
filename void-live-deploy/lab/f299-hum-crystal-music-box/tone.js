// Hum Crystals' sound: every tune is rendered to samples here, then mastered to one level before it plays or is saved.
// The old player sent each note straight to the speakers at a fixed 0.28 gain, mostly a pure sine at the hummed pitch (around middle C),
// with no master stage: about -10 dBFS at the peak of a lone note and far lower on average, and a phone speaker barely reproduces a sine
// that low. Now each note keeps its sine and its overtone (the box's answers still sound different from your hum) and gains a short bright
// music-box attack that small speakers carry, and the whole tune is normalized: peak to -1 dBFS, then lifted toward -16 dBFS RMS with a soft
// limiter, so a quiet tune and a dense one come out equally clear and nothing clips. Pure: no Web Audio here, so tools/hum-crystals.test.mjs
// measures it in Node.

export const CEILING_DB = -1;     // the loudest a sample may be
export const TARGET_RMS_DB = -16; // where a tune's average level is aimed
export const MAX_LIFT_DB = 9;     // how far past peak normalization the limiter may push a sparse tune

const dbOf = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
const linOf = (db) => Math.pow(10, db / 20);
const freqOf = (m) => 440 * Math.pow(2, (m - 69) / 12);

/** the partials of one note: [frequency ratio, amplitude, how many times faster than the body it fades]. Pure. */
export function partialsOf(ai) {
  // the old voice: a sine plus a triangle overtone (x3.01 at 0.1 for your notes, x2.003 at 0.18 for the box's); a triangle's own odd harmonics
  // are kept at 1/n^2 so it sounds as it did. Then the music-box tine: the 2nd and 4th harmonics, bright at the strike and gone soon after.
  const r = ai ? 2.003 : 3.01, a = ai ? 0.18 : 0.1;
  return [[1, 1, 1], [r, a, 1], [r * 3, -a / 9, 1.4], [r * 5, a / 25, 1.8], [2, 0.42, 2.2], [4, 0.16, 3.5]];
}

/** one note into `out` at `start` seconds (sr = sample rate), the same envelope the old player had: 8 ms up, then down to 0.001 over dur + 0.9 s. */
export function addNote(out, sr, midi, start, dur, ai) {
  const f = freqOf(midi), atk = 0.008, tail = dur + 0.9, s0 = Math.max(0, Math.round(start * sr));
  const n = Math.min(out.length - s0, Math.ceil((tail + 0.1) * sr)), k = Math.log(0.001) / (tail - atk);
  const parts = partialsOf(ai).filter(([ratio]) => f * ratio < sr * 0.45); // nothing above what the sample rate can hold
  const end = Math.min(n, Math.floor(tail * sr) + 1), up = Math.ceil(atk * sr);
  for (const [ratio, amp, fade] of parts) {
    // a sine by rotation (two multiplies a sample, no Math.sin) and an envelope by repeated multiplication, so a long tune renders at once
    const w = 2 * Math.PI * f * ratio / sr, c2 = 2 * Math.cos(w), d = Math.exp(k * fade / sr), g = 0.28 * amp; // 0.28: the old voice's gain
    let cur = 0, prev = -Math.sin(w), env = 1; // sin(w*i) and sin(w*(i-1))
    for (let i = 0; i < end; i++) {
      let e; if (i < up) e = Math.pow(i / up, fade); else { e = env; env *= d; }
      out[s0 + i] += g * cur * e;
      const next = c2 * cur - prev; prev = cur; cur = next;
    }
  }
}

/** how long a tune lasts once its last note has rung out, in seconds. Pure. */
export function lengthOf(list) {
  if (!list.length) return 0; const s0 = list[0].start;
  return Math.max(...list.map((n) => n.start - s0 + n.dur)) + 1.2;
}

/** the tune's raw samples, before mastering (`lead`: seconds of silence first). Pure. */
export function renderRaw(list, sr = 48000, lead = 0.02) {
  if (!list.length) return new Float32Array(0);
  const out = new Float32Array(Math.ceil((lengthOf(list) + lead) * sr)), s0 = list[0].start;
  for (const n of list) addNote(out, sr, n.midi, n.start - s0 + lead, n.dur, n.ai);
  return out;
}

/** peak and RMS in dBFS; RMS counts only the part of the buffer that sounds (above -60 dBFS), so a long tail of silence does not hide a loud tune. Pure. */
export function levelOf(buf) {
  let peak = 0, sum = 0, cnt = 0; const floor = linOf(-60);
  for (let i = 0; i < buf.length; i++) { const a = Math.abs(buf[i]); if (a > peak) peak = a; if (a > floor) { sum += buf[i] * buf[i]; cnt++; } }
  return { peakDb: dbOf(peak), rmsDb: cnt ? dbOf(Math.sqrt(sum / cnt)) : -Infinity };
}

/** the level a phone speaker gives back: the RMS after a 500 Hz high-pass (small speakers drop most of what is below). Pure. */
export function speakerDbOf(buf, sr = 48000) {
  const w = 2 * Math.PI * 500 / sr, c = Math.cos(w), al = Math.sin(w) / Math.SQRT2, a0 = 1 + al;
  const b0 = (1 + c) / 2 / a0, b1 = -(1 + c) / a0, b2 = b0, a1 = -2 * c / a0, a2 = (1 - al) / a0;
  const y = new Float32Array(buf.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < buf.length; i++) { const x = buf[i], v = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = v; y[i] = v; }
  return levelOf(y).rmsDb;
}

/** a soft limiter: unchanged up to the knee, then bent smoothly so nothing passes the ceiling. Pure. */
export function limit(x, ceiling = linOf(CEILING_DB), knee = 0.6) {
  const k = ceiling * knee, a = Math.abs(x);
  if (a <= k) return x;
  const room = ceiling - k;
  return Math.sign(x) * (k + room * Math.tanh((a - k) / room));
}

/** master a tune in place: peak to the ceiling, then up toward the target RMS (at most MAX_LIFT_DB more) through the limiter. Returns the gain used in dB. Pure. */
export function master(buf) {
  const lv = levelOf(buf); if (!Number.isFinite(lv.peakDb)) return 0;
  const toPeak = CEILING_DB - lv.peakDb, lift = Math.max(0, Math.min(MAX_LIFT_DB, TARGET_RMS_DB - (lv.rmsDb + toPeak)));
  const g = linOf(toPeak + lift), ceil = linOf(CEILING_DB);
  for (let i = 0; i < buf.length; i++) buf[i] = lift > 0 ? limit(buf[i] * g, ceil) : buf[i] * g;
  return toPeak + lift;
}

/** the finished samples of a tune, rendered and mastered. Pure. */
export function renderTune(list, sr = 48000, lead = 0.02) { const b = renderRaw(list, sr, lead); master(b); return b; }

/** a mono 16-bit WAV of the samples. Pure. */
export function wavOf(b, sr) {
  const dv = new DataView(new ArrayBuffer(44 + b.length * 2)), w = (o, s) => [...s].forEach((ch, i) => dv.setUint8(o + i, ch.charCodeAt(0)));
  w(0, 'RIFF'); dv.setUint32(4, 36 + b.length * 2, true); w(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, b.length * 2, true);
  for (let i = 0; i < b.length; i++) dv.setInt16(44 + i * 2, Math.max(-1, Math.min(1, b[i])) * 32767, true);
  return dv.buffer;
}
