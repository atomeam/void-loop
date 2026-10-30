// The faces of the 3D Book of Verse (lib/book-face.js): every page of skills/guide.json lays out inside its sheet, asks and jumps are
// where a tap can land, and the same page always draws the same. Run: node --test tools/book-face.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { layoutFace, wrap, hitAt, edgeAt, glyphShapes, rng, PAGE_W, PAGE_H } from '../void-live-deploy/lib/book-face.js';

const book = JSON.parse(readFileSync(new URL('../void-live-deploy/skills/guide.json', import.meta.url), 'utf8'));
const measure = (s, f) => s.length * (parseFloat(/(\d+(?:\.\d+)?)px/.exec(f)[1]) * 0.52); // a fixed-pitch stand-in for a canvas

test('wrap fits lines to the width, cuts to maxLines with an ellipsis, and never lets one long word run off the sheet', () => {
  const ls = wrap('the quick brown fox jumps over the lazy dog again and again', '10px x', 100, measure);
  assert.ok(ls.every((l) => measure(l, '10px x') <= 100) && ls.length > 1);
  assert.equal(wrap('a b c d e f g h i j k l m n o p', '10px x', 30, measure, 2).length, 2);
  assert.match(wrap('a b c d e f g h i j k l m n o p', '10px x', 30, measure, 2)[1], /…$/);
  const long = wrap('see https://example.com/a/very/long/address/that/has/no/spaces/at/all/anywhere', '10px x', 100, measure);
  assert.ok(long.every((l) => measure(l, '10px x') <= 100), 'the long address is cut: ' + long.join(' | '));
});

test('every page of the book lays out on both sides inside its sheet, clear of the footer', () => {
  for (const p of book.pages) for (const side of ['left', 'right']) {
    const l = layoutFace(p, book, side, measure);
    assert.equal(l.n, p.n);
    for (const o of l.ops) if (o.k === 'text') {
      assert.ok(o.x >= 0 && o.x <= PAGE_W, p.n + ' text x ' + o.x);
      if (o.align === 'left') assert.ok(o.x + measure(o.s, o.font) <= PAGE_W - 8, p.n + ' runs off the sheet: ' + o.s);
      assert.ok(o.y < PAGE_H - 10, p.n + ' text below the sheet: ' + o.s);
      if (o.y > PAGE_H - 52) assert.ok(o.y >= PAGE_H - 25, p.n + ' crosses the footer: ' + o.s);
    }
    for (const h of l.hits) assert.ok(h.x >= 0 && h.y >= 0 && h.x + h.w <= PAGE_W + 1 && h.y + h.h <= PAGE_H, p.n + ' a hit off the sheet');
  }
});

test('a skill page carries its asks as hits, the contents and index carry jumps, a blank side draws nothing', () => {
  const skill = book.pages.find((p) => p.kind === 'skill' && p.examples && p.examples.length >= 2);
  const l = layoutFace(skill, book, 'right', measure);
  assert.deepEqual(l.hits.map((h) => h.ask), skill.examples.slice(0, 5));
  const h0 = l.hits[0]; assert.equal(hitAt(l, h0.x + 5, h0.y + 5).ask, skill.examples[0]); assert.equal(hitAt(l, 1, 1), null);
  const toc = layoutFace(book.pages.find((p) => p.kind === 'toc'), book, 'left', measure);
  assert.ok(toc.hits.length >= 10 && toc.hits.every((h) => Number.isInteger(h.page) && h.page >= 1));
  const idx = layoutFace(book.pages.find((p) => p.kind === 'index'), book, 'right', measure);
  assert.ok(idx.hits.length >= 36 && idx.hits.every((h) => h.page >= 1 && h.page <= book.pages.length));
  assert.deepEqual(layoutFace(null, book, 'left', measure).ops, []);
});

test('the outer edge of a page turns it: the right page forwards, the left page back, the middle nothing', () => {
  assert.equal(edgeAt('right', PAGE_W - 10), 'next'); assert.equal(edgeAt('left', 10), 'prev');
  assert.equal(edgeAt('right', 10), null); assert.equal(edgeAt('left', PAGE_W - 10), null); assert.equal(edgeAt('right', PAGE_W / 2), null);
});

test('a glyph is the same on every visit and different for different names', () => {
  assert.deepEqual(glyphShapes('forge', 'make'), glyphShapes('forge', 'make'));
  assert.notDeepEqual(glyphShapes('forge', 'make'), glyphShapes('chess', 'games'));
  const r = rng(7), r2 = rng(7); assert.equal(r(), r2()); assert.ok(r() < 1);
});

// asked by Verse: a proven skill (success_rate > 0.9) wears a glow behind its glyph, and says so in its footer
test('a page with a glow draws a glow op before its glyph and says the percentage; one without does not', () => {
  const lit = book.pages.find((p) => p.kind === 'skill' && p.glow), plain = book.pages.find((p) => p.kind === 'skill' && !p.glow);
  assert.ok(lit, 'some skill in the real book glows');
  const l = layoutFace(lit, book, 'right', measure), gi = l.ops.findIndex((o) => o.k === 'glow'), yi = l.ops.findIndex((o) => o.k === 'glyph');
  assert.ok(gi >= 0 && gi < yi, 'glow is drawn first');
  assert.ok(l.ops.some((o) => o.k === 'text' && /proven glow/.test(o.s)));
  if (plain) assert.ok(!layoutFace(plain, book, 'right', measure).ops.some((o) => o.k === 'glow'));
});
