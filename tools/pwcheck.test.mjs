// lib/pwcheck.js: how long a password takes to guess, and the leak check that sends 5 characters. Run: node --test tools/pwcheck.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { check, guessesFor, pieceOf, timeWords, leakCount, LABELS } from '../void-live-deploy/lib/pwcheck.js';

test('the well-known weak passwords are weak and instant, and say why', () => {
  for (const pw of ['password', '123456', 'qwerty', 'letmein', 'iloveyou', 'abc123']) { const r = check(pw); assert.ok(r.score <= 1, pw + ' ' + r.label); assert.equal(r.offline, 'instantly', pw); assert.ok(r.reasons.length, pw); }
  assert.match(check('password').reasons[0], /Contains "password"/);
  assert.match(check('P@ssw0rd').reasons.join(), /look-alike symbols/); assert.ok(check('P@ssw0rd').score <= 1);
  assert.match(check('zxcvbnm').reasons.join(), /follows the keys/);
  assert.match(check('aaaaaaaa').reasons.join(), /same character repeated/); assert.match(check('Summer2024').reasons.join(), /Contains "Summer"/);
});
test('length and mixing raise the time, and ordinary words strung together are priced as words, not as random letters', () => {
  const short = check('Xk9$fT'), long = check('Xk9$fTq2#Lm7@Vz4'); assert.ok(long.guesses > short.guesses * 1e10);
  const phrase = check('correct horse battery staple'); assert.ok(phrase.pieces.filter((p) => p.kind === 'word').length >= 4, JSON.stringify(phrase.pieces.map((p) => p.kind)));
  assert.ok(phrase.guesses < 1e24 && phrase.guesses > 1e17, 'about four words from a 30,000 dictionary: ' + phrase.guesses);
  assert.ok(check('xkqjzpwrvb').guesses > 1e12, 'random consonants are not a word');
  assert.ok(check('Tr0ub4dor&3').score >= 2); assert.ok(check('Xk9$fT').score <= 1, 'six random characters fall in seconds to an offline rig'); assert.equal(check('Xk9$fT').offline, '36 seconds'.replace('36', String(Math.round(check('Xk9$fT').guesses / 2 / 1e10))));
});
const phrase4 = () => check('correct horse battery staple').score >= 3;
test('the answer shape: score and label, two speeds, tips that fit, and nothing for an empty password', () => {
  const r = check('hello1234'); assert.ok(r.score >= 0 && r.score <= 4 && r.label === LABELS[r.score]); assert.match(r.online, /./); assert.ok(r.tips.length);
  assert.ok(check('Xk9$fTq2#Lm7@Vz4Bn5!').score === 4); assert.ok(phrase4(), 'four words with spaces are Very strong against the rig'); assert.deepEqual(check(''), { length: 0, guesses: 1, score: 0, label: '', online: '', offline: '', pieces: [], reasons: [], tips: [] });
  assert.equal(check('a'.repeat(500)).length, 128, 'a very long input is cut at 128 characters');
});
test('time phrases are plain', () => {
  assert.equal(timeWords(0.2), 'instantly'); assert.equal(timeWords(1), '1 second'); assert.equal(timeWords(90), '2 minutes'); assert.equal(timeWords(3 * 3600), '3 hours');
  assert.equal(timeWords(400 * 31557600), '400 years'); assert.equal(timeWords(5e3 * 31557600), '5 thousand years'); assert.equal(timeWords(2e6 * 31557600), '2 million years'); assert.equal(timeWords(1e30), 'more than a trillion years');
});
test('the pieces multiply: a common word plus a year costs about their product (times the order)', () => {
  const g = guessesFor('password2024'); assert.deepEqual(g.pieces.map((p) => p.kind), ['common', 'year']); assert.ok(g.guesses < 1e5);
  assert.equal(pieceOf('x'), null);
});
test('the leak check sends only the first 5 characters of the SHA-1 and finds the password in the answer', async () => {
  const subtle = globalThis.crypto.subtle, sha = async (t) => [...new Uint8Array(await subtle.digest('SHA-1', new TextEncoder().encode(t)))].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  const h = await sha('password'), asked = [];
  const get = async (url) => { asked.push(url); return { ok: true, text: async () => 'ABCDEF0123456789ABCDEF0123456789ABC:3\r\n' + h.slice(5) + ':10434004\r\n0000000000000000000000000000000000A:0' }; };
  assert.equal(await leakCount('password', get), 10434004); assert.equal(asked.length, 1); assert.equal(asked[0], 'https://api.pwnedpasswords.com/range/' + h.slice(0, 5)); assert.ok(!asked[0].replace('pwnedpasswords', '').includes('password') && asked[0].length < 60, 'the password itself is never in the address');
  assert.equal(await leakCount('a-password-nobody-has-used', async () => ({ ok: true, text: async () => 'ABCDEF0123456789ABCDEF0123456789ABC:3' })), 0);
  assert.equal(await leakCount('x', async () => ({ ok: false })), null); assert.equal(await leakCount('x', async () => { throw new Error('offline'); }), null);
});
test('the skill takes the checker asks and a "is X a good password" ask (answered with a warning), and leaves the generator and the account asks alone', async () => {
  const { matches, carries } = await import('../void-live-deploy/skills/pwcheck.js');
  for (const a of ['how secure is my password', 'is my password strong?', 'check my password strength', 'test the strength of my password', 'how long would it take to crack my password', 'is Tr0ub4dor&3 a good password', 'is hunter2 a strong password']) assert.ok(matches(a), a);
  for (const a of ['generate a password', 'make me a password', 'forgot my password', 'reset my password', 'password manager', 'change my password', 'what is a good password manager', 'is it safe to use a password manager']) assert.ok(!matches(a), a);
  assert.ok(!carries('how secure is my password') && !carries('is my password strong?')); assert.ok(carries('is Tr0ub4dor&3 a good password') && carries('is hunter2 a strong password'));
});
