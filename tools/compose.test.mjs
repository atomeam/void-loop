// Verse's music (lib/compose.js, skills/music.js). Run: node --test tools/compose.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { compose, describe, notesText, wavBytes, schedule, moodOf, SCALES, hz } from '../void-live-deploy/lib/compose.js';
import music, { rollSvg } from '../void-live-deploy/skills/music.js';

test('the same ask always gives the same piece; different asks differ', () => {
  assert.deepEqual(compose('make me a lullaby'), compose('make me a lullaby'));
  assert.deepEqual({ ...compose('make me a lullaby'), ask: 0 }, { ...compose('Make me a LULLABY!'), ask: 0 });
  assert.notDeepEqual(compose('make me a lullaby'), compose('music for a rainy day'));
  assert.notDeepEqual(compose('a happy tune', 0), compose('a happy tune', 1));
});
test('the mood word picks tempo and scale; the values are what the card says', () => {
  const lull = compose('make me a lullaby'), dance = compose('a happy summer song'), beat = compose('make a beat');
  assert.equal(lull.mood, 'lullaby'); assert.ok(lull.bpm >= 58 && lull.bpm <= 70); assert.ok(dance.bpm >= 108); assert.ok(beat.drums.kick.length > 0 && lull.drums.snare.length === 0);
  for (const p of [lull, dance, beat]) {
    assert.ok(p.scale in SCALES); assert.equal(p.bars, 8); assert.equal(p.chords.length, 8); assert.ok(p.melody.length >= 8);
    const text = describe(p); assert.ok(text.includes(p.key) && text.includes(p.scale) && text.includes(String(p.bpm)) && text.includes(String(p.bars)));
    const inScale = new Set(SCALES[p.scale].map((x) => (x + p.tonic) % 12));
    assert.ok(p.melody.every((n) => inScale.has(n.midi % 12)), p.mood + ': every melody note is in its scale');
    assert.ok(p.melody.every((n) => n.step >= 0 && n.step < p.steps));
    const last = p.melody[p.melody.length - 1]; assert.equal(last.midi % 12, p.tonic % 12, 'it ends at home');
  }
  assert.equal(moodOf('hello'), null); assert.match(describe(compose('hello')), /named no mood/);
});
test('notes text lists every bar; the WAV is a real 16-bit mono file', () => {
  const p = compose('music for a rainy day'), t = notesText(p);
  assert.equal(t.split('\n').filter((l) => /^bar \d/.test(l)).length, p.bars); assert.ok(t.includes(String(p.bpm) + ' bpm'));
  const w = wavBytes(new Float32Array([0, 0.5, -0.5, 1, -1, 2]), 22050), v = new DataView(w.buffer);
  assert.equal(String.fromCharCode(...w.slice(0, 4)), 'RIFF'); assert.equal(String.fromCharCode(...w.slice(8, 12)), 'WAVE'); assert.equal(v.getUint32(24, true), 22050); assert.equal(v.getUint16(34, true), 16); assert.equal(v.getUint32(40, true), 12);
  assert.equal(v.getInt16(44 + 6, true), 32767); assert.equal(v.getInt16(44 + 8, true), -32768); assert.equal(v.getInt16(44 + 10, true), 32767);
});
test('schedule plays every note on a fake context and lasts the piece', () => {
  const made = { osc: 0, noise: 0 }, node = () => ({ connect() {}, gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, Q: {} });
  const ctx = { sampleRate: 22050, destination: {}, createGain: node, createBiquadFilter: node, createOscillator() { made.osc++; return { ...node(), start() {}, stop() {} }; }, createBuffer: (c, n) => ({ getChannelData: () => new Float32Array(n) }), createBufferSource() { made.noise++; return { ...node(), start() {} }; } };
  const p = compose('make a beat'), secs = schedule(ctx, p, 0);
  assert.ok(Math.abs(secs - (p.steps * 60 / p.bpm / 4 + 0.6)) < 1e-6);
  assert.equal(made.osc, p.chords.length * 3 + p.bass.length + p.melody.length + p.drums.kick.length); assert.equal(made.noise, p.drums.snare.length + p.drums.hat.length);
  assert.ok(Math.abs(hz(69) - 440) < 1e-9);
});
test('the skill takes asks to make music and leaves playing, lyrics and look-alikes', () => {
  for (const e of music.examples) assert.ok(music.match(e.toLowerCase(), e), e);
  for (const e of music.nearMisses) assert.ok(!music.match(e.toLowerCase(), e), e);
  const svg = rollSvg(compose('make me a song')); assert.match(svg, /^<svg /); assert.ok((svg.match(/class="mu-note"/g) || []).length >= 8); assert.ok(!/<script|on\w+=/.test(svg));
});
