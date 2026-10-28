#!/usr/bin/env node
// Verse works on itself from a terminal, on a timer (owner, 2026-10-28: "build a version of verse we can drop in the terminal and work
// on itself constantly on timers"). A thin wrapper over what the repo already runs on GitHub (docs/VERSE-LOOP.md lists reused vs new):
//   the brain      default "verse", Verse's own: tools/verse-coder.mjs, a coding agent on the free model stack (Workers AI, then
//                  OpenRouter, Groq, Gemini, Cerebras) for a red check or the top of docs/NEXT.md anywhere in the repo; and
//                  tools/propose-fix.mjs (/api/propose-fix, VOID_OWNER_TOKEN) for skill probe jobs, which applies, tests (collisions,
//                  unit test, Verse's review, benchmark) and writes a patch. Or a coding-agent CLI: opencode, aider, any command
//   the merge      the automerge label: tools/automerge.mjs merges on Verse's review (automerge.yml)
//   the safety net verify.yml runs the suite on every head of main and reverts a commit that breaks it (tools/revert-target.mjs);
//                  watchdog.yml opens the issue when main is red
// What this adds: one lap from a terminal, a lock so laps never overlap, before/after checks, a key scan of the diff, the branch,
// push (never forced) and the PR, and one line in docs/TAGTEAM.md. Exactly one item per lap. Keys come from the environment only.
//   node tools/verse-loop.mjs --once [--dry-run] [--agent verse|opencode|aider|cmd] [--every <minutes>] [--checks <file>] [--base main]
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, openSync, closeSync, unlinkSync, statSync, appendFileSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const CODER = join(fileURLToPath(new URL('.', import.meta.url)), 'verse-coder.mjs');

export const AGENTS = ['verse', 'opencode', 'aider', 'cmd'];
// the fast part of .github/actions/void-test (the browser suite is verify.yml's, on every head of main)
export const DEFAULT_CHECKS = [
  { name: 'guard-source', cmd: 'node tools/guard-source.mjs', timeoutMin: 5 },
  { name: 'growth-suites', cmd: 'node tools/growth-suites.mjs', timeoutMin: 15 },
];

/** Parse argv into options. Pure. */
export function parseArgs(argv, env = {}) {
  const o = { once: false, every: 0, dryRun: false, agent: env.VERSE_LOOP_AGENT || 'verse', checks: null, base: 'main', strict: false, help: false, task: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => { const v = argv[++i]; if (v === undefined) throw new Error(a + ' needs a value'); return v; };
    if (a === '--once') o.once = true;
    else if (a === '--every') { o.every = Number(val()); if (!(o.every > 0)) throw new Error('--every needs minutes > 0'); }
    else if (a === '--dry-run') o.dryRun = true;
    else if (a === '--agent') o.agent = val();
    else if (a === '--checks') o.checks = val();
    else if (a === '--base') o.base = val();
    else if (a === '--task') o.task = val();
    else if (a === '--strict') o.strict = true;
    else if (a === '-h' || a === '--help') o.help = true;
    else throw new Error('unknown flag ' + a);
  }
  if (!AGENTS.includes(o.agent)) throw new Error('--agent must be one of ' + AGENTS.join(', '));
  if (o.once) o.every = 0;
  return o;
}

/** The top open item of docs/NEXT.md: the first numbered line not marked done or assimilated. Pure. */
export function topItem(next) {
  for (const line of String(next).split('\n')) {
    const m = /^\s*(\d+)\.\s+(.*\S)/.exec(line);
    if (!m) continue;
    if (/status:\s*(done|assimilated)\b/i.test(line) || /^~~.*~~$/.test(m[2])) continue;
    return { n: Number(m[1]), text: m[2] };
  }
  return null;
}

