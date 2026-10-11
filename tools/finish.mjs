// The end of every run in one command (pit crew position 2, 2026-10-11): the steps AGENTS.md lists after the build, in
// order, stopping at the first that fails, so no run forgets one and none is done by hand.
//   node tools/finish.mjs <kind> "what changed, in plain words" [--log "the agent-log line, if it should say more"]
//        [--by claude] [--title "commit and PR title"] [--brief "who it is for; the problem; what it will not build"] [--dry] [--from N]
// kinds are the ledger's: grow, build, fix, retire, idea, finding (tools/grow.mjs).
//   1. the growth ledger line (tools/grow.mjs)          2. the agent-log line (domains/void.agents.log.md)
//   3. the map covers every skill, miniature, workflow and tool (tools/map-coverage.test.mjs; add a line to docs/MAP.md if not)
//   4. commit everything                                5. bring main in (tools/merge-main.mjs)
//   6. the fast checks (tools/checks.mjs)               7. push (tools/push.mjs)
//   8. the PR, with a B.I.T.E. body, labelled automerge (gh, when it is signed in; otherwise the body is printed to paste)
// --dry prints the steps and runs none of them. --from N starts at step N, after a stop, so the ledger and log lines are not
// written twice. Nothing here edits an old ledger or log line.
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KINDS } from './grow.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOG = resolve(root, 'domains', 'void.agents.log.md');
const node = (script, ...a) => [process.execPath, [resolve(root, 'tools', script), ...a]];

/** the parsed command line, or { error }. Pure. */
export function parseArgs(argv) {
  const [kind, what, ...rest] = argv;
  const opt = (flag) => { const i = rest.indexOf(flag); return i >= 0 && rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[i + 1] : ''; };
  if (!KINDS.includes(kind)) return { error: 'the first word is the kind: ' + KINDS.join(', ') };
  if (!what || what.startsWith('--')) return { error: 'say what changed, in quotes: node tools/finish.mjs build "the tide card shows the next three tides"' };
  if (/[\r\n]/.test(what)) return { error: 'what changed is one line' };
  return { kind, what, by: opt('--by') || 'claude', log: opt('--log') || what, title: opt('--title') || what, brief: opt('--brief'), dry: rest.includes('--dry'), from: Math.max(1, Number(opt('--from')) || 1) };
}

/** the agent-log line, in the log's own shape. Pure. */
export const logLine = ({ by, kind, log }, at = new Date()) => `${at.toISOString().replace(/\.\d+Z$/, 'Z')} | ${by} | ${kind} | ${log.replace(/\s+/g, ' ').trim()}`;

/** the PR body: AGENTS.md's B.I.T.E. headings, filled from what the run said. Pure. */
export function prBody({ what, brief, kind }) {
  return ['## Brief (B.I.T.E.)', brief || '- **For:** \n- **Problem:** \n- **First version:** ' + what + '\n- **Will not build:** ', '',
    '## Implement', `${kind}: ${what}`, '', '## Test', '- `VOID_SKIP_BENCH=1 node tools/checks.mjs` passes (run by tools/finish.mjs)', '- Used as a person would: ', '',
    '## Evolve', '- '].join('\n');
}

/** the steps, as [label, command | function]. Pure apart from what the functions do when run. */
export function steps(a) {
  return [
    ['ledger line', node('grow.mjs', a.kind, a.what, '--by', a.by)],
    ['agent-log line', () => { appendFileSync(LOG, logLine(a) + '\n'); return 0; }],
    ['map covers everything', [process.execPath, ['--test', resolve(root, 'tools', 'map-coverage.test.mjs')]]],
    ['commit', () => (git('add', '-A') || git('commit', '-q', '-m', a.title))],
    ['bring main in', node('merge-main.mjs')],
    ['fast checks', node('checks.mjs')],
    ['push', node('push.mjs')],
    ['pull request', () => openPr(a)],
  ];
}

function run(cmd, args, env) { return spawnSync(cmd, args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } }).status ?? 1; }
function git(...a) { return run('git', a); }
const out = (cmd, args) => { const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8' }); return r.status === 0 ? (r.stdout || '').trim() : null; };

function openPr(a) {
  const body = prBody(a);
  if (out('gh', ['auth', 'status']) === null) {
    console.log('\ngh is not signed in here: open the PR yourself with this body, then node tools/automerge.mjs <pr> --label\n\n' + body);
    return 0;
  }
  const branch = out('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  const url = out('gh', ['pr', 'create', '--head', branch, '--title', a.title, '--body', body]) || out('gh', ['pr', 'view', branch, '--json', 'url', '-q', '.url']);
  const pr = url && /\/pull\/(\d+)/.exec(url);
  if (!pr) { console.error('could not open or find the PR for ' + branch); return 1; }
  console.log('PR: ' + url);
  return run(...node('automerge.mjs', pr[1], '--label'));
}

function main(argv) {
  const a = parseArgs(argv.slice(2));
  if (a.error) { console.error('finish: ' + a.error + '\nusage: node tools/finish.mjs <kind> "what changed" [--log "..."] [--by claude] [--title "..."] [--brief "..."] [--dry] [--from N]'); return 2; }
  for (const [i, [label, step]] of steps(a).entries()) {
    const shown = typeof step === 'function' ? '' : ': ' + [step[0] === process.execPath ? 'node' : step[0], ...step[1].map((x) => x.replace(root + '/', ''))].join(' ');
    console.log(`\n[${i + 1}/8] ${label}${shown}`);
    if (a.dry || i + 1 < a.from) { if (i + 1 < a.from) console.log('  (done before: skipped)'); continue; }
    const code = typeof step === 'function' ? step() : run(step[0], step[1], label === 'fast checks' ? { VOID_SKIP_BENCH: '1' } : {});
    if (code !== 0) { console.error(`\nfinish: stopped at step ${i + 1} (${label}). Fix what it names, then: node tools/finish.mjs ${process.argv.slice(2).filter((x, j, all) => x !== '--from' && all[j - 1] !== '--from').map((x) => JSON.stringify(x)).join(' ')} --from ${i + 1}`); return 1; }
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv));
