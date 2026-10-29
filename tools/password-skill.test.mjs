// the password skill (skills/password.js): its examples reach it, its near misses do not, the length asked for is kept
// (8 to 64), every character comes from the alphabet, and run() puts the password on a page, escaped, with nothing fetched.
// "generate a password" stays with util, which is asked first.
//   node --test tools/password-skill.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isPassword, generate, CHARS } from '../void-live-deploy/skills/password.js';

test('every example is claimed and no near miss is', () => {
  for (const a of skill.examples) assert.ok(skill.match(a.toLowerCase(), a), a);
  for (const a of skill.nearMisses) assert.ok(!skill.match(a.toLowerCase(), a), a);
  for (const a of ['Random password?', 'give me a strong new password', 'password with 30 characters']) assert.ok(isPassword(a), a);
  for (const a of ['reset my password', 'password manager', 'is my password safe']) assert.ok(!isPassword(a), a);
  assert.equal(skill.suite().ok, true);
});

test('the length asked for, from the alphabet, all different', () => {
  const seen = new Set();
  for (const n of [8, 16, 33, 64]) for (let i = 0; i < 50; i++) {
    const pw = generate(n); assert.equal(pw.length, n);
    for (const ch of pw) assert.ok(CHARS.includes(ch), ch);
    seen.add(pw);
  }
  assert.equal(seen.size, 200);
});

test('run keeps the length in range and shows it through esc', async () => {
  for (const [ask, n] of [['random password', 16], ['password of 20 characters', 20], ['password of 3 characters', 8], ['password of 500 characters', 64]]) {
    const el = { innerHTML: '' }; const seen = [];
    const said = await skill.run(ask, { showPage: (f) => { f(el); return el; }, esc: (s) => { seen.push(s); return String(s); } });
    assert.equal(said, 'password');
    assert.equal(seen.length, 1);
    assert.equal(seen[0].length, n, ask);
    assert.ok(el.innerHTML.includes(n + ' characters'));
  }
});
