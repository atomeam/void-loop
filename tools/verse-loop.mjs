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
// push (never forced) and the PR, verify.yml started on the branch, and one line in docs/TAGTEAM.md. Exactly one item per lap.
// No human in the loop (owner, 2026-10-28): self-heal of a failed loop/* PR, grooming of docs/NEXT.md, a back-off that resumes by
// itself after 6 hours, and a low-confidence probe patch retried, then dropped and logged. Keys come from the environment only.
//   node tools/verse-loop.mjs --once [--dry-run] [--agent verse|opencode|aider|cmd] [--every <minutes>] [--checks <file>] [--base main]
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, openSync, closeSync, unlinkSync, statSync, appendFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { check as addOnlyCheck } from './add-only.mjs';

const CODER = join(fileURLToPath(new URL('.', import.meta.url)), 'verse-coder.mjs');
/** A paid member's idea (a member:<id> queue job, lib/members.js) may only add: the lap refuses it otherwise (tools/add-only.mjs). Pure. */
export const isMemberTask = (task) => !!task && task.kind === 'next' && /^Queue job \S+ \(member: /.test(String(task.text || ''));

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
    task.kind === 'heal'
      ? `A check failed on the open pull request ${task.pr} (branch ${task.branch}); you are on that branch. Fix what it tests (never by weakening the test).\nFailed: ${task.check}\nWorkflow: ${task.cmd}\nFailure log:\n${tail(task.output || '', 6000)}`
      : task.kind === 'fix'
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

// ---- no human in the loop (owner, 2026-10-28): back-off that resumes by itself, self-heal, grooming, low confidence dropped ----
export const PAUSE_TITLE = 'Verse loop paused';
export const PAUSE_HOURS = 6;
export const BACKOFF_AFTER = 3; // laps in a row that fail or do not merge
export const CONFIDENCE_BAR = 0.8; // a probe patch under it is retried, then dropped; it never waits for a person
export const PROBE_TRIES = 3; // the first try and up to 2 more
export const HEAL_TRIES = 3; // self-heal attempts on one loop/* branch before the loop leaves it to the back-off
export const GROOM_TITLE = 'Verse loop: groom docs/NEXT.md';
// laps that count against the streak; idle, skipped, paused and would-ship are neutral, a shipped PR counts once it is merged or closed
export const FAILS = ['error', 'rejected', 'refused', 'no-change', 'pushed', 'dropped'];

export function loadState(path) {
  try { const s = JSON.parse(readFileSync(path, 'utf8')); return { fails: 0, prs: [], heals: {}, last: [], pausedAt: null, ...s }; }
  catch { return { fails: 0, prs: [], heals: {}, last: [], pausedAt: null }; }
}
export function saveState(path, s) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(s, null, 1) + '\n'); }

/** The loop's own code: a commit to these after the failures began means the streak was not run on the code that runs now. */
export const LOOP_CODE = ['tools/verse-loop.mjs', 'tools/verse-coder.mjs', 'tools/verse-job.mjs', 'void-live-deploy/functions/api/coder.js'];

/** Is the loop paused? From the flag in the state, or (a fresh runner) the open 'Verse loop paused' issue. Paused for
 *  PAUSE_HOURS from the moment it paused, then it resumes by itself: nobody has to close anything. It resumes early when
 *  `changedAt` (the newest commit to LOOP_CODE on main) is after the first failure of the streak: the failures were on code
 *  that no longer runs (2026-10-29: the coder's token-cap fix merged at the same minute the third failure paused the loop
 *  for 6 hours). Pure. */
export function pauseState({ state = {}, issue = null, now = Date.now(), changedAt = null }) {
  const since = state.pausedAt != null ? state.pausedAt : issue && Date.parse(issue.createdAt) ? Date.parse(issue.createdAt) : null;
  if (since == null) return { paused: false, resume: false };
  const until = since + PAUSE_HOURS * 3600e3;
  const ats = (state.last || []).map((l) => Number(l && l.at)).filter((n) => n > 0);
  const began = ats.length ? Math.min(...ats) : since;
  if (now < until && Number(changedAt) > began) return { paused: false, resume: true, until, early: true };
  return now < until ? { paused: true, resume: false, until } : { paused: false, resume: true, until };
}

