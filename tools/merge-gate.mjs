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

/** The checks' exit status. A worktree has no node_modules, so a check that imports a declared package (the Anthropic SDK
 *  in claude-brain.test.mjs) fails whatever the PR changed. On a red run, install what the lockfile pins once and run again:
 *  only a failure that survives the install is the PR's (the same rule as skill-safety.mjs). A failed install keeps the red. */
export function gateStatus(checks, install, log = () => {}) {
  const first = checks();
  if (first === 0) return 0;
  log('merge-gate: a check failed in a worktree with no installed packages; installing what package-lock.json pins and running the checks again');
  if (install() !== 0) { log('merge-gate: the install failed, so the first result stands'); return first; }
  return checks();
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
    // commit the merge so the checks see this pull request's files, not every file main just brought in
    const committed = git(['commit', '-q', '--no-edit'], dir);
    if (committed.status === 0) console.log('merge-gate: committed the merge');
    // the generators, so a build output that conflicted is rewritten before we put the tree back
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
    // the generators rewrite build outputs in the worktree. Put those back so a rewritten file does not
    // pull a pre-existing red check into this pull request. Do it even when the merge commit was a no-op.
    git(['reset', '--hard', 'HEAD'], dir);
    git(['clean', '-fd'], dir);
    const checks = () => spawnSync(process.execPath, [resolve(dir, 'tools/checks.mjs'), '--changed', '--skip-browser'], {
      cwd: dir, encoding: 'utf8', stdio: 'inherit',
      env: { ...process.env, VOID_ALLOW_CHANGED: '1', VOID_SKIP_BENCH: '1', VOID_GATE: '1', CI: '', GITHUB_ACTIONS: '' },
    }).status ?? 1;
    const install = () => spawnSync('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: dir, encoding: 'utf8', stdio: 'inherit' }).status ?? 1;
    process.exit(gateStatus(checks, install, (m) => console.log(m)));
  } finally { rm(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
