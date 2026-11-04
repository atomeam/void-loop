// lib/colour-tool.js, the pure half of the one colour page (/color/, owner 2026-11-03: "our existing color pages should be one"):
// the address keeps the colour and the mode, every mode has a link, and the maths each mode shows holds.
//   node --test tools/colour-tool.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../void-live-deploy/lib/colour-tool.js';

test('the address holds the colour and the mode, and old names find their mode', () => {
  assert.deepEqual(T.MODES.map(([id]) => id), ['codes', 'picker', 'palette', 'random', 'gradient', 'contrast', 'shades', 'blindness']);
  const s = T.readState('?c=FF5733&mode=contrast&on=000');
  assert.equal(s.c, 'ff5733'); assert.equal(s.mode, 'contrast');
  assert.equal(T.readState('?c=zz').c, T.DEFAULT); // a code that is no colour falls back, never breaks the page
  for (const [w, m] of [['eyedropper', 'picker'], ['palettes', 'palette'], ['wcag', 'contrast'], ['tints', 'shades'], ['colorblind', 'blindness'], ['nonsense', 'codes']]) assert.equal(T.modeOf(w), m, w);
  assert.equal(T.modeLink('codes', '#ff5733'), '/color/?c=ff5733');
  assert.equal(T.modeLink('palette', 'ff8800', { scheme: 'triadic' }), '/color/?c=ff8800&mode=palette&scheme=triadic');
  for (const [id] of T.MODES) assert.match(T.modeLink(id, 'abcdef'), /^\/color\/\?[A-Za-z0-9_.=&%-]{1,200}$/, id); // lib/card-frame.js PAGE_QUERY takes it
});

test('binary, names and random colours', () => {
  assert.equal(T.binaryOf('#ff5733'), '11111111 01010111 00110011');
  assert.ok(T.similarNames('#ff0000', 3).length === 3);
  let i = 0; const rnd = () => ((i = (i * 9301 + 49297) % 233280) / 233280);
  for (const k of T.RANDOM_KINDS) for (let n = 0; n < 20; n++) assert.match(T.randomColour(k, rnd), /^#[0-9a-f]{6}$/, k);
  for (let n = 0; n < 20; n++) assert.ok(T.hslOf(T.randomColour('pastel', rnd)).l >= 70);
});

test('contrast is WCAG and the nearest passing colour passes', () => {
  const r = T.contrastReport('#000', '#fff');
  assert.ok(Math.abs(r.ratio - 21) < 0.01);
  const fix = T.nearestPassing('#999999', '#ffffff', 4.5);
  assert.ok(fix && T.contrastReport(fix, '#ffffff').ratio >= 4.5, String(fix));
});

test('shades, scales and exports', () => {
  const t = T.steps('#ff0000', 5, 'white');
  assert.equal(t.length, 5);
  const sc = T.scaleOf('#3366cc');
  assert.deepEqual(sc.map((x) => x.step), [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]);
  assert.equal(sc.find((x) => x.step === 500).hex.toLowerCase(), '#3366cc');
  assert.match(T.cssVars('My brand', ['#ABCDEF']), /--my-brand-1: #abcdef;/);
  assert.match(T.gpl('x', ['#ff0000']), /^GIMP Palette[\s\S]*255\s+0\s+0/);
  assert.deepEqual(JSON.parse(T.tokens('x', ['#ff0000'])), { x: { 1: '#ff0000' } });
});

test('a picture\'s main colours, and colour-blind views', () => {
  const data = new Uint8ClampedArray(4 * 100); for (let p = 0; p < 100; p++) data.set(p < 70 ? [255, 0, 0, 255] : [0, 0, 255, 255], p * 4);
  const d = T.dominant(data, 4).map((x) => (typeof x === 'string' ? x : x.hex));
  assert.equal(d[0], '#ff0000'); assert.ok(d.includes('#0000ff'));
  assert.equal(T.VISION.length, 8);
  assert.equal(T.simulate('#808080', 'achromatopsia').toLowerCase(), '#808080');
  const px = new Uint8ClampedArray([255, 0, 0, 255]); T.simulatePixels(px, 'protanopia'); assert.ok(px[0] < 255);
});
