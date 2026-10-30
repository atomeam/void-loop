// Verse's ears (owner, 2026-10-30: "teach it to listen to other rap and compare for itself"): lib/rap-ears.js measures a track (tempo, swing,
// how tight and how busy, loudness, punch, the balance of its bands, its width), compares two tracks, turns the gaps into a tune for the next take
// and masters a mix by that tune; lib/rap-listen.js runs the learning loop. Every sound here is made in the test, so its tempo, swing and level
// are known exactly and the ears can be checked against them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { listen, loudnessOf, tempoOf, spectraOf, compare, tuneFor, master, averageOf, windowOf, widthOf, isPlain, TUNE0, fitMix, mixOf, mixWhy, biquad, filtered, bandsOf } from '../void-live-deploy/lib/rap-ears.js';
import { learn, shown, baseOf } from '../void-live-deploy/lib/rap-listen.js';
import { planOf, songOf } from '../void-live-deploy/lib/rap-song.js';
import { settingsOf } from '../void-live-deploy/lib/rap.js';

const RATE = 48000;
// a seeded noise, so every run hears the same drums
const rngOf = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 * 2 - 1; };
/** a drum loop with a known tempo and swing: a 55 Hz kick on beats 1 and 3, a snare (noise and 200 Hz) on 2 and 4, a bright hat (above about 5 kHz) on every
 *  16th with the off 16ths pushed late by `swing`, and a mid-band click (a stand-in for syllables) on each 8th. [L, R], `width` sets the side. */
function drums({ bpm = 90, swing = 0.5, seconds = 16, level = 0.5, rate = RATE, width = 0, voice = 1 } = {}) {
  const n = Math.round(seconds * rate), L = new Float32Array(n), R = new Float32Array(n), rnd = rngOf(7), s16 = 60 / bpm / 4;
  const add = (t, len, fn, pan = 0) => { const a = Math.round(t * rate), m = Math.round(len * rate); for (let i = 0; i < m && a + i < n; i++) { const v = fn(i / rate, i / m) * level; L[a + i] += v * (1 - pan); R[a + i] += v * (1 + pan); } };
  for (let k = 0; k * s16 < seconds; k++) {
    const pair = Math.floor(k / 2), off = k % 2, t = pair * 2 * s16 + (off ? 2 * swing * s16 : 0), step = k % 16;
    if (step === 0 || step === 8) add(t, 0.25, (u, p) => Math.sin(2 * Math.PI * 55 * u) * Math.exp(-p * 5));
    if (step === 4 || step === 12) add(t, 0.15, (u, p) => (0.6 * rnd() + 0.4 * Math.sin(2 * Math.PI * 200 * u)) * Math.exp(-p * 6));
    // the hat: noise differenced twice, so it lives above about 5 kHz the way a real hat does
    { let a = 0, b = 0; add(t, 0.03, (u, p) => { const x = rnd(), d1 = x - a, d2 = d1 - b; a = x; b = d1; return 0.25 * d2 * (1 - p); }, width); }
    if (voice && k % (2 / voice) === 0) add(t + 0.002, 0.06, (u, p) => 0.3 * Math.sin(2 * Math.PI * 900 * u) * Math.sin(Math.PI * p), -width);
  }
  return [L, R];
}

test('the ears hear the tempo of a beat they did not make, at 70, 90 and 110 BPM', () => {
  for (const bpm of [70, 90, 110]) { const [L, R] = drums({ bpm }), p = listen(L, R, RATE); assert.ok(Math.abs(p.bpm - bpm) <= 1.5, bpm + ' heard as ' + p.bpm); }
});

test('a trap beat at 140 is heard at 70, the way Verse writes it', () => {
  const [L, R] = drums({ bpm: 140 }), p = listen(L, R, RATE);
  assert.ok(Math.abs(p.bpm - 70) <= 1.5, 'heard ' + p.bpm);
});

