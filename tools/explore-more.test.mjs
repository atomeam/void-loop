// Explore more: one official or legal link on an answer card. Run: node --test tools/explore-more.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { exploreMore, exploreHtml, namesTheAsk, minorsTopic } from '../void-live-deploy/lib/explore-more.js';

test('Explore more is one official or legal link, hidden on unsafe or minors topics, legal-only when adult', () => {
  const official = exploreMore({ official: 'https://www.nasa.gov/pluto' });
  assert.equal(official.href, 'https://www.nasa.gov/pluto');
  assert.equal(official.label, 'Explore more');
  assert.equal(official.rel, 'noopener nofollow');
  assert.equal(official.target, '_blank');
  const html = exploreHtml((s) => s, official);
  assert.match(html, /rel="noopener nofollow"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, />Explore more</);
  assert.equal(exploreHtml((s) => s, official, { gated: true }), '');
  assert.equal(exploreMore({ official: 'https://xvideos.com/x', adult: true }), null);
  assert.ok(exploreMore({ reference: 'https://en.wikipedia.org/wiki/Penthouse_(magazine)', adult: true }).href.includes('wikipedia.org'));
  assert.equal(exploreMore({ official: 'https://example.com', unsafe: true }), null);
  assert.equal(exploreMore({ official: 'https://example.com', minors: true }), null);
  assert.equal(exploreMore({ official: 'http://example.com' }), null);
  assert.equal(exploreMore({}), null);
  assert.equal(minorsTopic('nude children'), true);
  assert.equal(minorsTopic('pluto'), false);
  assert.equal(namesTheAsk('porn magazine', { title: 'Penthouse', desc: 'an American pornographic magazine' }), true);
  assert.equal(namesTheAsk('xyzzy', { title: 'Unrelated', answer: 'something else' }), false);
});
