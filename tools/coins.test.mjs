// Every coin (lib/coins.js): the asks, the Commons photo picked for each side, a made coin cleaned to what may be kept. Run: node --test tools/coins.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { coinAsk, pickPhoto, findCoin, cleanMine, sideUrl, FAMOUS } from '../void-live-deploy/lib/coins.js';

test('the asks: a real coin by name, the picker, the maker, your own; plain flips and other flips stay out', () => {
  assert.deepEqual(coinAsk('toss a Morgan dollar for dinner'), { kind: 'real', name: 'morgan dollar', for: 'dinner' });
  assert.equal(coinAsk('flip a Lydian stater').name, 'lydian stater');
  for (const [a, k] of [['flip a famous coin', 'pick'], ['create a coin', 'make'], ['make my own coin', 'make'], ['flip my coin', 'mine']]) assert.equal(coinAsk(a).kind, k, a);
  for (const a of ['flip a coin', 'flip a silver coin', 'flip a euro', 'flip 3 quarters', 'flip the card', 'flip a pancake', 'heads or tails']) assert.equal(coinAsk(a), null, a);
  assert.ok(FAMOUS.length >= 20);
});
test('the photo for each side: a JPEG or PNG, the one named for the side first; tails falls back to heads', async () => {
  const page = (i, title, mime = 'image/jpeg') => ({ index: i, title, imageinfo: [{ mime, thumburl: 'https://u/' + i, descriptionurl: 'https://c/' + i }] });
  const j = { query: { pages: { a: page(1, 'File:Morgan dollar 1881.jpg'), b: page(2, 'File:Morgan dollar reverse.jpg'), c: page(0, 'File:Morgan.svg', 'image/svg+xml') } } };
  assert.equal(pickPhoto(j, 'reverse').src, 'https://u/2'); assert.equal(pickPhoto(j, 'obverse').src, 'https://u/1'); assert.equal(pickPhoto({}, 'obverse'), null);
  const one = await findCoin('x', async (u) => (/obverse/.test(decodeURIComponent(u)) ? { query: { pages: { a: page(1, 'File:X obverse.jpg') } } } : {}));
  assert.equal(one.tails.src, one.heads.src); assert.equal(one.heads.half, null); assert.equal(one.tails.half, null, 'a narrow photo shows the same face twice');
  // one wide photo holds both faces side by side: heads is its left half, tails its right (the Lydian stater showed both faces squashed into one circle)
  const wide = (i, title) => ({ ...page(i, title), imageinfo: [{ mime: 'image/jpeg', thumburl: 'https://u/' + i, descriptionurl: 'https://c/' + i, width: 900, height: 400 }] });
  const two = await findCoin('x', async (u) => (/obverse/.test(decodeURIComponent(u)) ? { query: { pages: { a: wide(1, 'File:X obverse.jpg') } } } : {}));
  assert.equal(two.heads.half, 'left'); assert.equal(two.tails.half, 'right'); assert.equal(two.tails.src, two.heads.src);
  const own = await findCoin('x', async (u) => (/obverse/.test(decodeURIComponent(u)) ? { query: { pages: { a: wide(1, 'File:X obverse.jpg') } } } : { query: { pages: { b: page(2, 'File:X reverse.jpg') } } }));
  assert.equal(own.heads.half, 'left'); assert.equal(own.tails.half, null, 'its own narrow reverse photo is shown whole');
  assert.equal(await findCoin('x', async () => ({})), null);
  // nothing under obverse or reverse: the name alone finds it, heads and tails told apart by their file names
  const plain = await findCoin('maple', async (u) => (/obverse|reverse/.test(decodeURIComponent(u)) ? {} : { query: { pages: { a: page(1, 'File:Maple leaf 2014 front.jpg'), b: page(2, 'File:Maple leaf 2014 back.jpg') } } }));
  assert.equal(plain.heads.src, 'https://u/1'); assert.equal(plain.tails.src, 'https://u/2');
  assert.match(decodeURIComponent(sideUrl('Lydian stater', 'reverse')), /origin=\*.*Lydian stater reverse coin filetype:bitmap/);
});
test('a made coin keeps only what is safe: a known metal, short sides, no markup, photos only as small data URLs', () => {
  const m = cleanMine({ metal: 'plutonium', heads: '<img src=x>ABCDEFG', tails: '', rim: 'x'.repeat(80), hImg: 'javascript:alert(1)', tImg: 'data:image/jpeg;base64,AAAA' });
  assert.equal(m.metal, 'gold'); assert.equal(m.heads, 'img sr'); assert.equal(m.tails, 'T'); assert.equal(m.rim.length, 40); assert.equal(m.hImg, ''); assert.equal(m.tImg, 'data:image/jpeg;base64,AAAA');
});
