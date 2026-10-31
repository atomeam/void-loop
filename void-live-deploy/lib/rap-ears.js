// Verse's ears (owner, 2026-10-30: "teach it to listen to other rap and compare for itself"). Verse measures a track the way an engineer
// reads a record, with no one listening for it: the tempo and the beat grid (from where the sound starts, its onsets), the swing of the off
// 16ths, how tight the hits sit on the grid, how busy the voice band is, how loud the record is (integrated loudness in LUFS, the BS.1770
// way: K-weighted, 400 ms blocks, gated), its peak against its loudness, the balance of its low end, middle, presence and air, and its
// stereo width. compare() holds two such profiles side by side and scores how close Verse's take is to the reference; tuneFor() turns the gaps
// into changes Verse can make to its next take (the tempo, the swing, the mastering: level, low end, presence, air, width) and to how it writes
// the next one (a faster or a more laid-back flow). master() applies those mastering changes to a mix. Everything here is pure arithmetic on
// samples (Float32Arrays), so it runs in the browser on a track the visitor plays it (lib/rap-listen.js), never on a server, and in the tests
// (tools/rap-ears.test.mjs) on sounds whose tempo and swing are known.
import { fft } from './rap-fft.js';

export const BANDS = Object.freeze([['sub', 20, 60], ['low', 60, 250], ['mid', 250, 2000], ['presence', 2000, 6000], ['air', 6000, 16000]]);
const FRAME = 2048, HOP = 512;

/** the left and right channels as one. Pure. */
export function monoOf(L, R) { if (!R || R === L) return L; const n = Math.min(L.length, R.length), m = new Float32Array(n); for (let i = 0; i < n; i++) m[i] = (L[i] + R[i]) / 2; return m; }

/** a biquad (Audio EQ Cookbook) for `rate`: { b: [b0, b1, b2], a: [a1, a2] }. type: highpass, lowshelf, highshelf. Pure. */
export function biquad(type, f, rate, { q = Math.SQRT1_2, gain = 0 } = {}) {
  const w = 2 * Math.PI * Math.min(f, rate * 0.45) / rate, c = Math.cos(w), s = Math.sin(w), A = Math.pow(10, gain / 40), al = s / (2 * q);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'highpass') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
  else if (type === 'peaking') { b0 = 1 + al * A; b1 = -2 * c; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * c; a2 = 1 - al / A; }
  else {
    const sq = 2 * Math.sqrt(A) * al, sign = type === 'lowshelf' ? -1 : 1;
    b0 = A * ((A + 1) + sign * (A - 1) * c + sq); b1 = -2 * sign * A * ((A - 1) + sign * (A + 1) * c); b2 = A * ((A + 1) + sign * (A - 1) * c - sq);
    a0 = (A + 1) - sign * (A - 1) * c + sq; a1 = 2 * sign * ((A - 1) - sign * (A + 1) * c); a2 = (A + 1) - sign * (A - 1) * c - sq;
  }
  return { b: [b0 / a0, b1 / a0, b2 / a0], a: [a1 / a0, a2 / a0] };
}

/** x through a biquad, into a new array. Pure. */
export function filtered(x, { b, a }) {
  const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[0] * y1 - a[1] * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
  return y;
}

const db = (p) => 10 * Math.log10(Math.max(p, 1e-12));

/** integrated loudness (LUFS, ITU-R BS.1770: K-weighting, 400 ms blocks with 75% overlap, the -70 LUFS and the relative -10 LU gates), the sample
 *  peak (dBFS) and the peak to loudness ratio (dB): { lufs, peak, plr }. lufs is -70 or lower for silence. Pure. */
