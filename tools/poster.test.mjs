// node --test tools/poster.test.mjs: "order this as a poster" (frontier #15, the first piece's visible half). The open card
// becomes a print-ready poster file at three sizes (150 dpi); ordering waits for a print-on-demand account, so the skill
// says so and never shows a price it has no source for.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import poster, { posterOf, POSTER_SIZES, DPI, layoutPoster } from '../void-live-deploy/skills/poster.js';

test('the asks: make, print or turn this card into a poster; "order" stays the confirm line\'s, and posters in general are not this', () => {
  for (const a of ['Make this a poster', 'print this card as a poster', 'turn this into a poster', 'make a poster of this card', 'poster of this'])
    assert.ok(poster.match(a.toLowerCase(), a), a);
  for (const a of ['order this as a poster', 'what is a poster', 'share this card', 'poster sizes', 'how do I hang a poster', 'make me a teapot'])
    assert.ok(!poster.match(a.toLowerCase(), a), a);
  assert.ok(posterOf('make this a poster'));
});

test('three sizes, print-ready at 150 dpi', () => {
  assert.equal(DPI, 150);
  assert.deepEqual(POSTER_SIZES.map((s) => [s.w, s.h]), [[12, 18], [18, 24], [24, 36]]);
  for (const s of POSTER_SIZES) assert.deepEqual([s.px[0], s.px[1]], [s.w * DPI, s.h * DPI]);
});

test('the layout: the title big at the top, the text wrapped inside the margins, nothing past the edge', () => {
  const measure = (t, size) => t.length * size * 0.55; // a stand-in for canvas measureText
  const text = 'Lisbon, Portugal. Sunny, 24 °C, light wind from the north-west. '.repeat(12);
  for (const s of POSTER_SIZES) {
    const L = layoutPoster({ title: 'Weather in Lisbon', text }, s.px[0], s.px[1], measure);
    assert.equal(L.lines[0].text, 'Weather in Lisbon'); assert.ok(L.lines[0].size > L.lines[1].size, 'the title is the biggest line');
    for (const l of L.lines) {
      assert.ok(l.x >= L.margin && l.x + measure(l.text, l.size) <= s.px[0] - L.margin + 1, 'inside the side margins: ' + l.text.slice(0, 20));
      assert.ok(l.y > 0 && l.y <= s.px[1] - L.margin, 'above the bottom margin');
    }
    assert.ok(L.lines.some((l) => /a-to-mind\.com/.test(l.text)), 'the small mark at the foot');
  }
  const long = layoutPoster({ title: 'x', text: 'word '.repeat(5000) }, 1800, 2700, measure);
  assert.ok(long.cut, 'text that cannot fit is cut, and the layout says so');
  assert.ok(long.lines.every((l) => l.y <= 2700 - long.margin));
});
