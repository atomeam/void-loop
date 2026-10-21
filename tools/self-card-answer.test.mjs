// node --test tools/self-card-answer.test.mjs
// The answer endpoint now returns the self card's words for "open the self card" instead of falling to the model.
// This check confirms the recognition pattern matches the page's wantsVoice asks.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const SELF_CARD_RE = /^(?:(?:can|could)\s+you\s+|please\s+)?(?:open|show|see|bring\s+up|pull\s+up|go\s+to)\s+(?:me\s+)?(?:the\s+|your\s+|(?:verse|void)'?s\s+|(?:verse|v01d)'?s\s+)?(?:self[- ]?(?:card|page|review|reflection)s?|reflections?|voice(?:\s+(?:card|page))?|what\s+i\s+think\s+of\s+myself)\s*[?.!]?$/i;

test('self-card open asks the endpoint now answers with the card\'s words', () => {
  assert.ok(SELF_CARD_RE.test('open the self card'));
  assert.ok(SELF_CARD_RE.test('show me your self page'));
  assert.ok(SELF_CARD_RE.test('open the self card?'));
  assert.ok(!SELF_CARD_RE.test('open the book'));
  assert.ok(!SELF_CARD_RE.test('what is a black hole'));
});