test('the ears hear how much the off 16ths swing', () => {
  const straight = listen(...drums({ swing: 0.5 }), RATE), swung = listen(...drums({ swing: 0.6 }), RATE);
  assert.ok(Math.abs(straight.swing - 0.5) <= 0.03, 'straight heard as ' + straight.swing);
  assert.ok(Math.abs(swung.swing - 0.6) <= 0.03, 'swung heard as ' + swung.swing);
  assert.ok(straight.tight != null && straight.tight < 15, 'hits sit on the grid: ' + straight.tight + ' ms');
});

test('a busier voice band reads as busier', () => {
  const calm = listen(...drums({ voice: 1 }), RATE), busy = listen(...drums({ voice: 2 }), RATE);
  assert.ok(busy.density > calm.density * 1.4, calm.density + ' against ' + busy.density);
});

test('loudness is measured the BS.1770 way: a full-scale 997 Hz sine reads about -3 LUFS, and 10 dB down reads 10 dB lower', () => {
  const sine = (amp) => Float32Array.from({ length: RATE * 5 }, (_, i) => amp * Math.sin(2 * Math.PI * 997 * i / RATE));
  const full = loudnessOf(sine(1), sine(1), RATE), down = loudnessOf(sine(10 ** (-10 / 20)), sine(10 ** (-10 / 20)), RATE);
  // a stereo full-scale sine sums two channels: -3.01 LUFS for each, +3 for the pair, so 0 LUFS
  assert.ok(Math.abs(full.lufs - 0) <= 0.3, 'full scale reads ' + full.lufs);
  assert.ok(Math.abs(full.lufs - down.lufs - 10) <= 0.2, 'a 10 dB drop reads ' + (full.lufs - down.lufs));
  assert.ok(Math.abs(full.peak) <= 0.05, 'the peak of a full-scale sine is 0 dBFS: ' + full.peak);
});

test('stereo width: mono is far narrower than a wide mix', () => {
  const [L] = drums({}), mono = widthOf(L, L), [a, b] = drums({ width: 0.8 }), wide = widthOf(a, b);
  assert.ok(wide > mono + 20, 'mono ' + mono + ', wide ' + wide);
});

test('the bands: a loop with a 55 Hz kick has real sub and low end; a curve too short has no tempo', () => {
  const [L] = drums({}), sp = spectraOf(L, RATE);
  assert.ok(sp.bands.sub > -40 && sp.bands.low > -40, JSON.stringify(sp.bands));
  assert.equal(tempoOf(new Float32Array(4), 0.01).bpm, 0);
});

test('compare scores a track against itself at 100, and against another lower', () => {
  const a = listen(...drums({ bpm: 90 }), RATE), b = listen(...drums({ bpm: 76, swing: 0.6, level: 0.2 }), RATE);
  assert.equal(compare(a, a).score, 100);
  const c = compare(a, b); assert.ok(c.score < 70, 'score ' + c.score);
  const bpm = c.rows.find((r) => r.key === 'bpm'); assert.ok(bpm.diff > 10 && bpm.closeness < 0.3);
});

test('tuneFor moves the next take toward the reference: tempo, swing, level, and the flow to write in', () => {
  const own = listen(...drums({ bpm: 90, swing: 0.5, level: 0.15 }), RATE), ref = listen(...drums({ bpm: 76, swing: 0.6, level: 0.5, voice: 2 }), RATE);
  const { tune, flow, why } = tuneFor(compare(own, ref).rows, TUNE0, { bpm: 90, swing: 0.5 });
  assert.equal(tune.bpm, Math.round(ref.bpm));
  assert.ok(tune.swing > 0.55 && tune.swing <= 0.68, 'swing ' + tune.swing);
  assert.ok(tune.gain > 5, 'louder by ' + tune.gain + ' dB');
  assert.equal(flow, 'double');
  assert.ok(why.length >= 3 && why.every((w) => typeof w === 'string' && !w.includes(String.fromCharCode(0x2014)) && !w.includes(String.fromCharCode(0x2015))));
  assert.ok(isPlain(TUNE0) && !isPlain(tune));
});

