// the leet skill (skills/leet.js): its examples reach it, its near misses do not ("leet code", "leet speak" alone among them),
// letters are swapped as its table says, and run() puts the result on a page, escaped, with nothing fetched.
//   node --test tools/leet.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { phraseOf, toLeet } from '../void-live-deploy/skills/leet.js';

test('every example is claimed and no near miss is', () => {
  for (const a of skill.examples) assert.ok(skill.match(a.toLowerCase(), a), a);
  for (const a of skill.nearMisses) assert.ok(!skill.match(a.toLowerCase(), a), a);
  for (const a of ['leet speak', 'leetcode', 'leet', 'convert to leet']) assert.ok(!skill.match(a.toLowerCase(), a), a);
  assert.equal(skill.suite().ok, true);
});

test('the text to convert comes after the ask, without the closing punctuation', () => {
  assert.equal(phraseOf('leet speak for Hello World!'), 'Hello World');
  assert.equal(phraseOf('please l33t hacker'), 'hacker');
  assert.equal(phraseOf('Convert elite to 1337?'), 'elite');
  assert.equal(phraseOf('leet code'), null);
});

test('a e i o s t l become 4 3 1 0 5 7 1, the rest stays lower case', () => {
  assert.equal(toLeet('Elite Hackers'), '31173 h4ck3r5');
  assert.equal(toLeet('cool'), 'c001');
  assert.equal(toLeet('xyz 42'), 'xyz 42');
});

test('run shows the result and the text on a page, through esc', () => {
  const el = { innerHTML: '' }; const seen = [];
  const said = skill.run('leet hello!', { showPage: (f) => { f(el); return el; }, esc: (s) => { seen.push(s); return String(s); } });
  assert.equal(said, 'leet');
  assert.deepEqual(seen, ['h3110', 'hello']);
  assert.match(el.innerHTML, /^<h2>1337<\/h2><p [^>]*>h3110<\/p><div class="sub">from “hello”<\/div>/);
});
