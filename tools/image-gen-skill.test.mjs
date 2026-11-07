// The stage's picture generator (skills/image-gen.js): which asks it takes, the style it reads from the words, the seed the words give,
// the /image/ link, and the card: one POST /api/image with the words, the picture in the card, and the route's own words when it paints
// none. The draw, cartoon and image skills keep their own asks. A fake fetch stands in for the route; nothing leaves the machine.
// Run: node --test tools/image-gen-skill.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import gen, { pictureAsk, styleFrom, seedOf, pageOf, outcomeOf } from '../void-live-deploy/skills/image-gen.js';
import draw from '../void-live-deploy/skills/draw.js';
import cartoon from '../void-live-deploy/skills/cartoon.js';
import image from '../void-live-deploy/skills/image.js';
import make from '../void-live-deploy/skills/make.js';

const takes = (s, t) => !!s.match(t.toLowerCase(), t);

test('a made picture is read from the ask: its words and its style', () => {
  const cases = {
    'generate a picture of a lighthouse at night': ['a lighthouse at night', 'none'],
    'Generate an image of a red car': ['a red car', 'none'],
    'make an image of a sunset over the sea': ['a sunset over the sea', 'none'],
    'create a watercolour painting of a fox': ['a fox', 'watercolor'],
    'create an image of a castle': ['a castle', 'none'],
    'can you generate a pixel art picture of a dragon?': ['a dragon', 'pixel'],
    'render an image of a 3d robot': ['a 3d robot', '3d'],
    'generate a realistic photo of a mountain lake': ['a mountain lake', 'photo'],
    'ai art of a castle': ['a castle', 'none'],
    'AI image of a fox in the snow': ['a fox in the snow', 'none'],
    'paint an oil painting of a harbour': ['a harbour', 'painting'],
    'sketch a house': ['a house', 'sketch'],
    'sketch me an old oak tree please': ['an old oak tree', 'sketch'],
    'generate a drawing of a horse': ['a horse', 'none'],
  };
  for (const [ask, [words, style]] of Object.entries(cases)) assert.deepEqual(pictureAsk(ask), { words, style }, ask);
});

test('what is not a picture to make is left alone', () => {
  for (const t of ['make a picture of a dog', 'create a picture of a mountain', 'paint a picture of a lake', 'picture of a cat', 'draw a cat', 'draw a red circle',
    'sketch a red circle', 'sketch a circle', 'sketch pad', 'sketch a plan for the week', 'make an image board', 'generate a password', 'image', 'make an image',
    'generate an image of it', 'what is an image of a function', 'show this image https://example.org/cat.png', 'make the picture bigger', 'generate an image of me', ''])
    assert.equal(pictureAsk(t), null, t);
});

test('the style comes from the words; none named is none', () => {
  assert.equal(styleFrom('a watercolor of a cat'), 'watercolor'); assert.equal(styleFrom('8-bit castle'), 'pixel'); assert.equal(styleFrom('a neon city'), 'neon');
  assert.equal(styleFrom('a low poly fox'), 'lowpoly'); assert.equal(styleFrom('a pencil drawing'), 'sketch'); assert.equal(styleFrom('a cat on a mat'), 'none');
});

test('the same words give the same seed, and the link fills in the page', () => {
  const a = seedOf('a red car', 'none');
  assert.equal(a, seedOf('A Red Car', 'none')); assert.notEqual(a, seedOf('a red car', 'photo')); assert.notEqual(a, seedOf('a blue car', 'none'));
  assert.ok(Number.isInteger(a) && a >= 0 && a < 1e9);
  assert.equal(pageOf({ words: "a fox's den (at night)", style: 'sketch' }, 7), '/image/?prompt=a%20fox%27s%20den%20%28at%20night%29&style=sketch&seed=7');
  assert.equal(pageOf({ words: 'a cat', style: 'none' }, 1), '/image/?prompt=a%20cat&seed=1');
});

