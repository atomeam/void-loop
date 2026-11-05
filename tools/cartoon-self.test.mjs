// Identity probes ask for Verse's own picture, never a cartoon of the word "yourself" and never a paragraph saying it has no form
// (Verse's ask, 2026-11-01, asked 6 times; lists run 13). Run: node --test tools/cartoon-self.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import cartoon, { cartoonOf, cartoonTake, selfPortraitAsk, SELF_SUBJECT } from '../void-live-deploy/skills/cartoon.js';

test('self-portrait: identity probes paint Verse itself, one kept subject', () => {
  for (const q of ['draw yourself', 'Draw yourself!', 'what do you look like?', 'paint a self portrait', 'self-portrait', 'show me yourself', 'draw a picture of yourself', 'show me your face', 'what does verse look like']) {
    assert.ok(selfPortraitAsk(q), q);
    assert.deepEqual(cartoonOf(q), { subject: SELF_SUBJECT, self: true }, q);
    assert.ok(cartoon.match(q.toLowerCase(), q), q);
  }
  const t = cartoonTake(SELF_SUBJECT);
  assert.equal(t.name, "Verse's self-portrait");
  assert.ok(t.emoji && t.line);
});
test('self-portrait: questions about Verse and other drawings stay where they were', () => {
  for (const q of ['who are you', 'what are you', 'tell me about yourself', 'take a selfie', 'what does a cat look like']) assert.equal(selfPortraitAsk(q), false, q);
  assert.equal(cartoonOf('who are you'), null);
  assert.equal(cartoonOf('draw a cartoon cat').subject, 'cat');
  assert.equal(cartoonOf('draw me a robot').subject, 'robot');
});
test('self-portrait: the card says it is Verse picturing itself', async () => {
  const said = [], summoned = [];
  assert.equal(await cartoon.run('draw yourself', { say: (s) => said.push(s), summon: (k, o) => summoned.push([k, o]) }), 'cartoon');
  assert.equal(summoned[0][0], 'cartoon');
  assert.equal(summoned[0][1].subject, SELF_SUBJECT);
  assert.equal(summoned[0][1].name, "Verse's self-portrait");
  assert.match(said[0], /how I picture myself/);
});
