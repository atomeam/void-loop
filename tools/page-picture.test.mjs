// A picture for a Wikipedia answer whose summary has none (lib/page-picture.js). Run: node --test tools/page-picture.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { pictureUrls, pickPicture, pictureFor } from '../void-live-deploy/lib/page-picture.js';

const U = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/';
test('the page image comes first; otherwise the first real photo in the article (the K-pop card had none, 2026-10-17)', async () => {
  const urls = pictureUrls('K-pop'); assert.equal(urls.length, 2); assert.match(urls[0], /prop=pageimages.*titles=K-pop|titles=K-pop.*prop=pageimages/); assert.match(urls[1], /generator=images/);
  assert.equal(pickPicture({ query: { pages: [{ title: 'K-pop', pageimage: 'BTS.jpg', thumbnail: { source: U + 'BTS.jpg/640px-BTS.jpg' } }] } }), U + 'BTS.jpg/640px-BTS.jpg');
  const images = { query: { pages: [
    { title: 'File:K-pop logo.png', imageinfo: [{ mime: 'image/png', width: 800, thumburl: U + 'logo.png' }] },
    { title: 'File:Flag of South Korea.svg', imageinfo: [{ mime: 'image/svg+xml', width: 900, thumburl: U + 'flag.png' }] },
    { title: 'File:Tiny.jpg', imageinfo: [{ mime: 'image/jpeg', width: 120, thumburl: U + 'tiny.jpg' }] },
    { title: 'File:Concert in Seoul.jpg', imageinfo: [{ mime: 'image/jpeg', width: 2000, thumburl: U + 'concert.jpg' }] },
    { title: 'File:Evil.jpg', imageinfo: [{ mime: 'image/jpeg', width: 2000, thumburl: 'https://evil.example/x.jpg' }] }] } };
  assert.equal(pickPicture(images), U + 'concert.jpg', 'not a logo, a flag, a tiny picture, or one off Wikimedia');
  assert.equal(pickPicture(null), ''); assert.equal(pickPicture({ query: { pages: [{ title: 'K-pop' }] } }), '');
  const asked = []; const got = await pictureFor('K-pop', async (u) => { asked.push(u); return asked.length === 1 ? { query: { pages: [{ title: 'K-pop' }] } } : images; });
  assert.equal(got, U + 'concert.jpg'); assert.equal(asked.length, 2);
  assert.equal(await pictureFor('x', async () => { throw new Error('offline'); }), '');
});
