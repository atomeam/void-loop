import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { songFields } from '../void-live-deploy/lib/songs.js';
import { pickTrack } from '../void-live-deploy/lib/hear.js';
import { onRequestGet } from '../void-live-deploy/functions/songs/index.js';

const preview = 'https://audio-ssl.itunes.apple.com/itunes-assets/Preview.m4a';

test('a song needs a title and who plays it', () => {
  assert.equal(songFields('  Yesterday ', ' The Beatles ').title, 'Yesterday');
  assert.equal(songFields('', 'The Beatles').reason, 'empty');
  assert.equal(songFields('https://example.com', 'The Beatles').ok, false);
});

test('a preview is kept only when the title and the player match', () => {
  const track = pickTrack([{ trackName: 'Yesterday', artistName: 'The Beatles', previewUrl: preview, collectionName: 'Help!' }, { trackName: 'Yesterday', artistName: 'Someone Else', previewUrl: 'https://evil.example/a.m4a' }], 'Yesterday', 'The Beatles');
  assert.equal(track.preview, preview);
  assert.equal(pickTrack([{ trackName: 'Yesterday', artistName: 'The Beatles', previewUrl: 'https://evil.example/a.m4a' }], 'Yesterday', 'The Beatles'), null);
});

test('a query fills the page when scripts are off', async () => {
  const html = readFileSync(new URL('../void-live-deploy/songs/index.html', import.meta.url), 'utf8');
  const real = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ results: [{ trackName: 'Yesterday', artistName: 'The Beatles', previewUrl: preview, collectionName: 'Help!' }] }));
  try {
    const res = await onRequestGet({
      request: new Request('https://a-to-mind.com/songs/?title=Yesterday&artist=The%20Beatles'),
      next: async () => new Response(html),
    });
    const body = await res.text();
    assert.match(body, /src="https:\/\/audio-ssl\.itunes\.apple\.com\/itunes-assets\/Preview\.m4a"/);
    assert.match(body, /<h2>Yesterday<\/h2>/);
    assert.match(body, /value="Yesterday"/);
    assert.match(body, /value="The Beatles"/);
  } finally {
    globalThis.fetch = real;
  }
});
