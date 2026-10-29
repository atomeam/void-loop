// the ascii skill (skills/ascii.js): its examples reach it, its near misses do not, each character comes back with its code
// point in decimal (a closing ? ! or . left out), and run() puts the codes on a page, escaped, with nothing fetched.
//   node --test tools/ascii.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { phraseOf, codesOf } from '../void-live-deploy/skills/ascii.js';

test('every example is claimed and no near miss is', () => {
  for (const a of skill.examples) assert.ok(skill.match(a.toLowerCase(), a), a);
  for (const a of skill.nearMisses) assert.ok(!skill.match(a.toLowerCase(), a), a);
  for (const a of ['ascii', 'ascii codes', 'show me ascii art of a cat']) assert.ok(!skill.match(a.toLowerCase(), a), a);
  assert.equal(skill.suite().ok, true);
});

test('the text keeps its case and loses only the closing punctuation', () => {
  assert.equal(phraseOf('What is the ASCII of A?'), 'A');
  assert.equal(phraseOf('please char code for Hi!'), 'Hi');
  assert.equal(phraseOf('unicode of é'), 'é');
  assert.equal(phraseOf('what is ascii'), null);
});

test('each character with its code point in decimal', () => {
  assert.equal(codesOf('Hi'), 'H: 72, i: 105');
  assert.equal(codesOf('a b'), 'a: 97,  : 32, b: 98');
  assert.equal(codesOf('é😀'), 'é: 233, 😀: 128512');
});

test('run shows the codes and the text on a page, through esc', () => {
  const el = { innerHTML: '' }; const seen = [];
  const said = skill.run('ascii for hi?', { showPage: (f) => { f(el); return el; }, esc: (s) => { seen.push(s); return String(s); } });
  assert.equal(said, 'ascii');
  assert.deepEqual(seen, ['h: 104, i: 105', 'hi']);
  assert.match(el.innerHTML, /^<h2>ASCII \/ Unicode<\/h2><p>h: 104, i: 105<\/p><div class="sub">for “hi”<\/div>/);
});
