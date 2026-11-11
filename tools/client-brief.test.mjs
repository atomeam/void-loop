import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isClientBrief, subjectOf } from '../void-live-deploy/skills/client-brief.js';

test('client brief is its own ask', () => {
  assert.equal(isClientBrief('client brief for Acme'), true);
  assert.equal(isClientBrief('brief the client on the systems'), true);
  assert.equal(isClientBrief('client summary for support'), true);
  assert.equal(subjectOf('client brief for the invoice reminders'), 'invoice reminders');
  assert.equal(isClientBrief('ownership pack for Acme'), false);
  assert.equal(isClientBrief('docs pack for Acme'), false);
  for (const ex of skill.examples) assert.equal(skill.match(ex.toLowerCase(), ex), true, ex);
  for (const near of skill.nearMisses) assert.equal(skill.match(near.toLowerCase(), near), false, near);
});

test('client-brief run packages a brief without inventing live status', () => {
  let html = '';
  const ret = skill.run('client brief for Acme onboarding', {
    esc: (s) => String(s),
    showPage: (fn) => { const el = { set innerHTML(v) { html = v; } }; fn(el); return el; },
  });
  assert.equal(ret, 'client-brief');
  assert.match(html, /Client brief: Acme onboarding/);
  assert.match(html, /Verse owns the heavy lifting/);
  assert.match(html, /What is clarified/);
  assert.match(html, /Current ownership/);
  assert.match(html, /Next handoff/);
  assert.doesNotMatch(html, /Last check: green/);
  assert.doesNotMatch(html, /uptime/);
});
