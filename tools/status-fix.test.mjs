// The status card's suggested fix and recovery button (asked by Verse): node --test tools/status-fix.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixOf, recoverSkill, recoverJob, recover, statusHtml, SELF_SKILLS } from '../void-live-deploy/skills/status.js';

test('a red check becomes the two commands that find and ship its repair, for that section only', () => {
  const f = fixOf('appraise: "what is this coin worth" opens the photo card');
  assert.equal(f.cmd, 'node tools/heavy.mjs node tools/test_void.mjs --only "appraise"');
  assert.match(f.ship, /finish\.mjs fix .* --test "appraise"/);
  assert.match(fixOf('check timeout: no check finished within 300 s').cmd, /VOID_TRACE=1/);
});

test('the recovery picks the best-fitting skill of the Verse itself family, v01d-fixes when none fits', () => {
  assert.equal(recoverSkill(['merge log: the card lists what merged']), 'merges');
  assert.equal(recoverSkill(['automations: my automations opens the rules']), 'automations');
  assert.equal(recoverSkill(['calendar: add a meeting']), 'v01d-fixes');
  assert.ok(SELF_SKILLS.includes(recoverJob({ checks: ['x'] }).skill));
  assert.ok(recoverJob({ sha: 'abc1234', checks: ['status: void status shows'.repeat(20)] }).ask.length <= 200);
});

test('the button queues one job with the owner key, and does nothing without it', async () => {
  const calls = [];
  const f = async (u, o) => { calls.push([u, o]); return { ok: true }; };
  const none = await recover({ checks: ['status: x'] }, f, '');
  assert.equal(none.ok, false); assert.equal(calls.length, 0);
  const r = await recover({ sha: 'abc1234', checks: ['status: x'] }, f, 'k');
  assert.equal(r.ok, true);
  assert.equal(calls[0][0], '/api/queue'); assert.equal(calls[0][1].method, 'POST');
  assert.equal(JSON.parse(calls[0][1].body).target, 'next');
  assert.equal((await recover({ checks: [] }, async () => ({ ok: false, status: 503 }), 'k')).ok, false);
});

test('the failing row shows the cause, the suggested fix and the recover button; a green row shows none', () => {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const sk = { total: 1, ok: 1, missing: [], error: null };
  const red = statusHtml(esc, sk, [], null, '', [{ name: 'Checks on main', state: 'failed', sha: 'abc1234', note: 'x', checks: ['merge log: shows'], suite: 'browser suite' }]);
  assert.match(red, /What failed/); assert.match(red, /Suggested fix/); assert.match(red, /data-recover="abc1234"/); assert.match(red, /merges/);
  const green = statusHtml(esc, sk, [], null, '', [{ name: 'Checks on main', state: 'passed', sha: 'abc1234', note: 'ok' }]);
  assert.doesNotMatch(green, /data-recover|Suggested fix/);
});
