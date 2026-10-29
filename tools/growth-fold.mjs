// Fold the waiting growth entries (growth/entries/*.json, one per PR change, written by tools/grow.mjs on a branch) into the
// ledger, void-live-deploy/void.growth.json, in time order, and remove the files. An entry already in the ledger is not repeated,
// so a fold run twice, or on two machines, gives the same ledger. A file that is not one valid entry stops the fold and is named.
//   node tools/growth-fold.mjs            fold and remove the files (the deploy runs this; .github/workflows/growth-fold.yml commits it on main)
//   node tools/growth-fold.mjs --keep     fold but leave the files (a deploy that must not change the tree it reports on)
//   node tools/growth-fold.mjs --dry      say what would be folded, write nothing
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { LEDGER, ENTRIES, readEntries, foldInto, entryProblem, ledgerProblems } from './grow.mjs';

export function fold({ ledger = LEDGER, dir = ENTRIES, keep = false, dry = false } = {}) {
  const waiting = readEntries(dir), bad = waiting.filter(({ entry }) => !entry || entryProblem(entry));
  if (bad.length) throw new Error('not a valid entry: ' + bad.map((b) => 'growth/entries/' + b.name + ' (' + (b.entry ? entryProblem(b.entry) : 'not JSON') + ')').join(', '));
  if (!waiting.length) return { folded: 0, files: 0 };
  const text = readFileSync(ledger, 'utf8'), next = foldInto(text, waiting.map((w) => w.entry)), list = JSON.parse(next);
  const problems = ledgerProblems(list); if (problems.length) throw new Error(problems.slice(0, 5).join('; '));
  const folded = list.length - JSON.parse(text).length;
  if (!dry) { if (next !== text) writeFileSync(ledger, next); if (!keep) for (const w of waiting) rmSync(resolve(dir, w.name)); }
  return { folded, files: waiting.length };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const a = process.argv.slice(2);
  try { const r = fold({ keep: a.includes('--keep'), dry: a.includes('--dry') }); console.log('growth-fold: ' + r.files + ' file' + (r.files === 1 ? '' : 's') + ', ' + r.folded + ' new in the ledger' + (a.includes('--dry') ? ' (dry run)' : '')); }
  catch (e) { console.error('growth-fold: ' + e.message); process.exit(1); }
}
