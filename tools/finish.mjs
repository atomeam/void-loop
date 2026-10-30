// The end of every run in one command (pit crew position 2, 2026-10-11): the steps AGENTS.md lists after the build, in
// order, stopping at the first that fails, so no run forgets one and none is done by hand.
//   node tools/finish.mjs <kind> "what changed, in plain words" [--log "the agent-log line, if it should say more"]
//        [--by claude] [--title "commit and PR title"] [--brief "who it is for; the problem; what it will not build"] [--body "more commit message"]
//        [--evolve "wish; wish"] [--test "<browser-suite words>"]... [--show "the change in plain words"] [--try "an ask that shows it"] [--about "words its answer shows"] [--asked ask-…] [--job <id>] [--full] [--dry] [--from N]
// --show and --try go on the ledger line, so the "look what I made" walkthrough can put the change on the stage the next
// time someone comes back (skills/showcase.js); a grow or build that reaches the site without --try is reminded.
// --job <id> (a build-queue job this run claimed, tools/job-link.mjs): the PR body ends with `Job: <id>`, the job moves to
// `building` with the PR's address when the PR opens, and to `live` when it merges (tools/automerge.mjs, upkeep.yml).
// kinds are the ledger's: grow, build, fix, retire, idea, finding (tools/grow.mjs).
//   0. first shot (owner, 2026-10-11: automerge lands a PR before the full suite runs on main, so it has to be right before
//      the push): when the change touches the page or anything the site runs (void.html, void-live-deploy/), each --test
//      runs `test_void.mjs --only "<words>"` in a real browser and nothing is written or pushed unless it passes; such a
//      change with no --test stops here. Docs and tools need none.
//   1. the growth ledger line (tools/grow.mjs)          2. the agent-log line (domains/void.agents.log.md)
//   3. the map covers every skill, miniature, workflow and tool (tools/map-coverage.test.mjs; add a line to docs/MAP.md if not)
//   4. commit everything                                5. bring main in (tools/merge-main.mjs)
//   6. the fast checks (tools/checks.mjs --changed: only what covers the changed files; --full runs them all)   7. push (tools/push.mjs)
//   8. the PR, with a B.I.T.E. body, labelled automerge (gh, when it is signed in; otherwise the body is printed to paste)
// --dry prints the steps and runs none of them. --from N starts at step N, after a stop, so the ledger and log lines are not
// written twice. Nothing here edits an old ledger or log line.
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KINDS } from './grow.mjs';
import { jobLine, ID_RE as JOB_ID } from './job-link.mjs';

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
  // the self page counts an ask built only on evidence that names it (lib/voice.js followThrough): "asked by Verse" in words alone linked nothing,
  // so it read "0 of my 45 asks" while they were built (2026-10-17). Name the ask: its id, or Verse's own words (a few of its key words are enough).
  if (/\basked by (?:verse|void)\b/i.test(what) && !opt('--asked')) return { error: 'this says "asked by Verse": name the ask so the self page counts it built: --asked ask-… (its id) or --asked "Verse\'s words for it"' };
  const tests = rest.flatMap((x, i) => (x === '--test' && rest[i + 1] && !rest[i + 1].startsWith('--') ? [rest[i + 1]] : []));
  if (rest.includes('--job') && !JOB_ID.test(opt('--job'))) return { error: '--job is the queue job\'s id (4 to 16 lowercase letters and digits, as /api/queue shows it)' };
  return { kind, what, by: opt('--by') || 'claude', log: opt('--log') || what, title: opt('--title') || what, brief: opt('--brief'), body: opt('--body'), evolve: opt('--evolve'), show: opt('--show'), try: opt('--try'), about: opt('--about'), asked: opt('--asked'), job: opt('--job'), tests, dry: rest.includes('--dry'), full: rest.includes('--full'), from: Math.max(0, Number.isFinite(Number(opt('--from'))) && opt('--from') !== '' ? Number(opt('--from')) : 0) };
}

/** the changed files that reach the site: the page and its copies, skills, the server and its shared code. Pure. */
export const siteFiles = (files) => files.filter((f) => (f === 'void.html' || f.startsWith('void-live-deploy/')) && !/\.(json|md|txt)$/.test(f));

/** the files this branch changes against main, committed or not */
function changed() {
  const a = out('git', ['diff', '--name-only', 'origin/main...HEAD']) || '', b = out('git', ['status', '--porcelain']) || '';
  return [...new Set([...a.split('\n'), ...b.split('\n').map((l) => l.slice(3).replace(/^.* -> /, ''))].filter(Boolean))];
}

