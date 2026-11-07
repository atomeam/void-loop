// Verse masters its own song by ear (lib/genre-master.js): it renders the song, finds the master that brings it closest to real songs of its
// kind (fitMix in lib/rap-ears.js), renders it again through that master, and keeps the master only when the song scores closer. Here: the
// master fields are rounded and a flat tune changes nothing; the live master in Web Audio is the same chain as master() in lib/rap-ears.js
// (shelves at 60 Hz, 3 kHz and 9 kHz, bells at 125 Hz and 800 Hz, the side signal, the gain, a limiter); a mono render stays mono and a stereo
// one stays stereo; a dull song held against bright references gets a master that lifts the top and scores closer; a song that already matches
// keeps no master; the line says what happened; the master is kept per kind of song. Run: node --test tools/genre-master.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { masterOnly, isFlat, withMaster, masteredOAC, renderSong, remaster, remasterLine, loadTune, saveTune, tuneKey } from '../void-live-deploy/lib/genre-master.js';
import { master, listen, windowOf } from '../void-live-deploy/lib/rap-ears.js';
import { RATE } from '../void-live-deploy/lib/genre-score.js';
import { arrange, scheduleArranged } from '../void-live-deploy/lib/arrange.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../void-live-deploy');

/** a node that records what it connects to and its settings */
function node(kind) {
  const p = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const n = { kind, to: [], frequency: p(), gain: p(), Q: p(), detune: p(), pan: p(), threshold: p(), knee: p(), ratio: p(), attack: p(), release: p(),
    connect(d, out = 0, inp = 0) { n.to.push({ d, out, inp }); return d; } };
  return n;
}
/** an offline context that renders a fixed song through whatever master chain was built on it: it reads the chain back into a tune and plays
 *  the song through master() in lib/rap-ears.js, the reference the live chain copies. The song is noise with its top cut off (a dull mix). */
function fakeOAC(song) {
  return class FakeOAC {
    constructor(ch, len, rate) { this.channels = ch; this.length = len; this.sampleRate = rate; this.destination = node('dest'); this.destination.channelCount = ch; }
    createGain() { return node('gain'); } createBiquadFilter() { return node('biquad'); } createDynamicsCompressor() { return node('comp'); }
    createChannelSplitter() { return node('split'); } createChannelMerger() { return node('merge'); } createStereoPanner() { return node('pan'); }
    createOscillator() { return { ...node('osc'), start() {}, stop() {} }; } createWaveShaper() { return node('shaper'); }
    createBuffer(c, n) { return { getChannelData: () => new Float32Array(n) }; }
    createBufferSource() { return { ...node('src'), playbackRate: { value: 1 }, start() {}, stop() {} }; }
    async startRendering() {
      const [L, R] = song(this.length, this.sampleRate), t = chainTune(this.start, this.destination);
      const [l, r] = t ? master(L, R, this.sampleRate, t) : [L, R];
      return { numberOfChannels: this.channels, getChannelData: (i) => (i ? r : l) };
    }
  };
}
/** the tune a chain built by withMaster plays, read back from its nodes: null when the song goes straight to the destination */
function chainTune(start, dest) {
  if (!start || start.to.length !== 1) throw new Error('the song must connect once');
  let n = start.to[0].d; if (n === dest) return null;
  const t = { gain: 0, sub: 0, low: 0, mid: 0, presence: 0, air: 0, width: 0 }, band = { 'lowshelf 60': 'sub', 'peaking 125': 'low', 'peaking 800': 'mid', 'highshelf 3000': 'presence', 'highshelf 9000': 'air' };
  n = n.to[0].d; // past the input
  for (let i = 0; n && n !== dest && i < 20; i++) {
    if (n.kind === 'biquad') { t[band[n.type + ' ' + n.frequency.value]] = n.gain.value; n = n.to[0].d; }
    else if (n.kind === 'split') { const g = n.to.find((x) => x.out === 0 && x.d.to[0].inp === 0).d; t.width = Math.round(20 * Math.log10(2 * g.gain.value - 1) * 10) / 10; n = g.to[0].d.to[0].d; }
    else if (n.kind === 'gain') { t.gain = Math.round(20 * Math.log10(n.gain.value) * 10) / 10; n = n.to[0].d; }
    else if (n.kind === 'comp') n = n.to[0].d;
    else throw new Error('unexpected node ' + n.kind);
  }
  return t;
}
function noise(len, rate, cut) {
  let s = 12345; const r = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296) * 2 - 1, a = Math.exp(-2 * Math.PI * cut / rate);
  const L = new Float32Array(len), R = new Float32Array(len); let l = 0, rr = 0;
  for (let i = 0; i < len; i++) { const c = r(); l = (1 - a) * (c + 0.3 * r()) + a * l; rr = (1 - a) * (c + 0.3 * r()) + a * rr; L[i] = l * 0.6; R[i] = rr * 0.6; }
  return [L, R];
}
const dull = (len, rate) => noise(len, rate, 1500);
const schedule = (ctx) => { const s = ctx.createGain(); s.connect(ctx.destination); ctx.start = s; return 4; }; // a Proxy sets on its target
const refsOf = (L, R) => ({ genres: { heavy: { label: 'heavy metal', tracks: [{ id: 'a' }, { id: 'b' }], average: listen(L, R, RATE, windowOf(L.length / RATE)) } } });
const P = { steps: 32, bpm: 120 };

