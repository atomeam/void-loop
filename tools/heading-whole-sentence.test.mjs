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

// The same family on other surfaces of one card (owner, 2026-10-30, the "What is really true now" card): the ask list, the Adds to Verse line
// and the live GitHub line. Each one shows whole or ends where a sentence, clause or word ends, and the live line always comes to a result.
test('a card note never ends in the middle of a word ("The Versus jo")', () => {
  const note = 'The Versus job ran on both cards and the winner was saved to the ledger with its reason and the time it finished, for the record.';
  for (const n of [40, 60, 80, 120]) {
    const h = clipLine(note, n), body = h.replace(/…$/, '');
    assert.ok(note.startsWith(body) && /[\s.,;:]/.test(note.charAt(body.length) || ' '), n + ': ' + h);
  }
});

test('the ask list shows every ask whole: kept whole, drawn whole, wrapped and not cut', () => {
  for (const p of pages) {
    assert.match(p, /#hints div \{[^}]*overflow-wrap: anywhere[^}]*\}/, 'a long ask wraps');
    assert.doesNotMatch(p.match(/#hints div \{[^}]*\}/)[0], /text-overflow|nowrap/, 'no ellipsis cut on an ask');
    assert.match(p, /const t = String\(text \|\| ''\)\.trim\(\)\.slice\(0, 4000\);/, 'an ask is kept whole');
    assert.match(p, /hintsEl\.innerHTML = hintList\.map\(\(h, i\) => '<div role="option" data-i="' \+ i \+ '">' \+ esc\(h\) \+ '<\/div>'\)/, 'an ask is drawn whole');
  }
});

test('the Adds to Verse line shows whole on the card and on its picture ("telemetry…")', async () => {
  const { addsLine } = await import('../void-live-deploy/lib/card-frame.js');
  const { fitAdds, cardSvg } = await import('../void-live-deploy/lib/card-image.js');
  const tel = "Paste a CI report, build log or status update and Verse reads it as the builders' own telemetry instead of answering it like a coding question";
  assert.equal(addsLine(tel), tel);
  const a = fitAdds('Adds to Verse: ' + tel);
  assert.equal(a.lines.join(' '), 'Adds to Verse: ' + tel, 'every word drawn');
  assert.ok(a.lines.length <= 3 && a.fs >= 15, a.fs + ' px on ' + a.lines.length + ' lines');
  const svg = cardSvg({ title: 'What is really true now', text: 'checked', adds: tel });
  assert.ok(svg.includes('coding question'), 'the picture holds the end of the line');
  assert.doesNotMatch(svg, /telemetry…/);
  for (const n of [10, 60, 140, 400]) { const f = fitAdds('word '.repeat(n)); assert.equal(f.lines.join(' '), 'word '.repeat(n).trim()); assert.ok(f.lines.every((l) => !l.endsWith('…'))); }
});

test('the live GitHub line always ends: a call that hangs counts as GitHub not answering', async () => {
  const { liveLines } = await import('../void-live-deploy/lib/telemetry-live.js');
  const hang = () => new Promise(() => {});
  const t0 = Date.now(), lines = await liveLines({ prs: ['1992'] }, hang, { callMs: 50 });
  assert.ok(Date.now() - t0 < 2000);
  assert.deepEqual(lines, [{ text: 'GitHub did not answer, so nothing here is checked', ok: null }]);
  const route = readFileSync(new URL('../void-live-deploy/skills/telemetry-route.js', import.meta.url), 'utf8');
  assert.match(route, /\}\)\.catch\(failed\);/, 'a read that throws replaces the checking line too');
});
