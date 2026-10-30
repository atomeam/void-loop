// One short, current line for every skill, for cards that list them (the "already built" card; asked by the owner, 2026-10-19: "lots of words need
// refreshed and updated on many cards, we need an automatic system"). The inventory card kept a hand-written list and fell back to the skill's
// own name ("own-parts - own-parts"), so most rows said nothing and none followed a rename. The book already holds a current description of every
// skill (void-live-deploy/skills/guide.json, written from the skills themselves), so this copies name -> line into a small file the card imports.
// tools/refresh.mjs runs it after the book, on every build; the hand-written words in skills/inventory.js still win where they exist.
//   node tools/what-skills.mjs            write void-live-deploy/skills/what.json      node tools/what-skills.mjs --check    exit 1 when it is stale
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { addsLine } from '../void-live-deploy/lib/card-frame.js';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const FILE = resolve(root, 'void-live-deploy/skills/what.json'), MAX = 160;

/** a description made short and plain: one line, the book's own trailing ellipsis dropped; a long one ends at its last whole sentence,
 *  else its last whole clause, else its last whole word, with no ellipsis (owner: no line cut with "..."; the inventory card showed 159
 *  rows ending in "…", 2026-10-30). Pure. */
export function tidy(line) {
  const s = String(line == null ? '' : line).replace(/\s+/g, ' ').trim().replace(/…$/, '').replace(/\.\.\.$/, '').trim();
  return addsLine(s, MAX);
}

/** { skill name: line } from the book's pages, sorted by name; a skill whose line is only its own name says nothing and is left out. Pure. */
export function whatOf(guide) {
  const out = {};
  const pages = guide && Array.isArray(guide.pages) ? guide.pages : [];
  for (const p of pages) {
    if (!p || p.kind !== 'skill' || typeof p.name !== 'string') continue;
    const t = tidy(p.line);
    if (t.length >= 8 && t.toLowerCase() !== p.name.toLowerCase()) out[p.name] = t;
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

const text = (o) => JSON.stringify(o, null, 1) + '\n';

function main(argv) {
  const guide = JSON.parse(readFileSync(resolve(root, 'void-live-deploy/skills/guide.json'), 'utf8')), want = text(whatOf(guide));
  if (argv.includes('--check')) {
    if (existsSync(FILE) && readFileSync(FILE, 'utf8') === want) { console.log('ok: ' + Object.keys(JSON.parse(want)).length + ' skills have a line'); return 0; }
    console.error('what.json is stale: run node tools/what-skills.mjs'); return 1;
  }
  writeFileSync(FILE, want); console.log('wrote skills/what.json: ' + Object.keys(JSON.parse(want)).length + ' skills'); return 0;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
