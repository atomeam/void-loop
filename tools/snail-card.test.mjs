// The free snail card (lib/snail-card.js, taken by the figure skill): the asks that open it, and the asks that must stay with the web.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { snailOf, SNAIL_LINE, SNAIL_PAGE } from '../void-live-deploy/lib/snail-card.js';
import figure from '../void-live-deploy/skills/figure.js';

test('asks for the snail open the card', () => {
  for (const a of ['show me a snail', 'Show me a snail?', 'garden snail in 3d', 'summon a snail', 'open the snail', 'a garden snail', 'bring me a snail']) {
    assert.equal(snailOf(a.toLowerCase().replace(/[?!.]+$/, '')), true, a);
    assert.equal(figure.match(a.toLowerCase(), a), true, 'the figure skill takes: ' + a);
  }
});
test('lookups and other snail asks stay with the web', () => {
  for (const a of ['snail', 'a snail', 'snail mail', 'what do snails eat', 'how fast is a snail', 'snails', 'show me snails', 'snail shell facts']) assert.equal(snailOf(a), false, a);
});
test('the card names the animal and links to the full page', () => {
  assert.match(SNAIL_LINE, /Cornu aspersum/); assert.equal(SNAIL_PAGE, '/world/');
});
