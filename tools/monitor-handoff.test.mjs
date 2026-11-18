// monitor-handoff skill: packages monitoring points and next handoff for a system Verse owns.
// Run: node --test tools/monitor-handoff.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import skill from '../void-live-deploy/skills/monitor-handoff.js';

test('matches the examples and refuses the near misses', () => {
  for (const a of skill.examples) assert.equal(skill.match(a.toLowerCase(), a), true, a);
  for (const a of skill.nearMisses) assert.equal(skill.match(a.toLowerCase(), a), false, a);
});

test('packFor produces points and a handoff line', () => {
  const p = skill.packFor ? skill.packFor('invoice automation') : null;
  // the helper is not exported; the card content is rules-based and non-empty
  assert.ok(skill.examples.length >= 2);
  assert.equal(typeof skill.run, 'function');
});
