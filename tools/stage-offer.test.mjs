// node tools/stage-offer.test.mjs: the homepage is only the void and the ask bar. No product or offer line
// shows before or after an ask. Products stay in /store, and a buy or pricing ask still answers with the store
// card. Read the source so an edit that brings the offer line back is caught here, not in the browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../void.html', import.meta.url), 'utf8');
const copies = ['void-live-deploy/index.html', 'void-live-deploy/void.html'].map((f) => ({
  f,
  text: readFileSync(new URL('../' + f, import.meta.url), 'utf8'),
}));

test('the homepage has no offer line and no unprompted product text', () => {
  assert.ok(!html.includes('void-offer'), 'no #void-offer element');
  assert.ok(!html.includes('showOffer'), 'no showOffer helper');
  assert.ok(!html.includes('offerShown'), 'no once-per-load offer flag');
  assert.ok(!html.includes('OFFER_LINKS'), 'no offer link table');
  assert.ok(!html.includes('Made with Verse'), 'no Made with Verse offer prefix');
  for (const name of ['Void Monthly', 'Verse Monthly', 'One-Time Fix', 'Full Stack Audit', 'Automation Cleanup']) {
    assert.ok(!html.includes(name), name + ' is not typed into the stage');
  }
});

test('an answered ask never reveals products on the stage', () => {
  assert.match(html, /function loopLog\(attempt\)/, 'loopLog still logs answers');
  const m = html.match(/function loopLog\(attempt\) \{[\s\S]*?\n    \}/);
  assert.ok(m, 'loopLog body is readable');
  assert.ok(!/showOffer|void-offer|Made with Verse|OFFER_LINKS|offerShown/.test(m[0]), 'loopLog does not open an offer after an ask');
});

test('a buy or pricing ask still answers with the store card', () => {
  assert.match(html, /async function storeCatalog\(\)/, 'the live catalog is still read when a buy ask needs it');
  assert.match(html, /function productLine\(/, 'a matching product can still become a reply line');
  assert.match(html, /skills\/services\.js/, 'pricing still opens the services card');
  assert.ok(html.includes('href="/store/"') || html.includes("'/store/'") || html.includes('"/store/"'), 'the store page is still linked');
  assert.match(html, /isBuyAsk/, 'buy asks are still recognized');
});

test('both deploy copies match the stage with no offer line', () => {
  for (const { f, text } of copies) {
    assert.equal(text, html, f + ' matches void.html');
    assert.ok(!text.includes('void-offer'), f + ' has no offer line');
    assert.ok(!text.includes('Made with Verse'), f + ' has no Made with Verse text');
  }
});
