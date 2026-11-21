// lib/image-safety.js: no photo on any card, share, OG image or API answer about nudity, sex, the explicit body or minors in such a context
// (2026-11-20: "nude beach" showed a photo of children). Text-only: no image is fetched or drawn. Run: node --test tools/image-safety.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { unsafeText, unsafeImage, scrubCard, cardUnsafe, adultAllowed, minorBlocked, fileNameOf } from '../void-live-deploy/lib/image-safety.js';
import { refusal } from '../void-live-deploy/lib/art-rules.js';
import { findPicturesDetailed } from '../void-live-deploy/lib/free-pics.js';

const BLOCKED = ['nude beach', 'Nude beach', 'naturism', 'naturist resort', 'nudity', 'nudist camp', 'naked', 'topless', 'breast', 'boobs', 'titties', 'tits', 'porn', 'pornography', 'sex',
  'sexual intercourse', 'erotica', 'genitals', 'penis', 'vagina', 'nipple', 'dick', 'clothing-optional', 'skinny dipping', 'strip club', 'lingerie', 'bikini', 'onlyfans', 'hentai', 'adult film',
  'public bath', 'sauna', 'children at a beach', 'kids swimming', 'girls in swimsuits', 'teen model', 'baby bath', 'underage', 'lolicon'];
const SAFE = ['The Matrix', 'Slipknot', 'Mushroomhead', 'Michael Pfaff', 'Paris', 'cat', 'Essex', 'Sussex', '311', '42', 'easter egg', 'Lakeland, Florida', 'Eiffel Tower', 'Tortilla'];

test('every sensitive ask is refused a photo, in any casing', () => {
  for (const q of BLOCKED) assert.ok(unsafeText(q), q);
  for (const q of BLOCKED) assert.ok(unsafeText(q.toUpperCase()), q.toUpperCase());
});
test('ordinary asks keep their photos', () => { for (const q of SAFE) assert.equal(unsafeText(q), '', q); });
test('minors in a nude, partly clothed or bathing context are blocked with no override', () => {
  assert.ok(minorBlocked(unsafeText('children on the beach')));
  assert.ok(minorBlocked(unsafeText('preteen')));
  assert.equal(adultAllowed({ surface: 'card', ageVerified: true, optedIn: true }), false);
  assert.equal(adultAllowed({ surface: 'board', ageVerified: true, optedIn: false }), false);
  assert.equal(adultAllowed({ surface: 'board', ageVerified: false, optedIn: true }), false);
  assert.equal(adultAllowed({ surface: 'board', ageVerified: true, optedIn: true }), true);
});
test('a picture is judged by its own file name, alt and categories, and by the card it sits on', () => {
  const thumb = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Some_Naturist_Place.jpg/320px-Some_Naturist_Place.jpg';
  assert.equal(fileNameOf(thumb), 'Some_Naturist_Place.jpg');
  assert.ok(unsafeImage({ url: thumb }));
  assert.ok(unsafeImage({ url: 'https://upload.wikimedia.org/x/Beach.jpg', categories: ['Category:Nudity in Europe'] }));
  assert.ok(unsafeImage({ url: 'https://upload.wikimedia.org/x/Beach.jpg', context: ['nude beach'] }));
  assert.equal(unsafeImage({ url: 'https://upload.wikimedia.org/x/Eiffel_Tower.jpg', title: 'Eiffel Tower' }), '');
  assert.ok(unsafeImage({ url: 'http://example.com/a.jpg' }));
});

// a tiny DOM stand-in: only what scrubCard and cardUnsafe read
function fakeCard(title, imgs) {
  const kids = imgs.map((src) => ({ src, getAttribute: (k) => (k === 'src' ? src : null), removeAttribute() {}, remove() { kids.splice(kids.indexOf(this), 1); }, srcset: '' }));
  return { dataset: {}, textContent: title + ' lorem', kids, querySelector: (s) => (s === 'h2' ? { textContent: title } : null), querySelectorAll: (s) => (s === 'img' ? [...kids] : []) };
}
test('an unsafe card loses every photo and stays marked; a safe one keeps it', () => {
  const bad = fakeCard('Nude beach', ['https://upload.wikimedia.org/a/b/X.jpg', 'https://example.org/y.png']);
  assert.ok(cardUnsafe(bad, 'nude beach'));
  scrubCard(bad);
  assert.equal(bad.kids.length, 0);
  assert.equal(bad.dataset.imgSafe, 'blocked');
  const ok = fakeCard('The Matrix', ['https://upload.wikimedia.org/a/b/Matrix.jpg']);
  assert.equal(cardUnsafe(ok, 'the matrix'), false);
});
test('the Art Forge paints nothing for these subjects, and the photo sources are never asked', async () => {
  for (const q of ['nude beach', 'naturism', 'boobs', 'titties']) assert.ok(refusal(q), q);
  let asked = 0;
  const r = await findPicturesDetailed('nude beach', { kind: 'place', fetch: async () => { asked++; throw new Error('no'); }, cache: null, env: {} });
  assert.equal(r.pics.length, 0); assert.equal(asked, 0);
});
test('every render path reads the gate: the page, the frame, the forge, the answer API', () => {
  const page = readFileSync(new URL('../void-live-deploy/index.html', import.meta.url), 'utf8');
  for (const f of ['../void.html', '../void-live-deploy/void.html']) assert.equal(readFileSync(new URL(f, import.meta.url), 'utf8'), page, f);
  assert.match(page, /safeWatch\(el\)/); assert.match(page, /img-hold/); assert.match(page, /IS\.unsafeImage\(/);
  assert.match(readFileSync(new URL('../void-live-deploy/lib/card-frame.js', import.meta.url), 'utf8'), /cardUnsafe\(el/);
  assert.match(readFileSync(new URL('../void-live-deploy/lib/card-forge.js', import.meta.url), 'utf8'), /imgSafe === 'blocked'/);
  assert.match(readFileSync(new URL('../void-live-deploy/functions/api/answer.js', import.meta.url), 'utf8'), /!unsafeText\(ask, lead\.name/);
});

// the other picture doors (owner, 2026-11-20): the painter, the media answers and a generator's share card read the same gate
test('the painter never paints minors in such a context; media answers drop their pictures; a sensitive generator shares the plain card', async () => {
  const { refusalOf } = await import('../void-live-deploy/lib/image-gen.js');
  assert.equal(refusalOf('children at the nude beach'), 'unsuitable');
  assert.equal(refusalOf('a lighthouse at dawn'), '');
  const { safePictures } = await import('../void-live-deploy/functions/api/media.js');
  const bad = safePictures({ verified: true, title: 'Naked', poster: 'https://static.tvmaze.com/x.jpg', image: 'https://x/y.jpg' }, ['naked']);
  assert.equal(bad.poster, undefined); assert.equal(bad.image, undefined); assert.match(bad.pictures, /hidden/);
  const ok = safePictures({ verified: true, title: 'The Matrix', poster: 'https://static.tvmaze.com/m.jpg' }, ['the matrix']);
  assert.equal(ok.poster, 'https://static.tvmaze.com/m.jpg');
  const { withCard } = await import('../void-live-deploy/functions/gen/[id].js');
  const html = '<meta property="og:image" content="x">';
  assert.match(withCard(html, { id: 'abcdefgh', title: 'Nude pics', description: 'd', image: 'k1' }), /og\.png/);
  assert.match(withCard(html, { id: 'abcdefgh', title: 'Cat names', description: 'd', image: 'k1' }), /api\/gallery\?img=k1/);
});
