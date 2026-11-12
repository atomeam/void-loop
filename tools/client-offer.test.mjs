import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isClientOffer, subjectOf } from '../void-live-deploy/skills/client-offer.js';

test('client offer is its own ask', () => {
  assert.equal(isClientOffer('client offer for the email automation'), true);
  assert.equal(isClientOffer('offer to own the heavy lifting for weekly reports'), true);
  assert.equal(isClientOffer('package this as an offer: client onboarding'), true);
  assert.equal(isClientOffer('make a client offer for invoice reminders'), true);
  assert.equal(subjectOf('client offer for the email automation'), 'email automation');
  assert.equal(isClientOffer('client brief for Acme'), false);
  assert.equal(isClientOffer('handoff checklist for onboarding'), false);
  for (const ex of skill.examples) assert.equal(skill.match(ex.toLowerCase(), ex), true, ex);
  for (const near of skill.nearMisses) assert.equal(skill.match(near.toLowerCase(), near), false, near);
});

test('client-offer run packages a sellable offer', () => {
  let html = '';
  const ret = skill.run('client offer for the email automation', {
    esc: (s) => String(s),
    showPage: (fn) => { const el = { set innerHTML(v) { html = v; } }; fn(el); return el; },
  });
  assert.equal(ret, 'client-offer');
  assert.match(html, /Client offer: email automation/);
  assert.match(html, /An offer of the systems, automations, monitoring and handoff included/);
  assert.match(html, /What Verse takes over/);
  assert.doesNotMatch(html, /heavy lifting/i);
  assert.match(html, /Reduced client work/);
  assert.match(html, /Next step/);
});
