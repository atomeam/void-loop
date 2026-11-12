// lift-summary skill: a short summary of the systems, automations, monitoring and handoff included.
// Run: node --test tools/lift-summary.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isLiftSummary, subjectOf, summaryFor } from '../void-live-deploy/skills/lift-summary.js';

test('matches the examples and rejects near misses', () => {
  for (const a of skill.examples) assert.equal(isLiftSummary(a), true, a);
  for (const a of skill.nearMisses) assert.equal(isLiftSummary(a), false, a);
});

test('extracts the subject and builds a summary', () => {
  const s = subjectOf('lift summary for client onboarding');
  assert.equal(s, 'client onboarding');
  const pack = summaryFor(s);
  assert.ok(pack.owns.length >= 3);
  assert.ok(pack.clientDoesLess.length >= 2);
  assert.ok(pack.next.includes('handoff'));
});

test('old asks still match, and the card has no heavy-lifting boast', async () => {
  assert.equal(isLiftSummary('we own the heavy lifting for invoice reminders'), true);
  assert.equal(isLiftSummary('package the heavy lifting for the support flow'), true);
  assert.equal(isLiftSummary('heavy lifting'), false);
  let html = '';
  const ret = await skill.run('lift summary for client onboarding', {
    esc: (s) => String(s),
    showPage: (fn) => { const el = { set innerHTML(v) { html = v; } }; fn(el); return el; },
  });
  assert.equal(ret, 'lift-summary');
  assert.match(html, /Lift summary: client onboarding/);
  assert.match(html, /What Verse owns/);
  assert.match(html, /Client work that drops/);
  assert.doesNotMatch(html, /heavy lifting/i);
});
