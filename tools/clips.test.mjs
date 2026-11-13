import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clipQuery, archiveSearch } from '../void-live-deploy/lib/clips.js';
import { hitsOf } from '../void-live-deploy/lib/video.js';
import { onRequestGet } from '../void-live-deploy/functions/clips/index.js';

test('a title is a short line of words', () => {
  assert.equal(clipQuery('  Apollo 11 ').text, 'Apollo 11');
  assert.equal(clipQuery('').reason, 'empty');
  assert.equal(clipQuery('x'.repeat(81)).reason, 'long');
  assert.equal(clipQuery('https://example.com').ok, false);
});

test('archive hits keep a safe id and a title', () => {
  const hits = hitsOf('archive', { response: { docs: [{ identifier: 'Apollo11', title: 'Apollo 11', creator: 'NASA' }, { identifier: '../nope', title: 'no' }] } });
  assert.deepEqual(hits, [{ platform: 'archive', id: 'Apollo11', title: 'Apollo 11', channel: 'NASA', seconds: null, thumb: 'https://archive.org/services/img/Apollo11' }]);
  assert.match(archiveSearch('Apollo 11'), /mediatype%3Amovies/);
});

test('a query fills the page when scripts are off', async () => {
  const html = readFileSync(new URL('../void-live-deploy/clips/index.html', import.meta.url), 'utf8');
  const real = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ response: { docs: [{ identifier: 'Apollo11', title: 'Apollo 11', creator: 'NASA' }] } }));
  try {
    const res = await onRequestGet({
      request: new Request('https://a-to-mind.com/clips/?q=Apollo%2011'),
      next: async () => new Response(html),
    });
    const body = await res.text();
    assert.match(body, /src="https:\/\/archive.org\/embed\/Apollo11"/);
    assert.match(body, /Apollo 11/);
    assert.match(body, /value="Apollo 11"/);
  } finally {
    globalThis.fetch = real;
  }
});
