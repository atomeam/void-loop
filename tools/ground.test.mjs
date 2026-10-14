// lib/ground.js: the semantic validator's first step: is the answer card about what was asked?
import assert from 'node:assert/strict';
import { triggersFrom, subjectOf, grounded } from '../void-live-deploy/lib/ground.js';

const recipeAsks = ['recipe for banana bread', 'recipe for pancakes', 'how do i make lasagna', 'give me a recipe for chili', 'recipe for tacos', 'how to make soup'];
const t = triggersFrom(recipeAsks);
assert.ok(t.has('recipe'), 'a word in most of the skill\'s asks is its trigger');
assert.ok(!t.has('banana'), 'a word in one ask is a subject, not a trigger');
assert.deepEqual(subjectOf('recipe for banana bread', t), ['banana', 'bread']);
assert.deepEqual(subjectOf('tell me a joke', new Set(['joke'])), [], 'no subject: nothing to judge');
assert.equal(grounded('recipe for banana bread', 'Banana bread\n3 ripe bananas, flour…', t).ok, true);
const off = grounded('recipe for banana bread', 'Pancakes\nflour, milk, eggs', t);
assert.equal(off.ok, false, 'a card about something else is not grounded');
assert.deepEqual(off.missing, ['banana', 'bread']);
assert.equal(grounded('tell me a joke', 'Why did the chicken…', new Set(['joke'])).ok, true);
// three or more subject words: half is enough (a card need not repeat every word)
assert.equal(grounded('weather in new york city', 'New York: 18°', new Set(['weather'])).ok, true);
// accents and plural forms
assert.equal(grounded('define café', 'Café (noun): a small restaurant', new Set(['define'])).ok, true);
// the validator's own mistakes on the first full run (2026-10-14): apostrophes, verbs, numbers written differently
assert.deepEqual(subjectOf("what's the moon tonight", new Set(['moon'])), []);
assert.deepEqual(subjectOf('how do gears work', new Set(['gear'])), []);
assert.equal(grounded('car loan $20000 at 7% for 5 years', 'Monthly payment on $20,000 at 7% over 5 years', new Set(['loan', 'car'])).ok, true);
assert.equal(grounded('payment on a $300k mortgage', 'A $300,000 mortgage', new Set(['mortgage', 'payment'])).ok, true);
assert.equal(grounded('how many rolls of wallpaper for a 12x14 room', 'A 12 × 14 room needs 8 rolls', new Set(['wallpaper', 'roll', 'room'])).ok, true);
console.log('ground: ok');