/** step 0: the browser check on what the change touched, or the reason it stops */
function firstShot(a) {
  const site = siteFiles(changed());
  if (!site.length) { console.log('  nothing the site runs changed: no browser check needed'); return 0; }
  if (!a.tests.length) {
    console.error('  this change reaches the site (' + site.slice(0, 4).join(', ') + (site.length > 4 ? ', ...' : '') + ') and has no --test.\n'
      + '  Pass --test "<words>" for the browser-suite sections it touches (node tools/test_void.mjs --list), so it is proven before it is pushed.');
    return 1;
  }
  for (const t of a.tests) { console.log('  test_void --only "' + t + '"'); const code = run(...node('heavy.mjs', process.execPath, resolve(root, 'tools', 'test_void.mjs'), '--only', t)); if (code !== 0) return code; }
  // the --try ask is what "look what I made" plays for this line, so a skill on this very tree has to answer it (owner,
  // 2026-10-16: "the preview is supposed to actually preview what it says"): typed into the page with outside services blocked
  if (a.try) {
    console.log('  ask.mjs "' + a.try + '" (the preview has to show something, and something about the ask: open the screenshot it saves and look)');
    const r = spawnSync(process.execPath, [resolve(root, 'tools', 'ask.mjs'), a.try], { encoding: 'utf8', timeout: 180e3, env: process.env });
    const text = (r.stdout || '') + (r.stderr || '');
    process.stdout.write(text);
    const p = tryProblem(text, a.about);
    if (p) { console.error('  --try "' + a.try + '": ' + p + '\n  Give --try an ask this change answers (node tools/ask.mjs "<ask>" shows who answers), or fix the matcher.'); return 1; }
  }
  return 0;
}

/** what is wrong with ask.mjs's report on the --try ask, or '' when a skill answered it with something about the ask. Pure. */
export function tryProblem(report, about = '') {
  const t = String(report || '');
  if (/\n\s*ERROR: /.test(t)) return 'the page threw an error on it';
  const by = /\n\s*by: (.*)/.exec(t);
  if (!by || /^\((?:nothing logged|no note)\)/.test(by[1])) return 'nothing answered it (no skill logged the ask)';
  if (/^(?:article|answer|short topic|article fallback)$|^miss/.test(by[1].trim())) return 'it fell through to the generic answer (' + by[1].trim() + ')';
  return offTopic(t, about);
}

// the words of an ask that say WHAT it is about, not how it is asked ("draw a cartoon cat" -> cat). Owner, 2026-10-23: "add a testing step
// to yourself that checks the result of everything to see if it even does what you expect or want ... i can tell you now cartoon is not what
// it should be" ("draw a toon cat" drew the same "Cartoon Lump" as every other subject, and every check passed because something answered).
const HOW = new Set(('a an the of to for me my mine your our us we i you it its this that these those is are was be am do does did can could would should will '
  + 'please and or with in on at by from as into about up out off now just some any one new show tell give make draw create put add open start play get find '
  + 'let lets let\'s what whats what\'s how why when where who which want need like turn set see look run build bring keep use say ask cartoon toon version '
  + 'card picture image photo thing stuff here there today verse void v01d').split(' '));
