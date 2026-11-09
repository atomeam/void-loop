import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isOwnershipMap } from '../void-live-deploy/skills/ownership-map.js';

test('an ownership map is its own ask', () => {
  assert.equal(isOwnershipMap('ownership map for client onboarding'), true);
  assert.equal(isOwnershipMap('map ownership for invoice reminders'), true);
  assert.equal(isOwnershipMap('what does Verse own vs the client for support tickets'), true);
  assert.equal(isOwnershipMap('who owns what for weekly reports'), true);
  assert.equal(isOwnershipMap('heavy lift map for onboarding'), false);
  assert.equal(isOwnershipMap('system handoff for billing'), false);
  for (const ex of skill.examples) assert.equal(skill.match(ex.toLowerCase(), ex), true, ex);
  for (const near of skill.nearMisses) assert.equal(skill.match(near.toLowerCase(), near), false, near);
});

test('ownership-map run names the process and splits ownership', () => {
  let html = '';
  const ret = skill.run('ownership map for client onboarding', {
    esc: (s) => String(s),
    showPage: (fn) => { const el = { set innerHTML(v) { html = v; } }; fn(el); return el; },
  });
  assert.equal(ret, 'ownership-map');
  assert.match(html, /Ownership map: client onboarding/);
  assert.match(html, /What Verse owns/);
  assert.match(html, /What the client owns/);
  assert.match(html, /We own the heavy lifting/);
  assert.doesNotMatch(html, /Last check: green/);
});
