// Verse's keys are a real grand piano (owner, 2026-10-30: "needs real beats and music ... not just rap all music"): every take lib/rap-piano.js
// names is on disk as a clean 48 kHz mono 16-bit recording that starts on its hammer and sounds at its own pitch, a note plays the nearest
// recording at the right speed and layer, a chord is rolled by hand the same way every time, and a boom bap beat's keys played on the real
// takes sound the chord the beat wrote. The mixer here is a plain sum, so the test hears the recordings, not the browser's effects.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NOTES, ROOTS, SECONDS, HARD, takeOf, chordOf, pathOf, loadPiano, takesFor } from '../void-live-deploy/lib/rap-piano.js';
import { pitchOf } from '../void-live-deploy/lib/rap-voice.js';
import { settingsOf, beatFor } from '../void-live-deploy/lib/rap.js';
import { beatEvents } from '../void-live-deploy/lib/rap-beat.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../void-live-deploy');
const RATE = 48000;
const fileOf = (path) => resolve(ROOT, '.' + path);
const hz = (m) => 440 * 2 ** ((m - 69) / 12);

function readWav(buf) {
  assert.equal(buf.toString('ascii', 0, 4), 'RIFF'); assert.equal(buf.toString('ascii', 8, 12), 'WAVE');
  let fmt = null, data = null;
  for (let p = 12; p + 8 <= buf.length;) {
    const id = buf.toString('ascii', p, p + 4), n = buf.readUInt32LE(p + 4);
    if (id === 'fmt ') fmt = { format: buf.readUInt16LE(p + 8), channels: buf.readUInt16LE(p + 10), rate: buf.readUInt32LE(p + 12), bits: buf.readUInt16LE(p + 22) };
    if (id === 'data') data = buf.subarray(p + 8, p + 8 + n);
    p += 8 + n + (n % 2);
  }
  assert.ok(fmt && data, 'fmt and data chunks');
  const out = new Float32Array(data.length / 2 / fmt.channels);
  for (let i = 0; i < out.length; i++) out[i] = data.readInt16LE(i * 2 * fmt.channels) / 32768;
  return { ...fmt, data: out };
}
const takes = new Map();
const takeData = (path) => { if (!takes.has(path)) takes.set(path, readWav(readFileSync(fileOf(path))).data); return takes.get(path); };

test('every take is on disk: 48 kHz, mono, 16-bit, starting on its hammer, faded to silence, at the level NOTES says', () => {
  assert.deepEqual(ROOTS, [36, 40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80, 84]);
  for (const root of ROOTS) for (const layer of ['soft', 'hard']) {
    const path = pathOf(root, layer), label = root + ' ' + layer;
    assert.ok(existsSync(fileOf(path)), label + ' is on disk');
    const w = readWav(readFileSync(fileOf(path)));
    assert.deepEqual([w.format, w.channels, w.rate, w.bits], [1, 1, RATE, 16], label + ': PCM, mono, 48 kHz, 16-bit');
    let peak = 0; for (const v of w.data) peak = Math.max(peak, Math.abs(v));
    const first = w.data.findIndex((x) => Math.abs(x) > peak * 0.05);
    assert.ok(first <= 0.004 * RATE, label + ': the hammer lands at ' + (first / RATE * 1000).toFixed(1) + ' ms');
    assert.ok(Math.abs(w.data[0]) < 0.01 && Math.abs(w.data[w.data.length - 1]) < 0.01, label + ': no click at either end');
    assert.ok(Math.abs(w.data.length / RATE - SECONDS) < 0.01, label + ': ' + SECONDS + ' s long');
    assert.ok(Math.abs(peak / 0.89 - NOTES[root][layer]) < 0.01, label + ': level ' + NOTES[root][layer] + ' matches the file (' + (peak / 0.89).toFixed(3) + ')');
  }
});

// a hard strike rings a little sharp for its first tenths of a second (the string's tension rises with its swing), so the note is heard once it settles
test('every take settles on its own note, within 15 cents', () => {
  for (const root of ROOTS) for (const layer of ['soft', 'hard']) {
    const x = takeData(pathOf(root, layer)).subarray(Math.round(0.5 * RATE), Math.round(1.0 * RATE)), f = pitchOf(x, RATE, { lo: 40, hi: 1200 });
    assert.ok(f, root + ' ' + layer + ': a pitch is heard');
    const cents = 1200 * Math.log2(f / hz(root));
    assert.ok(Math.abs(cents) < 15, root + ' ' + layer + ': heard ' + f.toFixed(1) + ' Hz for ' + hz(root).toFixed(1) + ' Hz (' + cents.toFixed(1) + ' cents)');
  }
});

test('a note plays the nearest recording at its pitch, the layer its velocity calls for, never shifted more than 2 semitones in range', () => {
  for (let m = 34; m <= 86; m++) {
    const k = takeOf(m, 0.9);
    assert.ok(Math.abs(m - k.root) <= 2, m + ' plays ' + k.root);
    assert.ok(Math.abs(k.rate - 2 ** ((m - k.root) / 12)) < 1e-12, m + ': rate');
  }
  assert.equal(takeOf(54).root, 52, 'a tie goes to the lower recording (slowing down keeps the attack)');
  assert.equal(takeOf(60, HARD).layer, 'hard'); assert.equal(takeOf(60, HARD - 0.01).layer, 'soft');
  assert.equal(takeOf(60, 1).path, '/sounds/piano/60-hard.wav');
  assert.ok(Math.abs(takeOf(52, 0.5).gain - 0.5 / NOTES[52].soft) < 1e-12, 'the gain brings the take to the velocity');
  assert.ok(takeOf(52, 0.79).gain <= 1.6, 'never lifted more than 1.6 times');
  assert.equal(takeOf(20).root, 36, 'below the range: the lowest recording');
});