// Key shapes that never belong in a commit. Matched against added lines only.
export const SECRET_PATTERNS = [
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['GitHub token', /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b/],
  ['Anthropic key', /\bsk-ant-[A-Za-z0-9_-]{20,}/],
  ['OpenAI-style key', /\bsk-(proj-|or-v1-)?[A-Za-z0-9_-]{32,}/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Slack token', /\bxox[abposr]-[A-Za-z0-9-]{10,}/],
  ['Groq key', /\bgsk_[A-Za-z0-9]{40,}\b/],
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['assigned secret', /\b[A-Z0-9_]*(API_KEY|SECRET|TOKEN|PASSWORD)\s*[=:]\s*['"][A-Za-z0-9_\-/+=]{16,}['"]/],
];

/** Possible secrets in a unified diff: [{ kind, file }]. Only added lines are read; an added .env file is always a finding. Pure. */
export function scanDiff(diff) {
  const found = [];
  let file = '';
  for (const line of String(diff).split('\n')) {
    const f = /^\+\+\+ b\/(.*)$/.exec(line);
    if (f) { file = f[1]; if (/(^|\/)\.env(\.|$)/.test(file) && !/\.example$/.test(file)) found.push({ kind: 'env file', file }); continue; }
    if (!line.startsWith('+') || line.startsWith('+++')) continue;
    for (const [kind, re] of SECRET_PATTERNS) if (re.test(line)) { found.push({ kind, file }); break; }
  }
  return found;
}

/** What this lap does. Red: fix the first red check (every brain; Verse's through tools/verse-coder.mjs). Green: Verse takes the
 *  oldest probe job when it can reach the site (probe: VOID_OWNER_TOKEN is set) and no --task is given; otherwise --task or the
 *  top of docs/NEXT.md. Pure. */
export function pickTask({ before, agent, next, task, probe = true }) {
  const red = before.find((r) => !r.ok);
  if (red) return { kind: 'fix', check: red.name, cmd: red.cmd, output: red.output || '' };
  if (agent === 'verse' && probe && !task) return { kind: 'probe' };
  if (task) return { kind: 'next', n: null, text: task };
  const it = topItem(next);
  return it ? { kind: 'next', ...it } : { kind: 'idle', why: 'all green and docs/NEXT.md has no open item' };
}

/** The coding agent's prompt. Pure. */
export function buildPrompt({ task, tagteam = '', gates = '' }) {
  const tail = (s, n) => (s.length > n ? '…\n' + s.slice(-n) : s);
  return [
    'You are working on Verse (the atomeam/void-loop repo) as one lap of the Verse loop (tools/verse-loop.mjs). Do exactly one item, then stop.',
    'Rules: fix bugs, never weaken, skip or delete a test. No secrets or keys in any file. Do not commit, push or open a PR yourself: the loop does that.',
    'A floor counts as "assimilated" only with end-to-end journey evidence (say "assimilated", never "parity"). Small sites first, easiest first.',
    'Every new page declares its handoff types. No new inline scripts (CSP). Nothing is removed, only evolved. Every new tool or workflow gets a line in docs/MAP.md.',
    '',
    '## Task',
    task.kind === 'fix'
      ? `A check is red. Make it green by fixing what it tests (never by weakening the test).\nCheck: ${task.check}\nCommand: ${task.cmd}\nLast output:\n${tail(task.output || '', 4000)}`
      : `${task.n != null ? 'Top open item of docs/NEXT.md (item ' + task.n + ')' : 'The task'}:\n${task.text}\nTake the smallest next step on it that the checks can prove.`,
    '',
    '## docs/GATE-STANDARDS.md',
    tail(gates, 6000),
    '',
    '## docs/TAGTEAM.md (latest notes)',
    tail(tagteam, 6000),
  ].join('\n');
}

/** How to call each brain: { cmd, args, shell? }. Verse's: propose-fix for a probe job, its coder for anything else.
 *  Keys reach the CLI only through the environment it inherits. */
export function agentCommand(agent, promptFile, { env = process.env, outDir = '', dryRun = false, kind = 'probe', target = '', checksFile = '', repo = '.' } = {}) {
  const model = env.VERSE_LOOP_MODEL;
  if (agent === 'verse' && kind === 'probe') return { cmd: process.execPath, args: ['tools/propose-fix.mjs', '--out', outDir, ...(dryRun ? ['--dry'] : [])] };
  if (agent === 'verse') return { cmd: process.execPath, args: [CODER, '--repo', repo, '--prompt-file', promptFile, ...(checksFile ? ['--checks', checksFile] : []), ...(target ? ['--target', target] : [])] };
  if (agent === 'opencode') return { cmd: 'opencode', args: ['run', ...(model ? ['--model', model] : []), readFileSync(promptFile, 'utf8')] };
  if (agent === 'aider') return { cmd: 'aider', args: ['--yes-always', '--no-auto-commits', '--no-gitignore', ...(model ? ['--model', model] : []), '--message-file', promptFile] };
  if (!env.VERSE_LOOP_AGENT_CMD) throw new Error('--agent cmd needs VERSE_LOOP_AGENT_CMD (the prompt is on stdin and its path in VERSE_LOOP_PROMPT_FILE)');
  return { cmd: env.VERSE_LOOP_AGENT_CMD, args: [], shell: true };
}

/** After the brain: no check that was green went red; on a fix lap the target is green; --strict wants every check green. Pure. */
export function verdict(before, after, task, strict = false) {
  const red = (rs) => rs.filter((r) => !r.ok).map((r) => r.name);
  const wasGreen = new Set(before.filter((r) => r.ok).map((r) => r.name));
  const newRed = red(after).filter((n) => wasGreen.has(n) || !before.some((b) => b.name === n));
  if (newRed.length) return { ok: false, why: 'new red: ' + newRed.join(', ') };
  if (task.kind === 'fix' && red(after).includes(task.check)) return { ok: false, why: 'target still red: ' + task.check };
  if (strict && red(after).length) return { ok: false, why: 'strict: still red: ' + red(after).join(', ') };
  return { ok: true, why: red(after).length ? 'no new red (red before and after: ' + red(after).join(', ') + ')' : 'all checks green' };
}

export const stamp = (d = new Date()) => d.toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-');

/** Take the lap lock (O_EXCL). A lock whose process is gone, or older than 3 hours, is stale and replaced. */
export function takeLock(path, now = Date.now()) {
  for (let i = 0; i < 2; i++) {
    try { const fd = openSync(path, 'wx'); writeFileSync(fd, JSON.stringify({ pid: process.pid, at: now })); closeSync(fd); return true; }
    catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let stale;
      try {
        const l = JSON.parse(readFileSync(path, 'utf8'));
        let alive = true; try { process.kill(l.pid, 0); } catch (k) { alive = k.code === 'EPERM'; }
        stale = !alive || now - l.at > 3 * 3600e3;
      } catch { stale = now - statSync(path).mtimeMs > 3 * 3600e3; }
      if (!stale) return false;
      try { unlinkSync(path); } catch (u) { if (u.code !== 'ENOENT') throw u; } // another lap may have just removed it
    }
  }
  return false;
}

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 << 20, ...opts });
  return { code: r.status ?? (r.error ? 127 : 1), out: (r.stdout || '') + (r.stderr || ''), error: r.error };
}

