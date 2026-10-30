// tests for lib/denoise.js: the FFT, and spectral gating on a steady noise under tones with gaps
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { denoise, fft } from '../void-live-deploy/lib/denoise.js';

let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff - 0.5; };
const rate = 44100, n = rate * 4;
// tones on for 0.67 s, off for 0.67 s; white noise all the time
const clean = Float32Array.from({ length: n }, (_, i) => { const t = i / rate; return Math.floor(t * 1.5) % 2 ? 0 : 0.3 * Math.sin(2 * Math.PI * 220 * t) + 0.15 * Math.sin(2 * Math.PI * 660 * t); });
const noisy = clean.map((v) => v + rnd() * 0.06);
const snr = (x) => { let s = 0, e = 0; for (let i = 0; i < n; i++) { s += clean[i] ** 2; e += (x[i] - clean[i]) ** 2; } return 10 * Math.log10(s / e); };
const level = (x, a, z) => { let s = 0; for (let i = a; i < z; i++) s += x[i] ** 2; return 10 * Math.log10(s / (z - a)); };

test('the FFT and its inverse give the samples back', () => {
  const re = Float64Array.from({ length: 2048 }, () => rnd()), im = new Float64Array(2048), x = re.slice();
  fft(re, im); fft(re, im, true); for (let i = 0; i < 2048; i++) assert.ok(Math.abs(re[i] / 2048 - x[i]) < 1e-12);
});

test('a steady noise goes down in the gaps, the tones stay, and the notes say how far, measured', () => {
  const r = denoise({ rate, channels: [noisy] }, 12), y = r.channels[0];
  assert.equal(y.length, n);
  const gap = [Math.round(rate * 0.8), Math.round(rate * 1.2)];
  assert.ok(level(noisy, ...gap) - level(y, ...gap) > 8, 'the noise in a gap is 8 dB down at least');
  assert.ok(snr(y) > snr(noisy) + 5, 'closer to the clean tones than the noisy sound was');
  assert.match(r.notes.join(' '), /quietest/); assert.match(r.notes.join(' '), /dB down; the most it takes down is 12 dB/);
});

test('a clean sound comes back nearly as it was; digital silence is said, not measured as noise', () => {
  const r = denoise({ rate, channels: [clean] }, 12);
  assert.ok(snr(r.channels[0]) > 40); assert.match(r.notes.join(' '), /digital silence/);
});

test('the noise can be marked by seconds; a bad mark or a very short sound is a plain error', () => {
  assert.match(denoise({ rate, channels: [noisy] }, 12, 1.5, 0.75, 1.3).notes[0], /from 0\.75 s to 1\.30 s, as you marked it/);
  assert.throws(() => denoise({ rate, channels: [noisy] }, 12, 1.5, 1, ''), /mark the noise/);
  assert.throws(() => denoise({ rate, channels: [noisy] }, 12, 1.5, 1, 1.01), /mark the noise/);
  assert.throws(() => denoise({ rate, channels: [new Float32Array(100)] }), /too short/);
});
