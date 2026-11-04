// What an agent runs before it opens a pull request (owner, 2026-11-04: one pull request per task, rebase
// on main first, never edit a generated file by hand, and the code is perfect going in).
//   node tools/pre-pr.mjs                 refuse a branch behind main or one that commits a build output, then the fast checks
//   node tools/pre-pr.mjs --check-only    only the behind-main and build-output refusals
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generatedTouched } from './generated.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const git = (args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });

/** commits on `upstream` that `head` does not have. Null when git cannot say. */
export function behindCount(upstream = 'origin/main', head = 'HEAD', run = git) {
  const r = run(['rev-list', '--count', head + '..' + upstream]);
  if (r.status !== 0) return null;
  return Number(String(r.stdout || '').trim());
}

export function branchFiles(upstream = 'origin/main', run = git) {
  const r = run(['diff', '--name-only', upstream + '...HEAD']);
  if (r.status !== 0) return null;
  return String(r.stdout || '').split('\n').map((s) => s.trim()).filter(Boolean);
}

function main() {
  const behind = behindCount();
  if (behind === null) { console.error('pre-pr: fetch origin main first (git fetch origin main)'); process.exit(2); }
  if (behind > 0) { console.error('pre-pr: this branch is ' + behind + ' commit(s) behind main. Rebase on main before opening the pull request (node tools/merge-main.mjs).'); process.exit(1); }
  const files = branchFiles();
  if (!files) { console.error('pre-pr: could not read the diff against origin/main'); process.exit(2); }
  const generated = generatedTouched(files);
  if (generated.length) {
    console.error('pre-pr: these are written at deploy, from their own sources. Take them out of the commit:\n  ' + generated.join('\n  '));
    console.error('sources: skills/order/ (the index), growth/entries/ (the ledger), incidents/entries/ (one file per suite run), tower-evidence/ (one file per floor). Then node tools/refresh.mjs on the deploy, not in the pull request.');
    process.exit(1);
  }
  console.log('pre-pr: on top of main, and no build output in the diff');
  if (process.argv.includes('--check-only')) return;
  const r = spawnSync(process.execPath, [resolve(root, 'tools/checks.mjs'), '--changed'], { cwd: root, encoding: 'utf8', stdio: 'inherit', env: { ...process.env, VOID_SKIP_BENCH: '1' } });
  process.exit(r.status ?? 1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
