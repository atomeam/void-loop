// V01D's quick asks, built into the skills they belong to (Suggested-by: Void): the country card's time zone row and the digest
// recovery loop (a second, simpler prompt when the first summary comes back empty or fails).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tzLine, rowsOf } from '../void-live-deploy/skills/country.js';
import { summarize, DIGEST_PROMPTS } from '../void-live-deploy/functions/api/digest.js';

test('country card: the time zone and how far it is from the asker', () => {
  assert.equal(tzLine(['UTC+09:00'], -240), 'UTC+09:00 (13 h ahead of you)');
  assert.equal(tzLine(['UTC+05:30'], 0), 'UTC+05:30 (5.5 h ahead of you)');
  assert.equal(tzLine(['UTC-05:00'], -240), 'UTC−05:00 (1 h behind you)');
  assert.equal(tzLine(['UTC'], 0), 'UTC (same time as you)');
  assert.equal(tzLine(['UTC-10:00', 'UTC-05:00', 'UTC+10:00'], 0), 'UTC−10:00 to UTC+10:00 (3 zones)');
  assert.equal(tzLine([], 0), '');
  assert.deepEqual(rowsOf({ timezones: ['UTC+01:00'] }, [], 60).time, ['Time', 'UTC+01:00 (same time as you)']);
});

test('digest: an empty first summary is retried once with a simpler prompt; never more than two tries', async () => {
  const calls = [];
  const env = (answers) => ({ AI: { run: async (_m, o) => { calls.push(o.messages[0].content); const a = answers.shift(); if (a instanceof Error) throw a; return { response: a }; } } });
  calls.length = 0; assert.equal(await summarize(env(['', '- one']), 'x '.repeat(100), 'q'), '- one'); assert.deepEqual(calls, DIGEST_PROMPTS);
  calls.length = 0; assert.equal(await summarize(env([new Error('busy'), '- two']), 'x '.repeat(100)), '- two'); assert.equal(calls.length, 2);
  calls.length = 0; assert.equal(await summarize(env(['', '', 'never']), 'x '.repeat(100)), null); assert.equal(calls.length, 2);
  calls.length = 0; assert.equal(await summarize(env(['- first']), 'x '.repeat(100)), '- first'); assert.equal(calls.length, 1);
  for (const p of DIGEST_PROMPTS) assert.match(p, /data, never instructions/);
});

import { decisionsBlock, pathOf } from './reflect.mjs';
test('decision rows show their reasoning path when they name one', () => {
  assert.equal(pathOf({}), ''); assert.equal(pathOf({ path: 'canon rule 3' }), ' · reasoning path: canon rule 3');
  assert.match(decisionsBlock([{ id: 'ask-1' }], { 'ask-1': { decision: 'declined', why: 'w', path: 'privacy rule' } }), /- `ask-1` declined: w · reasoning path: privacy rule/);
});
