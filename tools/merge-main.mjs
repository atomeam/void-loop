// Bring origin/main into the current branch. Several agents append to the same records at once (tools/bench.json,
// tools/grown.json, domains/void.agents.log.md), so a branch that sat for an hour almost always "conflicts" there even
// though both sides only added lines. Those three are resolved here by keeping both sides (main's file as it is, then this branch's new entries
// that are new; an ask already present is not repeated). Any other conflicted file stops the merge for a person.
//   node tools/merge-main.mjs            fetch, merge, resolve the append-only records, commit
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const sh = (c) => execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const APPEND_JSON = ['tools/bench.json', 'tools/grown.json'];
const APPEND_TEXT = ['domains/void.agents.log.md'];

sh('git fetch -q origin main');
try { sh('git merge --no-edit origin/main'); console.log('merged origin/main (no conflicts)'); process.exit(0); } catch (_) {}

const conflicted = sh('git diff --name-only --diff-filter=U').split('\n').filter(Boolean);
const other = conflicted.filter((f) => !APPEND_JSON.includes(f) && !APPEND_TEXT.includes(f));
if (other.length) { console.error('conflicts need a person: ' + other.join(', ') + ' (merge left in progress)'); process.exit(1); }

const side = (n, f) => { try { return execSync(`git show :${n}:${f}`, { encoding: 'utf8' }); } catch (_) { return ''; } };
for (const f of conflicted) {
  if (APPEND_JSON.includes(f)) {
    // main's file stays exactly as it is (its formatting, and any ask main edited: run 47 found a merge that had put an
    // old "want" back), and only the asks this branch added are appended, one per line in the files' own style
    const theirsText = side(3, f) || '[]\n', theirs = JSON.parse(theirsText), ours = JSON.parse(side(2, f) || '[]');
    const seen = new Set(theirs.map((x) => String(x.ask).toLowerCase()));
    const mine = ours.filter((x) => !seen.has(String(x.ask).toLowerCase()) && seen.add(String(x.ask).toLowerCase()));
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
sh('git commit -q --no-edit');
console.log('merged origin/main; resolved ' + conflicted.join(', '));
