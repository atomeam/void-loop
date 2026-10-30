// password asks said another way (skills/util.js): "16 character password", "generate a password 16 characters", "strong password".
// 2026-10-30: each fell to an article. password.js keeps its own asks ("random password", "password of 20 characters").
//   node --test tools/password-asks.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import util, { utilOf } from '../void-live-deploy/skills/util.js';
import password, { isPassword } from '../void-live-deploy/skills/password.js';

test('the length before or after the word, and the kind alone, make a password card of that length', () => {
  for (const [a, n] of [['generate a password 16 characters', 16], ['16 character password', 16], ['password 16 characters', 16], ['give me a 12 character password', 12],
    ['generate a 20 character password', 20], ['secure password 32 chars', 32], ['random password 10 letters', 10], ['a 24-character password', 24], ['I need a 30 char strong password', 30],
    ['32 characters long password', 32], ['strong password', 20], ['a secure password', 20], ['strong random password', 20], ['random password generator', 20],
    ['secure password generator', 20], ['password maker', 20], ['6 character password', 8], ['500 character password', 128]]) assert.deepEqual(utilOf(a), { kind: 'password', n }, a);
});

test('not a password to make: questions about passwords, and the asks password.js answers', () => {
  for (const a of ['strong password tips', 'how to make a strong password', 'is this a strong password', 'what is a password', 'reset my password', 'forgot password',
    'change my password', 'password manager', 'random password', 'another password', 'password of 20 characters', 'password please', '4 digit pin', '8 letter words']) {
    assert.ok(!utilOf(a) || utilOf(a).kind !== 'password', a);
  }
  for (const e of password.examples) assert.ok(isPassword(e), 'password.js still owns ' + e);
  for (const e of util.examples) assert.ok(util.match(e.toLowerCase(), e), e);
  for (const n of util.nearMisses) assert.ok(!util.match(n.toLowerCase(), n), n);
});
