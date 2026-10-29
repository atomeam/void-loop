// lib/arrange.js: a heavy ask makes a song with a shape. Run: node --test tools/arrange.test.mjs
// (the loudness of each section is measured in a browser: tools/test_void.mjs, "music: a heavy ask")
import test from 'node:test';
import assert from 'node:assert/strict';
import { arrange, isHeavy, FORM, sectionsLine, sectionsSvg, sectionLoudness } from '../void-live-deploy/lib/arrange.js';
import { compose, describe, notesText } from '../void-live-deploy/lib/compose.js';

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
