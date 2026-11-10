import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isProposalPack, subjectOf } from '../void-live-deploy/skills/proposal-pack.js';

test('a proposal pack is its own ask, not a delivery pack or a handoff', () => {
  assert.equal(isProposalPack('proposal pack for client onboarding automation'), true);
  assert.equal(isProposalPack('make a client proposal for invoice reminders'), true);
  assert.equal(isProposalPack('generate a proposal for the support ticket router'), true);
  assert.equal(isProposalPack('proposal pack: weekly report automation'), true);
  assert.equal(subjectOf('proposal pack for the onboarding flow'), 'the onboarding flow');
  assert.equal(isProposalPack('delivery pack for my idea'), false);
  assert.equal(isProposalPack('system handoff for billing'), false);
  for (const ex of skill.examples) assert.equal(skill.match(ex.toLowerCase(), ex), true, ex);
  for (const near of skill.nearMisses) assert.equal(skill.match(near.toLowerCase(), near), false, near);
});

test('proposal-pack run names the subject and does not invent status or send anything', () => {
  let html = '';
  const ret = skill.run('proposal pack for client onboarding', {
    esc: (s) => String(s),
    showPage: (fn) => { const el = { set innerHTML(v) { html = v; } }; fn(el); return el; },
  });
  assert.equal(ret, 'proposal-pack');
  assert.match(html, /Proposal pack: client onboarding/);
  assert.match(html, /Verse owns the heavy lifting/);
  assert.match(html, /Nothing sent|nothing sent/);
  assert.doesNotMatch(html, /Last check: green/);
  assert.doesNotMatch(html, /ready for handoff/);
});
