// The music pages' German (void-live-deploy/lib/music-de.js, used by lib/music-ui.js): a frozen table of whole translations
// that keep what a string carries (its numbers and percentages) so a German page says the same thing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DE } from '../void-live-deploy/lib/music-de.js';

const nums = (s) => (String(s).match(/\d+/g) || []).join(',');

test('the table is frozen and every entry is a non-empty German string', () => {
  assert.ok(Object.isFrozen(DE));
  const all = Object.entries(DE);
  assert.ok(all.length > 100, 'entries: ' + all.length);
  for (const [en, de] of all) { assert.equal(typeof de, 'string', en); assert.ok(de.trim(), 'empty: ' + en); assert.equal(de, de.trim(), 'padded: ' + en); }
});

test('a translation keeps the numbers of its English', () => {
  for (const [en, de] of Object.entries(DE)) assert.equal(nums(de), nums(en), 'numbers differ: ' + en + ' -> ' + de);
});

test('the words every music page shows are translated', () => {
  for (const k of ['Metronome', 'Piano', 'Tuner', 'Music', 'Start', 'Stop', 'Related tools', 'Share this page']) assert.ok(DE[k] && DE[k] !== k || k === 'Start', k);
  assert.equal(DE.Metronome, 'Metronom');
  assert.equal(DE.Piano, 'Klavier');
});
