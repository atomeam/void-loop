// The tome (lib/tome.js): the V01D Book typeset for parchment, read full screen like a Skyrim book. Run: node --test tools/tome.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOME_CSS, pageHtml, sheetHtml, tocHtml, stacks, PROMPT, coverHtml, SERIF } from '../void-live-deploy/lib/tome.js';
import { flavorOf } from '../void-live-deploy/lib/guide.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const book = JSON.parse(readFileSync(resolve(root, 'void-live-deploy/skills/guide.json'), 'utf8'));
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

test('the look is a book, not a card: parchment, a serif, a drop capital, running heads and folios; no menu, tabs or buttons', () => {
  assert.match(TOME_CSS, /#e6d5ae/, 'parchment');
  assert.match(TOME_CSS, /first-letter/, 'a drop capital');
  assert.ok(TOME_CSS.includes(SERIF) && /Palatino|Georgia/.test(SERIF));
  assert.match(TOME_CSS, /html\.v-tome #stage\{filter:brightness/, 'the stage dims behind the book');
  assert.match(TOME_CSS, /\.tome-cover\{/); assert.match(TOME_CSS, /\.tome-leaf\{/); assert.match(TOME_CSS, /rotateY\(-180deg\)/, 'the cover and the leaves swing about the spine');
  assert.match(TOME_CSS, /@media \(max-width:700px\)/, 'one page on a phone');
  assert.doesNotMatch(TOME_CSS, /\.gb-tab|\.gb-nav|button\{/, 'no card chrome');
  assert.match(PROMPT, /Turn page/); assert.match(PROMPT, /Esc/); assert.match(PROMPT, /Swipe/);
});

test('every page of the real book typesets, with a title and a rule; a skill page has its line, its asks as ink, its rating and its glyph', () => {
  for (const p of book.pages) { const h = pageHtml(p, book, esc); assert.ok(h.length > 40, p.kind + ' ' + p.n); assert.match(h, /tome-title/); assert.match(h, /tome-rule/); }
  const timer = book.pages.find((p) => p.name === 'timer'), h = pageHtml(timer, book, esc);
  assert.match(h, /class="lead gb-line"/, 'a drop capital on the line');
  assert.match(h, /tome-try/); assert.match(h, /data-ask="/); assert.match(h, /tome-tier/); assert.match(h, /svg class="gglyph"/);
  assert.doesNotMatch(h, /tome-kicker">Time</, 'the chapter is the running head, not repeated above the title');
  const quoted = book.pages.find((p) => p.kind === 'skill' && /^"/.test(p.line || ''));
  if (quoted) assert.doesNotMatch(pageHtml(quoted, book, esc), /class="lead /, 'a line that opens with a quote keeps its first letter');
});

test('the running heads follow a book: the title on the left, the chapter on the right; the folio is the page number', () => {
  const p = book.pages.find((x) => x.kind === 'skill');
  const left = sheetHtml(p, book, 'left', esc), right = sheetHtml(p, book, 'right', esc);
  assert.match(left, /tome-head"><span>The V01D Book<\/span>/); assert.match(right, /<span><\/span><span>[^<]+<\/span><\/div>/);
  assert.match(left, new RegExp('tome-folio">' + p.n + '<'));
  assert.equal(sheetHtml(null, book, 'left', esc), '');
});

test('the front matter and the back: a title page, how to ask with the built-in asks, the legend with the four words, a contents with jumps, an index with jumps', () => {
  assert.match(pageHtml(book.pages[0], book, esc), /tome-title big/);
  assert.match(pageHtml(book.pages[1], book, esc), /data-ask="what is a black hole"/);
  assert.match(pageHtml(book.pages[2], book, esc), /nothing checks it yet/);
  assert.match(tocHtml(book, esc), /data-page="5"/);
  assert.match(pageHtml(book.pages[book.pages.length - 1], book, esc), /lead-dots/);
  assert.match(coverHtml(book, esc), /The V01D Book/);
});

test('the stacks of unread leaves grow and shrink with the page you are on', () => {
  assert.deepEqual(stacks(1, 200), { left: 0, right: 0.995 });
  const mid = stacks(100, 200); assert.ok(Math.abs(mid.left - 0.495) < 0.01 && Math.abs(mid.right - 0.5) < 0.01);
  assert.deepEqual(stacks(200, 200), { left: 0.995, right: 0 });
});

test('flavor text (asked by Void): one line of lore for a proven skill, cut from its evidence, unique across the book, none for the unproven', () => {
  assert.equal(flavorOf('timer', 'Time', 'a self-test, 12 real asks', 'checked'), '');
  const taken = new Set(), a = flavorOf('timer', 'Time', 'a self-test, 12 real asks in the benchmark', 'proven', taken), b = flavorOf('clock', 'Time', 'a self-test', 'proven', taken);
  assert.ok(a && b && a !== b && taken.size === 2);
  assert.match(a + b, /12/, 'the real asks count reaches the line');
  assert.equal(flavorOf('timer', 'Time', 'a self-test, 12 real asks in the benchmark', 'proven'), a, 'the same skill always carries the same line');
  const lines = book.pages.filter((p) => p.flavor).map((p) => p.flavor);
  assert.equal(lines.length, book.pages.filter((p) => p.kind === 'skill' && p.tier === 'proven').length, 'every proven skill has one');
  assert.equal(new Set(lines).size, lines.length, 'no two alike');
  assert.ok(lines.every((l) => l.length <= 150), 'short enough for one or two lines under a title: ' + Math.max(...lines.map((l) => l.length)));
});
