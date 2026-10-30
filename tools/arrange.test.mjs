// lib/arrange.js: a heavy ask makes a song with a shape. Run: node --test tools/arrange.test.mjs
// (the loudness of each section is measured in a browser: tools/test_void.mjs, "music: a heavy ask")
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { arrange, isHeavy, FORM, sectionsLine, sectionsSvg, sectionLoudness, scheduleArranged, arrangedLine } from '../void-live-deploy/lib/arrange.js';
import { compose, describe, notesText, instrumentsFor } from '../void-live-deploy/lib/compose.js';
import { listen } from '../void-live-deploy/lib/rap-ears.js';

test('only a heavy ask is arranged; every other ask stays the piece it was', () => {
  for (const a of ['make a heavy metal song', 'angry punk rock riff', 'an industrial breakdown', 'make me a brutal song']) assert.ok(isHeavy(a) && arrange(a), a);
  for (const a of ['make me a lullaby', 'music for a rainy day', 'compose a happy tune', 'write me a spooky song for halloween', 'make a rocking chair song']) assert.equal(arrange(a), null, a);
  assert.deepEqual(compose('make me a lullaby'), compose('make me a lullaby'), 'the old pieces are untouched');
});
test('the same ask gives the same song, a different ask a different one', () => {
  assert.deepEqual(arrange('make a heavy metal song'), arrange('make a heavy metal song'));
  assert.notEqual(arrange('make a heavy metal song').seed, arrange('make an angry punk song').seed);
});
test('the form: the sections fill the bars in order, quiet ones carry no drums and no guitar, loud ones carry both, and the climax is the most tense', () => {
  const p = arrange('make a heavy metal song');
  assert.deepEqual(p.sections.map((s) => s.id), FORM.map((s) => s.id)); assert.equal(p.bars, FORM.reduce((n, s) => n + s.bars, 0)); assert.equal(p.steps, p.bars * 16);
  let at = 0; for (const s of p.sections) { assert.equal(s.from, at); at += s.bars; }
  const inSec = (id, steps) => steps.filter((st) => { const s = p.sections.find((x) => x.id === id); return st >= s.fromStep && st < s.fromStep + s.steps; });
  for (const id of ['bridge']) { assert.equal(inSec(id, p.drums.kick).length, 0); assert.equal(inSec(id, p.guitar.map((g) => g.step)).length, 0); }
  assert.equal(inSec('intro', p.drums.kick).length, 0); assert.equal(inSec('intro', p.guitar.map((g) => g.step)).length, 0);
  for (const id of ['drop', 'breakdown', 'climax']) { assert.ok(inSec(id, p.drums.kick).length > 0, id + ' kicks'); assert.ok(inSec(id, p.guitar.map((g) => g.step)).length > 0, id + ' guitar'); }
  assert.ok(inSec('climax', p.drums.kick).length > inSec('breakdown', p.drums.kick).length, 'the climax kicks more than the breakdown (double kick)');
  assert.equal(Math.max(...p.sections.map((s) => s.tension)), p.sections.find((s) => s.id === 'climax').tension);
  assert.ok(p.drums.crash.includes(p.sections.find((s) => s.id === 'climax').fromStep), 'a crash lands on the climax');
  assert.ok(inSec('intro', p.drums.snare).length > 0, 'the intro ends on a snare roll into the drop');
});
test('every note is inside the song, on a real pitch, and the lead comes home', () => {
  const p = arrange('make a heavy metal song');
  for (const k of ['bass', 'melody', 'guitar', 'pad']) for (const n of p[k]) { assert.ok(n.step >= 0 && n.step < p.steps, k + ' step ' + n.step); assert.ok(n.midi >= 20 && n.midi <= 100, k + ' midi ' + n.midi); assert.ok(n.len >= 1, k + ' len'); }
  for (const k of ['kick', 'snare', 'hat', 'crash']) for (const st of p.drums[k]) assert.ok(st >= 0 && st < p.steps, k);
  assert.equal(p.chords.length, p.bars);
});
test('it fits the places a piece goes: the notes text, the description and the form line', () => {
  const p = arrange('make a heavy metal song');
  assert.match(describe(p), /heavy piece in .* (phrygian|minor), \d+ beats a minute, 28 bars/);
  assert.equal(notesText(p).split('\n').length, 3 + p.bars);
  assert.equal(sectionsLine(p), 'intro 4 · drop 8 · breakdown 4 · bridge 4 · climax 8 (bars)');
  assert.equal((sectionsSvg(p).match(/<rect/g) || []).length, 5);
});
test('sectionLoudness reads each section from samples (a loud section reads higher than a quiet one)', () => {
  const p = arrange('make a heavy metal song'), rate = 1000, sp = 60 / p.bpm / 4, total = Math.ceil(p.steps * sp * rate), x = new Float32Array(total);
  const quiet = p.sections.find((s) => s.id === 'intro'), loud = p.sections.find((s) => s.id === 'climax');
  for (let i = 0; i < total; i++) { const t = i / rate / sp; x[i] = (t >= loud.fromStep && t < loud.fromStep + loud.steps ? 0.5 : t >= quiet.fromStep && t < quiet.fromStep + quiet.steps ? 0.05 : 0.2) * Math.sin(i); }
  const by = Object.fromEntries(sectionLoudness(x, rate, p).map((s) => [s.id, s.db])); assert.ok(by.climax - by.intro > 15, JSON.stringify(by));
});

