// node --test tools/phonecut.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import phonecut, { wantsPhoneCut } from '../void-live-deploy/skills/phonecut.js';

test('phone-cut asks match', () => {
  for (const a of ['phone cut poster', 'auto generate film poster', 'promotional poster for the newest film'])
    assert.ok(phonecut.match(a.toLowerCase(), a), a);
  for (const a of ['make this a poster', 'film poster', 'what is a poster'])
    assert.ok(!phonecut.match(a.toLowerCase(), a), a);
  assert.ok(wantsPhoneCut('phone cut poster'));
});
