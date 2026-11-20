import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scrubSites, deepScrub, studiedHosts } from '../void-live-deploy/lib/scrub-sites.js';
import { publicSelf } from './public-sites.mjs';

test('a studied site\'s name or link becomes "another site"; other text is untouched', () => {
  const h = studiedHosts()[0];
  assert.equal(scrubSites('Add ' + h + ' to LANE_PAGES.'), 'Add another site to LANE_PAGES.');
  assert.equal(scrubSites('see https://www.' + h + '/page?x=1 now'), 'see another site now');
  assert.equal(scrubSites('a-to-mind.com/recipes/ stays'), 'a-to-mind.com/recipes/ stays');
  assert.equal(scrubSites('no sites here'), 'no sites here');
});

test('every string in a JSON value is scrubbed, keys and numbers are not', () => {
  const h = studiedHosts()[1];
  assert.deepEqual(deepScrub({ [h]: 3, a: ['x ' + h], b: { c: h } }), { [h]: 3, a: ['x another site'], b: { c: 'another site' } });
});

test('self.json as served: the tower keeps its counts, never the site', () => {
  const out = publicSelf({ about: 'x', tower: { target: studiedHosts()[0], next: [studiedHosts()[1]], beaten: 2, total: 222 } });
  assert.deepEqual(out.tower, { beaten: 2, total: 222 });
  assert.ok(!JSON.stringify(out).includes(studiedHosts()[0]));
});

test('the deploy copy of the served files names no studied site', async () => {
  const { readFileSync } = await import('node:fs');
  const { SERVED } = await import('./public-sites.mjs');
  for (const f of SERVED) {
    const j = JSON.parse(readFileSync(new URL('../void-live-deploy/' + f, import.meta.url), 'utf8'));
    const out = JSON.stringify(f === 'self.json' ? publicSelf(j) : deepScrub(j)).toLowerCase();
    assert.deepEqual(studiedHosts().filter((h) => out.includes(h)), [], f);
  }
});

test('where "another site" would read badly the site is named by what it is', () => {
  assert.equal(scrubSites('answered the way isitchristmas.com does it, one giant word'), 'answered the way the best one-question sites do it, one giant word');
  assert.equal(scrubSites('source 2 of 3: thesportsdb.com, wikipedia.org'), 'source 2 of 3: a public sports database, wikipedia.org');
  assert.equal(scrubSites('espn.com'), 'a sports news site');
});