test('master: louder by the tune and never over the 0.97 ceiling, and a plain tune changes nothing but the limiter', () => {
  const [L, R] = drums({ level: 0.4 }), before = loudnessOf(L, R, RATE);
  const [l2, r2] = master(L, R, RATE, { ...TUNE0, gain: 6 }), after = loudnessOf(l2, r2, RATE);
  let peak = 0; for (let i = 0; i < l2.length; i++) peak = Math.max(peak, Math.abs(l2[i]), Math.abs(r2[i]));
  assert.ok(peak <= 0.97 + 1e-6, 'peak ' + peak);
  assert.ok(after.lufs > before.lufs + 3, before.lufs + ' to ' + after.lufs);
  const [l3] = master(L, R, RATE, TUNE0); let same = 0; for (let i = 0; i < L.length; i++) same = Math.max(same, Math.abs(l3[i] - Math.max(-0.97, Math.min(0.97, L[i])))); assert.ok(same < 0.2);
});

test('averageOf and windowOf', () => {
  assert.equal(averageOf([]), null);
  const avg = averageOf([{ bpm: 80, bands: { sub: -10 } }, { bpm: 90, bands: { sub: -20 } }]);
  assert.equal(avg.bpm, 85); assert.equal(avg.bands.sub, -15);
  assert.deepEqual(windowOf(40), { from: 0, to: 40 });
  const w = windowOf(200); assert.equal(w.to - w.from, 60); assert.ok(w.from >= 30);
});

test('a tuned plan moves the beat to the tune: tempo and swing, with the bars timed on the new grid', () => {
  const s = settingsOf({ topic: 'the moon', style: 'boom bap' }), r = { title: 'Moon', sections: [{ name: 'Verse 1', bars: ['one two three four', 'five six seven eight'] }] };
  const p0 = planOf(r, s), p1 = planOf(r, s, { ...TUNE0, bpm: 80, swing: 0.62 });
  assert.equal(p1.beat.bpm, 80); assert.equal(p1.beat.swing, 0.62);
  assert.ok(Math.abs(p1.measure - 3) < 1e-9);
  if (p0.beat.bpm !== 80) assert.notEqual(p0.timing[1].at, p1.timing[1].at);
  assert.equal(baseOf({ plan: p0 }).swing, 0.58);
});

test('the learning loop keeps a take only when it scores higher, and reports the score before and after', async () => {
  // a stand-in song whose sound is the drum loop at its tune's tempo, swing and gain, so each retune really changes what the ears hear
  const songOf = (tune = null) => ({ tune, plan: { beat: { bpm: tune && tune.bpm ? tune.bpm : 92, swing: tune && tune.swing != null ? tune.swing : 0.5, rapStyle: 'boom bap' } }, retune: (t) => songOf(t) });
  const hear = async (song) => { const t = song.tune || TUNE0, [L, R] = drums({ bpm: song.plan.beat.bpm, swing: song.plan.beat.swing, level: 0.12, seconds: 12 }); const m = master(L, R, RATE, { ...t, bpm: null, swing: null }); return listen(m[0], m[1], RATE); };
  const ref = listen(...drums({ bpm: 78, swing: 0.6, level: 0.5, seconds: 12 }), RATE), steps = [];
  const out = await learn(songOf(), ref, { hear, onStep: (i) => steps.push(i) });
  assert.ok(out.best.cmp.score > out.before.cmp.score + 15, out.before.cmp.score + ' to ' + out.best.cmp.score);
  assert.equal(out.best.song.plan.beat.bpm, Math.round(ref.bpm));
  assert.ok(steps.length >= 1 && steps.length <= 3);
  // a take already at the reference has nothing to change
  const same = await learn(songOf(), listen(...drums({ bpm: 92, swing: 0.5, level: 0.12, seconds: 12 }), RATE), { hear });
  assert.equal(same.best, same.before);
});

