// photo-tools (skills/photo-tools.js): which asks open the photo tools card (lib/photo-ask.js photoAsk, plus edit/lighting asks), which tab or lane page
// each opens (photoHref), and the card: heading, the escaped link, the on-device line. Sized asks and "strip the exif" belong to other skills.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sk from '../void-live-deploy/skills/photo-tools.js';
import { photoAsk, photoHref } from '../void-live-deploy/lib/photo-ask.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const m = (t) => sk.match(t.toLowerCase(), t);
const card = (ask) => { const el = { innerHTML: '', dataset: {} }; assert.equal(sk.run(ask, { showPage: (f) => f(el), esc }), 'photo-tools'); return el; };
const href = (ask) => /<a class="pt-open" href="([^"]*)"/.exec(card(ask).innerHTML)[1];

test('examples in, near misses out, and the asks the parser names', () => {
  for (const e of sk.examples) assert.ok(m(e), e);
  for (const n of sk.nearMisses) assert.ok(!m(n), n);
  for (const a of ['photopea', 'compress my photos', 'convert png to jpg', 'jpg to webp converter', 'image compressor', 'crop this picture', 'rotate an image', 'add text to a photo', 'annotate a screenshot', 'photo cropper', 'exif viewer', 'show the gps of my photo', 'fix lighting', 'filter my selfie', 'Please compress an image.']) assert.ok(m(a), a);
  for (const a of ['compress a photo to pdf', 'what is a photo', 'resize my photo to 1080 px', 'remove the gps from my photo', 'crop rotation', 'take a photo']) assert.ok(!m(a), a);
});
test('"edit" is a word, not a substring: credit and edited are not edit asks', () => {
  for (const a of ['credit card photo', 'my credit score image', 'who edited this image', 'credit photo lighting']) assert.ok(!m(a), a);
  for (const a of ['edit a photo', 'editing a photo', 'image editing', 'photo editor', 'edit lighting on this photo', 'Edit my image']) assert.ok(m(a), a);
});
test('which tab or page each ask opens', () => {
  assert.deepEqual(photoAsk('crop a photo'), { slug: '', tab: 'crop' }); assert.equal(photoHref({ slug: '', tab: 'crop' }), '/photos/?tab=crop');
  const want = { 'crop a photo': '/photos/?tab=crop', 'view the exif of a photo': '/photos/exif/?tab=info', squoosh: '/photos/squoosh/', tinypng: '/photos/tinypng/', 'tiny png': '/photos/tinypng/', 'convert png to webp': '/photos/', 'compress an image': '/photos/',
    'add text to a photo': '/photos/?tab=text', 'filter my selfie': '/photos/?tab=fil', 'annotate a screenshot': '/photos/?tab=draw', 'photo cropper': '/photos/?tab=crop', 'image compressor': '/photos/?tab=out', 'brighten my photo': '/photos/?tab=adj' };
  for (const [a, h] of Object.entries(want)) assert.equal(href(a), h, a);
  assert.equal(photoAsk('compress my image to 100kb'), null); assert.equal(photoAsk('strip the exif from a photo'), null);
  assert.equal(href('edit lighting on this photo'), '/photos/'); // taken by the edit words, opened on the plain page
});
test('the card: heading, the tools it names, the on-device line, its kind', () => {
  const el = card('photo editor');
  assert.equal(el.dataset.cardKind, 'Photo tools');
  assert.match(el.innerHTML, /^<h2>Photo tools<\/h2>/);
  assert.match(el.innerHTML, /Compress and convert a photo \(JPEG, PNG, WebP, AVIF\)/);
  assert.match(el.innerHTML, />Open the photo tools<\/a>/);
  assert.match(el.innerHTML, /the picture is never uploaded, and the page opens offline/);
});
