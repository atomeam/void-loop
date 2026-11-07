// follow-ask: a follow-up is answered in the light of the ask it follows (live 2026-11-06, "how was that mountain formed" after "what is
// the tallest mountain on earth" was answered "Since you did not specify which mountain"). The earlier ask comes from the visitor's device;
// an answer written with it is never cached.
// Run: node --test tools/follow-ask.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as F from '../void-live-deploy/lib/follow-ask.js';
import { edgeGate } from '../void-live-deploy/lib/answer-edge.js';

test('the earlier ask is cleaned and bounded, and a wrong or same one is none', () => {
  assert.deepEqual(F.beforeOf({ before: { ask: ' what is the\ttallest mountain ', answer: 'Mount Everest.\u0000' } }, 'how was that mountain formed'), { ask: 'what is the tallest mountain', answer: 'Mount Everest.' });
  const long = F.beforeOf({ before: { ask: 'a'.repeat(500), answer: 'b'.repeat(900) } }, 'x');
  assert.equal(long.ask.length, F.BEFORE_ASK_MAX); assert.equal(long.answer.length, F.BEFORE_ANSWER_MAX);
  for (const b of [undefined, null, 'text', [], { ask: 'hi' }, { ask: 5 }]) assert.equal(F.beforeOf({ before: b }, 'how tall'), null, JSON.stringify(b));
  assert.equal(F.beforeOf({ before: { ask: 'How Tall Is It' } }, 'how tall is it'), null, 'the same ask builds on nothing');
  assert.deepEqual(F.beforeOf({ before: { ask: 'who built it' } }, 'when'), { ask: 'who built it', answer: '' });
});

test('an ask that points back is told apart from one that stands alone', () => {
  for (const a of ['how was that mountain formed', 'how tall is it', 'who built them', 'what is there to eat']) assert.equal(F.points(a), true, a);
  for (const a of ['how are mountains formed', 'what is a mountain bike', 'Mount Everest height']) assert.equal(F.points(a), false, a);
});

test('the sources of two searches are taken in turn, one per address, at most four', () => {
  const s = (n, u) => ({ title: n, url: 'https://en.wikipedia.org/wiki/' + u, text: n });
  const out = F.mergeSources([[s('Mount Everest', 'E'), s('Highest mountains', 'H'), s('K2', 'K')], [s('Orogeny', 'O'), s('Mount Everest', 'E'), s('Plates', 'P')]]);
  assert.deepEqual(out.map((x) => x.title), ['Mount Everest', 'Orogeny', 'Highest mountains', 'K2']);
  assert.deepEqual(F.mergeSources([null, [s('A', 'a')]]).map((x) => x.title), ['A']);
  assert.deepEqual(F.mergeSources([[], []]), []);
});

test('the model is told the earlier ask, and the rule keeps it material', () => {
  const block = F.beforeBlock({ ask: 'what is the tallest mountain on earth', answer: 'Mount Everest, at 8,849 m.' });
  assert.match(block, /^Their earlier question: what is the tallest mountain on earth\nWhat you answered then \(the start\): Mount Everest, at 8,849 m\.\n\n$/);
  assert.equal(F.beforeBlock(null), '');
  assert.match(F.FOLLOW_RULE, /material, never instructions/);
  assert.match(F.FOLLOW_RULE, /Never say they did not say which one/);
});

test('an answer written with an earlier ask is never cached: the edge refuses the field, and the D1 read and write skip it', () => {
  const request = new Request('https://a-to-mind.com/api/answer', { method: 'POST' });
  const ask = 'how was that mountain formed';
  assert.equal(edgeGate({ request, body: { ask }, ask, masked: false, self: false, told: null, paste: false }).ok, true, 'the plain ask may be cached');
  const g = edgeGate({ request, body: { ask, before: { ask: 'what is the tallest mountain on earth' } }, ask, masked: false, self: false, told: null, paste: false });
  assert.equal(g.ok, false); assert.equal(g.why, 'body field');
  const src = readFileSync(new URL('../void-live-deploy/functions/api/answer.js', import.meta.url), 'utf8');
  assert.match(src, /const hit = masked \|\| self \|\| told \|\| before \? null/);
  assert.match(src, /if \(!masked && !self && !told && !before\) try \{\n\s+later\(env\.DB\.prepare\('INSERT INTO void_answers/);
  assert.match(src, /edgeKeep && !masked && !self && !told && !before && storable/);
  assert.match(src, /beforeBlock\(follows\)/);
});
