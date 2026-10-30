// the magic8 skill (skills/magic8.js): its examples reach it, its near misses do not, and run() puts one of the twenty
// classic answers on a page, escaped, with nothing fetched.
//   node --test tools/magic8.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isMagic, ANSWERS } from '../void-live-deploy/skills/magic8.js';

test('every example is claimed and no near miss is', () => {
  for (const a of skill.examples) assert.ok(skill.match(a.toLowerCase(), a), a);
  for (const a of skill.nearMisses) assert.ok(!skill.match(a.toLowerCase(), a), a);
  for (const a of ['Magic 8-Ball?', '8ball', 'please ask magic 8 ball']) assert.ok(isMagic(a), a);
  for (const a of ['ask again', 'magic 8 ball is it going to rain', 'buy a magic 8 ball']) assert.ok(!isMagic(a), a);
  assert.equal(skill.suite().ok, true);
});

test('the twenty classic answers', () => {
  assert.equal(ANSWERS.length, 20);
  assert.equal(new Set(ANSWERS).size, 20);
});

test('run shows one of them on a page, through esc', () => {
  for (let i = 0; i < 20; i++) {
    const el = { innerHTML: '' }; const seen = [];
    const said = skill.run('magic 8 ball', { showPage: (f) => { f(el); return el; }, esc: (s) => { seen.push(s); return String(s); } });
    assert.equal(said, 'magic8');
    assert.equal(seen.length, 1);
    assert.ok(ANSWERS.includes(seen[0]), seen[0]);
    assert.ok(el.innerHTML.startsWith('<h2>Magic 8-Ball</h2><p ') && el.innerHTML.includes('>' + seen[0] + '</p>'));
  }
});
