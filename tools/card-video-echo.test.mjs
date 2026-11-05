// Owner, 2026-11-03: moving a card with a video playing restarted the video, and the answer card pasted the whole input back under
// the answer. A redraw keeps the same <video> element playing; the answer card shows a collapsed one-line glimpse, never the paste.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(resolve(root, 'void-live-deploy/void.html'), 'utf8');
const grab = (name) => { const i = page.indexOf('    function ' + name + '('); assert.ok(i > 0, name); const j = page.indexOf('\n    }\n', i); return page.slice(i, j + 6); };

function fakeVideo(src, playing) {
  return { src, paused: !playing, ended: false, currentTime: 12.3, currentSrc: src, getAttribute: (k) => (k === 'src' ? src : null),
    replaced: null, closest() { return this.card; }, play() { this.paused = false; this.played = true; return Promise.resolve(); }, replaceWith(n) { this.replaced = n; } };
}

test('a redraw puts the same playing video element back and keeps it playing from the same spot', () => {
  const env = new Function('CSS', grab('keepVideosTake') + grab('keepVideosPut') + 'return { keepVideosTake, keepVideosPut };')({ escape: (s) => s });
  const old = fakeVideo('/v/a.mp4', true); old.card = { dataset: { id: 'c1' } };
  const rootBefore = { querySelectorAll: () => [old] };
  const vids = env.keepVideosTake(rootBefore);
  assert.equal(vids.length, 1); assert.equal(vids[0].playing, true);
  old.paused = true; // taken out of the page: the browser paused it
  const fresh = fakeVideo('/v/a.mp4', false); fresh.currentTime = 0;
  const card = { querySelectorAll: () => [fresh], contains: () => false };
  env.keepVideosPut({ querySelector: (q) => (q.includes('c1') ? card : null) }, vids);
  assert.equal(fresh.replaced, old, 'the redrawn video is swapped for the original element');
  assert.equal(old.played, true, 'it plays on'); assert.equal(old.currentTime, 12.3, 'from the same spot');
});

test('render() keeps videos across every redraw, and a drag does not redraw a card that is playing', () => {
  const r = grab('render');
  assert.match(r, /keepVideosTake\(stage\)[\s\S]*stage\.innerHTML = ''[\s\S]*keepVideosPut\(stage, vids\)/);
  assert.match(r, /parkNode\(el\)/); // out of the document, innerHTML would start the clip over
  const b = grab('bindDrag');
  assert.match(b, /if \(!media\) render\(\)/); // a card with a video is not rebuilt on touch
  assert.match(b, /holdsMedia/);
});

test('the answer card never echoes the whole input back', () => {
  const f = grab('pasteFold');
  assert.doesNotMatch(f, /esc\(details\)/, 'the full paste is not written into the card');
  assert.match(f, /<details class="vpaste"/, 'only a collapsed summary');
  assert.match(f, /clipLine\(/, 'with at most a one-line glimpse');
  assert.equal(readFileSync(resolve(root, 'void-live-deploy/index.html'), 'utf8'), page, 'index.html and void.html stay the same page');
});
