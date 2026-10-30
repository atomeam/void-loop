// Tests for lib/music-tools.js (the music pages' numbers): tempo, ticks, tap tempo, keys, sheets, chords, scales, guitar shapes, pitch detection.
import test from 'node:test'; import assert from 'node:assert/strict';
import * as M from '../void-live-deploy/lib/music-tools.js';

test('notes and frequencies', () => {
  assert.equal(M.midiOf('A4'), 69); assert.equal(M.midiOf('C#4'), 61); assert.equal(M.midiOf('Bb3'), 58); assert.ok(Number.isNaN(M.midiOf('H4')));
  assert.equal(M.noteName(61), 'C#4'); assert.equal(M.noteName(61, true), 'Db4'); assert.ok(Math.abs(M.freqOfMidi(60) - 261.6256) < 0.001);
  assert.deepEqual(M.noteOfFreq(440), { midi: 69, name: 'A4', cents: 0, hz: 440 }); assert.equal(M.noteOfFreq(447).cents, 27); assert.equal(M.noteOfFreq(432, 432).name, 'A4');
});
test('tempo words and ticks', () => {
  assert.equal(M.tempoName(120), 'Allegro'); assert.equal(M.tempoName(60), 'Larghetto'); assert.equal(M.tempoName(50), 'Largo'); assert.equal(M.tempoName(210), 'Prestissimo');
  const t = M.barTicks(120, '4/4'); assert.equal(t.length, 4); assert.deepEqual(t.map((x) => x.level), [3, 1, 1, 1]); assert.equal(t[1].at, 0.5);
  assert.equal(M.barTicks(120, '4/4', 'eighth').length, 8); assert.equal(M.barTicks(90, '3/4', 'triplet').length, 9);
  assert.deepEqual(M.defaultAccents('6/8'), [3, 1, 1, 2, 1, 1]); assert.equal(M.barTicks(120, '4/4', 'offbeat').filter((x) => x.sub === 1).length, 4);
  assert.equal(M.barTicks(120, '4/4', 'none', [3, 0, 1, 0]).length, 2); // muted beats are left out
  assert.ok(Math.abs(M.barTicks(120, '4/4', 'swing')[1].at - 1 / 3) < 1e-9);
  assert.equal(M.barSeconds(120, '3/4'), 1.5); assert.equal(M.clampBpm(5), 20); assert.equal(M.clampBpm(999), 400);
});
test('speed trainer, silent bars, ladder', () => {
  assert.deepEqual(M.rampPlan(100, 112, 4, 2), [{ bar: 0, bpm: 100 }, { bar: 2, bpm: 104 }, { bar: 4, bpm: 108 }, { bar: 6, bpm: 112 }]);
  assert.deepEqual(M.rampPlan(100, 100, 4, 2), [{ bar: 0, bpm: 100 }]); assert.deepEqual(M.rampPlan(120, 110, 5, 1).map((x) => x.bpm), [120, 115, 110]);
  assert.deepEqual([0, 1, 2, 3, 4].map((b) => M.silentBar(b, 2, 1)), [false, false, true, false, false]); assert.deepEqual(M.practiceLadder(100), [60, 75, 90, 100]);
});
test('tap tempo and note lengths', () => {
  assert.equal(M.tapTempo([0, 500, 1000, 1500]).bpm, 120); assert.equal(M.tapTempo([0]).bpm, null); assert.equal(M.tapTempo([0, 500, 1000, 9000, 9600, 10200]).bpm, 100); // a pause starts over
  assert.equal(M.tapTempo([0, 500, 1010, 1500]).spread, 20);
  const n = M.noteLengths(120); assert.equal(n[2].ms, 500); assert.equal(n[3].ms, 250); assert.equal(n[2].dotted, 750); assert.equal(n[2].triplet, 333.33); assert.equal(n[3].hz, 4);
  assert.equal(M.songLength(120, '4/4', 60), '2:00'); assert.deepEqual(M.halfDouble(140), { half: 70, double: 280 });
});
test('piano keys', () => {
  assert.equal(M.midiForKey('1'), 36); assert.equal(M.midiForKey('q'), 53); assert.equal(M.midiForKey('Digit1'), 36); assert.equal(M.midiForKey('KeyM'), 96);
  assert.equal(M.midiForKey('1', true), 37); assert.equal(M.midiForKey('3', true), null); assert.equal(M.midiForKey('?'), null); assert.equal(M.keyForMidi(53), 'q'); assert.equal(M.keyForMidi(54), '⇧q'); assert.equal(M.keyForMidi(48), '8'); assert.equal(M.keyForMidi(30), '');
  assert.ok(M.isBlack(61) && !M.isBlack(60));
});
test('sheets', () => {
  const s = M.parseSheet('C4 D4:2 [C4 E4 G4]:2 - | E4 oops'); assert.equal(s.events.length, 4); assert.deepEqual(s.events[2].notes, [60, 64, 67]); assert.equal(s.events[3].at, 6); assert.deepEqual(s.bad, ['oops']);
  for (const x of M.SHEETS) { const p = M.parseSheet(x.sheet); assert.deepEqual(p.bad, [], x.id); assert.ok(p.events.length >= 6, x.id); }
});
test('chords', () => {
  assert.deepEqual(M.chordOf('C', 'maj7').notes, ['C', 'E', 'G', 'B']); assert.equal(M.chordOf('Bb', 'm').symbol, 'Bbm'); assert.deepEqual(M.chordOf('Bb', 'm').notes, ['Bb', 'Db', 'F']); assert.equal(M.chordOf('H', ''), null);
  assert.deepEqual(M.chordMidi('C', '', 4), [60, 64, 67]); assert.deepEqual(M.chordMidi('C', '', 4, 1), [64, 67, 72]);
  assert.equal(M.identifyChord(['C', 'E', 'G'])[0].symbol, 'C'); assert.equal(M.identifyChord(['A', 'C', 'E'])[0].symbol, 'Am'); assert.ok(M.identifyChord(['C', 'E', 'G', 'A']).some((c) => c.symbol === 'C6') && M.identifyChord(['C', 'E', 'G', 'A']).some((c) => c.symbol === 'Am7'));
  assert.deepEqual(M.identifyChord(['C']), []);
});
test('guitar shapes', () => {
  const c = M.guitarVoicings('C', ''); assert.ok(c.length >= 1); assert.equal(c[0].label, 'x 3 2 0 1 0');
  const e = M.guitarVoicings('E', 'm'); assert.equal(e[0].label, '0 2 2 0 0 0'); assert.equal(M.guitarVoicings('G', '')[0].label, '3 2 0 0 0 3'); assert.equal(M.guitarVoicings('A', 'm')[0].label, 'x 0 2 2 1 0');
  for (const v of M.guitarVoicings('F', '')) { const played = v.frets.filter((f) => f !== null); assert.ok(played.length >= 4); } assert.deepEqual(M.guitarVoicings('Q', ''), []);
});
test('scales and keys', () => {
  assert.deepEqual(M.scaleOf('C', 'major').notes, ['C', 'D', 'E', 'F', 'G', 'A', 'B']); assert.deepEqual(M.scaleOf('F', 'major').notes, ['F', 'G', 'A', 'Bb', 'C', 'D', 'E']);
  assert.deepEqual(M.scaleOf('D', 'major').notes, ['D', 'E', 'F#', 'G', 'A', 'B', 'C#']); assert.equal(M.scaleOf('A', 'minor').steps, 'W H W W H W W'); assert.equal(M.scaleOf('A', 'minorPentatonic').notes.join(' '), 'A C D E G');
  assert.equal(M.scaleOf('A', 'harmonicMinor').notes.join(' '), 'A B C D E F G#'); assert.ok(M.scalesWith(['C', 'E', 'G']).some((s) => s.name === 'C Major (Ionian)')); assert.equal(M.scalesWith(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#']).length, 0);
  assert.equal(M.keySignature('G'), 1); assert.equal(M.keySignature('F'), -1); assert.equal(M.keySignature('A', true), 0); assert.equal(M.keySignature('Eb'), -3);
  const k = M.chordsInKey('C'); assert.deepEqual(k.map((c) => c.symbol), ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']); assert.deepEqual(k.map((c) => c.roman), ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
  assert.deepEqual(M.chordsInKey('A', true).map((c) => c.symbol), ['Am', 'Bdim', 'C', 'Dm', 'Em', 'F', 'G']); assert.equal(M.chordsInKey('C', false, true)[0].symbol, 'Cmaj7'); assert.equal(M.chordsInKey('C', false, true)[4].symbol, 'G7');
  assert.deepEqual(M.nextChords('V'), ['I', 'vi', 'IV']); assert.equal(M.transposeSymbol('Am7', 2), 'Bm7'); assert.equal(M.transposeSymbol('F#/A#', -2), 'E/G#'); assert.equal(M.circleOfFifths()[1].major, 'G');
});
test('pitch detection', () => {
  const sr = 48000, make = (f, harm = [1]) => { const b = new Float32Array(4096); for (let i = 0; i < b.length; i++) b[i] = harm.reduce((s, a, k) => s + a * Math.sin(2 * Math.PI * f * (k + 1) * i / sr), 0) * 0.3; return b; };
  for (const [f, h] of [[82.41, [1, 0.8, 0.6]], [110, [1]], [196, [0.5, 1, 0.4]], [329.63, [1, 0.5]], [440, [1]], [1318.5, [1]]]) { const r = M.detectPitch(make(f, h), sr); assert.ok(r, String(f)); assert.ok(Math.abs(1200 * Math.log2(r.freq / f)) < 4, f + ' read ' + r.freq); }
  assert.equal(M.detectPitch(new Float32Array(4096), sr), null); const noise = new Float32Array(4096).map(() => (Math.random() - 0.5) * 0.4); const r = M.detectPitch(noise, sr); assert.ok(!r || r.clarity < 0.95);
  assert.equal(M.steadyFreq([100, 440, 441, 442, 900]), 441); const n = M.nearestString(112, 'guitar-standard'); assert.equal(n.note, 'A2'); assert.ok(n.cents > 0); assert.equal(M.nearestString(112, 'chromatic'), null);
  assert.equal(M.tuneWord(-3), 'in tune'); assert.equal(M.tuneWord(-40), 'too flat'); assert.equal(M.tuneWord(12), 'a little sharp');
});
test('bpm of a recording', () => {
  const sr = 22050, bpm = 124, s = new Float32Array(sr * 20); const gap = Math.round(sr * 60 / bpm); for (let at = 0; at < s.length; at += gap) for (let j = 0; j < 800 && at + j < s.length; j++) s[at + j] = Math.sin(j * 0.2) * Math.exp(-j / 200) * 0.8;
  const r = M.bpmOfSamples(s, sr); assert.ok(r && Math.abs(r.bpm - bpm) < 1.5, JSON.stringify(r)); assert.equal(M.bpmOfSamples(new Float32Array(sr * 20), sr), null);
});
test('setlists', () => {
  const l = M.setlistFromQuery(M.setlistToQuery([{ name: 'Verse A', bpm: 96, sig: '6/8', sub: 'eighth' }, { name: 'x', bpm: 9999, sig: 'bad', sub: 'bad' }])); assert.equal(l.length, 2); assert.equal(l[0].sig, '6/8'); assert.equal(l[1].bpm, 400); assert.equal(l[1].sig, '4/4');
  assert.equal(M.cleanEntry({ name: '<b>', bpm: 100 }).name, 'b'); assert.equal(M.cleanEntry(null), null); assert.deepEqual(M.setlistFromQuery(''), []);
});
test('a recording becomes a sheet', () => {
  const ev = [{ t: 0, midi: 60, down: true }, { t: 600, midi: 60, down: false }, { t: 600, midi: 64, down: true }, { t: 600, midi: 67, down: true }, { t: 1200, midi: 64, down: false }, { t: 1200, midi: 67, down: false }, { t: 2400, midi: 62, down: true }, { t: 3000, midi: 62, down: false }];
  assert.equal(M.recordingToSheet(ev, 100), 'C4 [E4 G4] -:2 D4'); assert.equal(M.recordingToSheet([], 100), ''); assert.deepEqual(M.parseSheet(M.recordingToSheet(ev, 100)).bad, []);
});
test('polyrhythm, strobe and the neck', () => {
  const p = M.polyTicks(120, '4/4', 3); assert.equal(p.length, 3); assert.equal(p[1].at, 2 / 3); assert.equal(p[0].level, 3); assert.deepEqual(M.polyTicks(120, '4/4', 1), []); assert.equal(M.polyTicks(60, '3/4', 4)[2].at, 1.5);
  assert.equal(M.strobeStep(0), 0); assert.equal(M.strobeStep(1), 0); assert.ok(M.strobeStep(20) > 0 && M.strobeStep(-20) < 0); assert.equal(M.strobeStep(500), 14); assert.equal(M.strobeStep(NaN), 0);
  const m = M.fretboardMap(M.scaleOf('A', 'minorPentatonic').pcs, 9); assert.equal(m.length, 6); assert.equal(m[0].length, 13); assert.equal(m[0][5], 2); assert.equal(m[0][0], 1); assert.equal(m[0][1], 0); // low E string: fret 5 is A (root), open E is in the scale, fret 1 (F) is not
  assert.deepEqual(M.fretsToPcs([null, 3, 2, 0, 1, 0]).sort((a, b) => a - b), [0, 4, 7]); assert.equal(M.identifyChord(M.fretsToPcs([null, 3, 2, 0, 1, 0]))[0].symbol, 'C');
});
