// brain-hearing: F299's hum crystal music box (atomeam/a-to-mind.com drafts/F299-hum-crystal-music-box) is a real organ of Verse Brain, not a
// separate demo (owner, 2026-10-29: "combine all the builds into one entity", "dont fake it"). It hears the pitch of a hummed tune as notes,
// it learns tunes it hears and guesses their next note far better than a count with no context, it runs in the brain's scheduler and
// writes its surprise into the one workspace, and its counts are kept between visits as numbers only. Only tunes it heard are claimed (a
// new tune is not guessed better than a count with no context), and the self says both numbers. Run: node --test tools/brain-hearing.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../void-live-deploy/lib/brain.js';
import * as H from '../void-live-deploy/lib/brain-hearing.js';

let a = 12345; const rnd = () => { a ^= a << 13; a >>>= 0; a ^= a >>> 17; a ^= a << 5; a >>>= 0; return a / 4294967296; };
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(6.2832 * rnd());
// public domain tunes: [semitones from the tonic, beats]
const SONGS = {
  twinkle: [[0, 1], [0, 1], [7, 1], [7, 1], [9, 1], [9, 1], [7, 2], [5, 1], [5, 1], [4, 1], [4, 1], [2, 1], [2, 1], [0, 2], [7, 1], [7, 1], [5, 1], [5, 1], [4, 1], [4, 1], [2, 2]],
  ode: [[4, 1], [4, 1], [5, 1], [7, 1], [7, 1], [5, 1], [4, 1], [2, 1], [0, 1], [0, 1], [2, 1], [4, 1], [4, 1.5], [2, 0.5], [2, 2]],
  jacques: [[0, 1], [2, 1], [4, 1], [0, 1], [0, 1], [2, 1], [4, 1], [0, 1], [4, 1], [5, 1], [7, 2], [4, 1], [5, 1], [7, 2]],
  mary: [[4, 1], [2, 1], [0, 1], [2, 1], [4, 1], [4, 1], [4, 2], [2, 1], [2, 1], [2, 2], [4, 1], [7, 1], [7, 2]]
};
const SR = 44100, N = 1024, HOP = 1102; // a 1024-sample frame every 25 ms, as the card reads the microphone
/** a person humming: a voice with six falling harmonics, vibrato (5.5 Hz, 35 cents), up to a quarter tone off, a gap between notes, noise */
function hum(song, tonic, beat, noise = 0.02) {
  const out = [], truth = []; let ph = 0;
  for (const [st, bt] of song) {
    const midi = tonic + st, dur = bt * beat, gap = 0.06 + 0.04 * rnd(), ns = Math.floor((dur - gap) * SR), det = (rnd() - 0.5) * 0.5;
    truth.push(midi);
    for (let i = 0; i < ns; i++) {
      const t = i / SR, f = 440 * Math.pow(2, (midi - 69 + det + 0.35 * Math.sin(6.2832 * 5.5 * t)) / 12); ph += f / SR;
      let s = 0; for (let h = 1; h <= 6; h++) s += Math.sin(6.2832 * h * ph) / (h * h * 0.7 + 0.3);
      out.push(0.25 * Math.min(1, t / 0.03, (ns - i) / SR / 0.03) * s + noise * gauss());
    }
    for (let i = 0; i < gap * SR; i++) out.push(noise * gauss());
  }
  return { buf: Float32Array.from(out), truth };
}
/** the frames the card would send: [Hz, seconds] every 25 ms, then a little silence */
function frames(buf, t0) {
  const out = []; let t = t0;
  for (let s = 0; s + N <= buf.length; s += HOP) { out.push([H.detectPitch(buf.subarray(s, s + N), SR).f, t]); t += HOP / SR; }
  out.push([0, t + 0.01], [0, t + 0.02]); return out;
}
const drain = (E) => E.pending.splice(0, E.pending.length);

test('it hears a hum as notes: every note found at its pitch, in quiet and in room noise', () => {
  for (const noise of [0.005, 0.02]) {
    let all = 0, right = 0;
    for (const nm of ['twinkle', 'ode']) for (const tonic of [48, 55, 62]) {
      const { buf, truth } = hum(SONGS[nm], tonic, 0.4, noise), E = H.makeEar(), got = [];
      for (const [f, t] of frames(buf, 0)) { H.hearFrame(E, f, t); got.push(...drain(E)); }
      assert.equal(got.length, truth.length, `${nm} from ${tonic}, noise ${noise}: ${got.length} notes heard of ${truth.length}`);
      all += truth.length; got.forEach((n, i) => { right += n.midi === truth[i] ? 1 : 0; });
    }
    assert.ok(right / all >= 0.95, `noise ${noise}: ${right} of ${all} notes at the right pitch`);
  }
  assert.equal(H.detectPitch(new Float32Array(N), SR).f, 0, 'silence has no pitch');
});

