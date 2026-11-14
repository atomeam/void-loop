import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isDeliveryReady, subjectOf, readinessFor } from '../void-live-deploy/skills/delivery-ready.js';

test('delivery-ready is its own ask', () => {
  assert.equal(isDeliveryReady('is the invoice automation delivery ready'), true);
  assert.equal(isDeliveryReady('handoff ready for onboarding'), true);
  assert.equal(isDeliveryReady('ready to handoff the weekly reports'), true);
  assert.equal(isDeliveryReady('check delivery readiness for support router'), true);
  assert.equal(subjectOf('delivery ready for the client portal'), 'client portal');
  assert.equal(isDeliveryReady('ready'), false);
  assert.equal(isDeliveryReady('delivery'), false);
  assert.equal(isDeliveryReady('handoff'), false);
  for (const ex of skill.examples) assert.equal(skill.match(ex.toLowerCase(), ex), true, ex);
  for (const near of skill.nearMisses) assert.equal(skill.match(near.toLowerCase(), near), false, near);
});

test('delivery-ready run lists checks without claiming completion', async () => {
  let html = '';
  const ret = await skill.run('is the invoice automation delivery ready for Acme', {
    esc: (s) => String(s),
    showPage: (fn) => { const el = { set innerHTML(v) { html = v; } }; fn(el); return el; },
  });
  assert.equal(ret, 'delivery-ready');
  assert.match(html, /Delivery ready: Acme/);
  assert.match(html, /Checks Verse covers/);
  assert.match(html, /Ownership clarified/);
  assert.match(html, /No uptime or completion claimed/);
  assert.doesNotMatch(html, /up 99/);
  assert.doesNotMatch(html, /completed/);
});

test('readinessFor covers the core packs', () => {
  const p = readinessFor('delivery ready for invoice automation');
  assert.ok(p.checks.length >= 6);
  assert.match(p.next, /systems owned/);
  assert.equal(p.subject, 'invoice automation');
});
