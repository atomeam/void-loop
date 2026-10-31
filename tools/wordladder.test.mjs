// the word ladder skill (skills/wordladder.js): asks that name a word ladder are its, a bare "ladder" is not, and the chain it finds
// changes one letter at a time and is the shortest in its word list.
//   node --test tools/wordladder.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isWordLadder } from '../void-live-deploy/skills/wordladder.js';

test('every example is claimed and no near miss is', () => {
  for (const a of skill.examples) assert.ok(skill.match(a.toLowerCase(), a), a);
  for (const a of skill.nearMisses) assert.ok(!skill.match(a.toLowerCase(), a), a);
  assert.ok(isWordLadder('Word ladder from CAT to DOG?'));
  assert.equal(skill.suite().ok, true);
});

function shown(text) {
  let html = ''; const p = {};
  skill.run(text, { showPage: (f) => { f(p); html = p.innerHTML; }, esc: (s) => String(s).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';') });
  return html;
}

test('the chain changes one letter at a time and is the shortest', () => {
  const html = shown('word ladder from cat to dog');
  const words = html.replace(/<[^>]+>/g, ' ').match(/\b(cat|cot|dot|dog|cog|hot)\b/g);
  assert.deepEqual(words.slice(0, 4), ['cat', 'cot', 'dot', 'dog']);
  const chain = shown('ladder from cold to warm').match(/<p[^>]*>([^<]*)<\/p>/)[1].split(' &rarr; ');
  assert.equal(chain.length, 5);
  assert.equal(chain[0], 'cold'); assert.equal(chain[4], 'warm');
  for (let i = 1; i < chain.length; i++) assert.equal([...chain[i]].filter((c, k) => c !== chain[i - 1][k]).length, 1, chain.join(' '));
});

test('a chain the word list cannot make says so, escaped', () => {
  const html = shown('word ladder from abc to xyz');
  assert.match(html, /No ladder found from abc to xyz/);
  assert.ok(!/<script/i.test(shown('word ladder from cat to dog')));
});
