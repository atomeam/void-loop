// Stop a broken intermediate state from reaching the remote (tonight a branch got a conflict marker in the growth ledger and then a
// missing comma in it; only luck and a later check caught them). Over the files the push would add or change, as they are in HEAD:
// a git conflict marker in any text file, a .js/.mjs that does not parse (node --check, as an ES module: package.json says module),
// and a .json that does not parse (the missing comma was in one).
//   node tools/prepush.mjs [--base <ref>]   checks the files that differ between <ref> and HEAD
//                                           (default: this branch's upstream, else origin/main); exit 1 and say what and where
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const git = (...a) => execFileSync('git', a, { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256e6 });
  const at = process.argv.indexOf('--base');
  let base = at >= 0 ? process.argv[at + 1] : '';
  if (!base) { try { base = git('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}').trim(); } catch (_) { base = 'origin/main'; } }
  let names;
  try { names = git('diff', '--name-only', '--diff-filter=ACMR', base, 'HEAD').split('\n').filter(Boolean); }
  catch (e) { console.error(`prepush: cannot diff against ${base}: ${String(e.stderr || e.message).split('\n')[0]}`); process.exit(1); }
  const files = names.map((path) => { try { return { path, text: git('show', 'HEAD:' + path) }; } catch (_) { return { path, text: null }; } });
  const problems = problemsIn(files);
  if (problems.length) { console.error(`prepush: ${problems.length} problem(s) in what this push would send (${names.length} changed file(s) against ${base}):\n  ` + problems.join('\n  ')); process.exit(1); }
  console.log(`prepush: ${names.length} changed file(s) against ${base}: no conflict markers, every script and JSON file parses`);
}
