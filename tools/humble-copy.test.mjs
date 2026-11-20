// The banned-phrase check (tools/humble-copy.mjs): only "heavy lifting"; tone and boast words are not policed.
// Run: node --test tools/humble-copy.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scan, boastsIn, ALLOW } from './humble-copy.mjs';

test('the site copy has no banned phrase', () => {
  const hits = scan();
  assert.deepEqual(hits.map((h) => h.file + ':' + h.line + ' [' + h.id + '] ' + h.hit), []);
});

test('it catches the banned phrase', () => {
  for (const s of ["'we own the heavy lifting'", "'Verse owns the heavy lifting'", "'Heavy lifting, done'"]) assert.ok(boastsIn(s).length > 0, s);
});

test('boast and tone words are allowed: Verse may say what it did, how it compares, and that it is the best', () => {
  for (const s of ['"I\'ve surpassed 7 sites so far."', "'Verse has conquered calculator.net'", "'Verse outclassed it'", "'Verse is the best'",
    "'I made 3 new things while you were away'", "'an awe-inspiring Verse'", "'Verse beats every site'", "'Verse does the work'"]) assert.deepEqual(boastsIn(s), [], s);
});

test('a game rule, a data key, a path or a comment is not a boast', () => {
  for (const s of ["'Beat the level to unlock the next one'", "if (r.outcome === 'surpassed') k = 'surpassed';", "'<a href=\"/conquered/\">Versus</a>'",
    "// the next site to conquer, from the frontier", "/* the floors Verse has surpassed */", "<!-- conquered sites under it -->",
    "'You win! Four in a row'", "'the greatest common divisor'", "'1 can crushed tomatoes'", "'https://a-to-mind.com/conquered/'", "// package the heavy lifting"]) assert.deepEqual(boastsIn(s), [], s);
});

test('the allowlist stays small and every entry says why', () => {
  assert.ok(ALLOW.length <= 8, 'a short list: ' + ALLOW.length);
  for (const a of ALLOW) assert.ok(a.length === 4 && a[3].length > 20, JSON.stringify(a));
});
