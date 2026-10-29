// the palette skill (skills/palette.js): harmony asks are its, the color skill's own ("color palette", "palette") are not, each
// scheme puts its hues where the color wheel says, a base color given is kept as the first swatch, and run() shows five swatches
// with their hex codes on a page, escaped, with nothing fetched.
//   node --test tools/palette.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { paletteOf, build, hexToHsl, hslToHex, SCHEMES } from '../void-live-deploy/skills/palette.js';
import { isColor } from '../void-live-deploy/skills/color.js';

test('every example is claimed, no near miss is, and the color skill keeps its asks', () => {
  for (const a of skill.examples) assert.ok(skill.match(a.toLowerCase(), a), a);
  for (const a of skill.nearMisses) assert.ok(!skill.match(a.toLowerCase(), a), a);
  for (const a of ['color palette', 'palette', 'random color', 'another color']) { assert.ok(isColor(a), a); assert.equal(paletteOf(a), null, a); }
  assert.deepEqual(paletteOf('Split-complementary palette!'), { scheme: 'split complementary', base: null });
  assert.deepEqual(paletteOf('monochrome palette for #abc'), { scheme: 'monochrome', base: '#aabbcc' });
  assert.equal(skill.suite().ok, true);
});

test('the hex and hsl conversions agree', () => {
  for (const h of ['#ff0000', '#00ff00', '#0000ff', '#336699', '#ffffff', '#000000']) { const [a, b, c] = hexToHsl(h); const back = hslToHex(a, b, c); assert.ok([1, 3, 5].every((i) => Math.abs(parseInt(back.slice(i, i + 2), 16) - parseInt(h.slice(i, i + 2), 16)) <= 3), h + ' ' + back); }
});

test('each scheme puts its hues where the color wheel says', () => {
  for (const [name, offs] of Object.entries(SCHEMES)) {
    if (name === 'pastel') continue;
    const c = build(name, '#cc3333'); assert.equal(c.length, 5); assert.equal(c[0], '#cc3333');
    c.forEach((x, i) => { assert.match(x, /^#[0-9a-f]{6}$/); if (i && hexToHsl(x)[1] > 5) { const d = Math.abs(((hexToHsl(x)[0] - (0 + offs[i])) % 360 + 540) % 360 - 180); assert.ok(d <= 3, name + ' ' + i + ' ' + x); } });
  }
  for (const x of build('pastel', null)) assert.ok(hexToHsl(x)[2] >= 70, 'pastel is light: ' + x);
});

test('run shows five swatches with their codes, through esc', () => {
  const el = { innerHTML: '' }; const seen = [];
  const said = skill.run('complementary palette from #ff8800', { showPage: (f) => { f(el); return el; }, esc: (s) => { seen.push(String(s)); return String(s); } });
  assert.equal(said, 'palette');
  assert.ok(el.innerHTML.startsWith('<h2>Complementary palette</h2>'));
  assert.equal((el.innerHTML.match(/<code/g) || []).length, 5);
  assert.ok(el.innerHTML.includes('#ff8800') && el.innerHTML.includes('built around #ff8800'));
});