/** One lap. Returns a report; an ordinary red, a no-op or a refusal is an outcome, not a throw. */
export async function lap(opts, { cwd = process.cwd(), env = process.env, log = (s) => console.log(s) } = {}) {
  const git = (...a) => sh('git', a, { cwd, env });
  const report = { dryRun: !!opts.dryRun, agent: opts.agent, steps: [] };
  const step = (s) => { report.steps.push(s); log('· ' + s); };
  const done = (outcome, why, extra = {}) => ({ ...report, ...extra, outcome, why });
  const gitDir = git('rev-parse', '--absolute-git-dir').out.trim();
  if (!gitDir || !existsSync(gitDir)) return done('error', 'not a git repository: ' + cwd);
  const lockPath = join(gitDir, 'verse-loop.lock');
  if (!takeLock(lockPath)) return done('skipped', 'another lap holds ' + lockPath);
  try {
    if (git('status', '--porcelain').out.trim()) return done('skipped', 'the working tree has local changes; a lap never overwrites them');
    if (!opts.dryRun || env.VERSE_LOOP_FETCH_IN_DRY_RUN === '1') {
      const f = git('fetch', 'origin', opts.base);
      if (f.code) return done('error', 'fetch failed: ' + f.out.trim());
      git('checkout', '-q', '--detach', 'origin/' + opts.base);
      step('started from origin/' + opts.base + ' ' + git('rev-parse', '--short', 'HEAD').out.trim());
    } else step('dry run: no fetch, starting from ' + git('rev-parse', '--short', 'HEAD').out.trim());

    const checksFile = opts.checks || env.VERSE_LOOP_CHECKS || resolve(cwd, 'tools/verse-loop.checks.json');
    const checks = existsSync(checksFile) ? JSON.parse(readFileSync(checksFile, 'utf8')) : DEFAULT_CHECKS;
    const run = (label) => checks.map((c) => {
      const r = sh(c.cmd, [], { cwd, env, shell: true, timeout: (c.timeoutMin || 30) * 60e3 });
      log(`  ${r.code === 0 ? 'pass' : 'FAIL'} ${c.name} (${label})`);
      return { name: c.name, cmd: c.cmd, ok: r.code === 0, output: r.out };
    });
    const before = run('before');
    report.before = before.map(({ name, ok }) => ({ name, ok }));
    const readDoc = (p) => (existsSync(resolve(cwd, p)) ? readFileSync(resolve(cwd, p), 'utf8') : '');
    const next = readDoc('docs/NEXT.md');
    let task = pickTask({ before, agent: opts.agent, next, task: opts.task, probe: !!env.VOID_OWNER_TOKEN });
    if (task.kind === 'idle') return done(task.kind, task.why);
    const work = mkdtempSync(join(tmpdir(), 'verse-loop-'));
    const promptFile = join(work, 'prompt.md'), checksCopy = join(work, 'checks.json');
    writeFileSync(checksCopy, JSON.stringify(checks));
    const brain = (t) => {
      report.task = t.kind === 'fix' ? { kind: 'fix', check: t.check } : t.kind === 'next' ? { kind: 'next', n: t.n, text: t.text.slice(0, 200) } : { kind: 'probe' };
      step(t.kind === 'fix' ? 'task: fix the first red check, ' + t.check : t.kind === 'next' ? 'task: ' + (t.n != null ? 'docs/NEXT.md item ' + t.n : 'the given task') : 'task: the oldest open probe job (tools/propose-fix.mjs)');
      const prompt = buildPrompt({ task: t.kind === 'probe' ? { kind: 'next', text: 'probe job', n: null } : t, tagteam: readDoc('docs/TAGTEAM.md'), gates: readDoc('docs/GATE-STANDARDS.md') });
      writeFileSync(promptFile, prompt);
      const a = agentCommand(opts.agent, promptFile, { env, outDir: join(work, 'fix'), dryRun: opts.dryRun, kind: t.kind, target: t.kind === 'fix' ? t.check : '', checksFile: checksCopy, repo: cwd });
      step('brain: ' + opts.agent + (opts.agent === 'verse' ? (t.kind === 'probe' ? ' (propose-fix)' : ' (verse-coder)') : ''));
      return sh(a.cmd, a.args, { cwd, env: { ...env, VERSE_LOOP_PROMPT_FILE: promptFile }, input: prompt, shell: !!a.shell, timeout: Number(env.VERSE_LOOP_AGENT_TIMEOUT_MIN || 45) * 60e3 });
    };
    let ar = brain(task);
    if (ar.error && ar.error.code === 'ENOENT') return done('error', opts.agent + ' is not installed (docs/VERSE-LOOP.md says how)');
    if (opts.agent === 'verse' && task.kind === 'probe' && ar.code === 3) {
      // no probe job (or the site is unreachable): the lap goes on to the top of docs/NEXT.md with Verse's coder
      step('no probe job (tools/propose-fix.mjs exit 3): on to docs/NEXT.md');
      task = pickTask({ before, agent: opts.agent, next, probe: false });
      if (task.kind === 'idle') return done('idle', 'no open probe job, and ' + task.why);
      ar = brain(task);
    }
    const coderSaid = () => { try { return JSON.parse(ar.out.trim().split('\n').filter((l) => l.startsWith('{')).pop()); } catch (_) { return { why: ar.out.trim().split('\n').slice(-2).join(' | ') }; } };

    let probe = null;
    if (opts.agent === 'verse' && task.kind !== 'probe') {
      // verse-coder leaves its change in the tree on exit 0; any other exit has put the tree back (4: no model key, 6: none answered)
      if (ar.code) {
        const c = coderSaid(), why = 'Verse\'s coder: ' + (c.why || 'exited ' + ar.code);
        if (git('status', '--porcelain').out.trim()) return done('refused', why + '; it left changes in the tree, which stay for a look');
        return done(ar.code === 4 || ar.code === 6 ? 'idle' : 'no-change', why);
      }
      step('Verse\'s coder finished in ' + (coderSaid().turns || '?') + ' turns');
    } else if (opts.agent === 'verse') {
      // propose-fix leaves the tree as it was and writes the passing change as a patch (exit 3: nothing to do or the site unreachable)
      if (ar.code === 3) return done('idle', 'no open probe job, the site could not be reached, or Verse proposed nothing (tools/propose-fix.mjs exit 3)');
      if (ar.code) return done('error', 'tools/propose-fix.mjs exited ' + ar.code + ': ' + ar.out.trim().split('\n').slice(-3).join(' | '));
      const res = join(work, 'fix', 'propose-fix.json'), patch = join(work, 'fix', 'propose-fix.patch');
      probe = existsSync(res) ? JSON.parse(readFileSync(res, 'utf8')) : null;
      if (!probe || !probe.passed || !existsSync(patch)) return done('no-change', 'Verse proposed nothing that passed its gate' + (probe && probe.failed ? ' (' + probe.failed + ')' : ''));
      // the same rule as propose-fix.yml's write job: the patch touches exactly the skill it names
      const files = sh('git', ['apply', '--numstat', patch], { cwd }).out.trim().split('\n').map((l) => l.split('\t')[2]).filter(Boolean);
      if (files.length !== 1 || files[0] !== 'void-live-deploy/skills/' + probe.skill + '.js') return done('refused', 'the patch touches ' + files.join(', ') + ', not void-live-deploy/skills/' + probe.skill + '.js');
      const ap = git('apply', patch);
      if (ap.code) return done('error', 'the patch no longer applies: ' + ap.out.trim());
      report.task = { kind: 'probe', skill: probe.skill, ask: probe.ask };
    } else if (ar.code) step('the brain exited ' + ar.code + ' (its changes, if any, still face the checks)');

    git('add', '-A');
    const diff = git('diff', '--cached').out;
    git('reset', '-q');
    if (!diff.trim()) return done('no-change', 'the brain changed nothing');
    const secrets = scanDiff(diff);
    if (secrets.length) return done('refused', 'possible secret in the diff: ' + secrets.map((s) => s.kind + ' in ' + s.file).join(', ') + '; nothing committed, the tree is left for a look', { secrets });

    const after = run('after');
    report.after = after.map(({ name, ok }) => ({ name, ok }));
    const v = verdict(before, after, task, opts.strict);
    report.verdict = v;
    if (!v.ok) return done('rejected', v.why + '; nothing committed, the changes are left in the tree and the next lap waits until it is clean');

    const branch = 'loop/' + stamp();
    const title = task.kind === 'fix' ? `Verse loop: fix ${task.check}`
      : task.kind === 'probe' ? String(probe.title || 'Verse fixes ' + probe.skill).slice(0, 90)
      : `Verse loop: ${task.n != null ? 'NEXT ' + task.n : 'task'}, ${task.text.replace(/\*\*/g, '').slice(0, 60)}`;
    const line = `- ${new Date().toISOString().slice(0, 16)}Z verse-loop (${opts.agent}): ${title.replace(/^Verse loop: /, '')}; ${v.why}; branch ${branch}`;
    Object.assign(report, { branch, title, tagteamLine: line });
    if (opts.dryRun) return done('would-ship', v.why + ' (dry run: no commit, push or PR; the changes are left in the tree)');

    git('checkout', '-q', '-b', branch);
    appendFileSync(resolve(cwd, 'docs/TAGTEAM.md'), '\n' + line + '\n');
    git('add', '-A');
    const last = scanDiff(git('diff', '--cached').out);
    if (last.length) { git('reset', '-q'); return done('refused', 'possible secret in the diff', { secrets: last }); }
    const c = git('commit', '-q', '-m', title, '-m', 'One lap of tools/verse-loop.mjs (brain: ' + opts.agent + '). Checks after: ' + v.why + '.');
    if (c.code) return done('error', 'commit failed: ' + c.out.trim());
    const p = git('push', '-u', 'origin', branch); // never --force
    if (p.code) return done('error', 'push failed: ' + p.out.trim());
    step('pushed ' + branch);
    const body = `One lap of \`tools/verse-loop.mjs\` (brain: ${opts.agent}).\n\nTask: ${task.kind === 'fix' ? 'fix the first red check, `' + task.check + '`' : task.kind === 'probe' ? 'the probe ask Verse missed (' + probe.skill + ')' : (task.n != null ? 'docs/NEXT.md item ' + task.n : 'the given task')}\n\nChecks after: ${v.why}. Merges on Verse's review (automerge); verify.yml reverts it if main's suite goes red.`;
    // propose-fix.yml's confidence gate: Verse's own patch merges by itself at 0.8 or more, otherwise it waits for the owner
    const label = task.kind === 'probe' && !(Number(probe.confidence) >= 0.8) ? 'waits for owner' : 'automerge';
    report.label = label;
    const pr = sh(env.VERSE_LOOP_GH || 'gh', ['pr', 'create', '--base', opts.base, '--head', branch, '--title', title, '--body', body, '--label', label], { cwd, env });
    git('checkout', '-q', '--detach', 'origin/' + opts.base);
    if (pr.code) return done('pushed', 'pushed ' + branch + ' but the PR was not opened: ' + pr.out.trim());
    report.pr = pr.out.trim().split('\n').pop();
    step('PR ' + report.pr);
    return done('shipped', v.why);
  } finally {
    try { unlinkSync(lockPath); } catch (u) { if (u.code !== 'ENOENT') log('the lock was not removed: ' + u.message); }
  }
}

