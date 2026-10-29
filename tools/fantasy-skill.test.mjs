// fantasy (skills/fantasy.js): which asks open the fantasy tools card (start or sit, compare players, trade value, mock draft) and what the card says.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sk from '../void-live-deploy/skills/fantasy.js';

const m = (t) => sk.match(t.toLowerCase(), t);
test('examples in, near misses out, and the asks the pattern names', () => {
  for (const e of sk.examples) assert.ok(m(e), e);
  for (const n of sk.nearMisses) assert.ok(!m(n), n);
  for (const a of ['fantasy football tools', 'Start/Sit?', 'start and sit', 'fantasy trade analyzer', 'trade value', 'compare two players', 'fantasy basketball draft', 'fantasy hockey assistant', 'mock draft', 'Fantasy baseball helper!']) assert.ok(m(a), a);
  for (const a of ['fantasy novel', 'start or sit tom brady', 'compare prices', 'trade school', 'fantasy football scores tonight', 'draft an email', 'fantasy cricket tools']) assert.ok(!m(a), a);
});
test('the card: what the page does, from the person\'s own sheet, nothing sent', () => {
  const el = { innerHTML: '' }; let calls = 0;
  assert.equal(sk.run('start or sit', { showPage: (f) => { calls++; f(el); } }), 'fantasy');
  assert.equal(calls, 1);
  assert.match(el.innerHTML, /^<h2>Fantasy tools<\/h2>/);
  assert.match(el.innerHTML, /From your own sheet, on your device/);
  assert.match(el.innerHTML, /says start or sit, weighs a trade in your value column/);
  assert.match(el.innerHTML, /nothing you paste leaves your device/);
  assert.match(el.innerHTML, /No account, no ads, no betting/);
});
