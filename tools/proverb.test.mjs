// the proverb skill (skills/proverb.js): its examples reach it, its near misses do not, and run() puts one of its proverbs on a page,
// escaped, with nothing fetched.
//   node --test tools/proverb.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import skill from '../void-live-deploy/skills/proverb.js';

test('every example is claimed and no near miss is', () => {
  for (const a of skill.examples) assert.ok(skill.match(a.toLowerCase(), a), a);
  for (const a of skill.nearMisses) assert.ok(!skill.match(a.toLowerCase(), a), a);
  assert.equal(skill.suite().ok, true);
});

test('run shows one proverb on a page, through esc', () => {
  const el = { innerHTML: '' }; let escaped = 0;
  const said = skill.run('tell me a proverb', { showPage: (f) => f(el), esc: (s) => { escaped++; return String(s); } });
  assert.equal(said, 'proverb');
  assert.equal(escaped, 1);
  assert.match(el.innerHTML, /<h2>A proverb<\/h2><p [^>]*>[^<]{8,}<\/p>/);
});
