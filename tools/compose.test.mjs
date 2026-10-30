// Verse's music (lib/compose.js, skills/music.js). Run: node --test tools/compose.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compose, describe, notesText, wavBytes, schedule, moodOf, SCALES, hz, partsOf, pianoNotesOf, instrumentsFor, playedLine } from '../void-live-deploy/lib/compose.js';
import { takesFor } from '../void-live-deploy/lib/rap-piano.js';
import { KITS, pathOf as kitPath } from '../void-live-deploy/lib/rap-kit.js';
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

// the real instruments (owner, 2026-10-30: "needs real beats and music ... not just rap all music"): every piece plays the recorded Steinway
// and drums when they load, and the same piece heard on them sounds the chords it wrote.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../void-live-deploy'), RATE = 48000;
/** the first channel of a 16-bit PCM WAV, as floats */
function pcm(buf) {
  for (let p = 12; p + 8 <= buf.length;) { const id = buf.toString('ascii', p, p + 4), n = buf.readUInt32LE(p + 4); if (id === 'data') { const d = buf.subarray(p + 8, p + 8 + n), o = new Float32Array(d.length / 2); for (let i = 0; i < o.length; i++) o[i] = d.readInt16LE(i * 2) / 32768; return o; } p += 8 + n + (n % 2); }
  throw new Error('no data chunk');
}
const fetchFn = async (u) => ({ ok: true, arrayBuffer: async () => ({ path: u, bytes: readFileSync(resolve(ROOT, '.' + u)) }) });
/** a context that records every recording it plays: { path, at, rate, gain, off } */
function recorder() {
  const played = [], param = (o, k) => ({ value: 0, setValueAtTime(v, t) { if (o[k] == null) o[k] = v; else if (t > (o.at ?? 0)) o.hold = Math.min(o.hold ?? Infinity, t); }, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => { const n = { connect() {}, frequency: param({}, 'f'), detune: { value: 0 } }; n.gain = param(n, 'g'); return n; };
  const ctx = { sampleRate: RATE, currentTime: 0, destination: {}, createGain: node, createBiquadFilter: node, createOscillator() { return { ...node(), start() {}, stop() {} }; },
    createBuffer: (c, n) => ({ getChannelData: () => new Float32Array(n) }),
    decodeAudioData: async (b) => ({ path: b.path, data: pcm(b.bytes) }),
    createBufferSource() { const s = { playbackRate: { value: 1 }, connect(g) { s.g = g; }, start(at) { s.at = at; }, stop(t) { s.off = t; } }; played.push(s); return s; } };
  return { ctx, played: () => played.filter((s) => s.buffer && s.buffer.path).map((s) => ({ path: s.buffer.path, data: s.buffer.data, at: s.at, rate: s.playbackRate.value, gain: s.g.g ?? s.g.gain.value, off: (s.g.hold ?? s.off) })) };
}

test('which parts each style plays on the piano, and which kit its drums use', () => {
  const lull = compose('make me a lullaby'), dark = compose('a spooky song for halloween'), beat = compose('make a beat');
  assert.deepEqual(partsOf(lull), { chords: true, bass: true, melody: true, kit: 'kit' }, 'a lullaby is all piano over a soft kick');
  assert.deepEqual(partsOf(dark), { chords: true, bass: false, melody: false, kit: 'kit' });
  assert.equal(partsOf(beat).kit, '808'); assert.equal(partsOf(beat).melody, true);
  const want = new Set(pianoNotesOf(lull)); for (const c of lull.chords) for (const m of c.tones) assert.ok(want.has(m));
  for (const n of lull.melody) assert.ok(want.has(n.midi)); for (const b of lull.bass) assert.ok(want.has(b.midi));
  assert.ok(takesFor(pianoNotesOf(lull)).length <= 26);
});
test('the real instruments load once, and the line says what played', async () => {
  const p = compose('make a beat'), { ctx } = recorder(), inst = await instrumentsFor(p, ctx, { fetchFn });
  assert.equal(inst.kit.name, '808'); assert.equal(inst.piano.buffers.size, takesFor(pianoNotesOf(p)).length);
  assert.equal(inst.kit.buffers.size, new Set(Object.values(KITS['808']).flatMap((v) => v.files.map(([f]) => kitPath('808', f)))).size);
  assert.equal(playedLine(p, inst), 'Played on a real grand piano and a real TR-808.');
  assert.equal(playedLine(compose('a spooky song'), { piano: inst.piano, kit: null }), 'Played on a real grand piano. The recorded drums did not load, so the drums are synthesised.');
  assert.equal(playedLine(compose('make me a lullaby'), {}), 'The piano recordings did not load, so it is synthesised.');
  const down = await instrumentsFor(p, ctx, { fetchFn: async () => ({ ok: false, status: 404 }) }), none = await instrumentsFor(p, null);
  assert.ok(down.piano && down.kit, 'what loaded before is kept for the page'); assert.deepEqual(none, { piano: null, kit: null });
});
test('on the real instruments every chord, note and hit plays a recording, and the piece rings out', async () => {
  for (const ask of ['make me a lullaby', 'a spooky song for halloween', 'make a beat']) {
    const p = compose(ask), { ctx, played } = recorder(), inst = await instrumentsFor(p, ctx, { fetchFn }), parts = partsOf(p);
    const secs = schedule(ctx, p, 0, inst), rec = played(), piano = rec.filter((r) => r.path.startsWith('/sounds/piano/')), drums = rec.filter((r) => r.path.startsWith('/sounds/drums/'));
    const strikes = p.style === 'soft' || p.style === 'slow' ? 1 : 2;
    assert.equal(piano.length, p.chords.length * 3 * strikes + (parts.bass ? p.bass.length : 0) + (parts.melody ? p.melody.length : 0), ask + ': every piano note');
    assert.equal(drums.length, parts.kit ? p.drums.kick.length + p.drums.snare.length + p.drums.hat.length : 0, ask + ': every drum hit');
    for (const r of piano) { assert.ok(r.rate > 0.88 && r.rate < 1.13, 'within two semitones of its take: ' + r.rate); assert.ok(r.gain > 0 && r.gain < 0.8); assert.ok(r.off - r.at <= 2.6 + 1e-9); }
    assert.ok(Math.abs(secs - (p.steps * 60 / p.bpm / 4 + 2.4)) < 1e-6, 'the last chord rings out');
  }
});
/** pitch-class energy of x, C3 to C6 */
function chroma(x) {
  const out = new Float64Array(12);
  for (let m = 48; m <= 84; m++) { const w = (2 * Math.PI * hz(m)) / RATE; let re = 0, im = 0; for (let i = 0; i < x.length; i++) { const h = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / x.length); re += x[i] * h * Math.cos(w * i); im += x[i] * h * Math.sin(w * i); } out[m % 12] += Math.hypot(re, im); }
  return out;
}
test('a song heard on the real piano sounds the chords it wrote, bar by bar, without clipping', async () => {
  const p = compose('a spooky song for halloween'), { ctx, played } = recorder(), inst = await instrumentsFor(p, ctx, { fetchFn });
  const secs = schedule(ctx, p, 0, inst), out = new Float32Array(Math.ceil(secs * RATE));
  for (const r of played()) { const a = Math.round(r.at * RATE), len = Math.round((r.off - r.at) * RATE); for (let i = 0, pos = 0; a + i < out.length && pos < r.data.length - 1 && i < len; i++, pos += r.rate) { const j = Math.floor(pos), f = pos - j; out[a + i] += 0.5 * r.gain * (r.data[j] * (1 - f) + r.data[j + 1] * f); } }
  let peak = 0; for (const v of out) peak = Math.max(peak, Math.abs(v));
  assert.ok(peak > 0.05 && peak < 1, 'audible and not clipping: peak ' + peak.toFixed(3));
  const bar = p.stepsPerBar * 60 / p.bpm / 4;
  for (const c of p.chords) {
    const from = Math.round((c.bar * bar + 0.15) * RATE), x = chroma(out.subarray(from, from + 8192)), want = new Set(c.tones.map((m) => m % 12));
    const top = [...x.keys()].sort((a, b) => x[b] - x[a]).slice(0, 3);
    assert.ok(top.filter((pc) => want.has(pc)).length >= 2, 'bar ' + (c.bar + 1) + ' (' + c.name + '): heard ' + top + ', wrote ' + [...want]);
  }
});