test('the route\'s answer: a picture only when it is one, otherwise its own words', () => {
  assert.deepEqual(outcomeOf({ state: 'art', img: 'data:image/jpeg;base64,QUJD' }), { img: 'data:image/jpeg;base64,QUJD' });
  assert.equal(outcomeOf({ state: 'art', img: 'javascript:alert(1)' }).img, undefined);
  assert.equal(outcomeOf({ state: 'art', img: 'data:image/svg+xml;base64,QUJD' }).img, undefined);
  assert.deepEqual(outcomeOf({ state: 'resting', say: 'The painter is resting: pictures are off for now.' }), { say: 'The painter is resting: pictures are off for now.' });
  assert.match(outcomeOf(null).say, /did not answer just now/);
});

test('the draw, cartoon, image and make skills keep their asks, and this one takes none of theirs', () => {
  for (const t of gen.examples) {
    assert.ok(takes(gen, t), t);
    for (const s of [draw, cartoon, image, make]) assert.ok(!takes(s, t), s.name + ' took ' + t);
  }
  for (const t of gen.nearMisses) assert.ok(!takes(gen, t), t);
  for (const s of [draw, cartoon, image]) for (const t of s.examples) assert.ok(!takes(gen, t), 'image-gen took ' + s.name + "'s " + t);
});

function fakeApi() {
  const slot = { innerHTML: '' }, page = { dataset: {}, innerHTML: '', querySelector: (sel) => (sel === '.ig-slot' ? slot : null) };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  return { page, slot, api: { esc, showPage: (fn) => { fn(page); return page; } } };
}
const settle = () => new Promise((r) => setTimeout(r, 20));

test('the card paints one picture with the words, the style and the seed, and links to the page', async (t) => {
  const calls = [], real = globalThis.fetch;
  globalThis.fetch = async (url, o) => { calls.push({ url, o }); return new Response(JSON.stringify({ state: 'art', img: 'data:image/jpeg;base64,QUJD', seed: 1 })); };
  t.after(() => { globalThis.fetch = real; });
  const { page, slot, api } = fakeApi();
  assert.equal(gen.run('sketch a <b>house</b>', api), 'image-gen');
  assert.match(page.innerHTML, /<h2>A picture of a &lt;b&gt;house&lt;\/b&gt;<\/h2>/); assert.doesNotMatch(page.innerHTML, /<b>house/);
  assert.match(page.innerHTML, /Painting it as pencil sketch/);
  const seed = seedOf('a <b>house</b>', 'sketch');
  assert.equal(page.dataset.page, '/image/?prompt=a%20%3Cb%3Ehouse%3C%2Fb%3E&style=sketch&seed=' + seed);
  await settle();
  assert.equal(calls.length, 1); assert.equal(calls[0].url, '/api/image'); assert.equal(calls[0].o.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].o.body), { prompt: 'a <b>house</b>', style: 'sketch', shape: 'square', seed });
  assert.match(slot.innerHTML, /^<img class="ig-pic" src="data:image\/jpeg;base64,QUJD" alt="a &lt;b&gt;house&lt;\/b&gt;"/);
});

test('when no picture comes, the card says why in the route\'s words, or that the painter did not answer', async (t) => {
  const real = globalThis.fetch; t.after(() => { globalThis.fetch = real; });
  globalThis.fetch = async () => new Response(JSON.stringify({ state: 'resting', why: 'mine', say: 'That is enough pictures for today <3' }));
  let f = fakeApi(); gen.run('generate a picture of a dog', f.api); await settle();
  assert.equal(f.slot.innerHTML, '<p class="sub">That is enough pictures for today &lt;3</p>');
  globalThis.fetch = async () => { throw new Error('offline'); };
  f = fakeApi(); gen.run('generate a picture of a dog', f.api); await settle();
  assert.match(f.slot.innerHTML, /The painter did not answer just now/);
  assert.equal(gen.run('make a picture of a dog', fakeApi().api), 'none');
});