export function loudnessOf(L, R, rate) {
  const k = (x) => filtered(filtered(x, biquad('highshelf', 1500, rate, { gain: 4 })), biquad('highpass', 38, rate, { q: 0.5 }));
  const chans = (R && R !== L ? [L, R] : [L]).map(k), n = chans[0].length, size = Math.round(0.4 * rate), step = Math.round(0.1 * rate), blocks = [];
  for (let s = 0; s + size <= n; s += step) { let p = 0; for (const c of chans) { let e = 0; for (let i = s; i < s + size; i++) e += c[i] * c[i]; p += e / size; } blocks.push(p); }
  if (R === L || !R) for (let i = 0; i < blocks.length; i++) blocks[i] *= 2; // a mono track is heard on both speakers
  const lk = (p) => -0.691 + db(p), above = blocks.filter((p) => lk(p) > -70);
  let peak = 0; for (const c of [L, R || L]) for (let i = 0; i < c.length; i++) { const v = Math.abs(c[i]); if (v > peak) peak = v; }
  if (!above.length) return { lufs: -70, peak: 20 * Math.log10(Math.max(peak, 1e-9)), plr: 0 };
  const rel = lk(above.reduce((p, q) => p + q, 0) / above.length) - 10, gated = above.filter((p) => lk(p) > rel);
  const lufs = lk(gated.reduce((p, q) => p + q, 0) / gated.length), pk = 20 * Math.log10(Math.max(peak, 1e-9));
  return { lufs: round(lufs, 1), peak: round(pk, 1), plr: round(pk - lufs, 1) };
}

const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

/** the track's spectrum frame by frame: { flux: { all, low, mid, high } (how much the spectrum rose since the last frame, one value a frame), bands (dB share of
 *  each of BANDS in the whole energy), hop (seconds a frame) }. Pure. */
export function spectraOf(x, rate) {
  const n = Math.max(0, Math.floor((x.length - FRAME) / HOP) + 1), half = FRAME / 2, win = new Float32Array(FRAME);
  for (let i = 0; i < FRAME; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (FRAME - 1));
  const bin = (f) => Math.max(1, Math.min(half - 1, Math.round(f * FRAME / rate))), lo = bin(200), m0 = bin(300), m1 = bin(3000), h0 = bin(5000);
  const flux = { all: new Float32Array(n), low: new Float32Array(n), mid: new Float32Array(n), high: new Float32Array(n) }, energy = BANDS.map(() => 0);
  const edges = BANDS.map(([, a, b]) => [bin(a), bin(b)]), re = new Float64Array(FRAME), im = new Float64Array(FRAME); let prev = new Float32Array(half), prevLin = new Float32Array(half), total = 0;
  for (let f = 0; f < n; f++) {
    const o = f * HOP; for (let i = 0; i < FRAME; i++) { re[i] = x[o + i] * win[i]; im[i] = 0; }
    fft(re, im);
    const mag = new Float32Array(half), lin = new Float32Array(half);
    for (let k = 1; k < half; k++) { const p = re[k] * re[k] + im[k] * im[k]; lin[k] = Math.sqrt(p); mag[k] = Math.log1p(1000 * lin[k]); total += p; for (let b = 0; b < edges.length; b++) if (k >= edges[b][0] && k < edges[b][1]) energy[b] += p; }
    // the low and high curves on a log scale (every hit counts, however quiet); the voice band on a plain one, so a loud syllable stands out
    // over the quiet edge of a hat that reaches down into it
    if (f) for (let k = 1; k < half; k++) { const d = mag[k] - prev[k]; if (d > 0) { if (k < lo) flux.low[f] += d; else if (k >= h0) flux.high[f] += d; } if (k >= m0 && k < m1) { const e = lin[k] - prevLin[k]; if (e > 0) flux.mid[f] += e; } }
    prev = mag; prevLin = lin;
  }
  // all: the three curves, each over its own mean, so the kick and the snare count as much as the many bins of a hat
  const mean = (c) => { let s = 0; for (let i = 0; i < c.length; i++) s += c[i]; return s / Math.max(1, c.length) || 1; }, ml = mean(flux.low), mm = mean(flux.mid), mh = mean(flux.high);
  for (let f = 0; f < n; f++) flux.all[f] = flux.low[f] / ml + flux.mid[f] / mm + flux.high[f] / mh;
  const bands = {}; BANDS.forEach(([name], b) => { bands[name] = total > 0 ? round(db(energy[b] / total), 1) : -120; });
  return { flux, bands, hop: HOP / rate, frames: n };
}

