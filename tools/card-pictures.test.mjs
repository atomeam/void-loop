// A store card or a recipe card never ships an emoji as its picture, and no two products borrow one 3D preview (owner audit, 2026-11-19: store
// "service" cards drew a colour 🛠, and the VoidQuest Miniatures card showed the chess set). Run: node --test tools/card-pictures.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const dep = resolve(dirname(fileURLToPath(import.meta.url)), '../void-live-deploy');
const read = (f) => readFileSync(resolve(dep, f), 'utf8');
const EMOJI = /\p{Extended_Pictographic}/u;

// the files that draw store cards and recipe cards (the card pictures, titles and labels they hold)
const CARD_FILES = ['store/index.html', 'skills/recipe.js', 'lib/recipe-card.js', 'lib/recipe-respect.js', 'skills/recipe-stack.js', 'skills/recipes-fill.js', 'lib/chat-recipes.js'];
test('no emoji in the files that draw store and recipe cards', () => {
  for (const f of CARD_FILES) {
    const hit = read(f).split('\n').map((line, i) => [i + 1, line.match(EMOJI)]).find(([, m]) => m);
    assert.equal(hit, undefined, f + ':' + (hit && hit[0]) + ' has an emoji (' + (hit && hit[1][0]) + '): draw an icon (an inline SVG) instead');
  }
});

// a card with no 3D preview shows one drawn icon per kind
test('the store draws an icon for every product kind it lists', () => {
  const html = read('store/index.html'), icons = html.slice(html.indexOf('const ICON = {'), html.indexOf('};', html.indexOf('const ICON = {')));
  for (const k of ['membership', 'license', 'service', 'support', 'download']) assert.match(icons, new RegExp(k + ': \'<svg'), k + ' needs a drawn icon');
});

// KNOWN_REUSE: a product that still shows another product's preview, named so it is fixed and then removed (never added to)
const KNOWN_REUSE = new Set(['voidquest-minis']);
test('no product borrows another product\'s 3D preview', async () => {
  const products = (await import(resolve(dep, 'lib/store-products.js'))).default;
  const by = new Map();
  for (const p of products) if (p.preview) by.set(p.preview, [...(by.get(p.preview) || []), p.id]);
  const reused = [...by.values()].filter((ids) => ids.length > 1);
  for (const ids of reused) assert.ok(ids.slice(1).every((id) => KNOWN_REUSE.has(id)), 'these products share one preview: ' + ids.join(', ') + ' (give each its own, or none)');
  const still = products.filter((p) => KNOWN_REUSE.has(p.id) && p.preview && (by.get(p.preview) || []).length < 2);
  assert.equal(still.length, 0, 'KNOWN_REUSE lists ' + still.map((p) => p.id) + ' but it no longer reuses a preview: remove it from the list');
});

// /blub/ once shipped with a line comment inside its one-line size() and the page script died ("Unexpected end of input"): the script must parse
test('blub.js parses as a module', () => { const f = resolve(mkdtempSync(resolve(tmpdir(), 'blub-')), 'blub.mjs'); writeFileSync(f, read('blub/blub.js')); execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); });
