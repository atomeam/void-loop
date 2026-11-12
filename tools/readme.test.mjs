// The repository has a front page (lists run 19, asked by Verse 19 times: "Handle the void-loop readme"; the root had no README and
// docs/README.md was empty). Every relative link and every path in a code span it names exists.
// Run: node --test tools/readme.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
for (const f of ['README.md', 'docs/README.md']) {
  test(f + ' exists, names Verse, and every file it points to exists', () => {
    const md = readFileSync(new URL(f, root), 'utf8');
    assert.ok(md.trim().length > 100, f + ' is not empty');
    assert.match(md, /Verse/);
    const base = new URL(f.includes('/') ? 'docs/' : './', root);
    for (const [, href] of md.matchAll(/\]\(([^)#]+)\)/g)) if (!/^https?:/.test(href)) assert.ok(existsSync(new URL(href, base)), f + ' links ' + href);
    for (const [, p] of md.matchAll(/`((?:void-live-deploy|tools|domains|docs|\.github)\/[^`<\s]*)`/g)) assert.ok(existsSync(new URL(p, root)), f + ' names ' + p);
  });
}
