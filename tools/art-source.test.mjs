// node --test tools/art-source.test.mjs: the one rule for what a card's art slot shows (lib/art-source.js; owner, 2026-10-18)
import test from 'node:test';
import assert from 'node:assert/strict';
import { artSource } from '../void-live-deploy/lib/art-source.js';

test('artSource: a real picture is the art, and it beats a painting', () => {
  assert.equal(artSource({ photo: 'https://upload.wikimedia.org/x/poster.jpg' }), 'photo');
  assert.equal(artSource({ photo: 'https://upload.wikimedia.org/x/poster.jpg', painting: true }), 'photo', 'a painting never goes over a poster');
  assert.equal(artSource({ photo: 'data:image/jpeg;base64,/9j/4AAQ' }), 'photo', 'the saved card draws the page\'s picture as a data URL');
});
test('artSource: no real picture and a painting is there: the painting is the one picture', () => {
  assert.equal(artSource({ painting: 'data:image/png;base64,AAAA' }), 'painting');
  assert.equal(artSource({ photo: '', painting: true }), 'painting');
});
test('artSource: nothing else (a text-only reply, or a painting still being made): the seal, alone', () => {
  assert.equal(artSource({}), 'seal'); assert.equal(artSource(), 'seal'); assert.equal(artSource(null), 'seal');
  assert.equal(artSource({ painting: false, photo: '' }), 'seal');
});
test('artSource: only an https link or a drawn data image counts as a photo; a card with no art box has none', () => {
  for (const bad of ['http://x.example/a.png', 'javascript:alert(1)', 'data:image/svg+xml;base64,PHN2Zz4=', '/relative.png']) assert.equal(artSource({ photo: bad }), 'seal', bad);
  assert.equal(artSource({ photo: 'https://x.example/a.png', hasArt: false }), 'none');
});