/** the dB share of each of BANDS in the whole energy, as spectraOf measures it, from every `stride`th frame only: a quick read of a mix's
 *  balance for fitMix, which reads it several times. Pure. */
export function bandsOf(x, rate, stride = 4) {
  const n = Math.max(0, Math.floor((x.length - FRAME) / HOP) + 1), half = FRAME / 2, win = new Float32Array(FRAME), re = new Float64Array(FRAME), im = new Float64Array(FRAME);
  for (let i = 0; i < FRAME; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (FRAME - 1));
  const bin = (f) => Math.max(1, Math.min(half - 1, Math.round(f * FRAME / rate))), edges = BANDS.map(([, a, b]) => [bin(a), bin(b)]), energy = BANDS.map(() => 0); let total = 0;
  for (let f = 0; f < n; f += stride) {
    const o = f * HOP; for (let i = 0; i < FRAME; i++) { re[i] = x[o + i] * win[i]; im[i] = 0; }
    fft(re, im);
    for (let k = 1; k < half; k++) { const p = re[k] * re[k] + im[k] * im[k]; total += p; for (let b = 0; b < edges.length; b++) if (k >= edges[b][0] && k < edges[b][1]) energy[b] += p; }
  }
  const out = {}; BANDS.forEach(([name], b) => { out[name] = total > 0 ? round(db(energy[b] / total), 1) : -120; });
  return out;
}

/** where an onset curve peaks: the times (seconds) of the frames above a moving threshold, at least `gap` seconds apart. Pure. */
export function onsetsOf(curve, hop, { gap = 0.05, k = 1.4, span = 0.6 } = {}) {
  const w = Math.max(2, Math.round(span / hop / 2)), out = [], minF = Math.max(1, Math.round(gap / hop)); let last = -Infinity;
  for (let i = 1; i < curve.length - 1; i++) {
    if (!(curve[i] > curve[i - 1] && curve[i] >= curve[i + 1])) continue;
    let s = 0, c = 0; for (let j = Math.max(0, i - w); j < Math.min(curve.length, i + w); j++) { s += curve[j]; c++; }
    if (curve[i] > (s / c) * k + 1e-6 && i - last >= minF) { out.push(i * hop); last = i; }
  }
  return out;
}

/** an onset curve smoothed by a short Gaussian (`sigma` frames), so hits that fall between frames still line up when the curve is compared with
 *  itself. Pure. */
export function smooth(curve, sigma = 1.5) {
  const r = Math.ceil(sigma * 3), k = Array.from({ length: 2 * r + 1 }, (_, i) => Math.exp(-0.5 * ((i - r) / sigma) ** 2)), sk = k.reduce((p, q) => p + q, 0), n = curve.length, out = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let j = -r; j <= r; j++) { const t = i + j; if (t >= 0 && t < n) s += curve[t] * k[j + r]; } out[i] = s / sk; }
  return out;
}

/** the tempo of an onset curve in beats a minute, folded into 60 to 120 (a trap beat at 140 is felt at 70, the way Verse writes it), with how
 *  sure the estimate is (0 to 1): { bpm, confidence }. The smoothed curve is autocorrelated over the lags of 55 to 180 BPM; each lag counts with
 *  its double, its half and the bar of four beats it makes, so the tempo, not a multiple of it, wins, and a syncopated pattern (drill's kicks five 16ths
 *  apart) does not pass for the beat: only the true beat repeats with the bar. confidence is how far the best lag stands above the next best tempo that is
 *  not a multiple of it. Pure. */
