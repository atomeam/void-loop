// Each busy page that used to offer nothing to buy now hands off to /members/ with its own context (?from=), so the missed-upsells finder drops it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const PAGES = { team: /team/i, brain: /brain/i, news: /sections/i, music: /setlists/i, chords: /chord sheets/i };
for (const [p, ctx] of Object.entries(PAGES)) test(p + ' links to /members/ with its context', () => {
  const html = readFileSync(new URL('../void-live-deploy/' + p + '/index.html', import.meta.url), 'utf8');
  const m = html.match(new RegExp('<a href="/members/\\?from=' + p + '">([^<]+)</a>'));
  assert.ok(m, p + ' has no /members/?from=' + p + ' link');
  assert.match(m[1], ctx);
  assert.match(html, /href="\/(members|store)\//); // the found-money hasOffer check
});
