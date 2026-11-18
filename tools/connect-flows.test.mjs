// connect-flows skill: maps data flows between systems Verse owns so the client does less architecture.
// Run: node --test tools/connect-flows.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isConnectFlows, subjectOf, flowsFor } from '../void-live-deploy/skills/connect-flows.js';

test('connect-flows matches its asks and leaves handoff and monitor packs alone', () => {
  assert.equal(isConnectFlows('connect the systems for invoice reminders'), true);
  assert.equal(isConnectFlows('show the data flows for client onboarding'), true);
  assert.equal(isConnectFlows('map connections for the support router'), true);
  assert.equal(subjectOf('connect the systems for invoice reminders'), 'invoice reminders');
  assert.equal(isConnectFlows('handoff checklist for the invoice system'), false);
  assert.equal(isConnectFlows('systems monitor'), false);
  assert.equal(isConnectFlows('what is a flow'), false);
});

test('flowsFor returns concrete connections for known processes and a generic fallback', () => {
  const inv = flowsFor('connect the systems for invoice reminders');
  assert.ok(inv.flows.length >= 2);
  assert.ok(inv.flows.some((f) => /reminder|confirm/i.test(f.to + f.from)));
  const generic = flowsFor('something new');
  assert.equal(generic.flows.length, 3);
  assert.ok(generic.next.includes('the process'));
});

test('the default export takes its examples and leaves its near misses', () => {
  assert.equal(typeof skill.match, 'function');
  assert.equal(typeof skill.run, 'function');
  for (const a of skill.examples) assert.ok(skill.match(a.toLowerCase(), a), 'takes "' + a + '"');
  for (const a of skill.nearMisses) assert.equal(skill.match(a.toLowerCase(), a), false, 'leaves "' + a + '"');
});
