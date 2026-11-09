// What an agent runs before it opens a pull request (owner, 2026-11-04: one pull request per task, rebase on main first, never edit a
// generated file by hand, and the code is perfect going in; then "only open easily clearable ones so we dont hang anymore").
// A pull request opens only when it can clear: on top of main, small, single purpose, and touching no file another open PR is changing.
//   node tools/pre-pr.mjs                 the refusals below, then the fast checks for what changed
//   node tools/pre-pr.mjs --check-only    only the refusals (helper-pr.yml runs this before it opens a PR)
//   --pr <n>                              this branch's own PR, left out of the overlap check (found by branch name when gh can say)
// Refusals: behind main; a build output in the diff (tools/generated.mjs); more than MAX_LINES changed lines (added + removed, not
// counting build outputs, the append-only records and binary files); a file another open pull request also changes (tools/collide.mjs
// COMMON and the append-only records aside, since tools/merge-main.mjs settles those). Split a big change into PRs that each stand alone.
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generatedTouched, BUILD_OUTPUTS } from './generated.mjs';
import { APPEND_JSON, APPEND_TEXT } from './records.mjs';
import { COMMON } from './collide.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const git = (args) => spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20, timeout: 120e3 });

/** the most changed lines one pull request may carry (owner, 2026-11-04: "only open easily clearable ones"). */
export const MAX_LINES = 400;
// written by a run, one small file each, or appended by every bot: never what makes a PR hard to review or land
const NOT_COUNTED = [/^growth\/entries\//, /^void-live-deploy\/incidents\/entries\//, /^void-live-deploy\/tower-evidence\//, /^void-live-deploy\/skills\/order\//, /(^|\/)package-lock\.json$/];
/** files every PR may share with another open PR: the shared ledgers and the records tools/merge-main.mjs merges by keeping both sides. */
export const SHARED_OK = [...new Set([...COMMON, ...APPEND_JSON, ...APPEND_TEXT, 'docs/MAP.md'])];

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

/** git diff --numstat text -> { lines, counted: [{ file, n }] } with build outputs, run records and binaries left out. Pure. */
export function diffSize(numstat) {
  const skip = new Set([...BUILD_OUTPUTS, ...APPEND_JSON, ...APPEND_TEXT]);
  const counted = [];
  for (const line of String(numstat || '').split('\n')) {
    const m = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
    if (!m || m[1] === '-' || m[2] === '-') continue; // a binary file
    const file = m[3].includes(' => ') ? m[3].replace(/\{([^}]*) => ([^}]*)\}/, '$2').replace(/^.* => /, '') : m[3];
    if (skip.has(file) || NOT_COUNTED.some((re) => re.test(file))) continue;
    counted.push({ file, n: Number(m[1]) + Number(m[2]) });
  }
  return { lines: counted.reduce((s, x) => s + x.n, 0), counted: counted.sort((a, b) => b.n - a.n) };
}

/** the open PRs (not `self`) that change one of `files`, with the shared files that are not SHARED_OK. prs: [{ number, title, files }]. Pure. */
export function overlapping(files, prs, self = null, ok = SHARED_OK) {
  const mine = new Set((files || []).filter((f) => !ok.includes(f)));
  return (prs || []).filter((p) => p.number !== self).map((p) => ({ number: p.number, title: p.title, shared: (p.files || []).filter((f) => mine.has(f)) })).filter((p) => p.shared.length);
}

/** every refusal for this branch, as lines to print; empty when it may open. Pure apart from what it is handed. */
export function refusals({ behind, files, numstat, prs, self, max = MAX_LINES }) {
  const out = [];
  if (behind > 0) out.push('this branch is ' + behind + ' commit(s) behind main. Bring main in first (node tools/merge-main.mjs).');
  const generated = generatedTouched(files);
  if (generated.length) out.push('these are written at deploy, from their own sources. Take them out of the commit:\n  ' + generated.join('\n  ') +
    '\nsources: skills/order/ (the index), growth/entries/ (the ledger), incidents/entries/ (one file per suite run), tower-evidence/ (one file per floor). Then node tools/refresh.mjs on the deploy, not in the pull request.');
  const size = diffSize(numstat);
  if (size.lines > max) out.push(size.lines + ' changed lines, more than ' + max + ' (build outputs and run records not counted). Split it into pull requests that each do one thing and land alone. Largest:\n  ' + size.counted.slice(0, 8).map((x) => x.n + '  ' + x.file).join('\n  '));
  if (prs) for (const p of overlapping(files, prs, self)) out.push('open PR #' + p.number + ' (' + String(p.title || '').slice(0, 70) + ') also changes ' + p.shared.join(', ') + '. Wait for it to land, then bring main in, or leave those files out.');
  return out;
}

function openPrs() {
  const r = spawnSync('gh', ['api', '--paginate', 'repos/{owner}/{repo}/pulls?state=open&per_page=100', '--jq', '.[] | {number, title, head: .head.ref}'], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20, timeout: 120e3 });
  if (r.status !== 0) return null;
  const prs = String(r.stdout || '').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  for (const p of prs) {
    const f = spawnSync('gh', ['api', '--paginate', 'repos/{owner}/{repo}/pulls/' + p.number + '/files?per_page=100', '--jq', '.[].filename'], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20, timeout: 120e3 });
    p.files = f.status === 0 ? String(f.stdout || '').split('\n').filter(Boolean) : [];
  }
  return prs;
}

function main() {
  const args = process.argv.slice(2);
  const behind = behindCount();
  if (behind === null) { console.error('pre-pr: fetch origin main first (git fetch origin main)'); process.exit(2); }
  const files = branchFiles();
  const numstat = git(['diff', '--numstat', 'origin/main...HEAD']);
  if (!files || numstat.status !== 0) { console.error('pre-pr: could not read the diff against origin/main'); process.exit(2); }
  const prs = process.env.PRE_PR_OFFLINE === '1' ? null : openPrs();
  const branch = String(git(['rev-parse', '--abbrev-ref', 'HEAD']).stdout || '').trim();
  const head = process.env.PRE_PR_BRANCH || branch;
  const self = args.includes('--pr') ? Number(args[args.indexOf('--pr') + 1]) : (prs || []).find((p) => p.head === head)?.number ?? null;
  const out = refusals({ behind, files, numstat: numstat.stdout, prs, self });
  if (out.length) { for (const o of out) console.error('pre-pr: ' + o); process.exit(1); }
  console.log('pre-pr: on top of main, ' + diffSize(numstat.stdout).lines + ' changed lines (at most ' + MAX_LINES + '), no build output, ' + (prs ? 'no file another open PR changes' : 'open PRs not checked (gh could not list them)'));
  if (args.includes('--check-only')) return;
  const r = spawnSync(process.execPath, [resolve(root, 'tools/checks.mjs'), '--changed'], { cwd: root, encoding: 'utf8', stdio: 'inherit', env: { ...process.env, VOID_SKIP_BENCH: '1' } });
  process.exit(r.status ?? 1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