// the real instruments in a heavy song (owner, 2026-10-30: "drums needs to sound like perfect studio quality"): the recorded acoustic kit
// plays every hit, harder as the tension rises, and the pad is the recorded grand piano; Verse's own ears hear the tempo it was written at.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../void-live-deploy'), RATE = 48000;
function pcm(buf) {
  for (let p = 12; p + 8 <= buf.length;) { const id = buf.toString('ascii', p, p + 4), n = buf.readUInt32LE(p + 4); if (id === 'data') { const d = buf.subarray(p + 8, p + 8 + n), o = new Float32Array(d.length / 2); for (let i = 0; i < o.length; i++) o[i] = d.readInt16LE(i * 2) / 32768; return o; } p += 8 + n + (n % 2); }
  throw new Error('no data chunk');
}
const fetchFn = async (u) => ({ ok: true, arrayBuffer: async () => ({ path: u, bytes: readFileSync(resolve(ROOT, '.' + u)) }) });
/** a context that records every recording it plays */
function recorder() {
  const sources = [], param = (o, k) => ({ value: 0, setValueAtTime(v) { if (o[k] == null) o[k] = v; }, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => { const n = { connect() {}, frequency: param({}, 'f'), detune: { value: 0 }, Q: { value: 0 }, threshold: { value: 0 }, knee: { value: 0 }, ratio: { value: 0 }, attack: { value: 0 }, release: { value: 0 } }; n.gain = param(n, 'g'); return n; };
  const ctx = { sampleRate: RATE, destination: {}, createGain: node, createBiquadFilter: node, createDynamicsCompressor: node, createWaveShaper: node, createOscillator() { return { ...node(), start() {}, stop() {} }; },
    createBuffer: (c, n) => ({ getChannelData: () => new Float32Array(n) }), decodeAudioData: async (b) => ({ path: b.path, data: pcm(b.bytes) }),
    createBufferSource() { const s = { playbackRate: { value: 1 }, connect(g) { s.g = g; }, start(at) { s.at = at; }, stop(t) { s.off = t; } }; sources.push(s); return s; } };
  return { ctx, played: () => sources.filter((s) => s.buffer && s.buffer.path).map((s) => ({ path: s.buffer.path, data: s.buffer.data, at: s.at, rate: s.playbackRate.value, gain: s.g.g ?? s.g.gain.value, off: s.off })) };
}
test('a heavy song on the real instruments: every hit a recording, harder in the climax, the pad on the grand piano', async () => {
  const p = arrange('make a heavy metal song'), { ctx, played } = recorder(), inst = await instrumentsFor(p, ctx, { fetchFn });
  assert.equal(inst.kit.name, 'kit'); assert.ok(inst.piano.buffers.size > 0);
  assert.equal(arrangedLine(p, inst), 'The drums are a real recorded kit and the pad is a real grand piano; the guitar, bass and lead are synthesised.');
  assert.equal(arrangedLine(p, {}), 'The recordings did not load, so every part is synthesised.');
  const secs = scheduleArranged(ctx, p, 0, inst), rec = played(), d = p.drums, sp = 60 / p.bpm / 4;
  const drums = rec.filter((r) => r.path.startsWith('/sounds/drums/kit/')), piano = rec.filter((r) => r.path.startsWith('/sounds/piano/'));
  assert.equal(drums.length, d.kick.length + d.snare.length + d.hat.length + d.crash.length, 'every hit');
  assert.equal(drums.filter((r) => r.path.includes('/crash-')).length, d.crash.length);
  assert.equal(piano.length, p.pad.length, 'every pad note');
  const kickAt = (id) => { const s = p.sections.find((x) => x.id === id); return drums.filter((r) => r.path.includes('/kick-') && r.at >= s.fromStep * sp && r.at < (s.fromStep + s.steps) * sp); };
  const loud = (rs) => rs.reduce((a, r) => a + r.gain, 0) / rs.length;
  assert.ok(loud(kickAt('climax')) > loud(kickAt('drop')), 'the climax kicks hit harder than the drop: ' + loud(kickAt('climax')).toFixed(3) + ' vs ' + loud(kickAt('drop')).toFixed(3));
  assert.ok(Math.abs(secs - (p.steps * sp + 2.4)) < 1e-6);
  // Verse's ears on the drop, mixed from the real takes
  const drop = p.sections.find((x) => x.id === 'drop'), from = drop.fromStep * sp, to = (drop.fromStep + drop.steps) * sp, out = new Float32Array(Math.ceil((to + 1) * RATE));
  for (const r of drums) { if (r.at >= to) continue; const a = Math.round(r.at * RATE); for (let i = 0; a + i < out.length && i < r.data.length; i++) out[a + i] += 0.5 * r.gain * r.data[i]; }
  let peak = 0; for (const v of out) peak = Math.max(peak, Math.abs(v)); if (peak > 0.9) for (let i = 0; i < out.length; i++) out[i] *= 0.9 / peak;
  const heard = listen(out, out, RATE, { from, to });
  assert.ok(heard && [p.bpm, p.bpm / 2, p.bpm * 2].some((b) => Math.abs(heard.bpm - b) <= 1.5), 'written at ' + p.bpm + ' bpm, heard at ' + (heard && heard.bpm));
  assert.ok(heard.bands.low > -20 || heard.bands.sub > -30, 'a real low end: low ' + heard.bands.low + ' dB');
});
