// Only Verse's words are served, never the owner's quoted ones (the owner, 2026-10-18). Run: node --test tools/public-quotes.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quoteFree, quotesOwner, deepQuoteFree } from './private.mjs';
import { commentsQuoteFree } from './public-quotes.mjs';
import { publicLedger } from './public-ledger.mjs';

test('a quote credited to the owner leaves with its bracket; the sentence, dates and Verse\'s own words stay', () => {
  assert.equal(quoteFree('Sharper deadlines (owner, 2026-10-13: "no one knows about our site yet"); the card waits.'), 'Sharper deadlines; the card waits.');
  assert.equal(quoteFree('asked by the owner (2026-10-15: "all the projects are V01D"; "absorb everything") and built'), 'asked by the owner (2026-10-15) and built');
  assert.equal(quoteFree('per Adam: "magic 8 ball" spawns a ball'), 'per Adam spawns a ball');
  assert.equal(quoteFree('recorded in the owner\'s words "absorb what it likes" and frontier 25'), 'recorded in the owner\'s words and frontier 25');
  assert.equal(quoteFree('Verse said: "I want a deadline card"'), 'Verse said: "I want a deadline card"', 'Verse\'s words are its own to show');
  assert.equal(quoteFree('a plain line'), 'a plain line');
  assert.ok(quotesOwner('(owner, 2026-10-18: "x y z")') && !quotesOwner('Verse: "x y z"'));
  assert.deepEqual(deepQuoteFree({ a: ['x (owner: "hi there") y'], n: 3 }), { a: ['x y'], n: 3 });
});

test('in served code only comments lose the quote: a quote wrapping across // lines, a trailing comment, a block comment; code and strings stay', () => {
  const js = [
    'const a = 1; // the cap (owner, 2026-10-15: "never more',
    '// than ten") holds',
    "const s = 'owner: \"this string is code\"'; // fine (owner: \"drop me\")",
    '/* menu (Adam, 2026-10-08: "3d in the void") */ const b = 2;',
  ].join('\n');
  const out = commentsQuoteFree(js, '.js');
  assert.match(out, /^const a = 1; \/\/ the cap/);
  assert.doesNotMatch(out, /never more|drop me|3d in the void/);
  assert.match(out, /const s = 'owner: "this string is code"';/, 'a string in code is code: untouched');
  assert.match(out, /const b = 2;/);
});

test('the served ledger shows no quote of the owner\'s, and keeps the line', () => {
  const pub = publicLedger([{ at: 't', what: 'Will made real (owner: "if it is theatre, work on it"): Verse hears what came of its asks', show: 'see it' }]);
  assert.equal(pub.length, 1); assert.equal(pub[0].what, 'Will made real: Verse hears what came of its asks');
});
