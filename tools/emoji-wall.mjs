#!/usr/bin/env node
// The emoji wall's rows, written into the page (owner, 2026-10-26: "drop the /emojis/ page ... onto main").
//
// The wall is a list of 134 rows. Built from script, the list appeared after the first paint and the page shifted
// as it arrived — measured by the gate's own designLook as a CLS of 0.12, a design defect. Written here, the rows
// are in the HTML before any script runs, so the layout never moves; the page's module only fills in the numbers.
//
// The list itself lives in void-live-deploy/lib/emoji.js (one source, shared with the closed tally and the server),
// so this is a pure re-render: run it after changing that file.
//
//   node tools/emoji-wall.mjs           # write the rows into the page
//   node tools/emoji-wall.mjs --check   # fail if the page and lib/emoji.js disagree (for CI)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pagePath = path.join(here, '..', 'void-live-deploy', 'emojis', 'index.html');
const libPath = path.join(here, '..', 'void-live-deploy', 'lib', 'emoji.js');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** the rows, one per emoji, with nothing counted yet: rank, character, name, count, bar */
export function rowsOf(emoji) {
  return emoji.map((e, i) =>
    '    <li><button type="button" data-c="' + esc(e.c) + '" aria-label="Copy ' + esc(e.n) + ', 0 copies today">' +
    '<span class="rank">' + (i + 1) + '.</span>' +
    '<span class="glyph" aria-hidden="true">' + esc(e.c) + '</span>' +
    '<span class="name">' + esc(e.n) + '</span>' +
    '<span class="n">0</span>' +
    '<span class="bar"><i style="width:0%"></i></span>' +
    '</button></li>').join('\n');
}

const OPEN = '    <!-- rows: tools/emoji-wall.mjs writes them here, so the wall is on the page before any script runs -->';
const CLOSE = '    <!-- /rows -->';

async function main() {
  const { EMOJI } = await import('file://' + libPath.replace(/\\/g, '/'));
  const page = fs.readFileSync(pagePath, 'utf8');
  const from = page.indexOf(OPEN), to = page.indexOf(CLOSE);
  if (from < 0 || to < 0 || to < from) throw new Error('the row markers are missing from ' + pagePath);
  const next = page.slice(0, from + OPEN.length) + '\n' + rowsOf(EMOJI) + '\n' + page.slice(to);
  if (process.argv.includes('--check')) {
    if (next !== page) { console.error('emoji-wall: the page is out of date; run node tools/emoji-wall.mjs'); process.exit(1); }
    console.log('emoji-wall: the page matches lib/emoji.js (' + EMOJI.length + ' rows)');
    return;
  }
  fs.writeFileSync(pagePath, next);
  console.log('emoji-wall: wrote ' + EMOJI.length + ' rows into the page');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