export function tempoOf(curve, hop) {
  const n = curve.length; if (n < 8) return { bpm: 0, confidence: 0 };
  const sm = smooth(curve); let mean = 0; for (let i = 0; i < n; i++) mean += sm[i]; mean /= n;
  const c = Float32Array.from(sm, (v) => v - mean), ac = (lag) => { let s = 0; for (let i = lag; i < n; i++) s += c[i] * c[i - lag]; return s / (n - lag); };
  const lagOf = (bpm) => 60 / bpm / hop, l0 = Math.floor(lagOf(180)), lHi = Math.ceil(lagOf(55)), l1 = Math.min(n - 2, lHi * 4 + 1);
  const r = new Float32Array(l1 + 2); for (let l = 1; l <= l1 + 1; l++) r[l] = ac(l);
  const at = (l) => { const i = Math.floor(l), f = l - i; return i + 1 < r.length ? r[i] * (1 - f) + r[i + 1] * f : 0; };
  const score = []; let best = 0, bestL = 0;
  for (let l = l0; l <= Math.min(lHi, l1); l++) { const s = r[l] + 0.5 * at(l * 2) + 0.25 * at(l / 2) + 0.5 * at(l * 4); score.push([l, s]); if (s > best) { best = s; bestL = l; } }
  if (!bestL || best <= 0) return { bpm: 0, confidence: 0 };
  const y0 = r[bestL - 1] || 0, y1 = r[bestL], y2 = r[bestL + 1] || 0, den = y0 - 2 * y1 + y2, lag = bestL + (den < 0 ? 0.5 * (y0 - y2) / den : 0);
  let bpm = 60 / (lag * hop); while (bpm >= 120.5) bpm /= 2; while (bpm < 59.5) bpm *= 2;
  // the runner-up: the best lag that is neither near the winner nor near its half or double
  const near = (l, m) => Math.abs(l - m) <= Math.max(2, m * 0.06); let second = 0;
  for (const [l, s] of score) if (!near(l, bestL) && !near(l, bestL * 2) && !near(l, bestL / 2) && s > second) second = s;
  return { bpm: round(bpm, 1), confidence: round(Math.max(0, Math.min(1, 1 - Math.max(0, second) / best)), 2) };
}

/** the phase of the beat grid: the time (0 to one beat) the quarter notes fall on, where the low onset curve (kicks and snares) sums highest when
 *  read once a beat. Pure. */
export function phaseOf(curve, hop, bpm) {
  const beat = 60 / bpm, sm = smooth(curve), steps = Math.max(1, Math.round(beat / hop)); let best = -1, bestP = 0;
  for (let k = 0; k < steps; k++) {
    const p = k * hop; let s = 0;
    for (let t = p; t / hop < sm.length - 1; t += beat) { const i = t / hop, j = Math.floor(i), f = i - j; s += sm[j] * (1 - f) + sm[j + 1] * f; }
    if (s > best) { best = s; bestP = p; }
  }
  return bestP;
}

/** how the hits sit on the 16th grid: { swing (where the off 16th falls in its 8th, 0.5 straight), tight (the median distance of the onsets from
 *  their 16th, past their usual offset, in ms), late (their median signed offset from the kicks' grid, ms: positive is behind) }. swing is null with too few off 16ths. Pure. */
export function gridOf(hi, mid, bpm, phase) {
  const s16 = 60 / bpm / 4, e8 = 2 * s16, pos = [];
  for (const t of hi) { const p = (((t - phase) % e8) + e8) % e8 / e8; if (p > 0.3 && p < 0.82) pos.push(p); }
  const swing = pos.length >= 8 ? round(median(pos), 3) : null, sw = swing == null ? 0.5 : swing, dev = [];
  for (const t of mid) {
    const rel = t - phase, pair = Math.floor(rel / e8), base = phase + pair * e8, cands = [base, base + 2 * sw * s16, base + e8];
    let best = Infinity; for (const g of cands) if (Math.abs(t - g) < Math.abs(best)) best = t - g; dev.push(best * 1000);
  }
  // tight is the spread of the hits around their own typical offset (a voice that sits evenly behind the kick is still tight); late is that offset
  const late = dev.length ? median(dev) : null;
  return { swing, tight: dev.length ? round(median(dev.map((d) => Math.abs(d - late))), 1) : null, late: late == null ? null : round(late, 1) };
}

