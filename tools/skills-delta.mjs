// The skill collision check, compared with the base branch (void-review.yml). A failure that already
// happens on the base is not this pull request's to fix; a failure only the pull request has blocks it.
//   node tools/skills-delta.mjs --base origin/main
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** lines of a skills-check run that are failures. An exit of 0 is none. Pure. */
export function failureLines(text, code) {
  if (code === 0) return [];
  return String(text || '').split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l && !l.startsWith('all ') && !l.startsWith('smoke:'));
}

/** failure lines in `head` that are not in `base`, in order, once. Pure. */
export function addedFailures(head, base) {
  const have = new Set(base || []);
  const out = [];
  for (const line of head || []) if (!have.has(line) && !out.includes(line)) out.push(line);
  return out;
}

function runCheck(cwd) {
  const r = spawnSync(process.execPath, [resolve(cwd, 'tools/skills-check.mjs')], { cwd, encoding: 'utf8', timeout: 180000, maxBuffer: 20e6 });
  const text = (r.stdout || '') + '\n' + (r.stderr || '');
  return failureLines(text, r.status ?? 1);
}

function worktree(ref) {
  const dir = mkdtempSync(resolve(tmpdir(), 'skills-base-'));
  const add = spawnSync('git', ['worktree', 'add', '--detach', '-q', dir, ref], { cwd: root, encoding: 'utf8' });
  if (add.status !== 0) throw new Error('could not check out ' + ref + ': ' + (add.stderr || add.stdout || '').slice(0, 300));
  return dir;
}

function main() {
  const i = process.argv.indexOf('--base');
  const baseRef = i >= 0 ? process.argv[i + 1] : 'origin/main';
  if (!baseRef) { console.error('usage: node tools/skills-delta.mjs --base origin/main'); process.exit(2); }
  let dir = '';
  try {
    const head = runCheck(root);
    dir = worktree(baseRef);
    // the same checker on both trees, so a line that only changed its wording is not a new failure
    for (const f of ['skills-check.mjs', 'skills-index.mjs', 'skills-unlisted.mjs']) copyFileSync(resolve(root, 'tools', f), resolve(dir, 'tools', f));
    const base = runCheck(dir);
    const added = addedFailures(head, base);
    if (!added.length) { console.log('skills: no new failure (' + head.length + ' on this head, ' + base.length + ' already on ' + baseRef + ')'); process.exit(0); }
    console.error(added.join('\n'));
    console.error('skills: ' + added.length + ' failure(s) this pull request adds (the ones already on ' + baseRef + ' are not this pull request\'s)');
    process.exit(1);
  } finally {
    if (dir) spawnSync('git', ['worktree', 'remove', '--force', dir], { cwd: root });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
