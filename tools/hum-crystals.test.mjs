// Hum Crystals' playback level (void-live-deploy/lab/f299-hum-crystal-music-box/tone.js). The imported draft sent every note straight to the
// speakers at a fixed 0.28 gain, mostly a pure sine near middle C, with no master stage: the demo tune peaked at -10.5 dBFS with -20.7 dBFS RMS
// (-28.6 dBFS through a phone-speaker high-pass), and five notes at once clipped at +1.5 dBFS. Every tune is now rendered and mastered: peak at
// -1 dBFS, lifted toward -16 dBFS RMS through a soft limiter. These checks render real tunes in Node and hold that level.
// Run: node --test tools/hum-crystals.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderTune, renderRaw, levelOf, speakerDbOf, master, limit, wavOf, partialsOf, CEILING_DB } from '../void-live-deploy/lab/f299-hum-crystal-music-box/tone.js';
import { pending, TUNED } from './lab-sync.mjs';
import { metaOf } from './lab-import.mjs';

const SR = 48000;
const tuneOf = (midis, ai = false) => { let t = 0; return midis.map((m, i) => { const dur = (i === 10 || i === 13) ? 0.6 : 0.3, n = { midi: m, start: t, dur, ai }; t += dur + 0.05; return n; }); };
const DEMO = tuneOf([60, 62, 64, 60, 60, 62, 64, 60, 64, 65, 67, 64, 65, 67]); // the page's "Try a tune"

// the draft's own voice, sample for sample: a 0.28 sine plus a triangle overtone, no master (what played before the fix)
function legacy(list) {
  const s0 = list[0].start, out = new Float32Array(Math.ceil((Math.max(...list.map((n) => n.start - s0 + n.dur)) + 1.22) * SR));
  for (const n of list) {
    const f = 440 * 2 ** ((n.midi - 69) / 12), r = n.ai ? 2.003 : 3.01, a = n.ai ? 0.18 : 0.1, st = Math.round((n.start - s0 + 0.02) * SR), tail = n.dur + 0.9, k = Math.log(0.001) / (tail - 0.008);
    for (let i = 0; st + i < out.length; i++) {
      const t = i / SR; if (t > tail) break;
      const env = t < 0.008 ? 0.28 * t / 0.008 : 0.28 * Math.exp(k * (t - 0.008));
      let tri = 0; for (const h of [1, 3, 5, 7, 9]) tri += (((h - 1) / 2) % 2 ? -1 : 1) * Math.sin(2 * Math.PI * f * r * h * t) / (h * h);
      out[st + i] += env * (Math.sin(2 * Math.PI * f * t) + a * tri * 8 / Math.PI ** 2);
    }
  }
  return out;
}

test('the demo tune plays at a clear level: peak at -1 dBFS, at least 7 dB louder on average and on a phone speaker than before', () => {
  const before = legacy(DEMO), after = renderTune(DEMO, SR), b = levelOf(before), a = levelOf(after);
  assert.ok(Math.abs(a.peakDb - CEILING_DB) < 0.05, 'peak ' + a.peakDb);
  assert.ok(a.rmsDb >= -16.5, 'rms ' + a.rmsDb + ' dBFS');
  assert.ok(a.rmsDb - b.rmsDb >= 7, `rms ${b.rmsDb.toFixed(1)} -> ${a.rmsDb.toFixed(1)}`);
  const pb = speakerDbOf(before, SR), pa = speakerDbOf(after, SR);
  assert.ok(pa - pb >= 7, `phone ${pb.toFixed(1)} -> ${pa.toFixed(1)}`);
});

test('every tune lands at the same level whatever its shape: one quiet low note, the box answering, five notes at once', () => {
  const cases = { 'one low note': [{ midi: 45, start: 0, dur: 0.2 }], answer: tuneOf([64, 62, 60, 62, 64, 64, 64, 60], true), chord: [60, 64, 67, 72, 76].map((m) => ({ midi: m, start: 0, dur: 0.6 })), high: tuneOf([84, 88, 91, 96]) };
  for (const [name, list] of Object.entries(cases)) {
    const lv = levelOf(renderTune(list, SR));
    assert.ok(lv.peakDb <= CEILING_DB + 1e-6 && lv.peakDb >= CEILING_DB - 0.5, name + ' peak ' + lv.peakDb);
    assert.ok(lv.rmsDb >= -17, name + ' rms ' + lv.rmsDb);
  }
  assert.ok(levelOf(legacy(cases.chord)).peakDb > 0, 'the draft clipped five notes at once');
});

test('the limiter never passes the ceiling and leaves quiet samples alone; master does nothing to silence', () => {
  const c = 10 ** (CEILING_DB / 20);
  for (const x of [0, 0.1, 0.5, 0.9, 1, 2, 10, -3]) assert.ok(Math.abs(limit(x)) <= c + 1e-12, String(x));
  assert.equal(limit(0.3), 0.3);
  const z = new Float32Array(1000); assert.equal(master(z), 0); assert.ok(z.every((v) => v === 0));
  assert.ok(renderRaw([], SR).length === 0);
});

test('the box still sounds unlike your hum, and Save sound writes the mastered samples as a valid WAV', () => {
  assert.notDeepEqual(partialsOf(true), partialsOf(false));
  const b = renderTune(DEMO.slice(0, 3), 44100), wav = new DataView(wavOf(b, 44100));
  assert.equal(String.fromCharCode(...new Uint8Array(wav.buffer, 0, 4)), 'RIFF');
  assert.equal(wav.getUint32(24, true), 44100); assert.equal(wav.getUint32(40, true), b.length * 2);
  let peak = 0; for (let i = 0; i < b.length; i++) peak = Math.max(peak, Math.abs(wav.getInt16(44 + i * 2, true)));
  assert.ok(peak > 28000 && peak <= 32767, 'saved peak ' + peak);
});

test('a lab re-import never undoes the hand-tuned page unless it is named', () => {
  assert.ok(TUNED.has('f299-hum-crystal-music-box'));
  const d = { dir: 'F299-hum-crystal-music-box', html: '<title>Hum</title>', spec: '' }, slug = metaOf(d.dir, d.html, d.spec).slug;
  assert.equal(slug, 'f299-hum-crystal-music-box');
  const cat = [{ slug, hash: 'old' }];
  assert.equal(pending([d], cat, { all: true }).length, 0, '--all leaves it');
  assert.equal(pending([d], cat).length, 0, 'a changed draft leaves it');
  assert.equal(pending([d], cat, { only: new Set([slug]) }).length, 1, 'naming it re-imports it');
  assert.equal(pending([d], [], {}).length, 1, 'a first import still happens');
});
