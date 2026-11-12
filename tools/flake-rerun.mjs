// One rerun when Verse verify fails on main (verify.yml). A pass is written into tools/flakes.json and the
// run stays green. A second failure keeps the revert path. This does not skip a check.
//   node tools/flake-rerun.mjs decide --failed [--rerun pass|fail]
//   node tools/flake-rerun.mjs land --sha <sha> --job "<job>" [--output <file>]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { failingChecks } from './revert-target.mjs';
import { recorded, text, FLAKES } from './flakes.mjs';

/** What a failed job should do next. rerun is 'pass', 'fail', or omitted when it has not run. Pure. */
export function decide({ failed = false, rerun = '' } = {}) {
  if (!failed) return { action: 'ok', green: true, record: false };
  if (rerun === 'pass') return { action: 'record', green: true, record: true };
  if (rerun === 'fail') return { action: 'revert', green: false, record: false };
  return { action: 'rerun', green: false, record: false };
}

/** The failed check names, or the job name when the output names none. Pure. */
export function namesOf(output, job) {
  const found = failingChecks(output).slice(0, 9);
  if (found.length) return found;
  const name = String(job || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  return name ? [name] : [];
}

function git(args) { return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 << 20 }); }

/** Append the flake rows and push only tools/flakes.json to main. Exit 0 either way: the rerun passed. */
export function land({ sha, job, output = '', runGit = git } = {}) {
  if (!/^[0-9a-f]{7,40}$/i.test(String(sha || ''))) { console.log('flake rerun: no commit to record'); return 0; }
  let body = '';
  if (output && existsSync(output)) { try { body = readFileSync(output, 'utf8'); } catch (_) { body = ''; } }
  const checks = namesOf(body, job);
  if (!checks.length) { console.log('flake rerun: nothing to record'); return 0; }
  try { runGit(['config', 'user.name', 'github-actions[bot]']); runGit(['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']); } catch (_) {}
  for (let i = 1; i <= 4; i++) {
    try {
      try { runGit(['reset', '-q', '--hard']); } catch (_) {}
      runGit(['fetch', '-q', 'origin', 'main']);
      runGit(['checkout', '-q', '-B', 'main', 'origin/main']);
      const before = existsSync(FLAKES) ? JSON.parse(readFileSync(FLAKES, 'utf8')) : [];
      const after = recorded(before, sha, checks);
      if (after.length === before.length) { console.log('flake rerun: already recorded'); return 0; }
      writeFileSync(FLAKES, text(after));
      runGit(['add', '--', 'tools/flakes.json']);
      runGit(['commit', '-q', '-m', 'Flake: ' + checks.length + ' check(s) passed on a rerun of ' + String(sha).slice(0, 7) + ' (tools/flakes.json)']);
      runGit(['push', '-q', 'origin', 'HEAD:main']);
      console.log('flake rerun: recorded ' + checks.join('; '));
      return 0;
    } catch (e) {
      console.log('flake rerun: record try ' + i + ' did not land (' + String(e && e.message || e).split('\n')[0].slice(0, 160) + ')');
    }
  }
  console.log('::warning title=Flake not recorded::the rerun passed; the flake list was not pushed');
  return 0;
}

function arg(name, argv) { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : ''; }

function main(argv) {
  const [cmd] = argv;
  if (cmd === 'decide') { console.log(JSON.stringify(decide({ failed: argv.includes('--failed'), rerun: argv.includes('--rerun') ? arg('--rerun', argv) : '' }))); return 0; }
  if (cmd === 'names') {
    let body = '';
    const output = arg('--output', argv);
    if (output && existsSync(output)) body = readFileSync(output, 'utf8');
    for (const n of namesOf(body, arg('--job', argv))) console.log(n);
    return 0;
  }
  if (cmd === 'land') return land({ sha: arg('--sha', argv), job: arg('--job', argv), output: arg('--output', argv) });
  console.error('usage: node tools/flake-rerun.mjs decide --failed [--rerun pass|fail] | names --job "..." [--output file] | land --sha <sha> --job "..." [--output file]');
  return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