const median = (a) => { const s = [...a].sort((p, q) => p - q), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0; };

/** the stereo width: the side signal against the middle, in dB (very negative for mono). Pure. */
export function widthOf(L, R) {
  if (!R || R === L) return -60; let m = 0, s = 0; const n = Math.min(L.length, R.length);
  for (let i = 0; i < n; i++) { const a = (L[i] + R[i]) / 2, b = (L[i] - R[i]) / 2; m += a * a; s += b * b; }
  return round(Math.max(-60, db(s / Math.max(m, 1e-12))), 1);
}

/** what Verse hears in a track: { seconds, bpm, confidence, swing, tight, late, density (onsets a second in the voice band, 300 to 3000 Hz), lufs,
 *  peak, plr, bands: { sub, low, mid, presence, air } (dB of the whole), width }. L and R at `rate`; R may be L for mono. Only `from` to `to`
 *  seconds are heard (the middle of a long track, past its intro). Pure. */
export function listen(L, R, rate, { from = 0, to = Infinity } = {}) {
  const a = Math.max(0, Math.floor(from * rate)), b = Math.min(L.length, Math.floor(Math.min(to, L.length / rate) * rate));
  const l = L.subarray(a, b), r = R && R !== L ? R.subarray(a, b) : l, x = monoOf(l, r), sec = x.length / rate;
  if (sec < 4) return null;
  const sp = spectraOf(x, rate), t = tempoOf(sp.flux.all, sp.hop), highs = onsetsOf(sp.flux.high, sp.hop), mids = onsetsOf(sp.flux.mid, sp.hop, { gap: 0.06 });
  const ph = t.bpm ? phaseOf(sp.flux.low, sp.hop, t.bpm) : 0, g = t.bpm ? gridOf(highs, mids, t.bpm, ph) : { swing: null, tight: null, late: null };
  return { seconds: round(sec, 1), bpm: t.bpm, confidence: t.confidence, swing: g.swing, tight: g.tight, late: g.late, density: round(mids.length / sec, 2), ...loudnessOf(l, r, rate), bands: sp.bands, width: widthOf(l, r) };
}

/** the part of a track to hear: the middle 60 seconds of a long one (past an intro), the whole of a short one: { from, to }. Pure. */
export function windowOf(seconds, span = 60) { if (seconds <= span + 10) return { from: 0, to: seconds }; const from = Math.max(0, Math.min(seconds - span, seconds * 0.3)); return { from, to: from + span }; }

// what each measure is called on the page, how far apart two takes may be before it counts as a gap (half the points), and how much it weighs
export const METRICS = Object.freeze([
  { key: 'bpm', label: 'Tempo', unit: 'BPM', tol: 4, w: 1.2 },
  { key: 'swing', label: 'Swing of the off 16ths', unit: '', tol: 0.03, w: 1 },
  { key: 'tight', label: 'Hits off the grid', unit: 'ms', tol: 8, w: 0.6 },
  { key: 'density', label: 'Busy-ness of the voice band', unit: 'a second', tol: 1.2, w: 1 },
  { key: 'lufs', label: 'Loudness', unit: 'LUFS', tol: 2, w: 1.2 },
  { key: 'plr', label: 'Punch (peak over loudness)', unit: 'dB', tol: 2, w: 0.6 },
  { key: 'bands.sub', label: 'Sub bass (20 to 60 Hz)', unit: 'dB', tol: 3, w: 0.8 },
  { key: 'bands.low', label: 'Low end (60 to 250 Hz)', unit: 'dB', tol: 3, w: 0.8 },
  { key: 'bands.mid', label: 'Middle (250 Hz to 2 kHz)', unit: 'dB', tol: 3, w: 0.6 },
  { key: 'bands.presence', label: 'Presence (2 to 6 kHz)', unit: 'dB', tol: 3, w: 0.8 },
  { key: 'bands.air', label: 'Air (6 to 16 kHz)', unit: 'dB', tol: 3, w: 0.6 },
  { key: 'width', label: 'Stereo width', unit: 'dB', tol: 4, w: 0.5 },
]);
const get = (p, key) => key.split('.').reduce((o, k) => (o == null ? null : o[k]), p);

