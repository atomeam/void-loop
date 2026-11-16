import test from 'node:test';
import assert from 'node:assert/strict';
import { namesRival, publicRivalHits, rivalLabels } from './rival-public.mjs';

test('a floor page that names or links its rival is refused, and the Tower is not', () => {
  assert.deepEqual(namesRival('<p class="original">The original: <a href="https://open.spotify.com/">spotify.com</a></p>', ['spotify.com']), ['spotify.com']);
  assert.deepEqual(namesRival('<p>A song preview.</p>', ['spotify.com']), []);
  assert.ok(rivalLabels({ rival: 'spotify.com', url: 'https://open.spotify.com/' }).includes('open.spotify.com'));
  assert.deepEqual(publicRivalHits(), []);
});
