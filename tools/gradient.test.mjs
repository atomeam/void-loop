// lib/gradient.js: CSS out, CSS read back, the link, the fallback colour, the text contrast and the asks
import test from 'node:test';
import assert from 'node:assert/strict';
import { css, read, pack, open, fallback, rule, textContrast, colourOf, normal, askGradient, PRESETS, reverse, adjust, inFormat, cssIn, scss, fromSamples, geometry, drawGradient } from '../void-live-deploy/lib/gradient.js';

const two = { type: 'linear', angle: 90, stops: [{ color: '#ff0000', pos: 0 }, { color: '#0000ff', pos: 100 }] };
test('CSS out for each type, stops sorted, positions filled in evenly when missing', () => {
  assert.equal(css(two), 'linear-gradient(90deg, #ff0000 0%, #0000ff 100%)');
  assert.equal(css({ ...two, type: 'radial', shape: 'circle' }), 'radial-gradient(circle at center, #ff0000 0%, #0000ff 100%)');
  assert.equal(css({ ...two, type: 'conic', angle: 45 }), 'conic-gradient(from 45deg at center, #ff0000 0%, #0000ff 100%)');
  assert.equal(css({ type: 'linear', angle: 0, stops: [{ color: 'red' }, { color: 'lime' }, { color: 'blue' }] }), 'linear-gradient(0deg, #ff0000 0%, #00ff00 50%, #0000ff 100%)');
  assert.equal(css({ type: 'linear', angle: 450, stops: [{ color: '#00f', pos: 80 }, { color: '#f00', pos: 10 }] }), 'linear-gradient(90deg, #ff0000 10%, #0000ff 80%)');
  assert.equal(css({ type: 'linear', stops: [{ color: 'red' }] }), '', 'one stop is not a gradient');
});
test('opacity: rgba, #rrggbbaa and transparent', () => {
  assert.deepEqual(colourOf('rgba(0, 0, 255, 0.5)'), { r: 0, g: 0, b: 255, a: 0.5 }); assert.deepEqual(colourOf('#0000ff80'), { r: 0, g: 0, b: 255, a: 0.502 });
  assert.deepEqual(colourOf('transparent'), { r: 0, g: 0, b: 0, a: 0 }); assert.deepEqual(colourOf('rgb(0 0 255 / 25%)'), { r: 0, g: 0, b: 255, a: 0.25 });
  assert.equal(css({ type: 'linear', angle: 180, stops: [{ color: '#000' }, { color: 'transparent' }] }), 'linear-gradient(180deg, #000000 0%, rgba(0, 0, 0, 0) 100%)');
});
test('CSS read back: angles, directions, radial circle, conic from, background: in front, and a round trip for every preset', () => {
  assert.deepEqual(read('linear-gradient(90deg, #f00 0%, #00f 100%)'), normal(two));
  assert.equal(read('linear-gradient(to right, red, blue)').angle, 90); assert.equal(read('linear-gradient(red, blue)').angle, 180, 'no direction is top to bottom');
  assert.equal(read('linear-gradient(0.25turn, red, blue)').angle, 90); assert.equal(read('linear-gradient(to top left, red, blue)').angle, 315);
  assert.equal(read('background: radial-gradient(circle, #fff 0%, #000 100%);').shape, 'circle');
  assert.equal(read('conic-gradient(from 45deg, red, blue)').angle, 45); assert.equal(read('-webkit-linear-gradient(left, red, blue)').type, 'linear');
  assert.equal(read('linear-gradient(90deg, rgba(255,0,0,0.5) 10%, blue 90%)').stops[0].color.a, 0.5);
  for (const p of PRESETS) assert.equal(css(read(css(p.g))), css(p.g), p.name);
  for (const bad of ['', 'red', 'linear-gradient()', 'linear-gradient(90deg, notacolour, blue)']) assert.equal(read(bad), null, bad);
});
test('the link holds the whole gradient', () => {
  for (const p of PRESETS) assert.equal(css(open(pack(p.g))), css(p.g), p.name);
  assert.equal(pack(two), 'l90-ff0000ff.0-0000ffff.100'); assert.equal(open('nonsense'), null);
});
test('the fallback colour is the stops weighted by the stretch each covers', () => {
  assert.equal(fallback(two), '#800080'); // half red, half blue
  assert.equal(fallback({ type: 'linear', stops: [{ color: '#000000', pos: 0 }, { color: '#ffffff', pos: 100 }] }), '#808080');
  assert.match(rule(two), /^background-color: #800080;\nbackground-image: linear-gradient\(90deg/);
});
test('text contrast is the worst along the gradient', () => {
  const bw = textContrast({ type: 'linear', stops: [{ color: '#000000' }, { color: '#ffffff' }] });
  assert.equal(bw.white, 1); assert.equal(bw.black, 1, 'black text vanishes at the black end, white at the white end');
  const dark = textContrast({ type: 'linear', stops: [{ color: '#000080' }, { color: '#000000' }] }); assert.equal(dark.text, '#FFFFFF'); assert.ok(dark.white > 14);
});
test('the asks', () => {
  assert.ok(askGradient('gradient generator')); assert.ok(askGradient('css gradient')); assert.ok(askGradient('linear gradient generator'));
  assert.equal(css(askGradient('make a gradient from red to blue').g), 'linear-gradient(90deg, #ff0000 0%, #0000ff 100%)');
  assert.equal(css(askGradient('gradient from #ff5f6d to #ffc371').g), 'linear-gradient(90deg, #ff5f6d 0%, #ffc371 100%)');
  for (const no of ['gradient', 'what is a gradient', 'gradient descent', 'the gradient of a hill', 'calculate the gradient of y = 2x', 'colour picker']) assert.equal(askGradient(no), null, no);
});
test('reverse, hue and saturation, formats, SCSS', () => {
  assert.equal(css(reverse({ type: 'linear', angle: 90, stops: [{ color: '#ff0000', pos: 0 }, { color: '#0000ff', pos: 30 }] })), 'linear-gradient(90deg, #0000ff 70%, #ff0000 100%)');
  assert.equal(css(adjust(two, 120)), 'linear-gradient(90deg, #00ff00 0%, #ff0000 100%)'); // red +120 is green, blue +120 is red
  assert.equal(css(adjust(two, 0, 0)), 'linear-gradient(90deg, #808080 0%, #808080 100%)', 'no saturation: grey at the same lightness');
  assert.equal(inFormat({ r: 255, g: 87, b: 51, a: 1 }, 'hsl'), 'hsl(11, 100%, 60%)'); assert.equal(inFormat({ r: 0, g: 0, b: 255, a: 0.5 }, 'rgb'), 'rgba(0, 0, 255, 0.5)');
  assert.equal(inFormat({ r: 0, g: 0, b: 255, a: 0.5 }, 'hex'), '#0000ff80'); assert.equal(cssIn(two, 'rgb'), 'linear-gradient(90deg, rgb(255, 0, 0) 0%, rgb(0, 0, 255) 100%)');
  assert.equal(scss(two, 'brand'), '$brand-1: #ff0000;\n$brand-2: #0000ff;\n$brand: linear-gradient(90deg, $brand-1 0%, $brand-2 100%);');
});
test('import from a picture: the fewest stops that redraw it', () => {
  const ramp = Array.from({ length: 21 }, (_, i) => ({ r: i * 12.75, g: 0, b: 255 - i * 12.75 })); // a straight red-blue ramp needs two stops
  assert.equal(fromSamples(ramp).stops.length, 2);
  const flag = Array.from({ length: 30 }, (_, i) => (i < 10 ? { r: 0, g: 85, b: 164 } : i < 20 ? { r: 255, g: 255, b: 255 } : { r: 239, g: 65, b: 53 }));
  const g = fromSamples(flag); assert.ok(g.stops.length >= 4 && g.stops.length <= 8, String(g.stops.length)); assert.equal(css(g).slice(0, 30), 'linear-gradient(90deg, #0055a4'); assert.match(css(g), /#ef4135 100%\)$/);
  assert.equal(fromSamples([{ r: 1, g: 2, b: 3 }]), null);
});

test('a gradient lies on a picture the way CSS draws it, and draws on a canvas', () => {
  const st = [{ color: '#000000', pos: 0 }, { color: '#ffffff', pos: 100 }], near = (a, b) => Math.abs(a - b) < 1e-9;
  const right = geometry({ type: 'linear', angle: 90, stops: st }, 200, 100); // to the right: left edge to right edge, through the middle
  assert.ok(near(right.x0, 0) && near(right.x1, 200) && near(right.y0, 50) && near(right.y1, 50));
  const down = geometry({ type: 'linear', angle: 180, stops: st }, 200, 100);
  assert.ok(near(down.x0, 100) && near(down.y0, 0) && near(down.y1, 100));
  const diag = geometry({ type: 'linear', angle: 45, stops: st }, 100, 100); // to the top right: the line's ends meet the corners' perpendiculars
  assert.ok(near(diag.x0, 0) && near(diag.y0, 100) && near(diag.x1, 100) && near(diag.y1, 0));
  const ell = geometry({ type: 'radial', stops: st }, 200, 100), circ = geometry({ type: 'radial', shape: 'circle', stops: st }, 200, 100);
  assert.ok(near(ell.rx, 100 * Math.SQRT2) && near(ell.ry, 50 * Math.SQRT2), 'an ellipse reaches the farthest corner');
  assert.ok(near(circ.rx, Math.hypot(100, 50)) && near(circ.ry, circ.rx));
  assert.ok(near(geometry({ type: 'conic', angle: 90, stops: st }, 200, 100).start, 0), 'from 90deg in CSS is the canvas right');
  assert.equal(geometry({ stops: st }, 0, 100), null); assert.equal(geometry({ stops: [st[0]] }, 10, 10), null);
  const calls = [], fill = { addColorStop: (o, c) => calls.push([o, c]) };
  const ctx = { createLinearGradient: () => fill, createRadialGradient: () => fill, save() {}, restore() {}, clearRect() {}, scale() {}, fillRect: (x, y, w, h) => calls.push(['rect', w, h]) };
  assert.ok(drawGradient(ctx, { type: 'linear', angle: 90, stops: st }, 200, 100));
  assert.deepEqual(calls, [[0, '#000000'], [1, '#ffffff'], ['rect', 200, 100]]);
  assert.equal(drawGradient(ctx, { type: 'conic', stops: st }, 200, 100), false, 'no conic gradients in this canvas: nothing drawn, nothing sent');
});