test('it learns tunes it hears: hummed again, the next note is guessed right most of the time, in far fewer bits than with no context', () => {
  const E = H.makeEar(), names = Object.keys(SONGS), rounds = []; let t = 0;
  for (let r = 0; r < 3; r++) {
    let g = 0, hit = 0, bits = 0, bits0 = 0;
    for (const nm of names) {
      const { buf } = hum(SONGS[nm], 50 + Math.floor(rnd() * 12), 0.35 + 0.15 * rnd()), fs = frames(buf, t); t = fs[fs.length - 1][1] + 2; // 2 s apart: a new phrase each time
      for (const [f, tt] of fs) { H.hearFrame(E, f, tt); for (const n of drain(E)) { const x = H.learnNote(E, n); if (x) { g++; hit += x.hit; bits += x.bits; bits0 += x.bits0; } } }
    }
    rounds.push({ hit: hit / g, bits: bits / g, bits0: bits0 / g });
  }
  const [first, , third] = rounds;
  assert.ok(third.hit >= 0.6, `third time through, ${Math.round(third.hit * 100)}% of next notes guessed right (first time ${Math.round(first.hit * 100)}%)`);
  assert.ok(third.bits < third.bits0 - 1.5, `${third.bits.toFixed(2)} bits a note with context, ${third.bits0.toFixed(2)} without`);
  assert.ok(third.bits < first.bits - 1, 'it got better at the tunes it heard before');
  const self = H.earOf(E); assert.equal(self.guessed, E.guessed); assert.ok(self.bits < self.bits0);
});

test('a long silence starts a new phrase: no interval is counted across it', () => {
  const E = H.makeEar();
  H.learnNote(E, { midi: 60, at: 0, dur: 0.3 }); assert.ok(H.learnNote(E, { midi: 62, at: 0.4, dur: 0.3 }));
  assert.equal(H.learnNote(E, { midi: 70, at: 5, dur: 0.3 }), null, 'after 4 s of silence the note starts a phrase');
  assert.equal(E.o0n, 1);
});

test('it is an organ of the brain: hummed frames become notes in the one workspace, the self says how it guesses, and an orb shows the note', () => {
  const b = B.createBrain(21), { buf } = hum(SONGS.twinkle, 55, 0.4), fs = frames(buf, 0);
  let k = 0; while (k < fs.length) { B.stepBrain(b, { x: 0.5, y: 0.5, over: false, pitches: fs.slice(k, k + 2) }); k += 2; } // about 2 frames a tick, as at 60 fps
  for (let i = 0; i < 40; i++) B.stepBrain(b, { x: 0.5, y: 0.5, over: false });
  assert.equal(b.ear.notes, SONGS.twinkle.length, 'every note reached the organ');
  assert.ok(b.runs.hearing > 0 && b.ear.pending.length === 0);
  assert.ok(b.board.ear && /^[A-G]#?\d$/.test(b.board.ear.note), 'the board names the last note');
  assert.ok(B.selfSays(b).some((s) => /^Hearing: 21 hummed notes; it guessed the next one right \d+% of the time \([\d.]+ bits a note, [\d.]+ with no context\)\.$/.test(s)));
  assert.ok(B.embodiment(b).some((o) => o.key === 'ear' && o.organ === 'hearing'), 'the ear is an orb on the field');
  const own = Object.keys(B.selfOf(b).owner.all); assert.ok(own.includes('hearing'), 'it wrote into the workspace as hearing');
  assert.ok(B.ORGAN_IDS.includes('hearing') && B.ORGAN_IDS.length === 17);
});

test('its counts are kept between visits as numbers only, and a wrong record is refused', () => {
  const b = B.createBrain(22), { buf } = hum(SONGS.ode, 52, 0.4);
  for (const p of frames(buf, 0)) B.stepBrain(b, { pitches: [p] });
  for (let i = 0; i < 40; i++) B.stepBrain(b, {});
  const k = JSON.parse(JSON.stringify(B.knowledgeOf(b))), c = B.createBrain(23);
  assert.ok(B.loadKnowledge(c, k).includes('hearing'));
  assert.deepEqual(c.ear.t, b.ear.t); assert.equal(c.ear.o0n, b.ear.o0n);
  assert.ok(!/"(midi|at|dur|f)"/.test(JSON.stringify(k.hearing)), 'no notes, pitches or times are kept, only interval and length counts');
  for (const bad of [{ ...k.hearing, t: [{ '': { 'x:1': 3 } }, {}, {}, {}] }, { ...k.hearing, t: [{ '': { '2:1': -1 } }, {}, {}, {}] }, { ...k.hearing, t: [{ 'evil': { '2:1': 1 } }, {}, {}, {}] }, { t: [] }]) {
    const d = B.createBrain(24); assert.ok(!B.loadKnowledge(d, { ...k, hearing: bad }).includes('hearing'));
  }
  assert.ok(!/pitch|midi/.test(JSON.stringify(B.params(b))), 'a seal holds no notes');
});
