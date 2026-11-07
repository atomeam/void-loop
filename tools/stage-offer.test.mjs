// node tools/stage-offer.test.mjs: the stage (the free page that wins most) names its paid products where the free experience
// leaves off — one muted line under the ask bar with Void Monthly, One-Time Fix and Full Stack Audit, revealed once per load
// after the first answered ask. Read the source, so an edit that drops the line or its links is caught here, not in the browser.
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

test('the line names the three products, static words only', () => {
  for (const link of ['href="/members/?from=stage"', 'href="/one-time-fix/"', 'href="/full-stack-audit/"']) assert.ok(html.includes(link), link);
  for (const name of ['Void Monthly', 'One-Time Fix', 'Full Stack Audit']) assert.ok(html.includes(name), name);
  assert.ok(!/offer\.innerHTML\s*=.*\$\{/.test(html), 'nothing interpolated into the line');
});

test('both deploy copies carry the same line (the page and its copies are one)', () => {
  for (const f of ['void-live-deploy/index.html', 'void-live-deploy/void.html']) assert.ok(readFileSync(new URL('../' + f, import.meta.url), 'utf8').includes('<div id="void-offer" hidden></div>'), f);
});
