// progress-report skill: client-visible progress on systems Verse owns.
// Run: node --test tools/progress-report.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isProgressReport, subjectOf, reportFor } from '../void-live-deploy/skills/progress-report.js';

test('matches the examples and rejects near misses', () => {
  for (const a of skill.examples) assert.equal(isProgressReport(a), true, a);
  for (const a of skill.nearMisses) assert.equal(isProgressReport(a), false, a);
});

test('extracts the subject and builds a report', () => {
  const s = subjectOf('progress report for the onboarding automation');
  assert.equal(s, 'onboarding automation');
  const rep = reportFor(s);
  assert.ok(rep.shipped.length >= 3);
  assert.ok(rep.next.length >= 2);
  assert.ok(rep.status.includes('monitors'));
});
