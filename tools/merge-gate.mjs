// Test the pull request as it will be after main is merged in (owner, 2026-11-04: the code is perfect
// going in). A conflict in a build output is regenerated; any other conflict fails and names the files.
// The fast checks then run on that tree. The full suite still runs on main after the merge.
//   node tools/merge-gate.mjs
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILD_OUTPUTS } from './generated.mjs';
import { APPEND_TEXT } from './records.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = new Set(BUILD_OUTPUTS);
// the append-mostly text files: a conflict there is two branches appending at the same spot, settled by keeping
// both sides' new lines (the same rule tools/merge-main.mjs applies); anything else still needs a person
const APPEND_MOSTLY = new Set([...APPEND_TEXT, 'tools/families.mjs']);

/** true when every conflicted path is a file the deploy rewrites. Pure. */
export function onlyBuildConflicts(files) {
  return files.length > 0 && files.every((f) => build.has(f));
}

function git(args, cwd) {
  return spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 20e6 });
}

function main() {
  const dir = mkdtempSync(resolve(tmpdir(), 'merge-gate-'));
  const rm = () => git(['worktree', 'remove', '--force', dir], root);
  const add = git(['worktree', 'add', '--detach', '-q', dir, 'HEAD'], root);
  if (add.status !== 0) { console.error('merge-gate: ' + (add.stderr || add.stdout)); process.exit(2); }
  try {
    const base = process.env.MERGE_GATE_BASE || 'origin/main';
    git(['config', 'user.email', 'merge-gate@users.noreply.github.com'], dir);
    git(['config', 'user.name', 'merge-gate'], dir);
    const merged = git(['merge', '--no-commit', '--no-ff', base], dir);
    if (merged.status !== 0) {
      const files = String(git(['diff', '--name-only', '--diff-filter=U'], dir).stdout || '').split('\n').map((s) => s.trim()).filter(Boolean);
      const merging = git(['rev-parse', '-q', '--verify', 'MERGE_HEAD'], dir).status === 0;
      if (!files.length && merging) console.log('merge-gate: main is in, nothing left unmerged');
      else if (!onlyBuildConflicts(files)) {
        // the append-mostly files settle the same way merge-main.mjs settles them (both sides' new lines), so a
        // branch that only appended does not need a person here either; anything else still stops below
        const settled = files.filter((f) => APPEND_MOSTLY.has(f));
        const rest = files.filter((f) => !settled.includes(f));
        for (const f of settled) {
          const base = git(['show', `:1:${f}`], dir).stdout || '';
          const ours = git(['show', `:2:${f}`], dir).stdout || '';
          const theirs = git(['show', `:3:${f}`], dir).stdout || '';
          const added = (s) => s.startsWith(base) ? s.slice(base.length) : s.split('\n').filter((l) => !base.split('\n').includes(l)).join('\n');
          const text = base + added(theirs).replace(/^\n+/, '') + (added(theirs).endsWith('\n') ? '' : '\n') + added(ours).replace(/^\n+/, '');
          writeFileSync(resolve(dir, f), text);
          git(['add', '--', f], dir);
          console.log('merge-gate: settled the append-collision in ' + f + ' (both sides\' new lines)');
        }
        if (rest.length) {
          console.error('merge-gate: conflicts with main in ' + (rest.join(', ') || '(none)'));
          console.error(String(merged.stderr || merged.stdout || (merged.error && merged.error.message) || '').slice(0, 800));
          console.error('A build output is regenerated here. These files need a person: run node tools/merge-main.mjs on the branch.');
          process.exit(1);
        }
      } else {
        for (const f of files) git(['checkout', '--ours', '--', f], dir);
        git(['add', '--', ...files], dir);
        console.log('merge-gate: regenerated through the conflict in ' + files.join(', '));
      }
    }
    // commit the merge so the checks see this pull request's files, not every file main just brought in
    const committed = git(['commit', '-q', '--no-edit'], dir);
    if (committed.status === 0) console.log('merge-gate: committed the merge');
    // the generators, so a build output that conflicted is rewritten before we put the tree back. The files the
    // merge itself rewrote (the append-mostly settles, and build outputs taken from ours) stay as committed in the
    // merge commit: resetting them would drop the settle and re-break the very files this branch appends to.
    const keep = new Set([...APPEND_MOSTLY, ...files]);
    for (const args of [
      ['tools/skills-index.mjs', '--write'],
      ['tools/deps.mjs'],
      ['tools/families.mjs'],
      ['tools/guide.mjs'],
      ['tools/what-skills.mjs'],
      ['tools/incident-log.mjs', 'assemble'],
      ['tools/tower-files.mjs', 'assemble'],
    ]) {
      const r = spawnSync(process.execPath, [resolve(dir, args[0]), ...args.slice(1)], { cwd: dir, encoding: 'utf8' });
      if (r.status !== 0) console.log('merge-gate: ' + args[0] + ' exited ' + r.status + ' (the check below says if that matters)');
    }
    // put the regenerated build outputs back so a rewritten file does not pull a pre-existing red check into this
    // pull request — but never the conflicted paths: those carry this branch's settle and stay as merged
    const changed = String(git(['diff', '--name-only'], dir).stdout || '').split('\n').map((s) => s.trim()).filter(Boolean);
    const restore = changed.filter((f) => !keep.has(f));
    if (restore.length) git(['checkout', '--', ...restore], dir);
    git(['clean', '-fd'], dir);
    const checks = spawnSync(process.execPath, [resolve(dir, 'tools/checks.mjs'), '--changed', '--skip-browser'], {
      cwd: dir, encoding: 'utf8', stdio: 'inherit',
      env: { ...process.env, VOID_ALLOW_CHANGED: '1', VOID_SKIP_BENCH: '1', VOID_GATE: '1', CI: '', GITHUB_ACTIONS: '' },
    });
    process.exit(checks.status ?? 1);
  } finally { rm(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
