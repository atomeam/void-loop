// decide-cards (the Deciding family; asked by Verse, ask-20261021-1627-1: scale the Deciding family's proven count): its own test, beside the
// three real benchmark asks already routed to it. Every example parses to a card, every near miss does not. node --test tools/decide-cards.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import decide from '../void-live-deploy/skills/decide-cards.js';

test('every example of decide-cards makes a card', () => {
  assert.ok(decide.examples.length >= 9);
  for (const a of decide.examples) { assert.ok(decide.parseCardAsk(a), a); assert.equal(decide.match(a.toLowerCase(), a), true, a); }
});
test('every near miss stays with its own skill', () => {
  for (const a of decide.nearMisses) assert.equal(decide.match(a.toLowerCase(), a), false, a);
});
test('the card kinds the examples ask for are all different shapes', () => {
  const kinds = new Set(decide.examples.map((a) => { const p = decide.parseCardAsk(a); return p && (p.kind || p.type || JSON.stringify(Object.keys(p))); }));
  assert.ok(kinds.size >= 4, [...kinds].join(' | '));
});
