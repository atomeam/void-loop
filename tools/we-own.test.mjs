/** we-own pure helpers */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isWeOwn, extractSubject, ownershipOf } from '../void-live-deploy/skills/we-own.js';

test('isWeOwn matches ownership asks', () => {
  assert.ok(isWeOwn('we own the heavy lifting for: late invoice follow-ups'));
  assert.ok(isWeOwn('ownership handoff: client onboarding automation'));
  assert.ok(isWeOwn('package ownership: status monitoring'));
  assert.ok(isWeOwn('show we-own card for lead capture'));
  assert.ok(!isWeOwn('we own a house'));
  assert.ok(!isWeOwn('what is ownership'));
});

test('extractSubject pulls the idea', () => {
  assert.equal(extractSubject('we own the heavy lifting for: late invoices'), 'late invoices');
  assert.equal(extractSubject('ownership handoff: client onboarding automation'), 'client onboarding automation');
  assert.equal(extractSubject('package ownership for the portal'), 'the portal');
});

test('ownershipOf splits client vs we', () => {
  const o = ownershipOf('invoice follow-ups');
  assert.equal(o.subject, 'invoice follow-ups');
  assert.ok(o.clientOwns.length >= 3);
  assert.ok(o.weOwn.length >= 4);
  assert.ok(o.handoff.length >= 2);
  assert.ok(o.weOwn.some(s => /monitor/i.test(s)));
});
