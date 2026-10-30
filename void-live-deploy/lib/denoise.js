// Remove Noise from Audio, on the device: spectral gating. Verse learns the noise from the quietest frames of the sound,
// then, in each frequency band of each short frame, takes down what is not above that noise. A steady noise (hiss, hum,
// a fan, room tone) goes; a noise that changes like the sound it covers (voices, traffic, music) cannot be told apart and stays.
// Pure: no DOM, no Web Audio, so node tests run it the same as the page does.

const N = 2048, HOP = N / 4, BINS = N / 2 + 1;
const WIN = Float64Array.from({ length: N }, (_, i) => Math.sqrt(0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N))); // sqrt-Hann, for analysis and synthesis
const COS = Float64Array.from({ length: N / 2 }, (_, i) => Math.cos((2 * Math.PI * i) / N)), SIN = Float64Array.from({ length: N / 2 }, (_, i) => Math.sin((2 * Math.PI * i) / N));
const REV = (() => { const r = new Uint16Array(N), bits = Math.log2(N); for (let i = 0; i < N; i++) { let x = i, y = 0; for (let k = 0; k < bits; k++) { y = (y << 1) | (x & 1); x >>= 1; } r[i] = y; } return r; })();

/** in place, radix 2; inverse when inv (not scaled: the caller divides by N) */
export function fft(re, im, inv = false) {
  for (let i = 0; i < N; i++) { const j = REV[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let size = 2; size <= N; size *= 2) {
    const half = size / 2, step = N / size;
    for (let s = 0; s < N; s += size) for (let k = 0; k < half; k++) {
      const c = COS[k * step], w = inv ? SIN[k * step] : -SIN[k * step], a = s + k, b = a + half;
      const tr = re[b] * c - im[b] * w, ti = re[b] * w + im[b] * c;
      re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
    }
  }
}

const db = (x) => 20 * Math.log10(x + 1e-12);

/** one channel, gated. { out, quietRms, quietRmsAfter, quietSeconds } */
function gateChannel(x, rate, reduceDb, k, span) {
  const n = x.length, frames = Math.max(1, Math.ceil((n + N) / HOP)), pad = N; // pad N on each side, so the edges get the full overlap
  const src = new Float64Array(n + 2 * N + HOP); src.set(x, pad);
  const mag = new Float32Array(frames * BINS); const re = new Float64Array(N), im = new Float64Array(N), energy = new Float64Array(frames);
  const specRe = new Float32Array(frames * BINS), specIm = new Float32Array(frames * BINS);
  for (let f = 0; f < frames; f++) {
    const o = f * HOP; let e = 0;
    for (let i = 0; i < N; i++) { re[i] = src[o + i] * WIN[i]; im[i] = 0; e += src[o + i] * src[o + i]; }
    energy[f] = e; fft(re, im);
    for (let b = 0; b < BINS; b++) { specRe[f * BINS + b] = re[b]; specIm[f * BINS + b] = im[b]; mag[f * BINS + b] = Math.hypot(re[b], im[b]); }
  }
  // the noise: the quietest tenth of the frames that hold sound (not the padding), 8 frames at least
  const real = []; for (let f = 0; f < frames; f++) { const o = f * HOP; if (o >= pad - HOP && o + N <= pad + n + HOP) real.push(f); }
  const pool = real.length ? real : [...Array(frames).keys()], take = Math.max(Math.min(8, pool.length), Math.round(pool.length / 10));
  // or the frames inside the seconds the user marked as noise only
  const marked = span ? pool.filter((f) => { const t = (f * HOP - pad + N / 2) / rate; return t >= span[0] && t <= span[1]; }) : [];
  const quiet = marked.length ? marked : pool.slice().sort((a, b) => energy[a] - energy[b]).slice(0, take);
  const mean = new Float64Array(BINS), sd = new Float64Array(BINS);
  for (const f of quiet) for (let b = 0; b < BINS; b++) mean[b] += db(mag[f * BINS + b]) / quiet.length;
  for (const f of quiet) for (let b = 0; b < BINS; b++) sd[b] += (db(mag[f * BINS + b]) - mean[b]) ** 2 / quiet.length;
  const thr = Float64Array.from(mean, (m, b) => m + k * Math.sqrt(sd[b]));
  // the mask: 1 where a band is above the noise, 0 where it is not; smoothed over 5 bands and 3 frames, so the gate does not chirp (musical noise)
  const mask = new Float32Array(frames * BINS);
  for (let i = 0; i < frames * BINS; i++) mask[i] = db(mag[i]) > thr[i % BINS] ? 1 : 0;
  const sm = new Float32Array(frames * BINS);
  for (let f = 0; f < frames; f++) for (let b = 0; b < BINS; b++) {
    let s = 0, c = 0;
    for (let df = -1; df <= 1; df++) { const g = f + df; if (g < 0 || g >= frames) continue; for (let d = -2; d <= 2; d++) { const h = b + d; if (h < 0 || h >= BINS) continue; s += mask[g * BINS + h]; c++; } }
    sm[f * BINS + b] = s / c;
  }
  const floor = 10 ** (-reduceDb / 20), out = new Float64Array(n + 2 * N + HOP);
  for (let f = 0; f < frames; f++) {
    for (let b = 0; b < BINS; b++) { const g = floor + (1 - floor) * sm[f * BINS + b]; re[b] = specRe[f * BINS + b] * g; im[b] = specIm[f * BINS + b] * g; }
    for (let b = 1; b < N / 2; b++) { re[N - b] = re[b]; im[N - b] = -im[b]; }
    fft(re, im, true);
    const o = f * HOP; for (let i = 0; i < N; i++) out[o + i] += (re[i] / N) * WIN[i];
  }
  // sqrt-Hann twice is Hann, and Hann at a quarter hop sums to 2
  const y = new Float32Array(n); for (let i = 0; i < n; i++) y[i] = out[pad + i] / 2;
  // the quiet frames, measured before and after: how far the noise went down
  let a = 0, z = 0, c = 0;
  for (const f of quiet) { const o = f * HOP - pad; for (let i = Math.max(0, o); i < Math.min(n, o + N); i++) { a += x[i] * x[i]; z += y[i] * y[i]; c++; } }
  return { out: y, quietRms: Math.sqrt(a / Math.max(1, c)), quietRmsAfter: Math.sqrt(z / Math.max(1, c)), quietSeconds: (quiet.length * HOP) / rate };
}

/** { rate, channels: [Float32Array] } with the steady noise taken down by reduceDb (12 by default). k (1.5) sets how far over the noise a band must be to stay.
 * Returns the same shape with notes, measured, not guessed. */
export function denoise(s, reduceDb = 12, k = 1.5, from = null, to = null) {
  const r = Math.max(3, Math.min(40, +reduceDb || 12)), n = s.channels[0].length, len = n / s.rate;
  if (n < N) throw new Error('the sound is too short: Verse needs ' + Math.ceil((1000 * N) / s.rate) + ' ms at least to learn its noise.');
  const a = from === '' || from == null ? null : +from, z = to === '' || to == null ? null : +to;
  if ((a == null) !== (z == null) || (a != null && !(z - a >= (2 * N) / s.rate && a >= 0 && a < len))) throw new Error('mark the noise with a start and an end at least ' + Math.ceil((2000 * N) / s.rate) + ' ms apart, inside the sound (' + len.toFixed(2) + ' s), or leave both empty.');
  const done = s.channels.map((c) => gateChannel(c, s.rate, r, k, a == null ? null : [a, z]));
  const before = Math.max(...done.map((d) => d.quietRms)), after = Math.max(...done.map((d) => d.quietRmsAfter));
  const notes = [a == null ? 'the noise was learned from the quietest ' + done[0].quietSeconds.toFixed(1) + ' s of the sound' : 'the noise was learned from ' + a.toFixed(2) + ' s to ' + z.toFixed(2) + ' s, as you marked it'];
  if (db(before) < -90) notes.push('that part is digital silence: there was no steady noise to take down');
  else notes.push('there, the level went from ' + db(before).toFixed(1) + ' dBFS to ' + db(after).toFixed(1) + ' dBFS (' + (db(before) - db(after)).toFixed(1) + ' dB down; the most it takes down is ' + r + ' dB)');
  notes.push('a steady noise (hiss, hum, a fan) goes; a noise that changes like the sound (voices, traffic) stays');
  return { rate: s.rate, channels: done.map((d) => d.out), notes };
}
