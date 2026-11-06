import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isSystemHandoff, systemOf } from '../void-live-deploy/skills/system-handoff.js';

test('a system handoff is its own ask, not a client handoff or a status check', () => {
  assert.equal(isSystemHandoff('system handoff for the onboarding automation'), true);
  assert.equal(isSystemHandoff('handoff the system: support ticket router'), true);
  assert.equal(isSystemHandoff('handoff this system: client onboarding automation'), true);
  assert.equal(isSystemHandoff('package the status handoff for my CRM sync'), true);
  assert.equal(isSystemHandoff('hand off the automation for weekly reports'), true);
  assert.equal(systemOf('system handoff for invoice reminders'), 'invoice reminders');
  assert.equal(isSystemHandoff('client handoff for the onboarding automation'), false);
  assert.equal(isSystemHandoff('system status for billing'), false);
  for (const ex of skill.examples) assert.equal(skill.match(ex.toLowerCase(), ex), true, ex);
  for (const near of skill.nearMisses) assert.equal(skill.match(near.toLowerCase(), near), false, near);
});

test('system-handoff run names the system and does not invent a green check', () => {
  let html = '';
  const ret = skill.run('handoff this system: client onboarding', {
    esc: (s) => String(s),
    showPage: (fn) => { const el = { set innerHTML(v) { html = v; } }; fn(el); return el; },
  });
  assert.equal(ret, 'system-handoff');
  assert.match(html, /System handoff: client onboarding/);
  assert.match(html, /a real check, not a sample/);
  assert.doesNotMatch(html, /Last check: green/);
  assert.doesNotMatch(html, /ready for handoff/);
});
