// heavy-lift-map skill: a map of the systems, automations and handoff included for a process.
// Run: node --test tools/heavy-lift-map.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isHeavyLiftMap } from '../void-live-deploy/skills/heavy-lift-map.js';

test('matches the examples and rejects near misses', () => {
  for (const a of skill.examples) assert.equal(isHeavyLiftMap(a), true, a);
  for (const a of skill.nearMisses) assert.equal(isHeavyLiftMap(a), false, a);
});

test('old asks still match, and the card has no heavy-lifting boast', async () => {
  assert.equal(isHeavyLiftMap('map the heavy lifting for client onboarding'), true);
  assert.equal(isHeavyLiftMap('own the heavy lifting for weekly status reports'), true);
  assert.equal(isHeavyLiftMap('what is heavy lifting'), false);
  let html = '';
  const ret = await skill.run('map the systems for client onboarding', {
    esc: (s) => String(s),
    showPage: (fn) => {
      const el = { set innerHTML(v) { html = v; } };
      fn(el);
      return el;
    },
  });
  assert.equal(ret, 'heavy-lift-map');
  assert.match(html, /Systems map: client onboarding/);
  assert.match(html, /Automations included/);
  assert.match(html, /Handoff package/);
  assert.doesNotMatch(html, /heavy lifting/i);
});
