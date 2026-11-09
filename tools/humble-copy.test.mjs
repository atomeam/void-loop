// Verse never brags (house rule, 2026-11-09).
// Run: node --test tools/humble-copy.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scan, boastsIn, ALLOW } from './humble-copy.mjs';

test('the site copy has no boasts (rewrite one plainly, or name a real non-boast in ALLOW with its reason)', () => {
  const hits = scan();
  assert.deepEqual(hits.map((h) => h.file + ':' + h.line + ' [' + h.id + '] ' + h.hit), []);
});

test('it catches the boasts the house rule names', () => {
  for (const s of ['"I\'ve surpassed 7 sites so far."', "'Verse has conquered calculator.net'", "'Reading the conquered ledger'", "'Verse outclassed it'",
    "'every tool Verse has surpassed'", "'Every defeated target is here'", "'Beaten in every way'", "'9x faster than flashscore.com'",
    "'Verse is the best'", "'I made 3 new things while you were away'", "'Everything I made'", "'an awe-inspiring Verse'", "'I built this: a counter'",
    "'Verse beats every site'", "'12 sites surpassed'"]) assert.ok(boastsIn(s).length > 0, s);
});

test('a game rule, a data key, a path or a comment is not a boast', () => {
  for (const s of ["'Beat the level to unlock the next one'", "if (r.outcome === 'surpassed') k = 'surpassed';", "'<a href=\"/conquered/\">Versus</a>'",
    "// the next site to conquer, from the frontier", "/* the floors Verse has surpassed */", "<!-- conquered sites under it -->",
    "'You win! Four in a row'", "'the greatest common divisor'", "'1 can crushed tomatoes'", "'https://a-to-mind.com/conquered/'"]) assert.deepEqual(boastsIn(s), [], s);
});

test('the allowlist stays small and every entry says why', () => {
  assert.ok(ALLOW.length <= 8, 'a short list: ' + ALLOW.length);
  for (const a of ALLOW) assert.ok(a.length === 4 && a[3].length > 20, JSON.stringify(a));
});