const HELP = `verse-loop: Verse works on itself, one item per lap (docs/VERSE-LOOP.md).
  --once             one lap, then exit (the default)
  --every <minutes>  a lap now, then one every N minutes
  --dry-run          checks and the brain run; nothing is committed, pushed or opened
  --agent <name>     verse (default: tools/verse-coder.mjs on the free model stack for red checks and NEXT items, and
                     tools/propose-fix.mjs for probe jobs), opencode, aider, or cmd (VERSE_LOOP_AGENT_CMD)
  --checks <file>    JSON list of {name, cmd, timeoutMin}; default tools/verse-loop.checks.json
  --task <text>      on green: this instead of a probe job or the top of docs/NEXT.md
  --strict           ship only when every check is green
  --base <branch>    default main
Keys come from the environment only.`;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let opts;
  try { opts = parseArgs(process.argv.slice(2), process.env); } catch (e) { console.error(e.message + '\n\n' + HELP); process.exit(2); }
  if (opts.help) { console.log(HELP); process.exit(0); }
  const once = async () => { const r = await lap(opts); console.log(JSON.stringify({ outcome: r.outcome, why: r.why, task: r.task, branch: r.branch, pr: r.pr })); return r; };
  if (opts.every) {
    const tick = async () => { try { await once(); } catch (e) { console.error('lap failed: ' + (e && e.message)); } setTimeout(tick, opts.every * 60e3); };
    tick();
  } else {
    const r = await once();
    process.exit(['error', 'refused'].includes(r.outcome) ? 1 : 0);
  }
}
