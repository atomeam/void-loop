// The heading of a fix card (clipLine in void.html): a long pasted note's heading stopped at "The store…" (owner, 2026-10-30: show whole
// sentences, not cuts). It now ends at the last whole sentence that fits, with no ellipsis; only a line with no sentence end in reach
// ends at a word, with an ellipsis. The function is taken from the page itself and run here.
//   node --test tools/heading-whole-sentence.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pages = ['../void.html', '../void-live-deploy/index.html', '../void-live-deploy/void.html'].map((p) => readFileSync(new URL(p, import.meta.url), 'utf8'));
const src = pages[0].match(/\n    const clipLine = \(t, n\) => \{[\s\S]*?\}; \/\/ ellipsis-ok[^\n]*\n/);
assert.ok(src, 'clipLine is in void.html');
const clipLine = new Function('return ' + src[0].trim().replace(/^const clipLine = /, '').replace(/; \/\/ ellipsis-ok[^\n]*$/, ''))();

const NOTE = 'Status note for the team. The card fix went out this morning and the answers look right on the main page. The store page loads fast and the cart keeps its items after a reload.';

test('a long note ends at its last whole sentence that fits, with no ellipsis', () => {
  const h = clipLine(NOTE, 120);
  assert.equal(h, 'Status note for the team. The card fix went out this morning and the answers look right on the main page.');
  assert.ok(!h.endsWith('…'));
  assert.equal(clipLine('Is it live? Yes. It went out at noon and the card now ends where a sentence ends, as it should do every time.', 36), 'Is it live? Yes.');
});

test('a short line stays whole, and a line with no sentence end in reach ends at a word with an ellipsis', () => {
  assert.equal(clipLine('my zap fails', 120), 'my zap fails');
  assert.equal(clipLine('first line\nsecond line', 120), 'first line');
  const w = clipLine('word '.repeat(40).trim(), 120);
  assert.ok(w.endsWith('word…') && w.length <= 121, w);
  // a sentence that ends too early (before 40% of the room) is not a heading on its own
  assert.ok(clipLine('Hi. ' + 'word '.repeat(40), 120).endsWith('…'));
});

test('the three page copies carry the same clipLine', () => {
  for (const p of pages) assert.ok(p.includes(src[0]), 'clipLine is the same in every page copy');
});
