// Stop a broken intermediate state from reaching the remote (tonight a branch got a conflict marker in the growth ledger and then a
// missing comma in it; only luck and a later check caught them). Over the files the push would add or change, as they are in HEAD:
// a git conflict marker in any text file, a .js/.mjs that does not parse (node --check, as an ES module: package.json says module),
// and a .json that does not parse (the missing comma was in one).
//   node tools/prepush.mjs --staged         checks what is staged to be committed (.githooks/pre-commit runs it: `git add -A` marks a conflicted file resolved, and a commit made
//                                           in the middle of an unfinished merge then carries the markers; it happened twice on 2026-10-19)
//   node tools/prepush.mjs [--base <ref>]   checks the files that differ between <ref> and HEAD
//                                           (default: this branch's upstream, else origin/main); exit 1 and say what and where
// Ledger guard (asked by Verse, run 118; lists run 3, 2026-10-21): a whole-file write once cut a ledger to a placeholder. A push where one of
// LEDGERS ends under half its size on the base, or a .md ledger loses a "## " heading it had, is refused (ledgerShrinks).
// tools/push.mjs runs it before every push (VOID_SKIP_PREPUSH=1 skips it, for a push that must go even though a check is wrong);
// .githooks/pre-push runs it for a plain `git push` once `git config core.hooksPath .githooks` is set.
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { conflictMarkers } from '../void-live-deploy/lib/code-review.js';

// problems in [{ path, text }]: strings like "tools/x.mjs: does not parse (line 3: SyntaxError: ...)"; binary files are skipped
export function problemsIn(files) {
  const out = [];
  for (const { path, text } of files) {
    if (typeof text !== 'string' || text.includes('\0')) continue;
    if (path.startsWith('archive/repos/')) continue; // early builds kept as found (archive/repos/README.md); conflict markers aside, nothing there runs
    const marks = conflictMarkers(text);
    if (marks.length) out.push(`${path}: conflict marker at line ${marks[0].line}${marks.length > 1 ? ` (and ${marks.length - 1} more)` : ''}: settle the merge (node tools/merge-main.mjs)`);
    if (/\.(m?js)$/.test(path)) {
      const r = spawnSync(process.execPath, ['--check', '--input-type=module', '-'], { input: text, encoding: 'utf8' });
      if (r.status !== 0) { const err = (r.stderr || '').split('\n'); const line = /:(\d+)\s*$/m.exec(err[0] || ''); out.push(`${path}: does not parse${line ? ' (line ' + line[1] + ')' : ''}: ${(err.find((l) => /Error/.test(l)) || '').trim().slice(0, 160)}`); }
    } else if (/\.json$/.test(path)) {
      try { JSON.parse(text); } catch (e) { out.push(`${path}: not valid JSON: ${String(e.message).slice(0, 160)}`); }
    }
  }
  return out;
}

// the shared ledgers every agent appends to: they only ever grow, a line or a row at a time
export const LEDGERS = ['void-live-deploy/void.growth.json', 'domains/void.frontier.md', 'domains/handoff.md', 'domains/lists.metrics.json', 'domains/void.voice.md', 'docs/convergence.md'];
const headings = (t) => String(t || '').split('\n').filter((l) => /^## /.test(l)).map((l) => l.trim());
/** why a ledger's new text looks cut ("" when it looks fine): under half the base's size, or a .md heading gone. Pure. */
export function ledgerShrinks(path, before, after) {
  if (!LEDGERS.includes(path) || typeof before !== 'string' || typeof after !== 'string' || before.length < 400) return '';
  if (after.length < before.length / 2) return `${path}: shrank from ${before.length} to ${after.length} bytes: a ledger only grows; write it with git, not a whole-file API write (VOID_SKIP_PREPUSH=1 if this is on purpose)`;
  if (/\.md$/.test(path)) { const gone = headings(before).filter((h) => !headings(after).includes(h)); if (gone.length) return `${path}: lost the heading "${gone[0]}"${gone.length > 1 ? ` (and ${gone.length - 1} more)` : ''}: a ledger keeps its sections`; }
  return '';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const git = (...a) => execFileSync('git', a, { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256e6, timeout: 120e3 });
  if (process.argv.includes('--staged')) {
    let names;
    try { names = git('diff', '--cached', '--name-only', '--diff-filter=ACMR').split('\n').filter(Boolean); }
    catch (e) { console.error(`precommit: cannot list the staged files: ${String(e.stderr || e.message).split('\n')[0]}`); process.exit(1); }
    const files = names.map((path) => { try { return { path, text: git('show', ':' + path) }; } catch (_) { return { path, text: null }; } });
    const problems = problemsIn(files);
    if (problems.length) { console.error(`precommit: ${problems.length} problem(s) in what is staged:\n  ` + problems.join('\n  ') + '\nprecommit: nothing committed. Settle it (node tools/merge-main.mjs), stage again, commit again.'); process.exit(1); }
    console.log(`precommit: ${names.length} staged file(s): no conflict markers, every script and JSON file parses`);
    process.exit(0);
  }
  const at = process.argv.indexOf('--base');
  let base = at >= 0 ? process.argv[at + 1] : '';
  if (!base) { try { base = git('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}').trim(); } catch (_) { base = 'origin/main'; } }
  let names;
  try { names = git('diff', '--name-only', '--diff-filter=ACMR', base, 'HEAD').split('\n').filter(Boolean); }
  catch (e) { console.error(`prepush: cannot diff against ${base}: ${String(e.stderr || e.message).split('\n')[0]}`); process.exit(1); }
  const files = names.map((path) => { try { return { path, text: git('show', 'HEAD:' + path) }; } catch (_) { return { path, text: null }; } });
  const problems = problemsIn(files);
  for (const f of files) if (LEDGERS.includes(f.path)) { let before = null; try { before = git('show', base + ':' + f.path); } catch (_) {} const why = ledgerShrinks(f.path, before, f.text); if (why) problems.push(why); }
  if (problems.length) { console.error(`prepush: ${problems.length} problem(s) in what this push would send (${names.length} changed file(s) against ${base}):\n  ` + problems.join('\n  ')); process.exit(1); }
  console.log(`prepush: ${names.length} changed file(s) against ${base}: no conflict markers, every script and JSON file parses`);
}
