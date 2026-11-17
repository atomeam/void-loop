// Text-to-particle shape resolver: keywords, glyph fallback and normalized bounds.
import test from 'node:test';
import assert from 'node:assert/strict';
import { wordOf, pointsFor } from '../void-live-deploy/lib/void-shapes.js';

const bounds = (a) => { let lo = 1, hi = -1; for (const v of a) { lo = Math.min(lo, v); hi = Math.max(hi, v); } return [lo, hi]; };

test('the strongest subject token drops stop words', () => {
  assert.equal(wordOf('show me a cube'), 'cube');
  assert.equal(wordOf('what is the weather in Paris'), 'weather');
  assert.equal(wordOf(''), '');
});

test('known subjects return a full cloud in normalized bounds', () => {
  for (const word of ['sphere', 'torus', 'cube', 'star', 'heart', 'wave', 'sun', 'cat', 'brain', 'time', 'fly']) {
    const p = pointsFor(word, 64);
    assert.equal(p.length, 192, word);
    for (const v of p) assert.ok(Number.isFinite(v), word);
    const [lo, hi] = bounds(p);
    assert.ok(lo >= -1.2 && hi <= 1.2, word + ' ' + lo + '..' + hi);
  }
});

test('unknown words use the injected glyph sampler when one is supplied', () => {
  let used = false;
  const make = () => ({ getContext: () => ({ fillRect(){}, fillText(){}, getImageData: () => ({ data: new Uint8Array(128 * 48 * 4).fill(200) }) }) });
  const p = pointsFor('zebra', 32, () => { used = true; return make(); });
  assert.equal(used, true);
  assert.equal(p.length, 96);
  for (const v of p) assert.ok(Number.isFinite(v));
});
