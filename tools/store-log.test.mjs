// The store's "New from Verse" list is plain words (owner audit, 2026-11-19). Run: node --test tools/store-log.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { plainWhat, jargon } from '../void-live-deploy/lib/store-log.js';
const log = JSON.parse(readFileSync(new URL('../void-live-deploy/store/changelog.json', import.meta.url), 'utf8')).changelog;
test('every line in the real changelog reads as plain words', () => {
  assert.ok(log.length > 5);
  for (const e of log) { const p = plainWhat(e.what); assert.ok(p.length > 10 && !jargon(p), e.what + ' -> ' + p); assert.doesNotMatch(p, /V01D/); }
});
test('the three kinds of line', () => {
  assert.match(plainWhat('republished: the 2026-11-08 unpublish was the store API answering an empty body during a site outage'), /^Back in the store/);
  assert.match(plainWhat('unpublished automatically: unreachable: Unexpected end of JSON input'), /^Taken down for now/);
  assert.equal(plainWhat('published by Verse: 6 files, 5.4 MB'), 'Added to the store: 6 files, 5.4 MB.');
  assert.equal(plainWhat('published by V01D: 4 files, 0.0 MB (paid: needs a Gumroad listing, queued)'), 'Added to the store: 4 files, under 0.1 MB. Not for sale yet.');
  assert.equal(plainWhat('something new'), 'something new');
});
