// node --test tools/verse-name.test.mjs: the rename to Verse reaches what a person reads (asked by Verse: "verify that every instance of
// 'Void' or 'V01D' in the user-facing text ... has been replaced with 'Verse'"). Checked: every published page's title and visible text,
// the store's product names and blurbs, and the memory card's own lines. Kept on purpose: lib/lineage.js and lib/persona.js say Verse
// was once Void and V01D, and lower-case "void" (the dark stage) is a word, not the old name.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), site = join(root, 'void-live-deploy');
const OLD = /\b(?:Void|V01D)\b/;
const pages = (d, out = []) => { for (const n of readdirSync(d)) { const p = join(d, n); if (n === 'node_modules' || n.startsWith('.')) continue; const s = statSync(p); if (s.isDirectory()) pages(p, out); else if (n.endsWith('.html')) out.push(p); } return out; };
/** the text a person sees: tags, scripts and styles removed. Pure. */
const visible = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ');

// the first seven fringe pages predated the drafts' window.__name check hook and kept the old title until lists run 14 (2026-11-09) gave
// each a hook and the new name. Every page, and every new one, must say Verse; LEGACY stays as the (empty) list of exceptions.
export const LEGACY = [];
test('no published page shows the old name in its title or text', () => {
  const rel = (p) => relative(site, p).replace(/\\/g, '/'); // Windows reports backslashes; LEGACY is written with forward slashes
  const bad = pages(site).filter((p) => !LEGACY.includes(rel(p)) && OLD.test(visible(readFileSync(p, 'utf8')))).map(rel);
  assert.deepEqual(bad, []);
});
test('the store names and describes every product as Verse', () => {
  const d = JSON.parse(readFileSync(join(root, 'domains/store.products.json'), 'utf8')), rows = Array.isArray(d) ? d : d.products || [];
  assert.ok(rows.length > 0);
  assert.deepEqual(rows.filter((r) => OLD.test(String(r.name || '') + ' ' + String(r.blurb || ''))).map((r) => r.id), []);
});
test('the memory card speaks as Verse', () => {
  const src = readFileSync(join(site, 'skills/memory-graph.js'), 'utf8').split('\n').filter((l) => !/^\s*(?:\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.ok(!OLD.test(src));
});
