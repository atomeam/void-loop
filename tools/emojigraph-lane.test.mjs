// emojigraph.org is a lane on the emoji-combos floor (lib/self-sites.js, LANE_PAGES). Its page is the dictionary, the
// search stays on that page, and the page keeps a worker so it opens again with the network cut.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FLOORS, LANE_PAGES } from '../void-live-deploy/lib/tower.js';

test('emojigraph.org is a lane on the tower, and its page stays itself', () => {
  assert.equal(LANE_PAGES['emoji combos: emojigraph.org'], '/emoji-combos/emoji-dictionary/');
  const f = FLOORS.find((x) => x.id === 'emoji combos: emojigraph.org');
  assert.ok(f, 'the lane is on the tower');
  assert.equal(f.site, 'emojigraph.org');
  assert.equal(f.page, '/emoji-combos/emoji-dictionary/');
  assert.equal(f.lane, 'emoji combos');
  const sw = readFileSync(new URL('../void-live-deploy/sw.js', import.meta.url), 'utf8');
  assert.match(sw, /\/emoji-combos\/emoji-dictionary\//);
  const html = readFileSync(new URL('../void-live-deploy/emoji-combos/emoji-dictionary/index.html', import.meta.url), 'utf8');
  assert.match(html, /serviceWorker\.register\('\/sw\.js'\)/);
  assert.match(html, /linkOf\(\{ q, c: \$\('build'\)\.value \}, here\(\)\)/);
  assert.match(html, /<h1>Emoji combos to copy<\/h1>/);
});
