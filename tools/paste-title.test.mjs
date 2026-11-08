// The paste card's title comes from the paste as given, not the page's normalized ask (tools/flakes.json: "paste any size and
// read aloud" failed five times; the failing title was a whole first sentence ending in "." and the check, rightly, wants a word
// cut with "…" for this log). The normalized ask can end at a sentence boundary; the raw first line cannot. Read the page's own
// source, so a later edit that swaps the title back to `ask` is caught here rather than in the browser suite.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(resolve(root, 'void-live-deploy/void.html'), 'utf8');

test('the paste card title is the raw paste first line, not the normalized ask', () => {
  assert.match(page, /const given = String\(details \|\| ''\), first = given\.split\('\\n'\)\[0\]\.trim\(\);/,
    'showFix reads the first line of the paste as given');
  assert.match(page, /const title = clipLine\(first \|\| ask, 120\)/,
    'the title is that line (the ask only when there is no paste at all)');
});

test('a long title still ends at a whole sentence past 40% of the room, or at a word with an ellipsis', () => {
  assert.match(page, /ends\[ends\.length - 1\] > n \* 0\.4/, 'the owner’s whole-sentence cut is kept');
  assert.match(page, /\+ '\\u2026'/, 'a word cut still carries the ellipsis');
});
