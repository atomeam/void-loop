import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeliveryDashboard, subjectOf, dashboardFor } from '../void-live-deploy/skills/delivery-dashboard.js';

test('matches dashboard asks and extracts subject', () => {
  assert.equal(isDeliveryDashboard('delivery dashboard for the invoice automation'), true);
  assert.equal(isDeliveryDashboard('show the dashboard for onboarding'), true);
  assert.equal(isDeliveryDashboard('client dashboard for weekly reports'), true);
  assert.equal(isDeliveryDashboard('systems owned for invoice'), false);
  assert.equal(subjectOf('delivery dashboard for the invoice automation'), 'invoice automation');
});

test('dashboardFor packages the owned systems and next step', () => {
  const d = dashboardFor('dashboard for onboarding');
  assert.ok(d.subject.includes('onboarding'));
  assert.ok(d.owned.length >= 5);
  assert.ok(d.owned.some(s => /systems-owned|ownership/.test(s)));
  assert.ok(d.next.includes('full handoff'));
});
