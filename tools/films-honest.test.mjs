// /films/ tells the truth about how often films come, keeps dead and loading tiles from being black holes, and keeps the drifting gems out
// from behind the text (owner audit, 2026-11-19: "new videos daily" with nothing newer than 10 Nov; black tiles; gems behind the heading).
// Run: node --test tools/films-honest.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const read = (f) => readFileSync(new URL('../void-live-deploy/' + f, import.meta.url), 'utf8');
const page = read('films/index.html'), card = read('skills/films.js');
test('no page or card says films come every day', () => {
  for (const [name, t] of [['films page', page], ['films card', card]]) assert.doesNotMatch(t, /new videos daily|a new one daily|Every day Verse films|next daily recording/i, name);
  assert.match(page, /passes Verse's own (?:quality )?check/);
});
test('a tile with no picture yet is a gradient, and a tile whose film cannot load leaves the grid', () => {
  assert.doesNotMatch(page, /\.film video \{[^}]*background: #000/);
  assert.match(page, /\.film video \{[^}]*linear-gradient/);
  assert.match(page, /vd\.addEventListener\('error'.*closest\('\.film\.thumb'\)/);
});
test('the gems stay in the side margins on a wide screen and fade back on a narrow one', () => {
  assert.match(page, /#verse-scene \{ opacity: \.22 !important; \}/);
  assert.match(page, /@media \(min-width: 1200px\) \{ #verse-scene \{[^}]*mask-image: linear-gradient\(90deg, #000 calc\(50% - 600px\), transparent calc\(50% - 540px\), transparent calc\(50% \+ 540px\)/);
});
test('the page script still parses', () => {
  const scripts = [...page.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter((s) => s.trim());
  assert.ok(scripts.length);
  const dir = mkdtempSync(join(tmpdir(), 'films-')); scripts.forEach((s, i) => { writeFileSync(join(dir, i + '.mjs'), s); execFileSync(process.execPath, ['--check', join(dir, i + '.mjs')]); });
});
test('the heading reads HOLOVIDS: the glitch flickers the I in place, it is never an extra letter (owner, 2026-11-20: it read HOLOVIDIS)', () => {
  assert.match(page, /VERSE HOLOV<span class="gl fast" aria-hidden="true"><b>I<\/b><i>1<\/i><\/span>DS<\/span><\/h1>/);
});