/** Verse's take against a reference, measure by measure: { score (0 to 100), rows: [{ key, label, unit, own, ref, diff, closeness (0 to 1) }] }.
 *  A measure either side could not read (a swing with too few off 16ths) is left out of the score. Tempo compares half and double time as one.
 *  Pure. */
export function compare(own, ref) {
  const rows = []; let sw = 0, sc = 0;
  for (const m of METRICS) {
    const a = get(own, m.key), b = get(ref, m.key);
    if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b) || (m.key === 'bpm' && (!a || !b))) { rows.push({ ...m, own: a, ref: b, diff: null, closeness: null }); continue; }
    const diff = round(a - b, 2), closeness = 1 / (1 + (diff / m.tol) ** 2);
    rows.push({ key: m.key, label: m.label, unit: m.unit, own: a, ref: b, diff, closeness: round(closeness, 3) }); sw += m.w; sc += m.w * closeness;
  }
  return { score: sw ? Math.round(100 * sc / sw) : 0, rows };
}

/** the average of several profiles (what Verse has heard so far), measure by measure. null for none. Pure. */
export function averageOf(profiles) {
  const ps = profiles.filter(Boolean); if (!ps.length) return null;
  const avg = (key) => { const v = ps.map((p) => get(p, key)).filter((x) => x != null && Number.isFinite(x)); return v.length ? round(v.reduce((p, q) => p + q, 0) / v.length, 2) : null; };
  const out = { bands: {} }; for (const m of METRICS) { if (m.key.startsWith('bands.')) out.bands[m.key.slice(6)] = avg(m.key); else out[m.key] = avg(m.key); }
  out.seconds = ps.reduce((p, q) => p + (q.seconds || 0), 0); return out;
}

export const TUNE0 = Object.freeze({ bpm: null, swing: null, gain: 0, sub: 0, low: 0, mid: 0, presence: 0, air: 0, width: 0 });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// the master's bands: which tune field moves which measured band, and what the band is called in a plain line
const MIXBANDS = Object.freeze([['sub', 'sub bass'], ['low', 'low end'], ['mid', 'middle'], ['presence', 'presence, where the voice cuts through'], ['air', 'air on top']]);
const signed = (v) => (v > 0 ? '+' : '') + v;

/** the plain lines for what a tune does to the master. Pure. */
export function mixWhy(tune) {
  const t = { ...TUNE0, ...tune }, why = [];
  if (Math.abs(t.gain) >= 0.5) why.push((t.gain > 0 ? 'Louder' : 'Quieter') + ' master (' + signed(t.gain) + ' dB).');
  for (const [k, name] of MIXBANDS) if (Math.abs(t[k]) >= 0.5) why.push((t[k] > 0 ? 'More ' : 'Less ') + name + ' (' + signed(t[k]) + ' dB).');
  if (Math.abs(t.width) >= 0.5) why.push((t.width > 0 ? 'A wider' : 'A narrower') + ' stereo image (' + signed(t.width) + ' dB of side).');
  return why;
}