/** The streak after one lap. A merged PR resets it; a PR closed without merging counts as a failure. Pure. */
export function recordOutcome(state, outcome, { pr = null, why = '', at = Date.now() } = {}) {
  const s = { ...state, prs: [...(state.prs || [])], last: [...(state.last || [])] };
  if (FAILS.includes(outcome)) { s.fails = (s.fails || 0) + 1; s.last = [...s.last, { at, outcome, why: String(why).slice(0, 160) }].slice(-BACKOFF_AFTER); }
  if (outcome === 'shipped' && pr) s.prs.push(pr);
  return s;
}
export function settlePrs(state, stateOf) {
  const s = { ...state, prs: [] };
  for (const url of state.prs || []) {
    const st = stateOf(url);
    if (st === 'MERGED') s.fails = 0;
    else if (st === 'CLOSED') { s.fails = (s.fails || 0) + 1; s.last = [...(s.last || []), { outcome: 'not merged', why: url }].slice(-BACKOFF_AFTER); }
    else s.prs.push(url);
  }
  return s;
}

const FAILED = new Set(['FAILURE', 'TIMED_OUT', 'STARTUP_FAILURE', 'ERROR']);
/** The first open loop/* PR with a failed check that has not used up its heal tries: { url, number, branch, failed: [names] }. Pure. */
export function failedLoopPr(prs, heals = {}) {
  for (const p of prs || []) {
    if (!/^loop\//.test(p.headRefName || '') || (heals[p.headRefName] || 0) >= HEAL_TRIES) continue;
    const failed = (p.statusCheckRollup || []).filter((c) => FAILED.has(c.conclusion) || FAILED.has(c.state)).map((c) => c.name || c.context || c.workflowName || 'a check');
    if (failed.length) return { url: p.url, number: p.number, branch: p.headRefName, failed };
  }
  return null;
}

/** The assimilation gaps docs/PARITY.md names: each section's "Still missing" or "Gaps." line that is not "None". Pure. */
export function assimilationGaps(doc) {
  const out = []; let title = '';
  for (const line of String(doc).split('\n')) {
    const h = /^##\s+(.*\S)/.exec(line); if (h) { title = h[1]; continue; }
    const g = /^\*\*(Still missing[^*]*|Gaps\.?)\*\*:?\s*(.*\S)/.exec(line);
    if (g && !/^none\b/i.test(g[2])) out.push({ title, text: g[2].replace(/\s+/g, ' ') });
  }
  return out;
}

/** How easy an item looks, lower first: a red check, a PR that only needs merging, an assimilation gap, an ordinary item (longer is harder),
 *  then anything blocked, far off or behind a partner or licence. Pure. */
export function ease(item) {
  if (item.src === 'red') return 0;
  const t = item.text;
  if (/\bblocked\b|far future|\[Gate: (Partner|License)\]|on (the )?owner\b/i.test(t)) return 9;
  if (/open PR|\brebase\b|green, merge/i.test(t)) return 1;
  if (item.src === 'gap') return 2;
  return 3 + Math.min(5, Math.floor(t.length / 250));
}

const GROOM_OPEN = '<!-- verse-groom:';
const GROOM_CLOSE = '<!-- /verse-groom -->';
/** docs/NEXT.md with Verse's ranked queue: the open numbered items, the assimilation gaps in docs/PARITY.md and the red checks,
 *  easiest first, in a block before the first numbered item (topItem reads the block's first line). The hand-written items stay
 *  as they are. The same inputs give the same text, so a lap only commits a real change. Pure. */
export function groomNext(next, { gaps = '', red = [] } = {}) {
  const text = String(next);
  const a = text.indexOf(GROOM_OPEN), b = text.indexOf(GROOM_CLOSE);
  const hasBlock = a >= 0 && b > a;
  const rest = hasBlock ? text.slice(0, a) + text.slice(b + GROOM_CLOSE.length) : text;
  const items = [];
  for (const r of red) items.push({ src: 'red', tag: 'red check', text: 'Make the red check `' + r + '` green (never by weakening its test)' });
  for (const line of rest.split('\n')) {
    const m = /^\s*(\d+)\.\s+(.*\S)/.exec(line);
    if (!m || /status:\s*(done|assimilated)\b/i.test(line) || /^~~.*~~$/.test(m[2])) continue;
    const t = m[2].length > 400 ? m[2].slice(0, 400).replace(/\s+\S*$/, '') + ' …' : m[2];
    items.push({ src: 'next', tag: 'NEXT ' + m[1], text: t });
  }
  for (const g of assimilationGaps(gaps)) items.push({ src: 'gap', tag: 'assimilation gap', text: g.title + ': ' + g.text });
  const ranked = items.map((it, i) => ({ ...it, i, e: ease(it) })).sort((x, y) => x.e - y.e || x.i - y.i);
  const block = [
    GROOM_OPEN + ' tools/verse-loop.mjs ranks this queue from the open items below, the assimilation gaps in docs/PARITY.md and the red checks, easiest first. Edit the items, not this block. -->',
    "**Verse's queue, easiest first** (the loop takes the top line):",
    ...ranked.map((it, k) => `${k + 1}. [${it.tag}] ${it.text}`),
    GROOM_CLOSE,
  ].join('\n');
  if (hasBlock) return text.slice(0, a) + block + text.slice(b + GROOM_CLOSE.length);
  const lines = text.split('\n');
  const at = lines.findIndex((l) => /^\s*\d+\.\s+\S/.test(l));
  if (at < 0) return text.replace(/\n*$/, '\n\n') + block + '\n';
  return [...lines.slice(0, at), block, '', ...lines.slice(at)].join('\n');
}

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 << 20, ...opts });
  return { code: r.status ?? (r.error ? 127 : 1), out: (r.stdout || '') + (r.stderr || ''), error: r.error };
}

