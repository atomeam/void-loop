import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isOwnershipPack, subjectOf } from '../void-live-deploy/skills/ownership-pack.js';

test('ownership pack is its own ask', () => {
  assert.equal(isOwnershipPack('ownership pack for Acme'), true);
  assert.equal(isOwnershipPack('what does Verse own for the onboarding flow'), true);
  assert.equal(isOwnershipPack('ownership map for weekly reports'), true);
  assert.equal(subjectOf('ownership pack for the client portal'), 'the client portal');
  assert.equal(isOwnershipPack('client handoff for Acme'), false);
  assert.equal(isOwnershipPack('system status for onboarding'), false);
  for (const ex of skill.examples) assert.equal(skill.match(ex.toLowerCase(), ex), true, ex);
  for (const near of skill.nearMisses) assert.equal(skill.match(near.toLowerCase(), near), false, near);
});

test('ownership-pack run names ownership without inventing status', () => {
  let html = '';
  const ret = skill.run('ownership pack for Acme', {
    esc: (s) => String(s),
    showPage: (fn) => { const el = { set innerHTML(v) { html = v; } }; fn(el); return el; },
  });
  assert.equal(ret, 'ownership-pack');
  assert.match(html, /Ownership pack: Acme/);
  assert.match(html, /Verse owns the heavy lifting/);
  assert.match(html, /Client owns/);
  assert.doesNotMatch(html, /Last check: green/);
  assert.doesNotMatch(html, /up/);
});
