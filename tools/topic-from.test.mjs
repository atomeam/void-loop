// The page's topicFrom (void.html): "what is anxiety" searched for "nxiety" (2026-10-19). The article word was stripped without a space after it,
// so any topic starting with a, an or the lost its first letters ("who is ariana grande" became "riana grande"). Read from the page itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../void.html', import.meta.url), 'utf8');
const body = src.match(/function topicFrom\(text\) \{[\s\S]*?\n    \}/);
const topicFrom = new Function('return (' + body[0] + ')')(); // the page's own function, compiled from its source text (no input from anyone)

test('a topic that starts with a, an or the keeps its letters', () => {
  for (const [q, want] of [['what is anxiety', 'anxiety'], ['who is ariana grande', 'ariana grande'], ['explain atoms', 'atoms'], ['define anarchy', 'anarchy'], ['what is theology', 'theology'], ['tell me about antarctica', 'antarctica']]) assert.equal(topicFrom(q), want, q);
});
test('a real article word is still taken off', () => {
  for (const [q, want] of [['what is an apple', 'apple'], ['what is the sun', 'sun'], ['what is a tile', 'tile'], ['tell me about an elephant', 'elephant']]) assert.equal(topicFrom(q), want, q);
});
