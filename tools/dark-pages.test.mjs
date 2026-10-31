// Every page of Verse stays deep space, whatever colour scheme the visitor's device asks for (owner, 2026-10-29: Verse's look is "deep space dark
// mode", never a stark-white container; docs/design.md). 26 pages and the /fix/ page template turned white for a device in light mode with a
// `@media (prefers-color-scheme: light)` block, and 84 more (the tool pages, /flights/, /jobs/, /generators/, the music pages, /is-it/) were
// light by default with their dark palette only inside `@media (prefers-color-scheme: dark)`. The self-check (tools/self-check.mjs) saw 125
// of them light on production. Now the dark palette is the page's own; a music page still turns light when its own toggle asks
// (data-theme=light). This keeps a new page or template from bringing either back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), site = join(root, 'void-live-deploy');
const pages = []; (function walk(d) { for (const n of readdirSync(d)) { if (n === 'vendor' || n === 'node_modules') continue; const f = join(d, n); if (statSync(f).isDirectory()) walk(f); else if (n.endsWith('.html')) pages.push(f); } })(site);
const DARK_ONLY_IN_MEDIA = /@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)/i;
const TEMPLATES = ['tools/fix-pages.mjs', 'tools/tool-site-pages.mjs', 'tools/music-pages.mjs', 'void-live-deploy/functions/is-it/[what].js'];
const LIGHT = /@media\s*\(\s*prefers-color-scheme\s*:\s*light\s*\)\s*\{\s*:root\s*\{[^}]*--(?:bg|card)\s*:/i;

test('no page and no page template turns light for a device in light mode', () => {
  assert.ok(pages.length > 400, 'the pages were found');
  const light = pages.filter((f) => LIGHT.test(readFileSync(f, 'utf8'))).map((f) => f.slice(site.length));
  assert.deepEqual(light, [], 'these pages turn light: keep the dark tokens and say color-scheme: dark');
  assert.ok(!LIGHT.test(readFileSync(join(root, 'tools/fix-pages.mjs'), 'utf8')), 'the /fix/ page template');
});

test('no page and no page template keeps its dark palette only for a device that asks for dark', () => {
  const light = pages.filter((f) => DARK_ONLY_IN_MEDIA.test(readFileSync(f, 'utf8'))).map((f) => f.slice(site.length));
  assert.deepEqual(light, [], 'these pages are light unless the device asks for dark: make the dark tokens the page\'s own');
  for (const t of TEMPLATES) assert.ok(!DARK_ONLY_IN_MEDIA.test(readFileSync(join(root, t), 'utf8')), t);
});
