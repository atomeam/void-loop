// lib/colour.js: parsing every way a colour is typed, every model, contrast (WebAIM's known values), names, shades, schemes and the asks
import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, describe, contrast, passes, nearestName, tintsAndShades, tones, schemes, askColour, NAMES, hslToRgb, rgbToHsl } from '../void-live-deploy/lib/colour.js';

const ff = { r: 255, g: 87, b: 51 };
test('parse: hex long and short, rgb, bare numbers, hsl, names', () => {
  assert.deepEqual(parse('#ff5733'), ff); assert.deepEqual(parse('FF5733'), ff); assert.deepEqual(parse('#f53'), { r: 255, g: 85, b: 51 });
  assert.deepEqual(parse('rgb(255, 87, 51)'), ff); assert.deepEqual(parse('255 87 51'), ff); assert.deepEqual(parse('rgba(255,87,51,0.5)'), ff);
  assert.deepEqual(parse('tomato'), { r: 255, g: 99, b: 71 }); assert.deepEqual(parse('Rebecca Purple'), { r: 102, g: 51, b: 153 });
  assert.deepEqual(parse('hsl(0, 100%, 50%)'), { r: 255, g: 0, b: 0 }); assert.deepEqual(parse('hsl(120deg 100% 25%)'), { r: 0, g: 128, b: 0 });
  for (const bad of ['', 'zz', '#12', 'rgb(300,0,0)', 'hsl(0,120%,50%)', 'notacolour']) assert.equal(parse(bad), null, bad);
});
test('148 CSS names, each one parses back to itself', () => {
  assert.equal(Object.keys(NAMES).length, 148);
  for (const [n, h] of Object.entries(NAMES)) assert.equal(describe(parse(n)).hex.toLowerCase(), h, n);
});
test('every model for #ff5733 matches the colour sites', () => {
  const d = describe(ff);
  assert.equal(d.hex, '#FF5733'); assert.deepEqual(d.hsl, { h: 11, s: 100, l: 60 }); assert.deepEqual(d.hsv, { h: 11, s: 80, v: 100 });
  assert.deepEqual(d.cmyk, { c: 0, m: 66, y: 80, k: 0 });
  assert.ok(Math.abs(d.lab.l - 60.2) < 0.1 && Math.abs(d.lab.a - 62.1) < 0.1 && Math.abs(d.lab.b - 54.3) < 0.2, JSON.stringify(d.lab));
});
test('hsl and rgb round-trip on every 17th colour', () => {
  for (let r = 0; r < 256; r += 17) for (let g = 0; g < 256; g += 51) for (let b = 0; b < 256; b += 85) { const h = rgbToHsl({ r, g, b }); assert.deepEqual(hslToRgb(h.h, h.s, h.l), { r, g, b }); }
});
test('contrast: WebAIM values', () => {
  const W = { r: 255, g: 255, b: 255 }, K = { r: 0, g: 0, b: 0 };
  assert.equal(Math.round(contrast(W, K) * 100) / 100, 21); assert.equal(contrast(W, W), 1);
  assert.equal(Math.round(contrast(parse('#767676'), W) * 100) / 100, 4.54); // the lightest grey that passes AA on white
  assert.deepEqual(passes(4.54), { aa: true, aaLarge: true, aaa: false, aaaLarge: true }); assert.equal(passes(4.49).aa, false);
  assert.equal(describe(parse('#ffff00')).contrast.text, '#000000'); assert.equal(describe(parse('#000080')).contrast.text, '#FFFFFF');
});
test('nearest name: exact for a named colour, by eye otherwise', () => {
  assert.deepEqual(nearestName(parse('tomato')), { name: 'tomato', hex: '#ff6347', distance: 0, exact: true });
  assert.equal(nearestName(ff).name, 'tomato'); assert.equal(nearestName(ff).exact, false);
  assert.equal(nearestName(parse('#010101')).name, 'black');
});
test('tints go to white, shades to black, nine each', () => {
  const { tints, shades } = tintsAndShades(parse('#808080'));
  assert.equal(tints.length, 9); assert.equal(shades.length, 9); assert.equal(tints[4], '#c0c0c0'); assert.equal(shades[4], '#404040');
});
test('tones lose saturation at the same lightness, ending near grey', () => {
  const t = tones(parse('#ff0000')); assert.equal(t.length, 9); assert.equal(t[8], '#8c7373');
  for (const h of t) { const x = rgbToHsl(parse(h)); assert.ok(Math.abs(x.l - 50) < 0.5 && (x.s === 0 || Math.abs(x.h) < 1 || Math.abs(x.h - 360) < 1), h); }
});
test('schemes turn the hue', () => {
  const s = schemes(parse('#ff0000'));
  assert.deepEqual(s.complementary, ['#ff0000', '#00ffff']); assert.deepEqual(s.triadic, ['#ff0000', '#00ff00', '#0000ff']); assert.equal(s.tetradic.length, 4);
});
test('asks: a colour ask names the colour, other asks do not', () => {
  assert.equal(askColour('#ff5733'), '#ff5733'); assert.equal(askColour('hex ff5733'), 'ff5733'); assert.equal(askColour('color tomato'), 'tomato');
  assert.equal(askColour('what color is rgb(255, 87, 51)?'), 'rgb(255, 87, 51)'); assert.equal(askColour('ff5733 color'), 'ff5733'); assert.equal(askColour('color picker'), '#6d4aff'); assert.equal(askColour('hsl(11, 100%, 60%)'), 'hsl(11, 100%, 60%)'); assert.equal(askColour('rgb(300, 0, 0)'), '');
  for (const no of ['color', 'what color is the sky', 'colour of the moon', 'color my world', 'hex to binary', 'red', 'make a red cube', 'colour blind test']) assert.equal(askColour(no), '', no);
});
test('every model the colour sites list, against published reference values', async () => {
  const m = await import('../void-live-deploy/lib/colour.js'), near = (a, b, e, what) => assert.ok(Math.abs(a - b) < e, what + ': ' + a + ' vs ' + b);
  const w = m.rgbToXyz({ r: 255, g: 255, b: 255 }); near(w.x, 95.047, 0.01, 'white X'); near(w.y, 100, 0.01, 'white Y'); near(w.z, 108.883, 0.02, 'white Z');
  const ok = m.rgbToOklab({ r: 255, g: 0, b: 0 }); near(ok.l, 0.62796, 1e-4, 'Oklab L of red'); near(ok.a, 0.22486, 1e-4, 'Oklab a'); near(ok.b, 0.12585, 1e-4, 'Oklab b'); // Ottosson's published red
  const lch = m.rgbToLch({ r: 255, g: 0, b: 0 }); near(lch.l, 53.24, 0.01, 'LCh L of red'); near(lch.c, 104.55, 0.05, 'LCh C'); near(lch.h, 40.0, 0.01, 'LCh h');
  const hl = m.rgbToHunterLab({ r: 255, g: 255, b: 255 }); near(hl.l, 100, 1e-6, 'Hunter L of white'); near(hl.a, 0, 0.02, 'Hunter a'); near(hl.b, 0, 0.02, 'Hunter b');
  assert.deepEqual(m.rgbToYxy({ r: 0, g: 0, b: 0 }), { Y: 0, x: 0.3127, y: 0.329 }); assert.deepEqual(m.rgbToHunterLab({ r: 0, g: 0, b: 0 }), { l: 0, a: 0, b: 0 });
  const d = m.describe(m.parse('#ff5733'));
  assert.equal(d.decimal, 0xff5733); assert.deepEqual(d.hwb, { h: 11, w: 20, b: 0 }); near(d.xyz.y, d.luminance * 100, 0.1, 'XYZ Y is the luminance');
  assert.ok(d.oklch.h >= 0 && d.oklch.h < 360 && d.lch.h >= 0 && d.lch.h < 360);
  const luv = m.rgbToLuv({ r: 255, g: 0, b: 0 }); near(luv.l, 53.24, 0.01, 'CIELUV L of red'); near(luv.u, 175.02, 0.1, 'CIELUV u'); near(luv.v, 37.76, 0.05, 'CIELUV v');
  assert.deepEqual(m.rgbToLuv({ r: 0, g: 0, b: 0 }), { l: 0, u: 0, v: 0 });
  const sq = m.schemes(m.parse('#ff0000')); assert.deepEqual(sq.square, ['#ff0000', '#80ff00', '#00ffff', '#8000ff']); assert.deepEqual(sq.tetradic, ['#ff0000', '#ffff00', '#00ffff', '#0000ff']);
});
