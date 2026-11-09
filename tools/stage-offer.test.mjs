// node tools/stage-offer.test.mjs: the stage (the free page that wins most) names its paid products where the free experience
// leaves off — one muted line under the ask bar with the membership, the one-time fix and the full stack audit, revealed once per
// load after the first answered ask. The names come from the live store (/api/catalog), never typed in the page, so the store
// rule in tools/test_void.mjs ("no product names or prices are hard-coded in the page") holds and a rename in the store follows. Read the source, so an edit that drops the line or its links is caught here, not in the browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../void.html', import.meta.url), 'utf8');

test('the offer line sits in the dock, hidden until the first answered ask', () => {
  assert.ok(html.includes('<div id="void-offer" hidden></div>'), 'the hidden offer line is in the dock');
  assert.match(html, /let offerShown = false/, 'the once-per-load flag');
  assert.match(html, /offerShown = true/, 'the line reveals once');
  assert.match(html, /note\.startsWith\('skill:'\)/, 'revealed by the first answered ask');
});

test('the line names the three products from the live store, with their pages', () => {
  for (const link of ["'/members/?from=stage'", "'/one-time-fix/'", "'/full-stack-audit/'"]) assert.ok(html.includes(link), link);
  for (const name of ['Void Monthly', 'Verse Monthly', 'One-Time Fix', 'Full Stack Audit', 'Automation Cleanup']) assert.ok(!html.includes(name), name + ' is not typed in the page');
  assert.match(html, /async function showOffer\(\)[\s\S]{0,400}await storeCatalog\(\)/, 'the names are read from the live catalog');
  assert.match(html, /a\.textContent = p\.name\.trim\(\)/, 'each name goes in as text');
  assert.ok(!/offer\.innerHTML\s*=/.test(html), 'nothing is written into the line as HTML');
  assert.match(html, /if \(!links\.length\) return;/, 'no live product = the line stays hidden');
  assert.match(html, /offer\.hidden = false;[\s\S]{0,300}dockSpace\(\);/, 'showing the line measures the dock again, so no card ends under the ask bar');
});

test('both deploy copies carry the same line (the page and its copies are one)', () => {
  for (const f of ['void-live-deploy/index.html', 'void-live-deploy/void.html']) assert.ok(readFileSync(new URL('../' + f, import.meta.url), 'utf8').includes('<div id="void-offer" hidden></div>'), f);
});
