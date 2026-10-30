// Verse's drums are real recordings (owner, 2026-10-30: "needs real beats and music drums needs to sound like perfect studio quality"): every
// take lib/rap-kit.js names is on disk as a clean 48 kHz mono 16-bit file that starts on its hit, a hit picks the right velocity layer and round
// robin, the 808 bass is tuned by its playback rate, and a beat played on the real samples is heard by Verse's own ears (lib/rap-ears.js) at the
// tempo and swing it was written at, with a real low end. The mixer here is a plain sum, so the test hears the samples, not the browser's effects.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KITS, KIT_OF, kitFor, takeOf, hitsOf, pathOf, loadKit, BASS_ROOT } from '../void-live-deploy/lib/rap-kit.js';
import { settingsOf, beatFor } from '../void-live-deploy/lib/rap.js';
import { beatEvents } from '../void-live-deploy/lib/rap-beat.js';
import { listen } from '../void-live-deploy/lib/rap-ears.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../void-live-deploy');
const RATE = 48000;
const fileOf = (path) => resolve(ROOT, '.' + path);

/** a 16-bit PCM WAV: { channels, rate, bits, data: Float32Array } (the first channel). */
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

test('every take a kit names is on disk: 48 kHz, mono, 16-bit, starting on its hit and fading to silence', () => {
  let n = 0;
  for (const [kit, voices] of Object.entries(KITS)) for (const [voice, v] of Object.entries(voices)) {
    assert.equal(v.files.length % v.layers, 0, kit + ' ' + voice + ': as many takes in each layer');
    for (const [file, level] of v.files) {
      const path = pathOf(kit, file), label = kit + ' ' + voice + ' ' + file;
      assert.ok(existsSync(fileOf(path)), label + ' is on disk');
      const w = readWav(readFileSync(fileOf(path)));
      assert.deepEqual([w.format, w.channels, w.rate, w.bits], [1, 1, RATE, 16], label + ': PCM, mono, 48 kHz, 16-bit');
      let peak = 0, at = 0; for (let i = 0; i < w.data.length; i++) { const a = Math.abs(w.data[i]); if (a > peak) { peak = a; at = i; } }
      const first = w.data.findIndex((x) => Math.abs(x) > peak * 0.05);
      assert.ok(first <= 0.004 * RATE, label + ': the hit starts at ' + (first / RATE * 1000).toFixed(1) + ' ms');
      assert.ok(Math.abs(w.data[0]) < 0.01 && Math.abs(w.data[w.data.length - 1]) < 0.01, label + ': no click at either end');
      assert.ok(Math.abs(peak / 0.89 - level) < 0.02, label + ': its level ' + level + ' matches the file (' + (peak / 0.89).toFixed(3) + ')');
      assert.ok(at < w.data.length, label); n++;
    }
  }
  assert.ok(n >= 50, n + ' takes');
});

test('a hit picks its velocity layer, then its round robin, and the gain that brings it to the velocity', () => {
  assert.equal(takeOf('kit', 'snare', 1, 0).file, 'snare-1');
  assert.equal(takeOf('kit', 'snare', 1, 1).file, 'snare-2', 'the next hit is the other take');
  assert.equal(takeOf('kit', 'snare', 1, 2).file, 'snare-1');
  assert.equal(takeOf('kit', 'snare', 0.75, 0).file, 'snare-3', 'a softer hit is the softer recording');
  assert.equal(takeOf('kit', 'snare', 0.5, 1).file, 'snare-6', 'the softest layer');
  assert.equal(takeOf('kit', 'snare', 0.1, 0).file, 'snare-5', 'below the range stays on the softest layer');
  assert.equal(takeOf('kit', 'snare', 1, 0).gain, 1);
  const soft = takeOf('kit', 'snare', 0.5, 0);
  assert.ok(soft.gain > 1 && soft.gain <= 4, 'a soft layer is lifted to its velocity, never more than 4 times: ' + soft.gain);
  assert.ok(Math.abs(takeOf('808', 'hat', 0.6, 0).gain - 0.6) < 1e-9, 'one layer: the gain is the velocity');
  assert.equal(takeOf('kit', 'cowbell', 1, 0), null, 'a voice the kit lacks plays nothing');
  assert.equal(pathOf('808', '../kit/clap-1'), '/sounds/drums/kit/clap-1.wav', 'a take one kit lends another');
  assert.equal(pathOf('808', 'kick-1'), '/sounds/drums/808/kick-1.wav');
});