/** the next take's changes from the gaps of a comparison (compare(own, ref).rows) on top of the take's own `tune` (TUNE0 for a first take):
 *  { tune: { bpm, swing, gain, sub, low, mid, presence, air, width (dB) }, flow: 'double' | 'laid' | null (how to write the next one),
 *  why: [plain lines], grid: [the lines about tempo, swing and flow alone] }. `base` is the take's own tempo and swing (the plan's), for the
 *  moves of a first take. Each band moves on its own gap. Pure. */
export function tuneFor(rows, tune = TUNE0, base = {}) {
  const t = { ...TUNE0, ...tune }, grid = [], mix = [], row = (k) => rows.find((r) => r.key === k && r.diff != null);
  const r = row('bpm'); if (r && Math.abs(r.diff) >= 1) { t.bpm = clamp(Math.round(r.ref), 60, 120); grid.push('Tempo to ' + t.bpm + ' BPM, the reference\'s (it was ' + Math.round(base.bpm || r.own) + ').'); }
  const s = row('swing'); if (s && Math.abs(s.diff) >= 0.01) { const cur = t.swing ?? base.swing ?? 0.5; t.swing = round(clamp(cur - s.diff, 0.5, 0.68), 3); grid.push(s.diff > 0 ? 'Straighter 16ths (swing ' + t.swing + ').' : 'More swing on the off 16ths (' + t.swing + ').'); }
  const l = row('lufs'); if (l && Math.abs(l.diff) >= 0.5) { t.gain = round(clamp(t.gain - l.diff, -12, 14), 1); mix.push(l.diff < 0 ? 'Louder master, ' + Math.abs(l.diff).toFixed(1) + ' dB up to the reference.' : 'Quieter master, ' + l.diff.toFixed(1) + ' dB down.'); }
  for (const [k, name] of MIXBANDS) { const e = row('bands.' + k); if (e && Math.abs(e.diff) >= 1) { t[k] = round(clamp(t[k] - e.diff * 0.8, -15, 12), 1); mix.push((e.diff < 0 ? 'More ' : 'Less ') + name + ' (' + signed(t[k]) + ' dB).'); } }
  const w = row('width'); if (w && Math.abs(w.diff) >= 1.5) { t.width = round(clamp(t.width - w.diff * 0.7, -12, 12), 1); mix.push(w.diff < 0 ? 'A wider stereo image.' : 'A narrower stereo image.'); }
  const d = row('density'); let flow = null;
  if (d && d.ref > d.own * 1.3 && d.diff < -1) { flow = 'double'; grid.push('The reference is busier (' + d.ref + ' onsets a second in the voice band against ' + d.own + '): write the next one in double time.'); }
  else if (d && d.ref < d.own * 0.75 && d.diff > 1) { flow = 'laid'; grid.push('The reference leaves more space (' + d.ref + ' onsets a second against ' + d.own + '): write the next one laid back.'); }
  return { tune: t, flow, why: [...grid, ...mix], grid };
}

/** what fitMix reads in a mix, quickly: { lufs, peak, plr, bands, width }. Pure. */
export function mixOf(L, R, rate) { return { ...loudnessOf(L, R, rate), bands: bandsOf(monoOf(L, R), rate), width: widthOf(L, R) }; }

/** the master that brings a mix closest to a reference, found by ear: master it, read it (mixOf), move the level, each band and the width by
 *  what is still off, and again, keeping the best (by compare) of up to `steps` passes. Only the master fields of `tune` move; its tempo and
 *  swing are kept. The middle of a long mix is read (windowOf). Returns { tune, score, before, passes }. Pure. */
