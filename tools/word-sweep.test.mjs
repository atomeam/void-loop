// The word sweep (tools/word-sweep.mjs): the day's words repeat, and each fault the owner found by hand on 2026-10-19 is flagged.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rng, seedOf, vocabulary, pick, flagsOf, report } from './word-sweep.mjs';

test('the same day draws the same words; the vocabulary is the words on the cards', () => {
  const v = vocabulary({ pages: [{ title: 'Null Sweep', line: 'Clear the mines before Verse does', examples: ['play minesweeper'] }] });
  assert.ok(v.includes('sweep') && v.includes('mines') && v.includes('minesweeper') && !v.includes('verse') && !v.includes('play'));
  assert.deepEqual(pick(v, 3, rng(seedOf('2026-10-19'))), pick(v, 3, rng(seedOf('2026-10-19'))));
});
test('each fault found by hand is flagged', () => {
  assert.ok(flagsOf('anxiety', { title: 'Political correctness', text: 'Closest match I found for “nxiety”.', thin: 'Closest match I found for “nxiety”.' }).some((f) => f === 'looked up "nxiety", not "anxiety"'));
  assert.ok(flagsOf('anxiety', { title: 'Nxiety', text: '' }).some((f) => /letters dropped/.test(f)));
  assert.ok(flagsOf('bike', { title: 'Bicycle', text: 'A bicycle, also called a bike…', thin: 'Closest match I found for “bike”.' }).some((f) => /false "closest match"/.test(f)));
  assert.ok(flagsOf('tile', { title: 'Tile', text: 'x', take: 'analysis The user wants a summary of tile manufacturing processes.' }).some((f) => /model's working/.test(f)));
  assert.ok(flagsOf('island', { title: 'Island', text: 'x', take: 'What most people overlook is that islands…' }).some((f) => /most people/.test(f)));
  assert.ok(flagsOf('whats good', { title: '', said: '', text: '' }).includes('nothing came back'));
  assert.ok(flagsOf('suntan', { title: 'Suntan', text: "I couldn't look this up just now" }).includes('no answer'));
  assert.deepEqual(flagsOf('island', { title: 'Island', text: 'An island is land surrounded by water.', take: 'Islands form in several ways.', ms: 3000 }), []);
});
test('the report puts the words with flags first and says when all were clean', () => {
  assert.match(report([{ word: 'tile', source: 'random', title: 'Tile', flags: ['x'] }, { word: 'sun', source: 'a card', title: 'Sun', flags: [] }]), /^Word sweep: 2 words, 1 with something wrong\n\n- \*\*tile\*\*/);
  assert.match(report([{ word: 'sun', source: 'a card', title: 'Sun', flags: [] }]), /Every card read clean/);
});
