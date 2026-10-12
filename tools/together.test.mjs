// Figures that pick something to do together (frontier #4, the owner's 2026-10-11 piece): each figure advertises what it
// offers and scores the other's offers by its own needs (The Sims' advertised affordances); the pair takes the best of
// trade, spar, inspect and argue, and says why. Run: node --test tools/together.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import skill, { offersOf, needsOf, choose, togetherAsk, KINDS } from '../void-live-deploy/skills/together.js';
import { fallbackScript } from '../void-live-deploy/skills/scripts.js';

const fig = (title, body = 'person') => ({ title, script: fallbackScript(body, title) });

test('each figure advertises what it offers and needs, from what it is', () => {
  assert.deepEqual(KINDS, ['trade', 'spar', 'inspect', 'argue']);
  assert.ok(offersOf(fig('police officer').script).includes('spar'));
  assert.ok(needsOf(fig('chef').script).trade > 0.8);
  assert.ok(offersOf(fig('flower', 'object').script).includes('inspect'));
  assert.ok(!offersOf(fig('flower', 'object').script).includes('spar'), 'a flower is no fighter');
});

test('the pair picks the interaction both score best, and says who offers it and who wants it', () => {
  const c = choose(fig('police officer'), fig('thief'));
  assert.equal(c.kind, 'spar');
  assert.match(c.why, /^the police officer and the thief spar: /);
  assert.equal(choose(fig('chef'), fig('farmer')).kind, 'trade');
  assert.equal(choose(fig('cat', 'animal'), fig('flower', 'object')).kind, 'inspect');
  assert.equal(choose(fig('philosopher', 'idea'), fig('troublemaker')).kind, 'argue');
});

test('the same pair always picks the same, whichever comes first; two things with nothing to offer each other do nothing', () => {
  for (const [a, b] of [['police officer', 'thief'], ['chef', 'farmer'], ['cat', 'flower']]) {
    assert.equal(choose(fig(a), fig(b)).kind, choose(fig(b), fig(a)).kind, a + ' / ' + b);
  }
  assert.equal(choose(fig('ice', 'object'), fig('sun', 'object')), null);
});

test('the ask: "what are they doing" and its kin, nothing else', () => {
  for (const q of ['what are they doing', 'what are they doing?', 'what would they do together', 'what are the figures doing', 'what will those two do']) assert.ok(togetherAsk(q), q);
  for (const q of ['what are they doing in congress', 'what is a figure', 'what are you doing', 'what do zombies do']) assert.ok(!togetherAsk(q), q);
  for (const q of skill.examples) assert.ok(skill.match(q.toLowerCase(), q), q);
  for (const q of skill.nearMisses) assert.ok(!skill.match(q.toLowerCase(), q), q);
});