/** One lap. Returns a report; an ordinary red, a no-op, a refusal or a pause is an outcome, not a throw. Before the lap: the pause
 *  (skip, or resume by itself after PAUSE_HOURS) and the PRs earlier laps opened. After: the streak, and a pause at BACKOFF_AFTER. */
export async function lap(opts, { cwd = process.cwd(), env = process.env, log = (s) => console.log(s), now = Date.now() } = {}) {
  const git = (...a) => sh('git', a, { cwd, env });
  const gh = (...a) => sh(env.VERSE_LOOP_GH || 'gh', a, { cwd, env });
  const ghJson = (...a) => { const r = gh(...a); if (r.code) return null; try { return JSON.parse(r.out); } catch { return null; } };
  const report = { dryRun: !!opts.dryRun, agent: opts.agent, steps: [] };
  const step = (s) => { report.steps.push(s); log('· ' + s); };
  const done = (outcome, why, extra = {}) => ({ ...report, ...extra, outcome, why });
  const gitDir = git('rev-parse', '--absolute-git-dir').out.trim();
  if (!gitDir || !existsSync(gitDir)) return done('error', 'not a git repository: ' + cwd);
  const lockPath = join(gitDir, 'verse-loop.lock');
  if (!takeLock(lockPath)) return done('skipped', 'another lap holds ' + lockPath);
  const statePath = env.VERSE_LOOP_STATE || join(gitDir, 'verse-loop.state.json');
  let state = loadState(statePath);
  const keep = !opts.dryRun; // a dry run reads the state and changes nothing on GitHub
  const pauseIssue = () => (ghJson('issue', 'list', '--state', 'open', '--search', `"${PAUSE_TITLE}" in:title`, '--json', 'number,title,createdAt') || []).find((i) => i.title === PAUSE_TITLE) || null;
  // three laps in a row that failed or did not merge: pause for PAUSE_HOURS, and say so in an issue that the loop closes itself
  const trip = () => {
    state = { ...state, pausedAt: now };
    if (!pauseIssue()) {
      const body = `Verse's loop failed or did not merge ${BACKOFF_AFTER} laps in a row, so laps are skipped for ${PAUSE_HOURS} hours. ` +
        `Then it resumes by itself and closes this issue; nobody needs to do anything.\n\nThe last laps:\n` +
        (state.last || []).map((l) => `- ${l.outcome}: ${l.why}`).join('\n');
      const c = gh('issue', 'create', '--title', PAUSE_TITLE, '--body', body);
      step(c.code ? 'paused; the issue was not opened: ' + c.out.trim().slice(0, 200) : 'paused; issue ' + c.out.trim().split('\n').pop());
    } else step('paused (the issue is already open)');
    report.paused = { until: new Date(now + PAUSE_HOURS * 3600e3).toISOString() };
  };
  try {
    // the pause: skip until it ends, then resume by itself
    const issue = pauseIssue();
    const ct = state.pausedAt != null || issue ? Number(git('log', '-1', '--first-parent', '--format=%ct', 'HEAD', '--', ...LOOP_CODE).out.trim()) : 0;
    const p = pauseState({ state, issue, now, changedAt: ct > 0 ? ct * 1000 : null });
    if (p.paused) return done('paused', `${BACKOFF_AFTER} laps in a row failed or did not merge; it resumes by itself at ${new Date(p.until).toISOString()}`);
    if (p.resume) {
      step(p.early ? 'the loop\'s code changed after the failures began; resuming early' : 'the pause is over; resuming');
      if (keep) {
        if (issue) gh('issue', 'close', String(issue.number), '--comment', p.early
          ? `Resumed early: the loop's own code changed on main after these failures began, so they were not on the code that runs now (tools/verse-loop.mjs).`
          : `Resumed by itself after ${PAUSE_HOURS} hours (tools/verse-loop.mjs).`);
        state = { ...state, fails: 0, pausedAt: null, last: [] };
        saveState(statePath, state);
      }
    }
    // the PRs earlier laps opened: merged resets the streak, closed without merging counts
    if (keep && (state.prs || []).length) {
      state = settlePrs(state, (url) => (ghJson('pr', 'view', url, '--json', 'state') || {}).state);
      if (state.fails >= BACKOFF_AFTER) { trip(); saveState(statePath, state); return done('paused', 'a loop PR was closed without merging, the last of ' + BACKOFF_AFTER + ' failures in a row'); }
      saveState(statePath, state);
    }
    const r = await oneLap();
    if (keep) {
      state = recordOutcome(state, r.outcome, { pr: r.pr, why: r.why, at: now });
      if (r.healed) state = { ...state, heals: { ...(state.heals || {}), [r.healed]: ((state.heals || {})[r.healed] || 0) + 1 } };
      if (r.outcome === 'healed') state = { ...state, fails: 0 };
      if (state.fails >= BACKOFF_AFTER) trip();
      saveState(statePath, state);
    }
    return { ...r, ...(report.paused ? { paused: report.paused, steps: report.steps } : {}) };
  } finally {
    try { unlinkSync(lockPath); } catch (u) { if (u.code !== 'ENOENT') log('the lock was not removed: ' + u.message); }
  }

  async function oneLap() {
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
    const readDoc = (p) => (existsSync(resolve(cwd, p)) ? readFileSync(resolve(cwd, p), 'utf8') : '');
    const work = mkdtempSync(join(tmpdir(), 'verse-loop-'));
    const promptFile = join(work, 'prompt.md'), checksCopy = join(work, 'checks.json');
    writeFileSync(checksCopy, JSON.stringify(checks));
    const brain = (t) => {
      report.task = t.kind === 'fix' ? { kind: 'fix', check: t.check } : t.kind === 'next' ? { kind: 'next', n: t.n, text: t.text.slice(0, 200) }
        : t.kind === 'heal' ? { kind: 'heal', branch: t.branch, pr: t.pr, failed: t.check } : { kind: 'probe' };
      step(t.kind === 'fix' ? 'task: fix the first red check, ' + t.check : t.kind === 'next' ? 'task: ' + (t.n != null ? 'docs/NEXT.md item ' + t.n : 'the given task')
        : t.kind === 'heal' ? 'task: heal ' + t.branch + ' (' + t.check + ')' : 'task: the oldest open probe job (tools/propose-fix.mjs)');
      const prompt = buildPrompt({ task: t.kind === 'probe' ? { kind: 'next', text: 'probe job', n: null } : t, tagteam: readDoc('docs/TAGTEAM.md'), gates: readDoc('docs/GATE-STANDARDS.md') });
      writeFileSync(promptFile, prompt);
      const a = agentCommand(opts.agent, promptFile, { env, outDir: join(work, 'fix'), dryRun: opts.dryRun, kind: t.kind, target: t.kind === 'fix' ? t.check : '', checksFile: checksCopy, repo: cwd });
      step('brain: ' + opts.agent + (opts.agent === 'verse' ? (t.kind === 'probe' ? ' (propose-fix)' : ' (verse-coder)') : ''));
      return sh(a.cmd, a.args, { cwd, env: { ...env, VERSE_LOOP_PROMPT_FILE: promptFile }, input: prompt, shell: !!a.shell, timeout: Number(env.VERSE_LOOP_AGENT_TIMEOUT_MIN || 45) * 60e3 });
    };
    const said = (ar) => { try { return JSON.parse(ar.out.trim().split('\n').filter((l) => l.startsWith('{')).pop()); } catch (_) { return { why: ar.out.trim().split('\n').slice(-2).join(' | ') }; } };
    // a coder's exit: 0 leaves its change in the tree; any other exit has put the tree back (4: no model key, 6: none answered)
    const coderStop = (ar) => {
      const c = said(ar), why = 'Verse\'s coder: ' + (c.why || 'exited ' + ar.code);
      if (git('status', '--porcelain').out.trim()) return done('refused', why + '; it left changes in the tree, which stay for a look');
      return done(ar.code === 4 || ar.code === 6 ? 'idle' : 'no-change', why);
    };
    // the diff, the key scan, the checks again and the verdict; null means go on
    const gate = (before, task) => {
      git('add', '-A');
      const diff = git('diff', '--cached').out;
      git('reset', '-q');
      if (!diff.trim()) return { stop: done('no-change', 'the brain changed nothing') };
      const secrets = scanDiff(diff);
      if (secrets.length) return { stop: done('refused', 'possible secret in the diff: ' + secrets.map((s) => s.kind + ' in ' + s.file).join(', ') + '; nothing committed, the tree is left for a look', { secrets }) };
      const after = run('after');
      report.after = after.map(({ name, ok }) => ({ name, ok }));
      const v = verdict(before, after, task, opts.strict);
      report.verdict = v;
      if (!v.ok) return { stop: done('rejected', v.why + '; nothing committed, the changes are left in the tree and the next lap waits until it is clean') };
      return { v };
    };
    const verify = (branch) => {
      const w = gh('workflow', 'run', 'verify.yml', '--ref', branch);
      report.verify = w.code ? 'not started: ' + w.out.trim().slice(0, 200) : 'started';
      step('verify.yml on ' + branch + ': ' + report.verify);
    };

    // self-heal first: an open loop/* PR with a failed check is fixed on its own branch, and the lap does nothing else
    const open = ghJson('pr', 'list', '--state', 'open', '--json', 'number,url,title,headRefName,statusCheckRollup', '--limit', '100') || [];
    const sick = failedLoopPr(open, state.heals || {});
    if (sick) {
      report.healed = sick.branch;
      const f = git('fetch', 'origin', sick.branch);
      if (f.code) return done('error', 'fetch of ' + sick.branch + ' failed: ' + f.out.trim());
      git('checkout', '-q', '--detach', 'FETCH_HEAD');
      step('self-heal: ' + sick.url + ' (' + sick.failed.join(', ') + ')');
      const runs = ghJson('run', 'list', '--branch', sick.branch, '--status', 'failure', '--json', 'databaseId,workflowName', '--limit', '1') || [];
      const logs = runs[0] ? gh('run', 'view', String(runs[0].databaseId), '--log-failed').out : '';
      const before = run('before');
      report.before = before.map(({ name, ok }) => ({ name, ok }));
      const task = { kind: 'heal', branch: sick.branch, pr: sick.url, check: sick.failed.join(', '), cmd: (runs[0] && runs[0].workflowName) || 'CI', output: logs.slice(-8000) || '(no log could be read)' };
      const ar = brain(task);
      if (ar.error && ar.error.code === 'ENOENT') return done('error', opts.agent + ' is not installed (docs/VERSE-LOOP.md says how)');
      if (opts.agent === 'verse' && ar.code) return coderStop(ar);
      const g = gate(before, task);
      if (g.stop) return g.stop;
      const title = `Verse loop: heal ${sick.branch} (${task.check})`.slice(0, 120);
      if (opts.dryRun) return done('would-heal', g.v.why + ' (dry run: no commit or push)', { title });
      git('add', '-A');
      const last = scanDiff(git('diff', '--cached').out);
      if (last.length) { git('reset', '-q'); return done('refused', 'possible secret in the diff', { secrets: last }); }
      const c = git('commit', '-q', '-m', title, '-m', 'Self-heal by tools/verse-loop.mjs (brain: ' + opts.agent + ') for ' + sick.url + '. Checks after: ' + g.v.why + '.');
      if (c.code) return done('error', 'commit failed: ' + c.out.trim());
      const p = git('push', 'origin', 'HEAD:refs/heads/' + sick.branch); // a plain fast-forward push, never --force
      if (p.code) return done('error', 'push failed: ' + p.out.trim());
      step('pushed the fix to ' + sick.branch);
      verify(sick.branch);
      git('checkout', '-q', '--detach', 'origin/' + opts.base);
      return done('healed', g.v.why, { branch: sick.branch, pr: sick.url, title });
    }

    const before = run('before');
    report.before = before.map(({ name, ok }) => ({ name, ok }));
    const red = before.filter((r) => !r.ok).map((r) => r.name);
    // grooming: Verse's queue in docs/NEXT.md, re-ranked; committed on a green lap when it changed and no groom PR is open
    const next0 = readDoc('docs/NEXT.md');
    const next = next0 ? groomNext(next0, { gaps: readDoc('docs/PARITY.md'), red }) : next0;
    const groomOpen = open.some((p) => /^loop\//.test(p.headRefName || '') && p.title === GROOM_TITLE);
    let task;
    if (!red.length && !opts.task && next !== next0 && !groomOpen) {
      task = { kind: 'groom' };
      report.task = { kind: 'groom' };
      step('task: groom docs/NEXT.md (the ranked queue changed)');
      writeFileSync(resolve(cwd, 'docs/NEXT.md'), next);
    } else {
      task = pickTask({ before, agent: opts.agent, next, task: opts.task, probe: !!env.VOID_OWNER_TOKEN });
      if (task.kind === 'idle') return done(task.kind, task.why);
    }

    let probe = null;
    if (task.kind !== 'groom') {
      let ar = brain(task);
      if (ar.error && ar.error.code === 'ENOENT') return done('error', opts.agent + ' is not installed (docs/VERSE-LOOP.md says how)');
      if (opts.agent === 'verse' && task.kind === 'probe' && ar.code === 3) {
        // no probe job (or the site is unreachable): the lap goes on to the top of docs/NEXT.md with Verse's coder
        step('no probe job (tools/propose-fix.mjs exit 3): on to docs/NEXT.md');
        task = pickTask({ before, agent: opts.agent, next, probe: false });
        if (task.kind === 'idle') return done('idle', 'no open probe job, and ' + task.why);
        ar = brain(task);
      }
      if (opts.agent === 'verse' && task.kind !== 'probe') {
        if (ar.code) return coderStop(ar);
        step('Verse\'s coder finished in ' + (said(ar).turns || '?') + ' turns');
      } else if (opts.agent === 'verse') {
        // propose-fix leaves the tree as it was and writes the passing change as a patch (exit 3: nothing to do or the site unreachable).
        // Under the confidence bar it is tried again, up to PROBE_TRIES in all; still under it, the patch is dropped and logged. No one is asked.
        const res = join(work, 'fix', 'propose-fix.json'), patch = join(work, 'fix', 'propose-fix.patch');
        const tries = [];
        for (let i = 1; ; i++) {
          if (ar.code === 3) return done('idle', 'no open probe job, the site could not be reached, or Verse proposed nothing (tools/propose-fix.mjs exit 3)');
          if (ar.code) return done('error', 'tools/propose-fix.mjs exited ' + ar.code + ': ' + ar.out.trim().split('\n').slice(-3).join(' | '));
          probe = existsSync(res) ? JSON.parse(readFileSync(res, 'utf8')) : null;
          if (!probe || !probe.passed || !existsSync(patch)) return done('no-change', 'Verse proposed nothing that passed its gate' + (probe && probe.failed ? ' (' + probe.failed + ')' : ''));
          tries.push(Number(probe.confidence));
          if (Number(probe.confidence) >= CONFIDENCE_BAR) break;
          if (i >= PROBE_TRIES) {
            const drop = { at: new Date(now).toISOString(), skill: probe.skill, confidences: tries, bar: CONFIDENCE_BAR };
            try { appendFileSync(join(gitDir, 'verse-loop.dropped.jsonl'), JSON.stringify(drop) + '\n'); } catch (_) { /* the report still says it */ }
            return done('dropped', `Verse's patch for ${probe.skill} stayed under confidence ${CONFIDENCE_BAR} after ${PROBE_TRIES} tries (${tries.join(', ')}); dropped and logged, nothing waits for a person`, { dropped: drop });
          }
          step(`confidence ${probe.confidence} is under ${CONFIDENCE_BAR}: trying again (${i + 1} of ${PROBE_TRIES})`);
          try { unlinkSync(res); unlinkSync(patch); } catch (_) { /* written again by the next try */ }
          ar = brain(task);
        }
        // the same rule as propose-fix.yml's write job: the patch touches exactly the skill it names
        const files = sh('git', ['apply', '--numstat', patch], { cwd }).out.trim().split('\n').map((l) => l.split('\t')[2]).filter(Boolean);
        if (files.length !== 1 || files[0] !== 'void-live-deploy/skills/' + probe.skill + '.js') return done('refused', 'the patch touches ' + files.join(', ') + ', not void-live-deploy/skills/' + probe.skill + '.js');
        const ap = git('apply', patch);
        if (ap.code) return done('error', 'the patch no longer applies: ' + ap.out.trim());
        report.task = { kind: 'probe', skill: probe.skill, ask: probe.ask };
      } else if (ar.code) step('the brain exited ' + ar.code + ' (its changes, if any, still face the checks)');
    }

    const g = gate(before, task);
    if (g.stop) return g.stop;
    const v = g.v;
    if (isMemberTask(task)) { // owner, 2026-10-29: paid members "only add positive improvements"; enforced here, before any commit
      const taken = addOnlyCheck(cwd, 'origin/' + opts.base);
      if (taken.length) return done('refused', 'a member\'s idea may only add, and this change ' + taken.slice(0, 3).join('; '), { addOnly: taken });
      step('add-only: nothing taken away');
    }

    const branch = 'loop/' + stamp();
    const title = task.kind === 'fix' ? `Verse loop: fix ${task.check}`
      : task.kind === 'groom' ? GROOM_TITLE
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
    const what = task.kind === 'fix' ? 'fix the first red check, `' + task.check + '`' : task.kind === 'groom' ? 're-rank Verse\'s queue in docs/NEXT.md (easiest first)'
      : task.kind === 'probe' ? 'the probe ask Verse missed (' + probe.skill + ', confidence ' + probe.confidence + ')' : (task.n != null ? 'docs/NEXT.md item ' + task.n : 'the given task');
    const body = `One lap of \`tools/verse-loop.mjs\` (brain: ${opts.agent}).\n\nTask: ${what}\n\nChecks after: ${v.why}. Merges on Verse's review (automerge); verify.yml reverts it if main's suite goes red.`;
    // no human in the loop: every PR the loop opens is labelled automerge (a low-confidence probe patch was dropped above)
    report.label = 'automerge';
    const pr = gh('pr', 'create', '--base', opts.base, '--head', branch, '--title', title, '--body', body, '--label', 'automerge');
    if (pr.code) { git('checkout', '-q', '--detach', 'origin/' + opts.base); return done('pushed', 'pushed ' + branch + ' but the PR was not opened: ' + pr.out.trim()); }
    report.pr = pr.out.trim().split('\n').pop();
    step('PR ' + report.pr);
    verify(branch);
    git('checkout', '-q', '--detach', 'origin/' + opts.base);
    return done('shipped', v.why);
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
No person is waited on. A lap first heals an open loop/* PR whose check failed (on its branch, nothing else that lap); on green it
re-ranks Verse's queue in docs/NEXT.md when it changed. ${BACKOFF_AFTER} laps in a row that fail or do not merge pause the loop for
${PAUSE_HOURS} hours (an issue titled '${PAUSE_TITLE}' says so); then it resumes and closes the issue itself. State: VERSE_LOOP_STATE
(default .git/verse-loop.state.json). Keys come from the environment only.`;

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
