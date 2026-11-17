// Text-to-point resolver for the idle particle field. All generators return normalized coordinates in -1..1
// with a small z depth. No assets, no network. The canvas sampler is injected so the pure parts run in Node tests.
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** the strongest subject token in a typed ask. Pure. */
export function wordOf(text) {
  const t = String(text || '').toLowerCase().match(/[a-z]{2,}/g) || [];
  const stop = new Set(['the', 'a', 'an', 'is', 'are', 'my', 'me', 'to', 'of', 'in', 'on', 'what', 'show', 'make', 'give', 'tell', 'can', 'you', 'verse', 'please']);
  return t.find((w) => !stop.has(w)) || '';
}

const fill = (out, n, fn) => { for (let i = 0; i < n; i++) { const p = fn(i, n); out[i * 3] = p[0]; out[i * 3 + 1] = p[1]; out[i * 3 + 2] = p[2] || 0; } return out; };
const sphere = (i, n) => { const y = 1 - (i / Math.max(1, n - 1)) * 2, r = Math.sqrt(Math.max(0, 1 - y * y)), t = i * 2.399963; return [Math.cos(t) * r, y, Math.sin(t) * r]; };
const torus = (i, n) => { const u = (i / n) * TAU, v = (i * 0.618033) * TAU, R = .62, r = .28; return [(R + r * Math.cos(v)) * Math.cos(u), (R + r * Math.cos(v)) * Math.sin(u), r * Math.sin(v)]; };
const cube = (i, n) => { const t = (i / n) * 6, f = (x) => clamp((x % 2) * 2 - 1, -1, 1); return t < 1 ? [f(t), Math.sin(i * 2.4), Math.cos(i * 2.4)] : t < 2 ? [Math.sin(i * 2.4), f(t), Math.cos(i * 2.4)] : [Math.sin(i * 2.4), Math.cos(i * 2.4), f(t)]; };
const circle = (i, n) => { const t = (i / n) * TAU; return [Math.cos(t) * .8, Math.sin(t) * .8, 0]; };
const star = (i, n) => { const t = (i / n) * TAU, r = .35 + .55 * Math.pow(Math.abs(Math.cos(2.5 * t)), 12); return [Math.cos(t) * r, Math.sin(t) * r, Math.sin(i * 3.1) * .1]; };
const heart = (i, n) => { const t = (i / n) * TAU, x = 16 * Math.pow(Math.sin(t), 3), y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t); return [x / 17, y / 17, Math.sin(i * 2.7) * .08]; };
const wave = (i, n) => { const x = (i % Math.ceil(Math.sqrt(n))) / Math.ceil(Math.sqrt(n)) * 2 - 1, y = Math.floor(i / Math.ceil(Math.sqrt(n))) / Math.ceil(Math.sqrt(n)) * 2 - 1; return [x, y * .6 + Math.sin(x * 5) * .18, Math.cos(x * 3) * .2]; };
const sun = (i, n) => i % 5 ? circle(i, n) : (() => { const t = (i / n) * TAU * 10; return [Math.cos(t) * .95, Math.sin(t) * .95, 0]; })();
const cat = (i, n) => { const t = (i / n) * TAU, head = i % 3 ? [Math.cos(t) * .6, Math.sin(t) * .6 - .1, 0] : [Math.sin(i * 4) * .5, .55 + (i % 7) / 16, 0]; return head; };
const brain = (i, n) => { const t = (i / n) * TAU, s = Math.sin(i * 5); return [Math.cos(t) * (.5 + .12 * s), Math.sin(t) * .65, (i % 2 ? 1 : -1) * .25]; };
const clock = (i, n) => i % 4 ? circle(i, n) : [Math.sin(i * .7) * .35, Math.cos(i * .7) * .35, 0];

const SHAPES = { sphere, torus, cube, star, heart, wave, sun, cat, brain, time: clock, fly: (i, n) => { const t = (i / n) * TAU; return [Math.sin(t * 6) * .7, Math.cos(t) * .5, Math.cos(t * 6) * .5]; } };
const ALIAS = { sea: 'wave', ocean: 'wave', water: 'wave', dog: 'cat', animal: 'cat', love: 'heart', code: 'cube', build: 'cube', world: 'sphere', planet: 'sphere', orbit: 'torus', ring: 'torus', sun: 'sun', star: 'star', verse: 'star' };

/** Consecutive searches keep their own slice of the field instead of replacing the last one. */
export function createConstellation(total, per = 140, max = 6) {
  var shapes = [], preview = null, cursor = 0;
  var offset = (i) => { var a = i * 2.399963, r = .28 + .11 * Math.min(i, 5); return [Math.cos(a) * r, Math.sin(a) * r, ((i % 3) - 1) * .18]; };
  var slice = (points, at, center) => { var k = 0, m = points.length / 3;
    for (var i = at; i < at + per && i < total; i++, k++) { var j = (k % m) * 3, p = i * 3; atSlice[p] = points[j] + center[0]; atSlice[p + 1] = points[j + 1] + center[1]; atSlice[p + 2] = points[j + 2] + center[2]; } };
  var atSlice = new Float32Array(total * 3);
  return {
    get shapes() { return shapes.slice(); },
    get length() { return shapes.length; },
    offset: offset,
    preview: function (text, points) { preview = { label: wordOf(text), points: points, center: offset(shapes.length) }; },
    lock: function () { if (preview) { shapes.push({ label: preview.label, points: preview.points, center: preview.center, createdAt: Date.now() }); preview = null; if (shapes.length > max) shapes.shift(); } },
    dropPreview: function () { preview = null; },
    clear: function () { shapes = []; preview = null; cursor = 0; },
    assign: function (target, base) {
      atSlice.set(base);
      for (var s = 0; s < shapes.length; s++) slice(shapes[s].points, (s * per) % Math.max(1, total - per), shapes[s].center);
      if (preview) slice(preview.points, (shapes.length * per) % Math.max(1, total - per), preview.center);
      target.set(atSlice.subarray(0, target.length));
      return target;
    }
  };
}

/** Resolve text to a normalized point cloud of exactly `count` points. Inject a canvas factory for glyph fallback. Pure apart from that injection. */
export function pointsFor(text, count, makeCanvas) {
  const out = new Float32Array(Math.max(1, count) * 3);
  const w = wordOf(text), key = ALIAS[w] || w, shape = SHAPES[key];
  if (shape) return fill(out, count, shape);
  if (!w || typeof makeCanvas !== 'function') return fill(out, count, (i, n) => sphere(i, n));
  const cv = makeCanvas(128, 48), c = cv.getContext('2d');
  c.fillStyle = '#000'; c.fillRect(0, 0, 128, 48); c.fillStyle = '#fff';
  c.font = 'bold 34px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(w.slice(0, 9).toUpperCase(), 64, 24);
  const px = c.getImageData(0, 0, 128, 48).data, lit = [];
  for (let y = 0; y < 48; y += 2) for (let x = 0; x < 128; x += 2) if (px[(y * 128 + x) * 4] > 110) lit.push([x / 64 - 1, 1 - y / 24, Math.sin((x + y) * .3) * .12]);
  if (!lit.length) return fill(out, count, (i, n) => sphere(i, n));
  for (let i = 0; i < count; i++) { const p = lit[i % lit.length]; out[i * 3] = p[0]; out[i * 3 + 1] = p[1]; out[i * 3 + 2] = p[2]; }
  return out;
}
