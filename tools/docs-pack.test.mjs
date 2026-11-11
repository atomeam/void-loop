import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isDocsPack, subjectOf } from '../void-live-deploy/skills/docs-pack.js';

test('docs pack is its own ask', () => {
  assert.equal(isDocsPack('docs pack for Acme'), true);
  assert.equal(isDocsPack('client docs for the onboarding flow'), true);
  assert.equal(isDocsPack('document the system Verse owns'), true);
  assert.equal(subjectOf('docs pack for the client portal'), 'client portal');
  assert.equal(isDocsPack('ownership pack for Acme'), false);
  assert.equal(isDocsPack('system status for onboarding'), false);
  for (const ex of skill.examples) assert.equal(skill.match(ex.toLowerCase(), ex), true, ex);
  for (const near of skill.nearMisses) assert.equal(skill.match(near.toLowerCase(), near), false, near);
});

test('docs-pack run packages docs without inventing live status', () => {
  let html = '';
  const ret = skill.run('docs pack for Acme onboarding', {
    esc: (s) => String(s),
    showPage: (fn) => { const el = { set innerHTML(v) { html = v; } }; fn(el); return el; },
  });
  assert.equal(ret, 'docs-pack');
  assert.match(html, /Docs pack: Acme onboarding/);
  assert.match(html, /Verse owns the heavy lifting/);
  assert.match(html, /What is documented/);
  assert.match(html, /Client does less/);
  assert.doesNotMatch(html, /Last check: green/);
  assert.doesNotMatch(html, /uptime/);
});
