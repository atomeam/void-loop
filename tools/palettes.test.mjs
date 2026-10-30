// lib/palettes.js: palettes that hold the colour, colour-blindness views, the web-safe colours
import test from 'node:test';
import assert from 'node:assert/strict';
import { palettesFor, blindness, WEB_SAFE, webSafe } from '../void-live-deploy/lib/palettes.js';

test('eight palettes of up to five, each starting with the colour and never repeating one', () => {
  const p = palettesFor('#6d4aff'); assert.equal(p.length, 8);
  for (const x of p) { assert.equal(x.colors[0].toUpperCase(), '#6D4AFF', x.name); assert.ok(x.colors.length >= 3 && x.colors.length <= 5, x.name); assert.equal(new Set(x.colors.map((c) => c.toUpperCase())).size, x.colors.length, x.name); for (const c of x.colors) assert.match(c, /^#[0-9A-F]{6}$/i); }
  assert.deepEqual(palettesFor('nonsense'), []); assert.ok(palettesFor('white').every((x) => x.colors.length >= 3));
});
test('colour blindness: red reads as dark yellow-brown without red cones, greys stay grey, achromatopsia is the luminance', () => {
  const r = Object.fromEntries(blindness('#ff0000').map((x) => [x.kind, x.hex.toUpperCase()]));
  const [pr, pg, pb] = [1, 3, 5].map((i) => parseInt(r.protanopia.slice(i, i + 2), 16)); assert.ok(pr < 0x80 && pg < 0x80 && pb < 0x30, r.protanopia);
  for (const x of blindness('#808080')) assert.equal(x.hex.toUpperCase(), '#808080', x.kind);
  assert.equal(r.achromatopsia, '#7F7F7F');
});
test('the 216 web-safe colours and the nearest one', () => {
  assert.equal(WEB_SAFE.length, 216); assert.equal(WEB_SAFE[0].toUpperCase(), '#000000'); assert.equal(WEB_SAFE[215].toUpperCase(), '#FFFFFF');
  assert.equal(webSafe('#6d4aff').toUpperCase(), '#6633FF');
});