test('a chord is rolled by hand: low to high, 6 to 10 ms apart, the top note louder, the same every time', () => {
  const e = { t: 2, vel: 0.9, notes: [64, 55, 60, 67], dur: 1.5 }, c = chordOf(e);
  assert.deepEqual(c.map((n) => n.midi), [55, 60, 64, 67]);
  assert.deepEqual(chordOf(e), c, 'deterministic');
  for (let i = 1; i < c.length; i++) { const gap = c[i].t - c[i - 1].t; assert.ok(gap > 0.002 && gap < 0.016, 'gap ' + (gap * 1000).toFixed(1) + ' ms'); }
  assert.ok(Math.abs(c[0].t - 2) <= 0.0016, 'the lowest note starts on the beat');
  assert.ok(c[3].vel > Math.max(c[0].vel, c[1].vel, c[2].vel), 'the top note carries the tune');
  assert.ok(c.every((n) => n.vel > 0 && n.vel <= 1 && n.dur > 0));
  assert.notDeepEqual(chordOf({ ...e, t: 3 }).map((n) => n.vel), c.map((n) => n.vel), 'another chord is played a little differently');
  assert.deepEqual(chordOf({ t: 0, notes: [] }), []);
});

test('a page loads only the takes its music plays, each once, shared between pages of the same session', async () => {
  assert.deepEqual(takesFor([55, 60, 64, 67]), ['/sounds/piano/56-soft.wav', '/sounds/piano/56-hard.wav', '/sounds/piano/60-soft.wav', '/sounds/piano/60-hard.wav', '/sounds/piano/64-soft.wav', '/sounds/piano/64-hard.wav', '/sounds/piano/68-soft.wav', '/sounds/piano/68-hard.wav']);
  assert.equal(takesFor().length, ROOTS.length * 2, 'no notes named: every take');
  const seen = [];
  const fetchFn = async (u) => { seen.push(u); return { ok: true, arrayBuffer: async () => readFileSync(fileOf(u)) }; };
  const p = await loadPiano({ fetchFn, decode: (b) => b.length, notes: [55, 60, 64, 67] });
  assert.equal(p.buffers.size, 8); assert.equal(seen.length, 8);
  const all = await loadPiano({ fetchFn, decode: (b) => b.length });
  assert.equal(all.buffers.size, ROOTS.length * 2);
  assert.equal(seen.length, ROOTS.length * 2, 'the takes already loaded are not fetched again');
  await loadPiano({ fetchFn, decode: (b) => b.length });
  assert.equal(seen.length, ROOTS.length * 2, 'the second load fetches nothing');
});

/** pitch-class energy of x: the spectrum folded onto the 12 notes, from C3 to C6 */
function chroma(x) {
  const out = new Float64Array(12);
  for (let m = 48; m <= 84; m++) {
    const f = hz(m), w = (2 * Math.PI * f) / RATE; let re = 0, im = 0;
    for (let i = 0; i < x.length; i++) { const h = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / x.length); re += x[i] * h * Math.cos(w * i); im += x[i] * h * Math.sin(w * i); }
    out[m % 12] += Math.hypot(re, im);
  }
  return out;
}
test('a boom bap beat\'s keys on the real piano sound the chords the beat wrote', () => {
  const beat = beatFor(settingsOf({ topic: 'pizza', style: 'boom bap' })), p = beatEvents(beat, { measures: 4 });
  const keys = p.events.filter((e) => e.kind === 'keys'); assert.ok(keys.length >= 4, keys.length + ' chords');
  const out = new Float32Array(Math.ceil((4 * p.measure + 3) * RATE));
  for (const e of keys) for (const n of chordOf(e)) {
    const k = takeOf(n.midi, n.vel), x = takeData(k.path), a = Math.round(n.t * RATE), len = Math.round(Math.min(n.dur, 2.6) * RATE);
    for (let i = 0, pos = 0; a + i < out.length && pos < x.length - 1 && i < len; i++, pos += k.rate) { const j = Math.floor(pos), f = pos - j; out[a + i] += 0.32 * k.gain * (x[j] * (1 - f) + x[j + 1] * f); }
  }
  let hits = 0;
  for (const e of keys.filter((k) => k.vel === 0.9)) {
    const c = chroma(out.subarray(Math.round((e.t + 0.08) * RATE), Math.round((e.t + 0.08) * RATE) + 8192)), want = new Set(e.notes.map((n) => n % 12));
    const top = [...c.keys()].sort((a, b) => c[b] - c[a]).slice(0, want.size);
    const inChord = top.filter((pc) => want.has(pc)).length;
    if (inChord >= want.size - 1) hits++;
    assert.ok(want.has(top[0]), 'the loudest note at ' + e.t.toFixed(2) + ' s is in the chord ' + [...want] + ' (heard ' + top + ')');
  }
  assert.ok(hits >= 3, hits + ' chords heard with all but one of their notes on top');
});
