import test from 'node:test';
import assert from 'node:assert/strict';
import { pixelStats, combine, pixelRegressions, pixelRaised, PIXEL_METRICS, SLACK_SAME, SLACK_OTHER_BROWSER } from './art-pixels.mjs';

const W = 40, H = 20;
const image = (fn) => { const d = new Uint8ClampedArray(W * H * 4); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const [r, g, b] = fn(x, y); const i = (y * W + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; } return d; };

test('a flat grey picture scores zero on tone, colour, detail and focus', () => {
  const s = pixelStats(image(() => [128, 128, 128]), W, H);
  assert.equal(s.tonal, 0); assert.equal(s.colour, 0); assert.equal(s.detail, 0); assert.equal(s.focus, 0);
});

test('tone: a picture from black to white has the full range, a narrow one does not', () => {
  const wide = pixelStats(image((x) => (x < W / 2 ? [0, 0, 0] : [255, 255, 255])), W, H);
  const narrow = pixelStats(image((x) => (x < W / 2 ? [120, 120, 120] : [140, 140, 140])), W, H);
  assert.equal(wide.tonal, 100); assert.ok(narrow.tonal > 0 && narrow.tonal < 15, String(narrow.tonal));
});

test('colour: a saturated picture scores above a grey one of the same tones', () => {
  const vivid = pixelStats(image((x) => (x % 2 ? [255, 0, 0] : [0, 0, 255])), W, H), grey = pixelStats(image((x) => (x % 2 ? [76, 76, 76] : [29, 29, 29])), W, H);
  assert.ok(vivid.colour > 90 && grey.colour === 0, vivid.colour + ' ' + grey.colour);
});

test('detail is a band: blank scores low, a clean outline scores full, white noise scores low again', () => {
  const blank = pixelStats(image(() => [10, 10, 10]), W, H).detail;
  const line = pixelStats(image((x, y) => (y === 10 || x === 20 ? [255, 255, 255] : [0, 0, 0])), W, H).detail;
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const noise = pixelStats(image(() => { const v = rnd() > 0.5 ? 255 : 0; return [v, v, v]; }), W, H).detail;
  assert.equal(blank, 0); assert.ok(line >= 60, 'a clean outline: ' + line); assert.ok(noise < line, 'noise ' + noise + ' vs outline ' + line);
});

test('focus: detail in the middle of the frame scores higher than the same detail at the edge', () => {
  const centre = pixelStats(image((x, y) => (Math.abs(x - W / 2) < 6 && Math.abs(y - H / 2) < 4 && (x + y) % 2 ? [255, 255, 255] : [0, 0, 0])), W, H).focus;
  const edge = pixelStats(image((x, y) => (x < 6 && (x + y) % 2 ? [255, 255, 255] : [0, 0, 0])), W, H).focus;
  assert.ok(centre > 60 && edge === 0, centre + ' ' + edge);
});

test('combine averages each property and the composite; an empty list is zero, not an error', () => {
  const c = combine([{ tonal: 100, colour: 0, detail: 50, focus: 50 }, { tonal: 0, colour: 100, detail: 50, focus: 50 }]);
  assert.deepEqual(c.metrics, { tonal: 50, colour: 50, detail: 50, focus: 50 }); assert.equal(c.composite, 50);
  assert.equal(combine([]).composite, 0);
});

test('the pixel floor never falls, allows a wider slack on another Chromium, and rises with the art', () => {
  const floor = { composite: 60, chrome: '153', metrics: { tonal: 70, colour: 50, detail: 60, focus: 60 } };
  const same = { composite: 60, metrics: { ...floor.metrics } };
  assert.deepEqual(pixelRegressions(same, floor), []);
  assert.match(pixelRegressions({ ...same, composite: 59 }, floor)[0], /pixel composite 59/);
  const dip = { composite: 60, metrics: { ...floor.metrics, tonal: 70 - SLACK_SAME - 1 } };
  assert.match(pixelRegressions(dip, floor).join(), /tonal .* dropped/); assert.deepEqual(pixelRegressions(dip, floor, SLACK_OTHER_BROWSER), [], 'wider slack on another browser');
  assert.deepEqual(pixelRegressions(same, null), []);
  const up = pixelRaised({ composite: 64, chrome: '141', metrics: { tonal: 75, colour: 40, detail: 60, focus: 66 } }, floor);
  assert.equal(up.composite, 64); assert.equal(up.metrics.tonal, 75); assert.equal(up.metrics.colour, 50, 'a property that fell keeps its floor'); assert.equal(up.chrome, '141');
  assert.equal(pixelRaised({ composite: 10, metrics: { tonal: 0, colour: 0, detail: 0, focus: 0 } }, floor).composite, 60);
  assert.deepEqual(PIXEL_METRICS, ['tonal', 'colour', 'detail', 'focus']);
});

test('pixelStats is self-contained: its source text runs in an empty context and gives the same numbers (the page receives it as text)', async () => {
  const vm = await import('node:vm');
  const img = image((x, y) => (x % 7 < 3 ? [200, 40, 90] : [10, 20, 60 + y]));
  const alone = vm.runInNewContext('(' + pixelStats.toString() + ')');
  assert.equal(JSON.stringify(alone(img, W, H)), JSON.stringify(pixelStats(img, W, H)));
});
