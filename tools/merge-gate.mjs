// Test the pull request as it will be after main is merged in (owner, 2026-11-04: the code is perfect
// going in). A conflict in a build output is regenerated; any other conflict fails and names the files.
// The fast checks then run on that tree. The full suite still runs on main after the merge.
//   node tools/merge-gate.mjs
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILD_OUTPUTS } from './generated.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = new Set(BUILD_OUTPUTS);

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
    const merged = git(['merge', '--no-commit', '--no-ff', base], dir);
    if (merged.status !== 0) {
      const files = String(git(['diff', '--name-only', '--diff-filter=U'], dir).stdout || '').split('\n').map((s) => s.trim()).filter(Boolean);
      const merging = git(['rev-parse', '-q', '--verify', 'MERGE_HEAD'], dir).status === 0;
      if (!files.length && merging) console.log('merge-gate: main is in, nothing left unmerged');
      else if (!onlyBuildConflicts(files)) {
        console.error('merge-gate: conflicts with main in ' + (files.join(', ') || '(none)'));
        console.error(String(merged.stderr || merged.stdout || (merged.error && merged.error.message) || '').slice(0, 800));
        console.error('A build output is regenerated here. These files need a person: run node tools/merge-main.mjs on the branch.');
        process.exit(1);
      } else {
        for (const f of files) git(['checkout', '--ours', '--', f], dir);
        git(['add', '--', ...files], dir);
        console.log('merge-gate: regenerated through the conflict in ' + files.join(', '));
      }
    }
    // the generators, so the checks see the tree the deploy will serve
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
    const checks = spawnSync(process.execPath, [resolve(dir, 'tools/checks.mjs'), '--changed', '--skip-browser'], {
      cwd: dir, encoding: 'utf8', stdio: 'inherit',
      env: { ...process.env, VOID_ALLOW_CHANGED: '1', VOID_SKIP_BENCH: '1', VOID_GATE: '1', CI: '', GITHUB_ACTIONS: '' },
    });
    process.exit(checks.status ?? 1);
  } finally { rm(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
