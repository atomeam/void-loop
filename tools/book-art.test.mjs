import test from 'node:test';
import assert from 'node:assert/strict';
import { bookArtFaults, auditBook, SCHEMATIC } from './book-art.mjs';

test('a decorative picture fails: many colours, a fill, a gradient, an emoji, an img', () => {
  assert.equal(bookArtFaults('<svg><circle fill="#ff7fb0"/><path stroke="#8fb6ff"/></svg>').length, 1);
  assert.match(bookArtFaults('<svg><path stroke="#fff" stroke-width="1"/><path stroke="#ffd79a"/></svg>')[0], /a picture in/);
  assert.match(bookArtFaults('<svg><defs><radialGradient id="a"/></defs><path stroke="' + SCHEMATIC + '"/></svg>')[0], /filled or shaded/);
  assert.match(bookArtFaults('<p>Timer \u23F1\uFE0F</p>')[0], /emoji/);
  assert.match(bookArtFaults('<p>Rocket 🚀</p>')[0], /emoji/);
  assert.match(bookArtFaults('<img src="x.png">')[0], /img/);
});

test('a monochrome hairline schematic and plain type pass', () => {
  assert.deepEqual(bookArtFaults('<svg viewBox="0 0 10 10"><path d="M0 0L10 10" fill="none" stroke="' + SCHEMATIC + '" stroke-width="1"/></svg><p>01 · Countdowns on the stage.</p>'), []);
  assert.deepEqual(bookArtFaults('<h3>Timer</h3><p>"set a timer for 5 minutes" · 3 × 4 = 12 · 50% · ©</p>'), []);
});

test('the real book: every page, the cover and the back cover carry no decorative art', async () => {
  const bad = await auditBook();
  assert.deepEqual(bad.slice(0, 5), []);
});