export function fitMix(L, R, rate, ref, tune = TUNE0, { steps = 6 } = {}) {
  const w = windowOf(L.length / rate), a = Math.floor(w.from * rate), b = Math.floor(w.to * rate), l0 = L.subarray(a, b), r0 = (R || L).subarray(a, b);
  const read = (t) => { const [l, r] = master(l0, r0, rate, t); return compare(mixOf(l, r, rate), ref); };
  let t = { ...TUNE0, ...tune }, cmp = read(t), best = { tune: { ...t }, score: cmp.score }, before = cmp.score, worse = 0, passes = 0;
  for (let i = 0; i < steps; i++) {
    const row = (k) => cmp.rows.find((x) => x.key === k && x.diff != null), moves = {};
    for (const [k] of MIXBANDS) { const e = row('bands.' + k); if (e) moves[k] = -e.diff * 0.8; }
    // the bands are shares of the whole: a move they all make together only changes the level, so take it out and leave that to the gain
    const ks = Object.keys(moves), mean = ks.length ? ks.reduce((p, k) => p + moves[k], 0) / ks.length : 0;
    const next = { ...t };
    for (const k of ks) next[k] = round(clamp(t[k] + moves[k] - mean, -15, 12), 1);
    const lu = row('lufs'); if (lu) next.gain = round(clamp(t.gain - lu.diff, -15, 14), 1);
    const wd = row('width'); if (wd) next.width = round(clamp(t.width - wd.diff * 0.9, -12, 12), 1);
    if (JSON.stringify(next) === JSON.stringify(t)) break;
    t = next; cmp = read(t); passes++;
    if (cmp.score > best.score) { best = { tune: { ...t }, score: cmp.score }; worse = 0; } else if (++worse >= 2) break;
  }
  return { tune: best.tune, score: best.score, before, passes };
}

/** a mix mastered by a tune: a shelf for the sub (60 Hz), bells for the low end (125 Hz) and the middle (800 Hz), shelves for presence (3 kHz)
 *  and air (9 kHz), the side signal for width, the gain, then a
 *  peak limiter (5 ms look-ahead, 80 ms release, ceiling 0.97) so a louder master never clips. [L, R] in, new [L, R] out. Pure. */
export function master(L, R, rate, tune = TUNE0) {
  const t = { ...TUNE0, ...tune }; let l = L, r = R;
  const eq = (type, f, gain, q = Math.SQRT1_2) => { if (!gain) return; const c = biquad(type, f, rate, { gain, q }); l = filtered(l, c); r = filtered(r, c); };
  eq('lowshelf', 60, t.sub); eq('peaking', 125, t.low, 0.8); eq('peaking', 800, t.mid, 0.6); eq('highshelf', 3000, t.presence); eq('highshelf', 9000, t.air);
  const n = Math.min(l.length, r.length), side = Math.pow(10, (t.width || 0) / 20), g = Math.pow(10, (t.gain || 0) / 20), oL = new Float32Array(n), oR = new Float32Array(n);
  for (let i = 0; i < n; i++) { const m = (l[i] + r[i]) / 2, s = (l[i] - r[i]) / 2 * side; oL[i] = (m + s) * g; oR[i] = (m - s) * g; }
  const ceil = 0.97, look = Math.max(1, Math.round(0.005 * rate)), rel = Math.exp(-1 / (0.08 * rate)), need = new Float32Array(n);
  for (let i = 0; i < n; i++) { const p = Math.max(Math.abs(oL[i]), Math.abs(oR[i])); need[i] = p > ceil ? ceil / p : 1; }
  // the gain at each sample is the least any sample in the look-ahead needs, released slowly back up: a sliding minimum, then the release
  const q = []; let gain = 1;
  for (let i = 0; i < n + look; i++) {
    if (i < n) { while (q.length && need[q[q.length - 1]] >= need[i]) q.pop(); q.push(i); }
    const j = i - look; if (j < 0) continue; while (q.length && q[0] < j) q.shift();
    const want = q.length ? need[q[0]] : 1; gain = want < gain ? want : want - (want - gain) * rel;
    oL[j] = clamp(oL[j] * gain, -ceil, ceil); oR[j] = clamp(oR[j] * gain, -ceil, ceil);
  }
  return [oL, oR];
}

/** a tune that changes nothing. Pure. */
export const isPlain = (tune) => !tune || Object.keys(TUNE0).every((k) => tune[k] == null || tune[k] === TUNE0[k]);
