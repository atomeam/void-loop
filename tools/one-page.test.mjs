// A job that already has a page does not get a second page (tools/tower-self.mjs, lib/self-sites.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { SELF_SITES } from '../void-live-deploy/lib/self-sites.js';
import { pageForJob } from './tower-self.mjs';

// leftovers may only shrink: delete a path here in the same change that removes its page
const NUMBERED = ['/convert/unit-converter-2/'];
const SAME_HEADLINE = [
  ['/color/colour-management/', '/color/colour-picker-tool/'],
  ['/convert/unit-converter-2/', '/convert/unit-converter/'],
];

test('a numbered second page is a leftover, and the list only shrinks', () => {
  const have = SELF_SITES.map((r) => r.path).filter((p) => /-\d+\/$/.test(p)).sort();
  assert.deepEqual(have, NUMBERED.slice().sort());
});

test('two pages with one headline are a leftover, and that list only shrinks', () => {
  const groups = new Map();
  for (const r of SELF_SITES) {
    const k = r.base + '\n' + String(r.h1 || '').toLowerCase();
    groups.set(k, [...(groups.get(k) || []), r.path]);
  }
  const have = [...groups.values()].filter((g) => g.length > 1).map((g) => g.slice().sort());
  have.sort((a, b) => a[0].localeCompare(b[0]));
  assert.deepEqual(have, SAME_HEADLINE);
});

test('the same headline is the existing page, and a different headline stays free', () => {
  const fam = { id: 'colour', base: '/color/' };
  assert.equal(pageForJob(fam, { h1: 'Colour codes: hex, RGB, HSL, CMYK, shades and schemes' }, SELF_SITES), '/color/colour-picker-tool/');
  assert.equal(pageForJob(fam, { h1: 'A gradient between two colours' }, SELF_SITES), null);
  assert.equal(pageForJob({ id: 'unit converter', base: '/convert/' }, { h1: 'short' }, SELF_SITES), null);
});
