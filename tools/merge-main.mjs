// Bring origin/main into the current branch. Several agents append to the same records at once (tools/bench.json,
// tools/grown.json, void-live-deploy/void.growth.json, domains/void.agents.log.md), so a branch that sat for an hour almost always "conflicts" there even
// though both sides only added lines. Those three are resolved here by keeping both sides (main's file as it is, then this branch's new entries
// that are new; an ask already present is not repeated). The skill index (a one-line list) keeps main's order and puts the skills the
// branch added after the name before them (tools/merge-index.mjs); if the two sides ordered shared skills differently it stops for a person.
// Any other conflicted file stops the merge for a person.
//   node tools/merge-main.mjs            fetch, merge, resolve the append-only records, commit (refused while any tracked file has a conflict marker)
import { execSync, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { conflictMarkers } from '../void-live-deploy/lib/code-review.js';
import { mergeIndex } from './merge-index.mjs';
import { readOrder, indexText, adoptOrder } from './skills-index.mjs';
import { APPEND_JSON, APPEND_TEXT, INDEX, keyOf } from './records.mjs'; // the append-only records, shared with tools/revert-records.mjs

const sh = (c) => execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

sh('git fetch -q origin main');
// the families and the book are generated from the tree: after a merge they are written again, and committed if the text moved (two branches that each added a skill leave both stale without a conflict)
// every generated file (tools/refresh.mjs writes them in order: the index, the dependency map, what.json, the families, the book, self.json, the asks'
// links, the bench alarms): after a merge each is written again from the merged tree and committed if it moved. Before 2026-10-23 only the families and
// the book were, so nearly every finish after a merge stopped at the fast checks on a stale deps.json or what.json and had to be resumed by hand.
// (the skill index is settled name by name below, never taken from one side, so it is not in this list; regen() still writes it again after)
const GENERATED = ['void-live-deploy/skills/families.json', 'void-live-deploy/skills/guide.json', 'void-live-deploy/skills/deps.json',
  'void-live-deploy/skills/what.json', 'void-live-deploy/self.json', 'void-live-deploy/void.asks.json', 'void-live-deploy/lib/similar-index.js', 'void-live-deploy/skills/bench-alarms.json'];
const REGEN = GENERATED.concat('void-live-deploy/skills/index.json');
function regen() {
  if (!existsSync(resolve(process.cwd(), 'tools', 'refresh.mjs'))) return;
  try { execFileSync(process.execPath, [resolve(process.cwd(), 'tools', 'refresh.mjs'), '--keep-going'], { stdio: 'ignore' }); } catch (e) { console.error('tools/refresh.mjs failed after the merge (' + (e.status || e.message) + '): the check will say why'); }
  try { execFileSync(process.execPath, [resolve(process.cwd(), 'tools', 'similar-index.mjs')], { stdio: 'ignore' }); } catch (_) {}
  try { sh(`git add ${REGEN.filter((f) => existsSync(resolve(process.cwd(), f))).join(' ')}`); if (sh('git diff --cached --name-only')) { sh('git commit -q -m "Regenerate the generated files after the merge"'); console.log('regenerated the generated files after the merge'); } } catch (_) {}
}
try { sh('git merge --no-edit origin/main'); console.log('merged origin/main (no conflicts)'); regen(); process.exit(0); } catch (_) {}

const conflicted = sh('git diff --name-only --diff-filter=U').split('\n').filter(Boolean);
const sideOf = (n, f) => { try { return execFileSync('git', ['show', `:${n}:${f}`], { encoding: 'utf8' }); } catch (_) { return ''; } };
let indexMerged = null, indexHow = ''; // the settled index text, or null when a person has to
// the index is generated from one order file per skill (tools/skills-index.mjs): after the merge both sides' order files are in
// the tree, so the settled index is simply regenerated; the name-by-name merge (tools/merge-index.mjs) is the fallback when the
// order files are not there yet (a branch from before them)
if (conflicted.includes(INDEX)) {
  try {
    const l = (n) => JSON.parse(sideOf(n, INDEX) || '[]'), m = mergeIndex(l(1), l(2), l(3)); // null: the two sides order shared names differently
    const order = resolve(process.cwd(), 'void-live-deploy', 'skills', 'order');
    if (m && existsSync(order)) { // a skill one side listed by hand (a branch from before the order files) gets its order file at that place
      const made = adoptOrder(m, order);
      indexMerged = indexText(readOrder(order)); indexHow = 'regenerated from skills/order/' + (made.length ? ' after making ' + made.join(', ') + ' for the names listed by hand' : ' (both sides\' order files are in the tree)');
    } else if (m) { indexMerged = JSON.stringify(m) + (sideOf(3, INDEX).endsWith('\n') ? '\n' : ''); indexHow = "kept main's order and added this branch's new skills after the name before them"; }
  } catch (e) { console.error('skills/index.json: ' + e.message); } }
// generated files (families, the book): take main's here, regen() writes them again from the merged tree after the commit
for (const f of conflicted.filter((x) => GENERATED.includes(x))) { sh(`git checkout --theirs -- ${f}`); sh(`git add ${f}`); }
const other = conflicted.filter((f) => !GENERATED.includes(f) && !APPEND_JSON.includes(f) && !APPEND_TEXT.includes(f) && !(f === INDEX && indexMerged !== null));
if (other.length) { console.error('conflicts need a person: ' + other.join(', ') + ' (merge left in progress)'); process.exit(1); }

const side = (n, f) => { try { return execSync(`git show :${n}:${f}`, { encoding: 'utf8' }); } catch (_) { return ''; } };
for (const f of conflicted) {
  if (GENERATED.includes(f)) continue; // settled above, written again by regen()
  if (f === INDEX) {
    writeFileSync(f, indexMerged);
    console.log(`${f}: ${indexHow} (${JSON.parse(indexMerged).length} total)`);
  } else if (APPEND_JSON.includes(f)) {
    // main's file stays exactly as it is (its formatting, and any ask main edited: run 47 found a merge that had put an
    // old "want" back), and only the asks this branch added are appended, one per line in the files' own style
    const theirsText = side(3, f) || '[]\n', theirs = JSON.parse(theirsText), ours = JSON.parse(side(2, f) || '[]');
    const seen = new Set(theirs.map((x) => keyOf(f, x)));
    const mine = ours.filter((x) => !seen.has(keyOf(f, x)) && seen.add(keyOf(f, x)));
    const line = (o) => '  {' + Object.entries(o).map(([k, v]) => JSON.stringify(k) + ': ' + JSON.stringify(v)).join(', ') + '}';
    const body = theirsText.trimEnd().replace(/\]$/, '').trimEnd();
    writeFileSync(f, mine.length ? (theirs.length ? body + ',\n' : '[\n') + mine.map(line).join(',\n') + '\n]\n' : theirsText);
    JSON.parse(readFileSync(f, 'utf8'));
    const all = theirs.concat(mine);
    console.log(`${f}: kept main's file and added this branch's ${mine.length} new (${all.length} total)`);
  } else {
    const base = side(1, f), ours = side(2, f), theirs = side(3, f);
    const added = (s) => s.startsWith(base) ? s.slice(base.length) : s.split('\n').filter((l) => !base.split('\n').includes(l)).join('\n');
    writeFileSync(f, base + added(theirs).replace(/^\n+/, '') + (added(theirs).endsWith('\n') ? '' : '\n') + added(ours).replace(/^\n+/, ''));
    console.log(`${f}: kept both sides' new lines`);
  }
  sh(`git add ${f}`);
}
// never commit a merge that still carries a conflict marker anywhere (#291 hand-merged one into the growth ledger): name it and stop
const marked = sh('git ls-files').split('\n').filter(Boolean).filter((f) => { try { const t = existsSync(f) ? readFileSync(f, 'utf8') : ''; return !t.includes('\0') && conflictMarkers(t).length; } catch (_) { return false; } });
if (marked.length) { console.error('conflict markers left in: ' + marked.join(', ') + ' (merge left in progress, nothing committed)'); process.exit(1); }
sh('git commit -q --no-edit');
regen();
console.log('merged origin/main; resolved ' + conflicted.join(', '));
