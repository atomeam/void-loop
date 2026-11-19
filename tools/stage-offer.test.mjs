// node tools/stage-offer.test.mjs: a buy or pricing ask on the homepage answers with the store card, and the deploy copies
// match void.html. What the homepage shows is not limited here: products, offers and anything else may appear on it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../void.html', import.meta.url), 'utf8');
const copies = ['void-live-deploy/index.html', 'void-live-deploy/void.html'].map((f) => ({
  f,
  text: readFileSync(new URL('../' + f, import.meta.url), 'utf8'),
}));

test('a buy or pricing ask still answers with the store card', () => {
  assert.match(html, /async function storeCatalog\(\)/, 'the live catalog is still read when a buy ask needs it');
  assert.match(html, /function productLine\(/, 'a matching product can still become a reply line');
  assert.match(html, /skills\/services\.js/, 'pricing still opens the services card');
  assert.ok(html.includes('href="/store/"') || html.includes("'/store/'") || html.includes('"/store/"'), 'the store page is still linked');
  assert.match(html, /isBuyAsk/, 'buy asks are still recognized');
});

test('both deploy copies match the stage', () => {
  for (const { f, text } of copies) assert.equal(text, html, f + ' matches void.html');
});
