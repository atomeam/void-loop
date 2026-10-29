// An approval that starts a task which keeps running after the person leaves (asked by Verse): node --test tools/keep-going.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keepAsk, keepLine, everyOf, keepGoing } from '../void-live-deploy/lib/keep-going.js';
import { GATED, isGated, parseGatedAsk, confirmLine, fingerprint } from '../void-live-deploy/lib/approval-core.js';
import { validate, due } from '../void-live-deploy/lib/automations.js';

test('the ask stops on the confirm line with the schedule it asked for', () => {
  assert.deepEqual(parseGatedAsk('keep morning-digest running every 2 hours'), { toolName: 'automation.keep', args: { id: 'morning-digest', every: 120, on: true } });
  assert.equal(parseGatedAsk('keep my nightly-scan automation going each day').args.every, 1440);
  assert.equal(parseGatedAsk('keep digest running').args.every, 60, 'no interval: hourly');
  assert.equal(keepAsk('keep digest running every 1 minute').args.every, 15, 'never faster than the clock');
  assert.equal(parseGatedAsk('stop keeping morning-digest').args.on, false);
  for (const a of ['keep calm', 'keep running', 'keep the change', 'how do I keep it running']) assert.equal(keepAsk(a), null, a);
  assert.ok(isGated('automation.keep'));
  assert.match(confirmLine('automation.keep', keepAsk('keep digest running every 2 hours').args), /even when you are not here/);
  assert.match(keepLine({ id: 'x', on: false }), /^Stop keeping/);
  assert.equal(everyOf('3', 'days'), 4320);
});

const rule = (on, extra = {}) => ({ id: 'digest', name: 'Digest', enabled: false, when: { on, ...extra }, do: [{ action: 'note', text: 'hi' }] });
const store = (r) => { const st = { saved: null, enabled: null, get: async (e, id) => (r && id === r.id ? { rule: r } : null), save: async (e, x) => { st.saved = x; const v = validate(x, {}); return v.ok ? { ok: true, rule: v.rule } : { ok: false, errors: v.errors }; }, setEnabled: async (e, id, on) => { st.enabled = on; return true; } }; return st; };

test('the yes switches the automation onto the clock, and the clock then runs it with nobody here', async () => {
  const st = store(rule('manual'));
  const said = await keepGoing({ id: 'digest', every: 120, on: true }, {}, st);
  assert.match(said, /every 120 minutes/);
  assert.equal(st.saved.enabled, true);
  assert.deepEqual(st.saved.when, { on: 'schedule', every: 120 });
  const now = Date.now();
  assert.ok(due({ ...st.saved, when: st.saved.when }, new Date(now - 3 * 3600e3).toISOString(), now), 'due after two hours with no one asking');
  assert.ok(!due({ ...st.saved }, new Date(now - 30 * 60e3).toISOString(), now), 'not due early');
});

test('it fails closed: no such rule, a webhook rule, a bad interval; and off means off', async () => {
  await assert.rejects(keepGoing({ id: 'nope', every: 60, on: true }, {}, store(rule('manual'))), /no automation called nope/);
  await assert.rejects(keepGoing({ id: 'digest', every: 60, on: true }, {}, store(rule('webhook'))), /webhook/);
  await assert.rejects(keepGoing({ id: 'digest', every: 5, on: true }, {}, store(rule('manual'))), /whole minutes/);
  const st = store(rule('schedule', { every: 60 }));
  assert.match(await keepGoing({ id: 'digest', on: false }, {}, st), /switched off/);
  assert.equal(st.enabled, false);
});

test('the fingerprint covers the schedule: a changed interval is a different yes', async () => {
  const a = await fingerprint('automation.keep', { id: 'digest', every: 60, on: true }), b = await fingerprint('automation.keep', { id: 'digest', every: 15, on: true });
  assert.notEqual(a, b);
});
