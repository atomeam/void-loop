// the color skill (skills/color.js): its examples reach it (and "another color", which its page offers), its near misses do
// not, and run() shows one hex swatch for a colour and five for a palette, each code escaped, with nothing fetched.
//   node --test tools/color.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isColor } from '../void-live-deploy/skills/color.js';

test('every example is claimed and no near miss is', () => {
  for (const a of skill.examples) assert.ok(skill.match(a.toLowerCase(), a), a);
  for (const a of skill.nearMisses) assert.ok(!skill.match(a.toLowerCase(), a), a);
  for (const a of ['another color', 'give me another colour', 'Random hex!', 'please color palette']) assert.ok(isColor(a), a);
  for (const a of ['what color is #ff8800', 'colour picker', 'color of the year']) assert.ok(!isColor(a), a);
  assert.equal(skill.suite().ok, true);
});

const show = (ask) => {
  const el = { innerHTML: '' }; const seen = [];
  const said = skill.run(ask, { showPage: (f) => { f(el); return el; }, esc: (s) => { seen.push(s); return String(s); } });
  return { said, seen, html: el.innerHTML };
};

test('a colour is one swatch, a palette five, each a hex code', () => {
  const one = show('random color');
  assert.equal(one.said, 'color');
  assert.match(one.html, /^<h2>A color<\/h2>/);
  assert.equal(one.seen.length, 1);
  const five = show('color palette');
  assert.match(five.html, /^<h2>A palette<\/h2>/);
  assert.equal(five.seen.length, 5);
  for (const c of [...one.seen, ...five.seen]) {
    assert.match(c, /^#[0-9a-f]{6}$/);
    assert.ok(five.html.includes('background:' + c) || one.html.includes('background:' + c), c);
  }
});
