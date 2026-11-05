// Test the pull request as it will be after main is merged in (owner, 2026-11-04: the code is perfect
// going in). A conflict in a build output is regenerated; any other conflict fails and names the files.
// The fast checks then run on that tree. The full suite still runs on main after the merge.
// A merge-policy failure names the rule and the file, branch or label that broke it. The check used to
// print only "FAIL merge-policy" and a duration (2026-11-05, #2315).
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

// an assertion that names no file still belongs to the source it was written against
const POLICY_FILE = [
  [/enablePullRequestAutoMerge|mergeMethod:SQUASH|merge_method=squash|disablePullRequestAutoMerge|update-branch/, 'file tools/automerge.mjs'],
  [/pull-requests: write|17 \\?\* \\?\*|STUCK:/, 'file .github/workflows/automerge.yml'],
];

/** the first line of a node:test error, without the source dump that follows "Input:". Pure. */
function policyError(block) {
  const quoted = String(block || '').match(/\n  error: '([^'\n]*)'/);
  if (quoted) return quoted[1];
  const multi = String(block || '').match(/\n  error: \|-\n([\s\S]*?)\n  [A-Za-z]/);
  if (!multi) return '';
  const line = multi[1].split('\n').map((l) => l.replace(/^ {4}/, '')).join('\n').split(/\n\s*\n/)[0].split('\n')[0].trim();
  return line.replace(/\s*Input:\s*$/, '').trim();
}

/** the file, branch or label a failure is about. The earliest one the message names wins. Pure. */
function policyOffender(msg) {
  const text = String(msg || '');
  const marks = [];
  const take = (re, kind) => { const m = re.exec(text); if (m) marks.push({ at: m.index, text: kind + ' ' + m[1].replace(/[.,;:)]+$/, '') }); };
  take(/\bfile\s+(\S+)/, 'file');
  take(/\bbranch\s+(\S+)/, 'branch');
  take(/\blabel\s+["']?([A-Za-z0-9][\w.-]*)/, 'label');
  take(/((?:tools|void-live-deploy|\.github)\/[\w./-]+\.\w+)/, 'file');
  take(/\b((?:helper|loop|lab|cursor)\/[\w./-]+)\b/, 'branch');
  if (marks.length) return marks.sort((a, b) => a.at - b.at)[0].text;
  for (const [re, who] of POLICY_FILE) if (re.test(text)) return who;
  return '';
}

/**
 * One line per failed merge-policy test. The rule is the test's name. The offender is the file, branch
 * or label the failure names (a bare auto-merge assertion is tools/automerge.mjs). `tap` is what
 * `node --test tools/merge-policy.test.mjs` prints. Pure.
 */
export function explainPolicyFailure(tap) {
  const out = [];
  for (const block of String(tap || '').split(/\n(?=not ok \d+ - )/)) {
    const head = block.match(/^not ok \d+ - (.+)$/m);
    if (!head) continue;
    const rule = head[1].trim();
    const why = policyError(block);
    const who = policyOffender(why);
    out.push('merge-policy rule "' + rule + '" violated' + (who ? ' by ' + who : '') + (why ? ': ' + why : ''));
  }
  return out;
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
    const checks = spawnSync(process.execPath, [resolve(dir, 'tools/checks.mjs'), '--changed', '--skip-browser'], {
      cwd: dir, encoding: 'utf8', maxBuffer: 20e6,
      env: { ...process.env, VOID_ALLOW_CHANGED: '1', VOID_SKIP_BENCH: '1', VOID_GATE: '1', CI: '', GITHUB_ACTIONS: '' },
    });
    if (checks.stdout) process.stdout.write(checks.stdout);
    if (checks.stderr) process.stderr.write(checks.stderr);
    if (checks.error) console.error('merge-gate: ' + checks.error.message);
    const report = String(checks.stdout || '') + String(checks.stderr || '');
    // the check keeps two lines. The test's own output names the rule, and that output was thrown away (2026-11-05, #2315).
    if ((checks.status ?? 1) !== 0 && /FAIL\s+merge-policy\b/.test(report)) {
      const again = spawnSync(process.execPath, ['--test', resolve(dir, 'tools/merge-policy.test.mjs')], { cwd: dir, encoding: 'utf8', maxBuffer: 20e6 });
      const lines = explainPolicyFailure(String(again.stdout || '') + '\n' + String(again.stderr || ''));
      if (lines.length) for (const line of lines) console.error('merge-gate: ' + line);
      else console.error('merge-gate: merge-policy failed and named no rule');
    }
    process.exit(checks.status ?? 1);
  } finally { rm(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
