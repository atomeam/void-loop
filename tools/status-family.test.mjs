// The status family (skills/status-board.js, lists run 9, 2026-11-04): status and system-status are one routing entry, every old ask
// still reaches the member that answered it, both old names stay as parts, and the system-status card shows no state it did not check.
// Run: node --test tools/status-family.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import fam from '../void-live-deploy/skills/status-board.js';
import status from '../void-live-deploy/skills/status.js';
import automationStatus from '../void-live-deploy/skills/automation-status.js';
import automations from '../void-live-deploy/skills/automations.js';
import systemStatus, { isSystemStatus, addressOf, extractSystem, cardHtml } from '../void-live-deploy/skills/system-status.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
test('every example of both old skills lands on the same member as before the merge (status first, as at rank 0650)', () => {
  for (const a of status.examples) assert.equal(fam.part(a.toLowerCase(), a), 'status', a);
  for (const a of systemStatus.examples) assert.equal(fam.part(a.toLowerCase(), a), 'system-status', a);
  assert.equal(fam.part('system status', 'system status'), 'status', 'Verse\'s own health card, as before');
});
test('the tightened match takes no ask that is not a system: orders, flights and the near misses of both stay out', () => {
  for (const a of ['status of my order', 'flight status', 'status of my visa application', 'status quo', 'relationship status', 'automation status', 'what is the status'])
    assert.equal(isSystemStatus(a), false, a);
  for (const a of fam.nearMisses) assert.equal(fam.match(a.toLowerCase(), a), false, a);
  assert.equal(fam.suite().ok, true);
});
test('an address in the ask is what gets checked; a name with no address shows no made-up state', () => {
  assert.equal(addressOf('status of https://example.com/health'), 'https://example.com/health');
  assert.equal(addressOf('status of example.com'), 'https://example.com/');
  assert.equal(addressOf('the invoice automation'), null);
  assert.equal(extractSystem('status of the invoice automation'), 'invoice automation');
  const none = cardHtml(esc, 'invoice automation', null, null);
  assert.match(none, /Not connected yet/); assert.doesNotMatch(none, /Running|Last green check|No open incidents/);
  assert.match(cardHtml(esc, 'x', 'https://example.com/', { ok: true, ms: 42 }), /Reachable.*42 ms/);
  assert.match(cardHtml(esc, 'x', 'https://example.com/', { ok: false, ms: 6000, note: 'no answer in 6 s' }), /Not reachable.*no answer in 6 s/);
});
test('the old names are kept as parts, the family takes one place in the index and the order, the members left both', () => {
  assert.deepEqual(fam.parts, ['status', 'system-status', 'automation-status']);
  const index = JSON.parse(readFileSync(new URL('../void-live-deploy/skills/index.json', import.meta.url), 'utf8'));
  assert.ok(index.includes('status-board')); assert.ok(!index.includes('status') && !index.includes('system-status'));
  assert.ok(existsSync(new URL('../void-live-deploy/skills/order/0650-status-board', import.meta.url)));
  assert.ok(!existsSync(new URL('../void-live-deploy/skills/order/9510-system-status', import.meta.url)));
  assert.ok(!index.includes('automation-status'));
  assert.ok(!existsSync(new URL('../void-live-deploy/skills/order/9995-automation-status', import.meta.url)));
});
// lists run 17 (2026-11-11): automation-status joined last, as it sat last (9995); system-status keeps the asks it answered before,
// and the automations skill (1010, between the old ranks) keeps a bare "what automations are running"
test('automation-status joined as the third member and every ask lands where it did before', () => {
  for (const a of automationStatus.examples) assert.equal(fam.part(a.toLowerCase(), a), systemStatus.match(a.toLowerCase(), a) ? 'system-status' : 'automation-status', a);
  assert.equal(fam.part('automation status for invoice reminders', 'automation status for invoice reminders'), 'system-status');
  assert.equal(fam.part('what automations are running for onboarding', 'what automations are running for onboarding'), 'automation-status');
  assert.equal(fam.part('automation status', 'automation status'), 'automation-status');
  assert.equal(fam.match('what automations are running', 'what automations are running'), false, 'the automations skill answers it, as before');
  assert.equal(automations.match('what automations are running', 'what automations are running'), true);
});

