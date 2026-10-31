// The book (the owner, 2026-10-16: "a book you could flip through that contains everything so you don't have to search ...
// like a BradyGames or Prima strategy guide"): one JSON the page reads, written from the site's own data so it can never miss
// a skill. Chapters are skills/families.json's families in its order, pages are every skill in skills/index.json (a family
// skill opened into its members), the games chapter carries skills/rack.js GAMES, the 3D miniatures chapter is every file in
// skills/mini/, and each page's one line is the first sentence of its skill's own header comment (lib/guide.js oneLine).
//   node tools/guide.mjs            write void-live-deploy/skills/guide.json and print the chapters
//   node tools/guide.mjs --check    exit 1 if guide.json is out of date or a skill is on no page (tools/checks.mjs runs this)
// The reader is skills/guide.js ("open the book"); the pure pieces and their tests are lib/guide.js and tools/guide.test.mjs.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compose, gamesOf, miniDocOf } from '../void-live-deploy/lib/guide.js';
import { CORE } from '../void-live-deploy/functions/tools.json.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = resolve(root, 'void-live-deploy/skills/guide.json');
const read = (p) => readFileSync(resolve(root, p), 'utf8');

/** the book from the repo as it is now: { chapters, pages, index, totals, unplaced }. */
export function bookFromRepo() {
  const names = JSON.parse(read('void-live-deploy/skills/index.json'));
  const src = (n) => { try { return read('void-live-deploy/skills/' + n + '.js'); } catch (_) { return ''; } };
  const minis = readdirSync(resolve(root, 'void-live-deploy/skills/mini')).filter((f) => f.endsWith('.js') && f !== 'sample.js').map((f) => f.replace(/\.js$/, '')).sort(); // sample.js is the template a new one is copied from, not a thing to see
  const readMini = (k) => { try { return read('void-live-deploy/skills/mini/' + k + '.js'); } catch (_) { return ''; } };
  return compose({ names, read: src, families: JSON.parse(read('void-live-deploy/skills/families.json')), games: gamesOf(src('rack')), minis, readMini, miniDoc: miniDocOf(read('docs/miniatures.md')), core: CORE });
}

/** the JSON text the page reads: the book without its builder-only field. Pure. */
export function textOf(book) {
  const { unplaced, ...rest } = book;
  return JSON.stringify({ note: 'The Book of Verse: every skill, game and 3D miniature, one page each, written by tools/guide.mjs from the site\'s own data. Do not edit by hand.', ...rest }, null, 1) + '\n';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const book = bookFromRepo(), json = textOf(book), problems = [];
  if (book.unplaced.length) problems.push('skills on no page of the book (their family is missing in tools/families.mjs): ' + book.unplaced.join(', '));
  if (process.argv.includes('--check')) {
    if (!existsSync(OUT) || readFileSync(OUT, 'utf8') !== json) problems.push('void-live-deploy/skills/guide.json is out of date (node tools/guide.mjs)');
    if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
    console.log('ok: the book has ' + book.totals.pages + ' pages in ' + book.totals.chapters + ' chapters (' + book.totals.skills + ' skills, ' + book.totals.games + ' games, ' + book.totals.minis + ' miniatures)'); process.exit(0);
  }
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  writeFileSync(OUT, json);
  for (const c of book.chapters) console.log(c.name.padEnd(22) + ' pages ' + String(c.from).padStart(3) + '–' + String(c.to).padEnd(4) + (c.for ? '  ' + c.for : ''));
  console.log('all'.padEnd(22) + ' ' + book.totals.pages + ' pages, ' + book.totals.skills + ' skills, ' + book.totals.games + ' games, ' + book.totals.minis + ' miniatures');
}
