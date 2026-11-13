// A job that already has a page does not get a second page (tools/tower-self.mjs slugFor, lib/self-sites.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { SELF_SITES } from '../void-live-deploy/lib/self-sites.js';

// numbered leftovers may only shrink: delete a path here in the same change that removes its page
const NUMBERED = ['/convert/unit-converter-2/'];

test('a numbered second page is a leftover, and the list only shrinks', () => {
  const have = SELF_SITES.map((r) => r.path).filter((p) => /-\d+\/$/.test(p)).sort();
  assert.deepEqual(have, NUMBERED.slice().sort());
  for (const p of have) assert.ok(NUMBERED.includes(p), p);
});