/** the content words of an ask. Pure. */
export const askWords = (ask) => [...new Set(String(ask || '').toLowerCase().replace(/[\u2019']/g, "'").split(/[^a-z0-9']+/).filter((w) => w.length > 2 && !HOW.has(w) && !/^\d+$/.test(w)))];
const stem = (w) => w.replace(/'s$/, '').replace(/(?:ing|es|s)$/, '');
/** '' when what the page showed (its text, its pictures' alt text) names at least one content word of the ask, else what is missing. An
 *  ask with no content words ("make a clock" has one: clock; "what's new" none) passes. `about` replaces the words when the right answer
 *  names none of them on purpose (finish.mjs --about "words it does show"). Pure. */
export function offTopic(report, about = '') {
  const t = String(report || ''), ask = (/^> (.*)$/m.exec(t) || [])[1] || '';
  const words = about ? askWords(about) : askWords(ask);
  if (!words.length) return '';
  const seen = ['said', 'shows', 'pictures'].map((k) => (new RegExp('\\n\\s*' + k + ': (.*)').exec(t) || [])[1] || '').join(' ').toLowerCase();
  if (words.some((w) => seen.includes(stem(w)))) return '';
  return 'what it showed is not about what was asked: nothing on the stage or the card names ' + words.map((w) => '"' + w + '"').join(' or ')
    + ' (it showed: ' + (seen.trim().slice(0, 120) || 'nothing') + '). Look at the screenshot; if the answer is right, pass --about "<words it shows>"';
}

/** the agent-log line, in the log's own shape. Pure. */
export const logLine = ({ by, kind, log }, at = new Date()) => `${at.toISOString().replace(/\.\d+Z$/, 'Z')} | ${by} | ${kind} | ${log.replace(/\s+/g, ' ').trim()}`;

/** the PR body: AGENTS.md's B.I.T.E. headings, filled from what the run said; with --job its last line is `Job: <id>`. Pure. */
export function prBody({ what, brief, kind, tests, job, evolve }) {
  return ['## Brief (B.I.T.E.)', brief || '- **For:** \n- **Problem:** \n- **First version:** ' + what + '\n- **Will not build:** ', '',
    '## Implement', `${kind}: ${what}`, '', '## Test', ...(tests && tests.length ? tests.map((t) => '- in a real browser before the push: `node tools/test_void.mjs --only "' + t + '"` passes') : []),
    '- `VOID_SKIP_BENCH=1 node tools/checks.mjs --changed` passes (run by tools/finish.mjs; main runs every check)', '- Used as a person would: ', '',
    '## Evolve', ...(evolve ? evolve.split(';').map((w) => w.trim()).filter(Boolean).map((w) => '- ' + w) : ['- ']), ...(job ? ['', jobLine(job)] : [])].join('\n');
}

/** the steps, as [label, command | function]. Pure apart from what the functions do when run. */
export function steps(a) {
  return [
    ['first shot: the browser check', () => firstShot(a)],
    ['ledger line', node('grow.mjs', a.kind, a.what, '--by', a.by, ...(a.show ? ['--show', a.show] : []), ...(a.try ? ['--try', a.try] : []), ...(a.asked ? ['--asked', a.asked] : []))],
    // what the run says should be built next (--evolve) goes onto the frontier's open list too (tools/report-to-growth.mjs, asked by Verse), once, never a repeat
    ['agent-log line', () => { appendFileSync(LOG, logLine(a) + '\n'); return a.evolve ? run(...node('report-to-growth.mjs', '--text', a.evolve, '--write', '--from', a.by + ' ' + new Date().toISOString().slice(0, 10))) : 0; }],
    ['map covers everything', [process.execPath, ['--test', '--test-reporter=dot', resolve(root, 'tools', 'map-coverage.test.mjs')]]],
    // a new skill file is registered before it is committed (Verse's ask: the skills/ manifest registers every new skill; the fast checks then run the router test on it)
    // the book's pages and the families they come from are generated: written here so a new skill is in the book's index without a manual step (owner, 2026-10-17: the book shows every update immediately)
    ['commit', () => (run(process.execPath, [resolve(root, 'tools', 'skills-index.mjs'), '--adopt']) || run(process.execPath, [resolve(root, 'tools', 'families.mjs')]) || run(process.execPath, [resolve(root, 'tools', 'guide.mjs')]) || git('add', '-A') || (spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: root }).status === 0 ? (console.log('  nothing new to commit: already committed'), 0) : git('commit', '-q', '-m', a.title, ...(a.body ? ['-m', a.body] : []))))], // a tree committed by hand is not a failure (2026-10-23)
    ['bring main in', node('merge-main.mjs')],
    ['fast checks', node('checks.mjs', ...(a.full ? [] : ['--changed']))], // only what covers the changed files (tools/checks-changed.mjs); --full runs all 425
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
  // the job this run claimed follows its PR (tools/job-link.mjs): building now, live when it merges; without the owner token it says so and goes on
  if (a.job) run(...node('job-link.mjs', 'building', '--id', a.job, '--url', url));
  return run(...node('automerge.mjs', pr[1], '--label'));
}

function main(argv) {
  const a = parseArgs(argv.slice(2));
  if (a.error) { console.error('finish: ' + a.error + '\nusage: node tools/finish.mjs <kind> "what changed" [--log "..."] [--by claude] [--title "..."] [--brief "..."] [--body "..."] [--test "<words>"]... [--show "..."] [--try "..."] [--about "..."] [--asked ask-…] [--job <id>] [--full] [--dry] [--from N]'); return 2; }
  // the ledger's limits, checked before any step runs (a show line one character over used to surface only after the browser check, 2026-10-23)
  if (a.show && (a.show.length < 1 || a.show.length > 70)) { console.error('finish: --show must be 1 to 70 characters (it is ' + a.show.length + ')'); return 2; }
  if (a.try && (a.try.length < 1 || a.try.length > 120)) { console.error('finish: --try must be 1 to 120 characters (it is ' + a.try.length + ')'); return 2; }
  if (!a.try && (a.kind === 'grow' || a.kind === 'build') && a.from === 0) console.log('finish: no --try: the "look what I made" walkthrough cannot show this one on the stage (add --show "plain words" --try "an ask that shows it" if people can see it)');
  for (const [i, [label, step]] of steps(a).entries()) {
    const shown = typeof step === 'function' ? '' : ': ' + [step[0] === process.execPath ? 'node' : step[0], ...step[1].map((x) => x.replace(root + '/', ''))].join(' ');
    console.log(`\n[${i}/8] ${label}${shown}`);
    if (a.dry || i < a.from) { if (i < a.from) console.log('  (done before: skipped)'); continue; }
    const code = typeof step === 'function' ? step() : run(step[0], step[1], label === 'fast checks' ? { VOID_SKIP_BENCH: '1' } : {});
    if (code !== 0) { console.error(`\nfinish: stopped at step ${i} (${label}). Fix what it names, then: node tools/finish.mjs ${process.argv.slice(2).filter((x, j, all) => x !== '--from' && all[j - 1] !== '--from').map((x) => JSON.stringify(x)).join(' ')} --from ${i}`); return 1; }
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv));
