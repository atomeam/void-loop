// Every sitemap page carries the visit beacon (tools/beacon-pages.mjs), and the beacon stays light. Run: node --test tools/beacon-pages.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { missing, pages, withBeacon, TAG } from './beacon-pages.mjs';

test('every HTML page in sitemap.xml loads /visit.js (a page without it is traffic Verse cannot see)', () => {
  const bad = missing();
  assert.deepEqual(bad.map((b) => b.url + ' ' + b.why), [], 'run node tools/beacon-pages.mjs, or add ' + TAG + ' to the generator that writes the page');
  assert.ok(pages().length > 50);
});

test('withBeacon: once, before </head>, nothing without a head', () => {
  const once = withBeacon('<html><head><title>x</title></head><body></body></html>');
  assert.equal(once, '<html><head><title>x</title>' + TAG + '\n</head><body></body></html>');
  assert.equal(withBeacon(once), once);
  assert.equal(withBeacon('<p>fragment</p>'), '<p>fragment</p>');
});

test('the beacon is light: deferred, tiny, sent after the load event, never on other hosts', () => {
  const js = readFileSync(new URL('../void-live-deploy/visit.js', import.meta.url), 'utf8');
  assert.ok(Buffer.byteLength(js) < 3200, 'visit.js grew past 3.2 KB'); // 1.5 KB until the Verse Brain loader, 2.8 KB with prerender-safe counting, 3.2 KB once a skipped fade is caught instead of thrown (/under-the-hood/)
  assert.match(TAG, /\bdefer\b/);
  assert.match(js, /addEventListener\('load'/); assert.match(js, /after\(0, function \(\) \{[^}]*\n[^]*?sendBeacon/); assert.match(js, /sendBeacon/);
  assert.match(js, /d\.prerendering \? d\.addEventListener\('prerenderingchange'/, 'a page Chrome prerendered and nobody opened was counted as a visit');
  assert.match(js, /a-to-mind\\\.com/);
  assert.doesNotMatch(js, /\bimport\b|document\.write|localStorage|document\.cookie/);
});
