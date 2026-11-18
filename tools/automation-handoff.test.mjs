import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isAutomationHandoff, subjectOf } from '../void-live-deploy/skills/automation-handoff.js';

test('automation handoff is its own ask', () => {
  assert.equal(isAutomationHandoff('automation handoff for the email reminders'), true);
  assert.equal(isAutomationHandoff('handoff the running automations for onboarding'), true);
  assert.equal(isAutomationHandoff('package the running jobs for the client'), true);
  assert.equal(isAutomationHandoff('make an automation handoff for invoice follow-ups'), true);
  assert.equal(subjectOf('automation handoff for the email reminders'), 'email reminders');
  assert.equal(isAutomationHandoff('client offer for email'), false);
  assert.equal(isAutomationHandoff('handoff checklist for onboarding'), false);
  for (const ex of skill.examples) assert.equal(skill.match(ex.toLowerCase(), ex), true, ex);
  for (const near of skill.nearMisses) assert.equal(skill.match(near.toLowerCase(), near), false, near);
});

test('automation-handoff run packages the running automations', () => {
  let html = '';
  const ret = skill.run('automation handoff for the email reminders', {
    esc: (s) => String(s),
    showPage: (fn) => { const el = { set innerHTML(v) { html = v; } }; fn(el); return el; },
  });
  assert.equal(ret, 'automation-handoff');
  assert.match(html, /Automation handoff: email reminders/);
  assert.match(html, /The running automations Verse owns/);
  assert.match(html, /Automations Verse runs/);
  assert.match(html, /Status and monitoring/);
  assert.match(html, /Client work that drops/);
  assert.match(html, /Next step/);
});