test('the master fields are rounded to 0.1 dB, the tempo and swing are left out, and a flat tune changes nothing', () => {
  assert.deepEqual(masterOnly({ bpm: 90, swing: 0.6, presence: 4.26, air: '3', width: null }), { gain: 0, sub: 0, low: 0, mid: 0, presence: 4.3, air: 3, width: 0 });
  assert.ok(isFlat(null)); assert.ok(isFlat({ bpm: 90 })); assert.ok(isFlat({ presence: 0.04 })); assert.ok(!isFlat({ presence: 0.1 }));
  const ctx = new (fakeOAC(dull))(2, 10, RATE);
  assert.equal(withMaster(ctx, null), ctx); assert.equal(withMaster(ctx, { bpm: 80 }), ctx); assert.equal(masteredOAC(Object, null), Object);
});

test('the live master is the same chain as master(): the filters in order, the side signal, the gain, then a limiter into the destination', () => {
  const ctx = new (fakeOAC(dull))(2, 10, RATE), m = withMaster(ctx, { sub: 2, low: -1, mid: 1.5, presence: 5, air: 4, width: 3, gain: 2 });
  assert.notEqual(m, ctx); assert.equal(m.sampleRate, RATE); assert.equal(typeof m.createGain, 'function');
  const input = m.destination; assert.notEqual(input, ctx.destination); assert.equal(input.channelCount, 2); assert.equal(input.channelCountMode, 'explicit');
  const kinds = [], filters = []; let n = input, side = null;
  for (let i = 0; n !== ctx.destination && i < 20; i++) {
    kinds.push(n.kind); if (n.kind === 'biquad') filters.push([n.type, n.frequency.value, n.gain.value, n.Q.value]);
    if (n.kind === 'split') { side = n.to.map((x) => [x.out, x.d.to[0].inp, Math.round(x.d.gain.value * 1000) / 1000]); n = n.to[0].d.to[0].d; } else n = n.to[0].d;
  }
  assert.deepEqual(kinds, ['gain', 'biquad', 'biquad', 'biquad', 'biquad', 'biquad', 'split', 'merge', 'gain', 'comp']);
  assert.deepEqual(filters, [['lowshelf', 60, 2, 0], ['peaking', 125, -1, 0.8], ['peaking', 800, 1.5, 0.6], ['highshelf', 3000, 5, 0], ['highshelf', 9000, 4, 0]]);
  const k = Math.pow(10, 3 / 20), r = (v) => Math.round(v * 1000) / 1000;
  assert.deepEqual(side, [[0, 0, r((1 + k) / 2)], [1, 0, r((1 - k) / 2)], [0, 1, r((1 - k) / 2)], [1, 1, r((1 + k) / 2)]], 'L and R through mid and side, as master() does');
  const level = (() => { let x = input; while (x.kind !== 'comp') { if (x.kind === 'gain' && x !== input) { const g = x; x = x.to[0].d; if (x.kind === 'comp') return g; } else x = x.kind === 'split' ? x.to[0].d.to[0].d : x.to[0].d; } })();
  assert.equal(r(level.gain.value), r(Math.pow(10, 2 / 20)));
  // a chain read back from its nodes is the tune it was built from, so a render through it is a render through master()
  const s = m.createGain(); s.connect(m.destination);
  assert.deepEqual(chainTune(s, ctx.destination), { gain: 2, sub: 2, low: -1, mid: 1.5, presence: 5, air: 4, width: 3 });
});

test('a mono render (the WAV) stays mono, with no side signal; a stereo one stays stereo, and a heavy song still pans its guitars', () => {
  const mono = new (fakeOAC(dull))(1, 10, 22050), m = withMaster(mono, { presence: 4, width: 3 });
  assert.equal(m.destination.channelCount, 1);
  let n = m.destination; const kinds = []; while (n !== mono.destination) { kinds.push(n.kind); n = n.to[0].d; }
  assert.deepEqual(kinds, ['gain', 'biquad', 'gain', 'comp'], 'no splitter on one channel');
  const OAC = masteredOAC(fakeOAC(dull), { presence: 4 }), c = new OAC(1, 10, 22050);
  assert.notEqual(c.destination.kind, 'dest', 'a context made from the mastered class plays through the master'); assert.equal(typeof c.startRendering, 'function');
  // the heavy song reads the destination's channel count to choose stereo: through the master it sees the same count
  const p = arrange('make a heavy metal song'), pans = [];
  for (const ch of [2, 1]) {
    const made = [], real = new (fakeOAC(dull))(ch, 10, RATE); real.createStereoPanner = () => { const x = node('pan'); made.push(x); return x; };
    scheduleArranged(withMaster(real, { presence: 4 }), p, 0, {}); pans.push(made.filter((x) => x.pan.value !== 0).length);
  }
  assert.ok(pans[0] > 0, 'stereo through the master pans the guitars'); assert.equal(pans[1], 0, 'mono through the master pans nothing');
});

