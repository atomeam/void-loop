#!/usr/bin/env node
// A pull request opened or updated with the repository GITHUB_TOKEN (author github-actions[bot]) creates
// pull_request runs in the approval-required state: zero jobs, until someone with write access approves them
// (GitHub changelog 2026-06-11, "Bot-created pull requests can run workflows if approved"). workflow_dispatch
// always runs, from that same token. This starts the same checks the pull_request event would have started.
// It does not approve the held runs, and it does not skip a check: deploy.yml's pr input is the quick checks
// a pull request already gets, and it never deploys.
//   node tools/loop-checks.mjs --pr <number or url> --ref <branch> [--files a,b] [--repo o/r] [--from automerge|resolve]
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Every pull_request opened/synchronize workflow that is not limited to a path. automerge is left out when
// this is started from automerge itself, so a sweep cannot start another sweep.
export const ALWAYS = [
  { file: 'void-review.yml', args: (pr) => ['-f', `pr=${pr}`] },
  { file: 'merge-gate.yml', args: (pr) => ['-f', `pr=${pr}`] },
  { file: 'deploy.yml', args: (pr) => ['-f', `pr=${pr}`] },
  { file: 'collide.yml', args: (pr) => ['-f', `pr=${pr}`] },
  { file: 'automerge.yml', args: (pr) => ['-f', `pr=${pr}`] },
];

// The same path filters as the workflows. A prefix matches GitHub's directory globs; an exact name matches a file.
export const PATHS = [
  { file: 'loop-critic.yml', prefixes: ['void-live-deploy/', 'void.html'], args: (pr) => ['-f', `pr=${pr}`] },
  { file: 'workflow-lint.yml', prefixes: ['.github/workflows/', '.github/actions/'] },
  { file: 'bench.yml', prefixes: ['tools/bench.mjs', '.github/workflows/bench.yml', '.github/actions/void-test/'] },
  { file: 'ouroboros.yml', prefixes: ['tools/ouroboros', 'tools/void_lens.py', 'tools/build_ouroboros_pack.py', '.github/workflows/ouroboros.yml'] },
  { file: 'touch-webkit.yml', prefixes: ['void-live-deploy/skills/ringer', 'void-live-deploy/skills/mini/ringer.js', 'void-live-deploy/skills/scene3d.js', 'tools/test_3d.mjs', 'tools/touch-webkit.mjs', '.github/workflows/touch-webkit.yml'] },
];

const touches = (file, prefixes) => prefixes.some((p) => file === p || file.startsWith(p));

/** The workflows to start for this diff. `from: 'automerge'` leaves automerge.yml out. Pure. */
export function checksFor(files, { from = '' } = {}) {
  const list = [...ALWAYS, ...PATHS.filter((c) => (files || []).some((f) => touches(f, c.prefixes)))];
  return from === 'automerge' ? list.filter((c) => c.file !== 'automerge.yml') : list;
}

/** A pull request number from a number or a pull URL, or ''. Pure. */
export function prNumber(v) {
  const m = String(v || '').trim().match(/(\d+)\s*$/);
  return m ? m[1] : '';
}

/** gh argv for one workflow. Pure. */
export function ghArgs(check, { pr, ref, repo }) {
  const a = ['workflow', 'run', check.file];
  if (repo) a.push('--repo', repo);
  a.push('--ref', ref);
  if (check.args) a.push(...check.args(pr));
  return a;
}

const SAFE_REF = /^[A-Za-z0-9._/-]+$/;

function parse(argv) {
  const o = { pr: '', ref: '', files: null, repo: process.env.GITHUB_REPOSITORY || '', from: '', help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => { const v = argv[++i]; if (v === undefined) throw new Error(a + ' needs a value'); return v; };
    if (a === '--pr') o.pr = val();
    else if (a === '--ref') o.ref = val();
    else if (a === '--files') o.files = val();
    else if (a === '--repo') o.repo = val();
    else if (a === '--from') o.from = val();
    else if (a === '-h' || a === '--help') o.help = true;
    else throw new Error('unknown flag ' + a);
  }
  return o;
}

function gh(args) {
  return spawnSync('gh', args, { encoding: 'utf8' });
}

function main(argv) {
  let o;
  try { o = parse(argv); } catch (e) { console.error(e.message); return 2; }
  if (o.help) { console.log('node tools/loop-checks.mjs --pr <number or url> --ref <branch> [--files a,b] [--repo o/r] [--from automerge]'); return 0; }
  if (!SAFE_REF.test(o.ref) || o.ref.includes('..')) { console.error('ref must be a branch name'); return 2; }
  let pr = prNumber(o.pr);
  if (!pr) {
    const q = ['pr', 'list', '--head', o.ref, '--state', 'open', '--json', 'number', '--jq', '.[0].number'];
    if (o.repo) q.splice(2, 0, '--repo', o.repo);
    pr = prNumber(gh(q).stdout);
  }
  if (!/^\d+$/.test(pr)) { console.error('no open pull request for ' + o.ref); return 1; }
  let files = o.files === null ? null : o.files.split(',').map((s) => s.trim()).filter(Boolean);
  if (files === null) {
    const path = `repos/${o.repo || '{owner}/{repo}'}/pulls/${pr}/files`;
    const r = gh(['api', '--paginate', path, '--jq', '.[].filename']);
    if (r.status) { console.error('could not read the pull request files: ' + (r.stderr || r.stdout || '').trim().slice(0, 200)); return 1; }
    files = (r.stdout || '').trim().split('\n').filter(Boolean);
  }
  let failed = 0;
  for (const c of checksFor(files, { from: o.from })) {
    const w = gh(ghArgs(c, { pr, ref: o.ref, repo: o.repo }));
    const msg = ((w.stderr || '') + (w.stdout || '')).trim().slice(0, 200);
    if (w.status) { failed++; console.log(c.file + ': not started: ' + msg); }
    else console.log(c.file + ': started');
  }
  return failed ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
