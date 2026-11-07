import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isMonitorPack, subjectOf } from '../void-live-deploy/skills/monitor-pack.js';

test('monitor-pack matches its asks and leaves systems-monitor and system-status alone', () => {
  assert.equal(isMonitorPack('monitor pack for client onboarding'), true);
  assert.equal(isMonitorPack('set up monitors for the invoice reminders'), true);
  assert.equal(isMonitorPack('what will Verse watch for the support router'), true);
  assert.equal(subjectOf('monitor pack for client onboarding'), 'client onboarding');
  assert.equal(isMonitorPack('systems monitor'), false);
  assert.equal(isMonitorPack('system status for the onboarding flow'), false);
  assert.equal(isMonitorPack('what is a monitor'), false);
});

// the router (void.html firstSkill) calls skill.match on the default export: without it the whole suite
// crashes with "s.match is not a function"
test('monitor-pack keeps the skill contract: the default export takes its examples and leaves its near misses', () => {
  assert.equal(typeof skill.match, 'function');
  assert.equal(typeof skill.run, 'function');
  for (const a of skill.examples) assert.ok(skill.match(a.toLowerCase(), a), 'takes "' + a + '"');
  for (const a of skill.nearMisses) assert.ok(!skill.match(a.toLowerCase(), a), 'leaves "' + a + '"');
});
