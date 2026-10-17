import test from 'node:test';
import assert from 'node:assert/strict';
import { dataOf, codeOf, shareText, parse, fileName, MARK } from '../void-live-deploy/lib/card-share.js';

const card = { t: "What's New Pussycat? ✦", k: 'FILM · SONG — 1965', b: 'A 1965 film.\n\nIt is also a song by Tom Jones.', src: [{ t: 'Wikipedia', u: 'https://en.wikipedia.org/wiki/What%27s_New_Pussycat%3F' }, { t: 'bad', u: 'javascript:alert(1)' }] };
test('copy text reads well and ends in one code line', () => {
  const t = shareText(card);
  assert.match(t, /^What's New Pussycat\?/); assert.match(t, /Sources:/); assert.match(t, /a-to-mind\.com/);
  assert.equal(t.trim().split('\n').pop().startsWith(MARK), true);
});
test('pasting the copied text, or only its code, gives the card back (unicode, newlines)', () => {
  const back = parse(shareText(card)), bare = parse(codeOf(card));
  for (const d of [back, bare]) { assert.equal(d.t, card.t); assert.equal(d.k, card.k); assert.equal(d.b, card.b); assert.equal(d.src.length, 2); assert.equal(d.src[1].u, ''); }
});
test('only https links survive and nothing else rides along', () => {
  assert.ok(parse(codeOf(card)).src.every((s) => s.u === '' || s.u.startsWith('https://')));
  assert.deepEqual(Object.keys(dataOf(card)).sort(), ['b', 'k', 'src', 't', 'v']);
  const evil = MARK + Buffer.from(JSON.stringify({ v: 1, t: '<img src=x onerror=1>', b: 'x', power: 99, src: [{ t: 'a', u: 'http://x.test' }] })).toString('base64url');
  const d = parse(evil); assert.equal(d.power, undefined); assert.equal(d.src[0].u, '');
});
test('junk is not a card', () => {
  assert.equal(parse('hello'), null); assert.equal(parse(MARK + 'not-json-at-all'), null); assert.equal(parse(MARK + Buffer.from('{"v":2,"t":"x"}').toString('base64url')), null); assert.equal(parse(''), null);
});
test('file names are safe', () => { assert.equal(fileName({ t: 'Black hole!' }), 'black-hole.v01d-card.txt'); assert.equal(fileName({ t: '' }), 'card.v01d-card.txt'); });

test('the code line is short; the whole copied text restores the full body, a bare code restores its start', () => {
  const body = 'My own words. '.repeat(160), d = { t: 'What I think of myself', k: 'Answer — from V01D', b: body, src: [{ title: 'a', url: 'https://a.example/x' }, { title: 'b', url: 'https://b.example/y' }, { title: 'c', url: 'https://c.example/z' }] };
  const text = shareText(d), code = codeOf(d);
  assert.ok(code.length < 700, 'the code is short: ' + code.length);
  const whole = parse(text); assert.equal(whole.t, d.t); assert.ok(whole.b.length > 2000, 'a paste of the whole text keeps the full body'); assert.equal(whole.src.length, 3);
  const bare = parse(code); assert.equal(bare.t, d.t); assert.ok(bare.b.length <= 200 && bare.b.length > 20); assert.ok(bare.src.length <= 2);
});