test('a dull song held against bright real tracks gets a master that lifts the top, and scores closer through it', async () => {
  const len = Math.ceil((P.steps * (60 / P.bpm / 4) + 2.6) * RATE), [L, R] = dull(len, RATE), [bL, bR] = master(L, R, RATE, { presence: 7, air: 6, gain: 3 });
  const OAC = fakeOAC(dull), refs = refsOf(bL, bR);
  const raw = await renderSong(P, OAC, schedule, {}, null); assert.deepEqual([raw.L.length, raw.R.length], [len, len]);
  const r = await remaster(P, OAC, schedule, {}, refs, 'heavy');
  assert.ok(r && r.better, 'a master was kept'); assert.ok(r.after.score > r.before.score, r.before.score + ' to ' + r.after.score);
  assert.ok(r.tune.presence > 0 || r.tune.air > 0, 'the top is lifted: ' + JSON.stringify(r.tune));
  // the score of the kept master is the score of a render through it, measured again
  const again = await remaster(P, OAC, schedule, {}, refs, 'heavy', r.tune);
  assert.equal(again.before.score, r.after.score, 'the kept master scores the same when Verse plays through it next time');
  assert.ok(again.after.score >= again.before.score);
  const line = remasterLine(r, r.before.label);
  assert.match(line, new RegExp('^Verse mastered it by ear against them: from ' + r.before.score + ' to ' + r.after.score + ' of 100\\. '));
  assert.match(line, /Play and Save as WAV use this master now, and so does every heavy metal song Verse makes on this device\.$/);
});

test('a song that already sounds like its references keeps no master; no reference or no offline render gives no result', async () => {
  const len = Math.ceil((P.steps * (60 / P.bpm / 4) + 2.6) * RATE), [L, R] = dull(len, RATE), OAC = fakeOAC(dull);
  const r = await remaster(P, OAC, schedule, {}, refsOf(L, R), 'heavy');
  assert.ok(!r.better); assert.equal(r.tune, null); assert.equal(r.after, r.before);
  assert.equal(remasterLine(r), 'Verse tried mastering it by ear against them, and no master it found came closer, so it kept the mix as it is.');
  assert.equal(await remaster(P, OAC, schedule, {}, { genres: {} }, 'heavy'), null);
  assert.equal(await remaster(P, null, schedule, {}, refsOf(L, R), 'heavy'), null);
  assert.equal(remasterLine(null), ''); assert.equal(remasterLine({}), '');
});

test('the master is kept per kind of song on this device, never a flat one, and a broken store is ignored', () => {
  const m = new Map(), store = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
  assert.equal(loadTune('heavy', store), null);
  saveTune('heavy', { presence: 4.26, air: 2, bpm: 90 }, store); saveTune('happy', { gain: 0 }, store);
  assert.deepEqual([...m.keys()], [tuneKey('heavy')]); assert.equal(tuneKey('heavy'), 'verse.music.master.heavy');
  assert.deepEqual(loadTune('heavy', store), { gain: 0, sub: 0, low: 0, mid: 0, presence: 4.3, air: 2, width: 0 });
  assert.equal(loadTune('happy', store), null);
  m.set(tuneKey('dark'), '{not json'); assert.equal(loadTune('dark', store), null);
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.equal(loadTune('heavy', broken), null); assert.doesNotThrow(() => saveTune('heavy', { presence: 2 }, broken)); assert.equal(loadTune('heavy', undefined), null);
});

test('the music card plays, saves and compares through the master it kept for that kind of song', () => {
  const src = readFileSync(resolve(ROOT, 'skills/music.js'), 'utf8');
  assert.match(src, /withMaster\(ac, loadTune\(refKey\(p\)\)\)/, 'Play');
  assert.match(src, /masteredOAC\(OAC, loadTune\(refKey\(p\)\)\)/, 'Save as WAV');
  assert.match(src, /remaster\(p, OAC, [^)]*loadTune\(key\)\)/, 'Compare starts from the kept master');
  assert.match(src, /if \(r\.better\) saveTune\(key, r\.tune\)/, 'only a better master is kept');
});