test('the beat events become hits: the 808 bass tuned by its rate, a slide from the note before, claps doubled with real hands', () => {
  const ev = [
    { t: 0, kind: 'kick', vel: 1 }, { t: 0, kind: '808', midi: BASS_ROOT, dur: 0.5 }, { t: 0.5, kind: '808', midi: BASS_ROOT + 12, from: BASS_ROOT, dur: 0.4 },
    { t: 0.5, kind: 'clap' }, { t: 0.6, kind: 'hat', vel: 0.8 }, { t: 0.7, kind: 'hat', vel: 0.8 }, { t: 0.8, kind: 'keys' },
  ];
  const h = hitsOf(ev, '808');
  const bass = h.filter((x) => x.voice === 'bass');
  assert.equal(bass.length, 2);
  assert.equal(bass[0].rate, 1, 'G1 plays at its own speed');
  assert.ok(Math.abs(bass[1].rate - 2) < 1e-9, 'an octave up plays twice as fast');
  assert.equal(bass[1].from, 1, 'the slide starts at the note before');
  assert.equal(bass[0].from, null);
  assert.deepEqual(bass.map((x) => x.dur), [0.5, 0.4]);
  assert.deepEqual(h.filter((x) => x.t === 0.5 && x.voice !== 'bass').map((x) => x.voice), ['clap', 'clap2'], 'the 808 clap with a real one under it');
  const hats = h.filter((x) => x.voice === 'hat');
  assert.equal(hats.length, 2); assert.ok(hats.every((x) => Math.abs(x.gain - 0.8 * 0.55) < 1e-9));
  assert.ok(!h.some((x) => x.voice === 'keys'), 'the music is not a drum');
  const k = hitsOf([{ t: 0, kind: 'hat', vel: 1 }, { t: 0.1, kind: 'hat', vel: 1 }, { t: 0.2, kind: 'hat', vel: 1 }], 'kit');
  assert.deepEqual(k.map((x) => x.file), ['hat-1', 'hat-2', 'hat-1'], 'round robins alternate');
  assert.ok(!hitsOf([{ t: 0, kind: '808', midi: 31 }], 'kit').length, 'the acoustic kit plays no 808');
});

test('each style plays the kit that fits it', () => {
  assert.equal(kitFor({ rapStyle: 'boom bap' }), 'kit');
  assert.equal(kitFor({ rapStyle: 'trap' }), '808');
  assert.equal(kitFor({}), 'kit');
  for (const k of Object.values(KIT_OF)) assert.ok(KITS[k], k);
});

test('a kit loads every take once and shares it between pages of the same session', async () => {
  const seen = [];
  const fetchFn = async (u) => { seen.push(u); return { ok: true, arrayBuffer: async () => readFileSync(fileOf(u)) } };
  const k = await loadKit('808', { fetchFn, decode: (b) => b.length });
  const paths = new Set(Object.values(KITS['808']).flatMap((v) => v.files.map(([f]) => pathOf('808', f))));
  assert.equal(k.buffers.size, paths.size);
  assert.equal(seen.length, paths.size);
  await loadKit('808', { fetchFn, decode: (b) => b.length });
  assert.equal(seen.length, paths.size, 'the second load fetches nothing');
  await assert.rejects(loadKit('kit', { fetchFn: async () => ({ ok: false, status: 404 }), decode: (b) => b }), /404/);
});

/** play hits on the real takes: a plain sum, each take resampled to its rate (the 808 bass's slide ramps over 0.12 s). Mono. */
function play(hits, kit, seconds) {
  const out = new Float32Array(Math.ceil(seconds * RATE));
  for (const h of hits) {
    const x = takeData(h.path), a = Math.round(h.t * RATE), stop = h.dur != null ? Math.round((h.dur + 0.08) * RATE) : Infinity;
    let pos = 0;
    for (let i = 0; a + i < out.length && pos < x.length - 1 && i < stop; i++) {
      const j = Math.floor(pos), f = pos - j, g = h.dur != null && i > h.dur * 0.85 * RATE ? Math.max(0, 1 - (i - h.dur * 0.85 * RATE) / (0.08 * RATE)) : 1;
      out[a + i] += h.gain * g * (x[j] * (1 - f) + x[j + 1] * f);
      const r = h.from != null && i < 0.12 * RATE ? h.from + (h.rate - h.from) * i / (0.12 * RATE) : h.rate; pos += r;
    }
  }
  let peak = 0; for (const v of out) peak = Math.max(peak, Math.abs(v));
  if (peak > 0.9) for (let i = 0; i < out.length; i++) out[i] *= 0.9 / peak;
  return out;
}
const near = (heard, bpm) => [bpm, bpm / 2, bpm * 2].some((b) => Math.abs(heard - b) <= 1.5);

for (const style of ['boom bap', 'trap', 'drill']) test('a ' + style + ' beat on the real ' + (KIT_OF[style]) + ' samples: Verse hears its tempo, its swing and its low end', () => {
  const beat = beatFor(settingsOf({ topic: 'pizza', style })), kit = kitFor(beat), p = beatEvents(beat, { measures: 6 });
  const hits = hitsOf(p.events, kit);
  assert.ok(hits.length > 40, hits.length + ' hits');
  const x = play(hits, kit, 6 * p.measure + 1), heard = listen(x, x, RATE, { from: p.measure, to: 5 * p.measure });
  assert.ok(heard, 'the ears heard it');
  assert.ok(near(heard.bpm, beat.bpm), style + ': written at ' + beat.bpm + ', heard at ' + heard.bpm);
  if (heard.swing != null && Math.abs(heard.bpm - beat.bpm) <= 1.5) assert.ok(Math.abs(heard.swing - p.swing) <= 0.05, style + ': swing ' + p.swing + ' heard as ' + heard.swing);
  assert.ok(heard.peak <= 0, 'no clipping: peak ' + heard.peak + ' dB');
  assert.ok(heard.bands.sub > -30 || heard.bands.low > -14, style + ': a real low end, sub ' + heard.bands.sub + ' dB, low ' + heard.bands.low + ' dB');
  assert.ok(heard.bands.presence > -40 && heard.bands.air > -50, style + ': cymbals and snares cut through, presence ' + heard.bands.presence + ', air ' + heard.bands.air);
});
