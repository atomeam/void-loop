import test from 'node:test';
import assert from 'node:assert/strict';
import { incidentOf, durations, span, briefMarkdown, minutesBetween } from '../void-live-deploy/skills/incident.js';

test('incident-brief asks open the card, with a title when one is given; word asks stay words', () => {
  assert.deepEqual(incidentOf('write an incident brief'), { title: '' });
  assert.deepEqual(incidentOf('incident report for the login outage'), { title: 'Login outage' });
  assert.deepEqual(incidentOf('write a postmortem for the checkout outage'), { title: 'Checkout outage' });
  assert.deepEqual(incidentOf('incident brief: payments down'), { title: 'Payments down' });
  for (const t of ['postmortem template', 'post-incident review', 'outage report']) assert.ok(incidentOf(t), t);
  for (const t of ['postmortem', 'what is an incident', 'incident at work', 'police incident report near me', 'what is a postmortem', 'post mortem examination']) assert.equal(incidentOf(t), null, t);
});

test('time to detect, mitigate and resolve count from the start; missing or backwards times give nothing', () => {
  const s = { started: '2026-10-08T14:00', detected: '2026-10-08T14:12', mitigated: '2026-10-08T14:40', resolved: '2026-10-08T16:05' };
  assert.deepEqual(durations(s), { detect: 12, mitigate: 40, resolve: 125 });
  assert.equal(minutesBetween('2026-10-08T14:00', '2026-10-08T13:00'), null);
  assert.equal(minutesBetween('', '2026-10-08T13:00'), null);
  assert.equal(span(12), '12 min'); assert.equal(span(125), '2 h 5 min'); assert.equal(span(60 * 72), '3 days');
});

test('the Markdown brief keeps what was filled in, says the cause is not known yet, and stays blameless', () => {
  const md = briefMarkdown({ title: 'Login outage', status: 'resolved', severity: 'SEV2', started: '2026-10-08T14:00', detected: '2026-10-08T14:12', mitigated: '', resolved: '',
    impact: 'All sign-ins failed', cause: '', timeline: [{ at: '2026-10-08T14:12', what: 'Alert fired' }, { at: '', what: '' }], next: [{ what: 'Add a canary', owner: 'Sam', due: '2026-10-15' }, { what: '', owner: '', due: '' }] });
  assert.match(md, /^# Incident brief: Login outage\n/);
  assert.match(md, /\*\*Severity:\*\* SEV2 \(major/);
  assert.match(md, /- Detected: 2026-10-08 14:12 \(12 min to detect\)/);
  assert.doesNotMatch(md, /Mitigated|Resolved:/);
  assert.match(md, /## Timeline\n- 2026-10-08 14:12 Alert fired\n\n/);
  assert.match(md, /## Cause\n_Not known yet._/);
  assert.match(md, /- \[ \] Add a canary \(owner: Sam\) \(due 2026-10-15\)\n\n_Blameless/);
});
