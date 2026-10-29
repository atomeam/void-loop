// lib/password.js: the password generator behind /password/ (the tower's passwordsgenerator.net floor)
import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES, SIMILAR, AMBIGUOUS, WORDS, normalize, alphabetOf, problemOf, below, spaceOf, bitsOf, generate, generateMany, passphrase, phraseBits, crackTime, strengthOf, sayable, MAX_COUNT } from '../void-live-deploy/lib/password.js';

const has = (s, cls) => [...s].some((c) => CLASSES[cls].includes(c));
test('a password is as long as asked, from the classes asked, with one of each by default', () => {
  for (const L of [4, 8, 16, 64, 128]) { const p = generate({ length: L }); assert.equal(p.length, L); for (const k of Object.keys(CLASSES)) assert.ok(has(p, k), L + ': ' + k + ' in ' + p); }
  for (let i = 0; i < 50; i++) { const p = generate({ length: 10, symbols: false, upper: false }); assert.match(p, /^[a-z0-9]{10}$/); assert.ok(has(p, 'lower') && has(p, 'digits')); }
  assert.equal(normalize({ length: 1 }).length, 4); assert.equal(normalize({ length: 999 }).length, 128); assert.equal(normalize({ upper: false, lower: false, digits: false, symbols: false }).lower, true, 'nothing chosen falls back to lowercase');
});
test('the exclusions: look-alikes, ambiguous punctuation, repeats, three in a row', () => {
  for (let i = 0; i < 40; i++) {
    const p = generate({ length: 32, similar: true, ambiguous: true, noRepeat: true, noSequential: true });
    for (const c of p) { assert.ok(!SIMILAR.includes(c), 'similar ' + c); assert.ok(!AMBIGUOUS.includes(c), 'ambiguous ' + c); }
    assert.equal(new Set(p).size, p.length, 'no repeats in ' + p);
    for (let j = 2; j < p.length; j++) { const d = p.charCodeAt(j - 1) - p.charCodeAt(j - 2); assert.ok(!((d === 1 || d === -1) && p.charCodeAt(j) - p.charCodeAt(j - 1) === d), 'three in a row in ' + p); }
  }
  assert.equal(alphabetOf({ similar: true }).all.includes('l'), false); assert.equal(alphabetOf({}).all.length, 26 + 26 + 10 + 32);
  // a setting that can make nothing says why instead of looping
  assert.match(problemOf({ length: 20, noRepeat: true, upper: false, lower: false, symbols: false }), /Only 10 different characters/);
  assert.match(problemOf({ length: 9, noRepeat: true, digits: true, similar: true, upper: false, lower: false, symbols: false }), /Only 8 different characters/, '0 and 1 excluded as look-alikes');
  assert.equal(problemOf({ length: 16 }), ''); assert.throws(() => generate({ length: 20, noRepeat: true, upper: false, lower: false, symbols: false }), /Only 10/);
});
test('the entropy is log2 of the exact count: inclusion-exclusion for one of each, falling factorials for no repeats', () => {
  assert.equal(spaceOf({ length: 4, each: false }), 94n ** 4n); assert.equal(bitsOf({ length: 16, each: false }), Math.round(16 * Math.log2(94) * 10) / 10);
  // 4 characters, one of each class: 4! × 26 × 26 × 10 × 32 orderings of one from each
  assert.equal(spaceOf({ length: 4 }), 24n * 26n * 26n * 10n * 32n);
  assert.equal(spaceOf({ length: 4, noRepeat: true, each: false, upper: false, lower: false, symbols: false }), 10n * 9n * 8n * 7n);
  const fall = (n, k) => { let p = 1n; for (let i = 0; i < k; i++) p *= BigInt(n - i); return p; };
  assert.equal(spaceOf({ length: 4, noRepeat: true, upper: false, symbols: false }), fall(36, 4) - fall(26, 4) - fall(10, 4), 'four different characters with a lowercase and a digit among them');
  assert.ok(bitsOf({ length: 16 }) < bitsOf({ length: 16, each: false }), 'the rule costs a fraction of a bit'); assert.ok(bitsOf({ length: 16, each: false }) - bitsOf({ length: 16 }) < 0.5);
  assert.equal(bitsOf({ length: 20, noRepeat: true, upper: false, lower: false, symbols: false }), 0);
});
test('a thousand draws use every character and no draw leaves the alphabet; below() is unbiased by rejection', () => {
  const seen = new Set(); for (let i = 0; i < 200; i++) for (const c of generate({ length: 32, each: false })) seen.add(c);
  assert.equal(seen.size, 94);
  // a fake random source whose first 32-bit value sits past the last whole multiple of the range is thrown away, not folded in
  let calls = 0; const rnd = { getRandomValues: (b) => { b[0] = calls++ === 0 ? 4294967295 : 7; } };
  assert.equal(below(10, rnd), 7); assert.equal(calls, 2); assert.throws(() => below(0));
  const fixed = (n) => 0; assert.equal(generate({ length: 6, each: false, lower: false, digits: false, symbols: false }, fixed), 'AAAAAA');
  assert.equal(generateMany({ length: 8 }, 5).length, 5); assert.equal(generateMany({}, 99).length, MAX_COUNT); assert.equal(generateMany({}, 0).length, 1);
});
test('passphrases: words from the list, the separator, capitals, a digit, and their bits', () => {
  assert.ok(WORDS.length >= 500); assert.equal(new Set(WORDS).size, WORDS.length, 'no word twice'); for (const w of WORDS) assert.match(w, /^[a-z]{3,7}$/);
  const p = passphrase({ words: 5, sep: '-' }); const ws = p.split('-'); assert.equal(ws.length, 5); for (const w of ws) assert.ok(WORDS.includes(w), w);
  assert.match(passphrase({ words: 3, sep: ' ', capitalize: true, digit: true }), /^[A-Z][a-z]+ [A-Z][a-z]+ [A-Z][a-z]+\d$/);
  assert.equal(passphrase({ words: 3, sep: '' }, () => 0), WORDS[0].repeat(3));
  assert.equal(phraseBits({ words: 4 }), Math.round(4 * Math.log2(WORDS.length) * 10) / 10); assert.equal(Math.round((phraseBits({ words: 4, digit: true }) - phraseBits({ words: 4 })) * 10) / 10, 3.3);
  assert.equal(passphrase({ words: 99 }).split('-').length, 10); assert.equal(passphrase({ words: 1 }).split('-').length, 3);
});
test('crack time in plain words at ten billion guesses a second, and a label', () => {
  assert.equal(crackTime(20).text, 'less than a second'); assert.equal(crackTime(40).text, '1.8 minutes'); assert.equal(crackTime(50).text, '1.3 days');
  assert.equal(crackTime(60).text, '3.7 years'); assert.equal(crackTime(68).text, '9.4 centuries'); assert.match(crackTime(104.6).text, /^\d+ trillion years$/); assert.match(crackTime(200).text, /age of the universe/);
  assert.equal(strengthOf(20).label, 'Very weak'); assert.equal(strengthOf(30).label, 'Weak'); assert.equal(strengthOf(50).label, 'Fair'); assert.equal(strengthOf(70).label, 'Strong'); assert.equal(strengthOf(104.6).label, 'Very strong');
  assert.equal(strengthOf(104.6).score, 4);
});
test('remember me: one word a character', () => {
  assert.equal(sayable('Zb9#'), 'Zulu bravo NINE HASH'); assert.equal(sayable('a-Z'), 'alfa HYPHEN Zulu'); assert.equal(sayable(''), '');
});
