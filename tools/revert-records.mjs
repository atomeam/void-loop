// Settle the append-only records after `git revert --no-commit <sha>`, so taking a broken commit back off main never jams on
// them (verify.yml; before 2026-10-11 the revert conflicted on the growth ledger and a person had to do it, five times).
//   history (the growth ledger, the agent log): main's file stays exactly as it is, conflicted or not. What happened stays
//     written; verify.yml appends one "fix" line saying what was taken back.
//   the test asks (tools/bench.json, tools/grown.json) and the skill index: main's file minus only the entries the reverted
//     commit added; everything that merged since stays. The index is regenerated from skills/order/ when it is there.
//   any other conflicted file: exit 1 naming it, the revert left in progress for verify.yml to abort and report.
// Nothing is committed here. Run from the repository root:  node tools/revert-records.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { conflictMarkers } from '../void-live-deploy/lib/code-review.js';
import { readOrder, indexText } from './skills-index.mjs';
import { APPEND_JSON, INDEX, HISTORY, keyOf } from './records.mjs';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const stage = (n, f) => { try { return git('show', `:${n}:${f}`); } catch (_) { return ''; } };
const inHead = (f) => { try { git('cat-file', '-e', 'HEAD:' + f); return true; } catch (_) { return false; } };
const keyFor = (f, x) => (typeof x === 'string' ? x.toLowerCase() : keyOf(f, x));

/** main's entries minus the ones the reverted commit added (in its version, not in its parent's). Pure. */
export function withoutAdded(f, ours, added, parent) {
  const before = new Set(parent.map((x) => keyFor(f, x)));
  const gone = new Set(added.map((x) => keyFor(f, x)).filter((k) => !before.has(k)));
  return ours.filter((x) => !gone.has(keyFor(f, x)));
}

/** the top-level entries of a JSON array as [start, end) spans of its text, so entries can be dropped and every other byte kept. Pure. */
export function entrySpans(text) {
  const spans = [];
  let depth = 0, inStr = false, esc = false, from = -1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (depth === 1 && from < 0 && !/[\s,\]]/.test(c)) from = i;
    if (c === '"') inStr = true;
    else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') depth--;
    if (from >= 0 && depth === 1 && (c === ',' || /\s/.test(c)) && !inStr) { spans.push([from, i]); from = -1; }
    if (depth === 0 && from >= 0) { spans.push([from, i]); from = -1; }
  }
  return spans;
}

/** main's file text without the entries at the given positions, every other byte as it was. Pure. */
export function dropEntries(text, drop) {
  const spans = entrySpans(text), kept = spans.map((s, i) => i).filter((i) => !drop.has(i));
  if (kept.length === spans.length) return text;
  if (!kept.length) return text.slice(0, spans[0][0]).replace(/\s+$/, '') + text.slice(spans.at(-1)[1]).replace(/^\s+/, '');
  let out = text.slice(0, spans[0][0]) + text.slice(...spans[kept[0]]);
  for (const i of kept.slice(1)) out += text.slice(spans[i - 1][1], spans[i][0]) + text.slice(...spans[i]);
  return out + text.slice(spans.at(-1)[1]);
}

function main() {
  const conflicted = git('diff', '--name-only', '--diff-filter=U').split('\n').filter(Boolean);
  const other = conflicted.filter((f) => !APPEND_JSON.includes(f) && !HISTORY.includes(f) && f !== INDEX);
  if (other.length) { console.error('the revert conflicts outside the append-only records: ' + other.join(', ')); return 1; }
  for (const f of HISTORY) {
    if (!inHead(f)) continue;
    git('checkout', 'HEAD', '--', f);
    console.log(`${f}: kept main's file (history is never taken back)`);
  }
  for (const f of conflicted.filter((x) => !HISTORY.includes(x))) {
    const ours = stage(2, f) || '[]\n';
    const order = resolve('void-live-deploy', 'skills', 'order');
    let text;
    if (f === INDEX && existsSync(order)) text = indexText(readOrder(order));
    else {
      const all = JSON.parse(ours), keep = new Set(withoutAdded(f, all, JSON.parse(stage(1, f) || '[]'), JSON.parse(stage(3, f) || '[]')));
      text = dropEntries(ours, new Set(all.map((x, i) => i).filter((i) => !keep.has(all[i]))));
    }
    JSON.parse(text);
    writeFileSync(f, text);
    git('add', f);
    console.log(`${f}: kept main's file without the entries the reverted commit added`);
  }
  const marked = git('diff', '--cached', '--name-only').split('\n').filter(Boolean)
    .filter((f) => { try { const t = existsSync(f) ? readFileSync(f, 'utf8') : ''; return !t.includes('\0') && conflictMarkers(t).length; } catch (_) { return false; } });
  if (marked.length) { console.error('conflict markers left in: ' + marked.join(', ')); return 1; }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) process.exit(main());
