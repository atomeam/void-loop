// the lorem skill (skills/lorem.js): its examples reach it, its near misses do not ("lorem ipsum" and "placeholder text" are
// the util skill's, asked first), the paragraph count is read and kept between 1 and 5, and run() puts that many paragraphs
// of the classic text on a page, with nothing fetched.
//   node --test tools/lorem.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { paragraphsOf } from '../void-live-deploy/skills/lorem.js';
import { utilOf } from '../void-live-deploy/skills/util.js';

test('every example is claimed and no near miss is', () => {
  for (const a of skill.examples) assert.ok(skill.match(a.toLowerCase(), a), a);
  for (const a of skill.nearMisses) assert.ok(!skill.match(a.toLowerCase(), a), a);
  assert.equal(skill.suite().ok, true);
});

test('what the util skill takes, this one leaves alone', () => {
  for (const a of ['lorem ipsum', 'placeholder text', 'give me some lorem ipsum', '2 paragraphs of placeholder text', 'lorem ipsum 3 paragraphs']) {
    assert.ok(utilOf(a), 'util takes ' + a);
    assert.equal(paragraphsOf(a), 0, a);
  }
  for (const a of skill.examples) assert.equal(utilOf(a), null, a);
});

test('the paragraph count, from 1 to 5', () => {
  assert.equal(paragraphsOf('lorem'), 1);
  assert.equal(paragraphsOf('generate more lorem!'), 1);
  assert.equal(paragraphsOf('3 paragraphs of lorem'), 3);
  assert.equal(paragraphsOf('1 paragraph of lorem'), 1);
  assert.equal(paragraphsOf('20 paragraphs of placeholder'), 5);
  assert.equal(paragraphsOf('what is lorem ipsum'), 0);
});

test('run shows as many paragraphs as asked on a page', () => {
  const el = { innerHTML: '' };
  const said = skill.run('3 paragraphs of lorem', { showPage: (f) => { f(el); return el; }, esc: String });
  assert.equal(said, 'lorem');
  assert.match(el.innerHTML, /^<h2>Lorem ipsum<\/h2><p>Lorem ipsum dolor sit amet/);
  assert.equal(el.innerHTML.match(/Lorem ipsum dolor sit amet/g).length, 3);
});
