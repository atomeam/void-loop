// emojigraph.org (an emoji encyclopedia) is a lane on the emoji-combos floor. Its page is /emojis/dictionary/, built for it by hand (asked by Verse,
// 2026-11-05: "Add emojigraph.org to LANE_PAGES in lib/tower.js and begin target assimilation"); the loop's copy of /emoji-combos/ stays where it was.
// The page keeps a worker so it opens again with the network cut, carries its view in the hash, and is on the shared hand-off row.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { FLOORS, LANE_PAGES } from '../void-live-deploy/lib/tower.js';
import { TARGET_SITES, SITE_PAGES } from '../void-live-deploy/lib/tool-sites.js';
import { RELATED } from '../void-live-deploy/lib/toolkit.js';
import { probeFor } from './tower-probes.mjs';

test('emojigraph.org is a lane on the tower, and its page is the emoji dictionary', () => {
  assert.equal(LANE_PAGES['emoji combos: emojigraph.org'], '/emojis/dictionary/');
  const f = FLOORS.find((x) => x.id === 'emoji combos: emojigraph.org');
  assert.ok(f, 'the lane is on the tower');
  assert.equal(f.site, 'emojigraph.org');
  assert.equal(f.page, '/emojis/dictionary/');
  assert.equal(f.lane, 'emoji combos');
  const pr = probeFor(f.id); assert.equal(pr.verse, '/emojis/dictionary/'); assert.equal(pr.ask.verse, '/emojis/dictionary/#e=%F0%9F%90%B1');
  assert.ok(TARGET_SITES.some((r) => r.lane === f.id && r.path === '/emojis/dictionary/') && SITE_PAGES.some((r) => r.path === '/emojis/dictionary/'), 'a lib/tool-sites.js row');
  assert.ok(existsSync(new URL('../void-live-deploy/emoji-combos/emoji-dictionary/index.html', import.meta.url)), 'the loop\'s copy stays (nothing is deleted)');
});
test('the dictionary page works offline, in deep space, from the hash, and hands off to the pages that take text', () => {
  const sw = readFileSync(new URL('../void-live-deploy/sw.js', import.meta.url), 'utf8');
  assert.match(sw, /'\/emojis\/dictionary\/'/);
  const html = readFileSync(new URL('../void-live-deploy/emojis/dictionary/index.html', import.meta.url), 'utf8');
  assert.match(html, /serviceWorker\.register\('\/sw\.js'\)/);
  assert.match(html, /<h1>Emoji dictionary<\/h1>/);
  assert.match(html, /color-scheme: dark/); assert.match(html, /--bg: #050505/); assert.match(html, /class="glass"/);
  assert.match(html, /stateFromHash\(location\.hash\)/); assert.match(html, /history\.replaceState\(null, '', location\.pathname \+ location\.search \+ h\)/);
  assert.match(html, /<meta name="verse-handoff" content="in: text; out: text">/);
  assert.match(html, /mountRelated\(\$\('related'\), '\/emojis\/dictionary\/', \[/);
  assert.doesNotMatch(html, /fetch\(|XMLHttpRequest|sendBeacon/, 'nothing is fetched or sent');
  assert.doesNotMatch(html, /emojigraph/i, 'the page names no other site');
  assert.deepEqual(RELATED['/emojis/dictionary/'], ['/emojis/', '/emoji-combos/', '/word-count/', '/base64/']);
});