test('the table reads plainly', () => {
  assert.equal(shown(null, 'BPM'), 'not heard');
  assert.equal(shown(-14.234, 'LUFS'), '-14.2 LUFS');
  assert.equal(shown(0.583, ''), '0.58');
});

test('a bell boosts its own frequency and leaves a far one alone', () => {
  const sine = (f) => Float32Array.from({ length: RATE }, (_, i) => Math.sin(2 * Math.PI * f * i / RATE)), rms = (x) => { let e = 0; for (let i = RATE / 2; i < x.length; i++) e += x[i] * x[i]; return Math.sqrt(e / (x.length - RATE / 2)); };
  const c = biquad('peaking', 1000, RATE, { gain: 6, q: 0.7 });
  assert.ok(Math.abs(20 * Math.log10(rms(filtered(sine(1000), c)) / rms(sine(1000))) - 6) < 0.3);
  assert.ok(Math.abs(20 * Math.log10(rms(filtered(sine(60), c)) / rms(sine(60)))) < 0.5);
});

test('the quick band read agrees with the full one', () => {
  const [L] = drums({}), a = spectraOf(L, RATE).bands, b = bandsOf(L, RATE);
  for (const k of Object.keys(a)) assert.ok(Math.abs(a[k] - b[k]) < 1.5, k + ': ' + a[k] + ' against ' + b[k]);
});

test('sub and low end move apart when the gaps pull apart (a thin sub under a heavy low end)', () => {
  const rows = [{ key: 'bands.sub', diff: -4, own: -10, ref: -6 }, { key: 'bands.low', diff: 6, own: -1, ref: -7 }];
  const { tune, why } = tuneFor(rows, TUNE0, {});
  assert.ok(tune.sub > 2 && tune.low < -4, JSON.stringify(tune));
  assert.ok(why.some((w) => w.startsWith('More sub bass')) && why.some((w) => w.startsWith('Less low end')));
  assert.deepEqual(mixWhy(TUNE0), []);
});

test('fitMix masters a mix by ear until it reads like the reference, and leaves the tempo and swing alone', () => {
  const [L, R] = drums({ level: 0.3, width: 0.1 }), [a, b] = drums({ level: 0.5, width: 0.5 });
  const ref = mixOf(...master(a, b, RATE, { ...TUNE0, sub: 6, low: -6, mid: 4, air: -5, gain: -3 }), RATE);
  const out = fitMix(L, R, RATE, ref, { ...TUNE0, bpm: 80, swing: 0.6 });
  assert.ok(out.score >= 90 && out.score > out.before + 15, out.before + ' to ' + out.score);
  assert.equal(out.tune.bpm, 80); assert.equal(out.tune.swing, 0.6);
  const got = compare(mixOf(...master(L, R, RATE, out.tune), RATE), ref).rows;
  for (const k of ['lufs', 'bands.mid', 'bands.air']) assert.ok(Math.abs(got.find((r) => r.key === k).diff) < 1.5, k);
});

test('a retune of the master alone shares the rendered mix; a new tempo renders again', () => {
  const s = settingsOf({ topic: 'the moon', style: 'boom bap' }), r = { title: 'Moon', sections: [{ name: 'Verse 1', bars: ['one two three four', 'five six seven eight'] }] };
  const song = songOf(r, s, { win: {} }), louder = song.retune({ ...TUNE0, gain: 3 }), faster = song.retune({ ...TUNE0, bpm: 100 });
  assert.equal(louder.raw(true), song.raw(true));
  assert.equal(louder.retune({ ...TUNE0, gain: 3, air: 2 }).raw(true), song.raw(true));
  assert.notEqual(faster.raw(true), song.raw(true));
});
