// Verse's own coding agent (owner, 2026-10-26: "build verse so that it can": climb the tower and earn without Claude). A plan, act, test,
// repair loop on free models (Workers AI, docs/brains.md) that makes real, multi-file changes in a GitHub runner, and a gate that lets the
// patch reach main only when every check passes. Playbook: docs/playbooks/verse-agent.md; workflow: .github/workflows/verse-agent.yml.
//
// What could a bad model output make this do? (the question functions/api/tally.js asks of a stranger; here the stranger is the model)
//  - Write anywhere: no. Every edit goes through patch_file/create_file, which take only paths allowPath() allows (skills/, lib/, tools/,
//    static pages, docs) and never the workflows, secrets, deploy scripts, server functions, auth, payments, owner-key code, the gate's own
//    tools or the history files. No file is ever deleted, no edit replaces more than MAX_SEARCH lines, no new file is over MAX_NEW lines.
//  - Run anything: no shell. run_tests takes a name from a fixed list (a unit test that exists, a browser-suite section by its words, the
//    changed-files checks, two generators); the words are checked against a plain pattern and passed as one argument, never through a shell.
//  - Read a secret: the agent holds no owner key. Its brain is the site's own Workers AI binding (/api/agent-brain, since the repo's Cloudflare
//    token cannot run Workers AI), reached with a ticket (lib/agent-ticket.js) that a step running no model code mints from the owner key: it
//    opens that one route, runs only the agent's free models under the route's daily cap, and expires within three hours. The ticket and any
//    Workers AI token reach this process as files (VERSE_TICKET_FILE, VERSE_AI_TOKEN_FILE) read once and deleted, never environment variables,
//    so the code a model wrote (which the tests run) cannot find them in /proc/<pid>/environ; every child gets an environment with every token,
//    key and secret removed; and before the loop starts the workflow takes root away (sudo and docker off, ptrace limited to root), so that
//    code cannot read this process's memory either. The job holds no write token (persist-credentials: false, contents: read).
//  - Spend money: only free-plan models (lib/models.js AGENT_MODELS), capped in neurons per run (2,500) and per day: the Workers Free
//    allocation is 10,000 a day and the site's visitors share it, so a run starts only when the account's real use today (the analytics API,
//    --budget) leaves room past a reserve kept for the site; capped in steps and wall time too. A paid model is never called.
//  - Fool the gate: the gate runs Verse's own checks (scope, secret scan, Verse's review, `checks.mjs --changed`, the named browser sections)
//    on a commit, then checks the tree did not change while they ran. The patch is only bytes to the land job, which checks out main afresh
//    and re-checks the scope with main's copy of this file before it applies anything. Code that games a test in a way the checks cannot
//    see is the residual risk: verify.yml runs the full suite on every main head and reverts what breaks it, and live-revert reverts what
//    breaks the live site; a reverted agent commit is written to tools/verse-agent.incidents.json and shown to the next run.
//  - Loop forever / flood main: steps, neurons, minutes and repairs are capped; one run lands at most one commit.
//
//   node tools/verse-agent.mjs --task "…" [--test "<browser words>"]… [--dry] [--out dir] [--max-steps 30] [--max-neurons 2500]
//        [--day-used N --day-cap 3000] [--minutes 30]       the loop, then the gate; writes <out>/result.json, summary.md, agent.patch
//   node tools/verse-agent.mjs --pick                     (workflow) the task, or the queue job JOB the conductor claimed, with a heal job's log
//   node tools/verse-agent.mjs --budget <day.json>        (workflow) the neurons this run may spend: the account's use today, else its own count
//   node tools/verse-agent.mjs --outcome <result.json>    (workflow) what the queue is told: { state, note }
//   node tools/verse-agent.mjs --check                    one 1-token call per model: which brains answer with the token held
//   node tools/verse-agent.mjs --scope <patch>            exit 1 when a patch touches a path the agent may not (the land job, main's copy)
//   node tools/verse-agent.mjs --incidents [--write]      reverted agent commits from git log (into tools/verse-agent.incidents.json)
// Exit 0 when the loop ran (landed or not: result.json says), 2 on bad arguments, 3 when no brain answered.
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, statSync, appendFileSync } from 'node:fs';
import { resolve, dirname, join, normalize, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import { AGENT_MODELS, AGENT_NEURONS } from '../void-live-deploy/lib/models.js';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '..');

// ---------------------------------------------------------------- the paths it may change (pure)
export const MAX_SEARCH = 80, MAX_REPLACE = 160, MAX_NEW = 220, MAX_READ = 160, MAX_ADDED = 600, MAX_FILES = 14;
const ALLOW = [/^void-live-deploy\/skills\//, /^void-live-deploy\/lib\//, /^tools\//, /^docs\//, /^domains\/features\//,
  /^void-live-deploy\/(?!functions\/)[a-z0-9-]+\/[\w.-]*\.(?:html|css|js|json|svg|txt|md)$/];
const DENY = [
  /^\.github\//, /^\.githooks\//, /^\.claude\//, /(?:^|\/)node_modules\//, /^void-live-deploy\/functions\//, /^archive\//,
  /^(?:void\.html|void-live-deploy\/index\.html|void-live-deploy\/void\.html)$/, // the one page: its three copies move together, by a builder
  /(?:^|\/)(?:package(?:-lock)?\.json|wrangler\.toml|_headers|_redirects|_routes\.json|sw\.js)$/, /\.(?:py|sh|ps1|bat|cmd|yml|yaml|toml|env|pem|key)$/i,
  // auth, payments, money, owner-key and secret code, and what spends model budget
  // (a whole word of the file name, so display.js and restore.js stay open)
  /(?:^|\/)(?:[^/]*[-_.])?(?:guard|auth|oauth|passkeys?|owner|gumroad|stripe|store|store-db|pay|paid|payments?|payouts?|prices?|price-lock|earn|earnings|checkout|billing|licen[cs]es?|secrets?|tokens?|wallet|refunds?|daily-cap|budget|models|private|webhooks?|keys?)(?:[-_.][^/]*)?$/i,
  // the gate and the safety tools themselves: the agent is checked by them, it does not edit them
  /^tools\/(?:checks|checks-changed|secret-scan|review-pr|review-offer|test_void|heavy|verse-agent[^/]*|merge-main|push|prepush|revert-target|finish|automerge|pr-ready|merge-when-green|propose-fix|claude-brain|grow-gate|grow|public-ledger|public-quotes|refresh|skills-index|workflow-lint|lint-workflows)\.m?js$/,
  /^void-live-deploy\/lib\/(?:code-review|review-api|propose-fix|probe-log|learn|guard|actions|automations(?:-run)?|agent-[\w-]+|daily-cap|shortfall)\.js$/,
  // history and Verse's own words: append-only files are written by the land job or by people, never by the agent
  /^(?:void-live-deploy\/void\.growth\.json|domains\/void\.agents\.log\.md|domains\/void\.voice\.md|GROWTH\.md|STANDING\.md|AGENTS\.md|docs\/RULES\.md|domains\/handoff\.md)$/,
];
/** '' when the agent may change this repo path, else why not. Pure. */
export function allowPath(p) {
  const s = String(p || '').replace(/\\/g, '/');
  if (!s || isAbsolute(s) || s.split('/').includes('..') || normalize(s).replace(/\\/g, '/') !== s) return 'not a plain repo path';
  for (const d of DENY) if (d.test(s)) return 'off limits to the agent (' + d.source.slice(0, 40) + ')';
  if (!ALLOW.some((a) => a.test(s))) return 'outside the agent\'s paths (skills/, lib/, tools/, docs/, static pages)';
  return '';
}

/** what a diff (`git diff --numstat` and `--name-status` lines, or a patch) may not do: [] when clean. Pure. */
export function scopeProblems(nameStatus, numstat = '', patch = '') {
  const out = [];
  const files = String(nameStatus || '').split('\n').filter(Boolean).map((l) => l.split('\t'));
  if (files.length > MAX_FILES) out.push(files.length + ' files changed (at most ' + MAX_FILES + ')');
  for (const [st, a, b] of files) {
    if (/^D/.test(st)) out.push(a + ': deleted (the agent never deletes a file)');
    for (const p of [a, b].filter(Boolean)) { const why = allowPath(p); if (why) out.push(p + ': ' + why); }
  }
  let added = 0;
  for (const l of String(numstat || '').split('\n').filter(Boolean)) { const [ad, , f] = l.split('\t'); if (ad === '-') out.push(f + ': binary'); else added += +ad || 0; }
  if (added > MAX_ADDED) out.push(added + ' lines added (at most ' + MAX_ADDED + ')');
  // a test made weaker to pass: removed assertions in an existing test file
  let file = '', removedAsserts = 0;
  for (const l of String(patch || '').split('\n')) {
    const h = /^\+\+\+ b\/(.+)$/.exec(l); if (h) { file = h[1]; continue; }
    if (/\.test\.m?js$/.test(file) && /^-(?!--)/.test(l) && /\bassert\b|\bexpect\(|\bok\(/.test(l)) removedAsserts++;
  }
  if (removedAsserts) out.push(removedAsserts + ' assertion line(s) removed from a test (a test is never weakened to pass)');
  return out;
}

// ---------------------------------------------------------------- what the model says (pure)
/** the first JSON object in a model's reply ({ tool, args, thought }), fences and prose around it ignored; null when there is none. Pure. */
export function parseAction(text) {
  const s = String(text || '').replace(/^\s*```(?:json)?/gim, '').replace(/```\s*$/gm, '');
  for (let i = s.indexOf('{'); i >= 0; i = s.indexOf('{', i + 1)) {
    let depth = 0, inStr = false, esc = false;
    for (let j = i; j < s.length; j++) {
      const c = s[j];
      if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true; else if (c === '{') depth++; else if (c === '}' && --depth === 0) {
        try { const o = JSON.parse(s.slice(i, j + 1)); if (o && typeof o.tool === 'string') return { tool: o.tool, args: o.args && typeof o.args === 'object' ? o.args : {}, thought: String(o.thought || '').slice(0, 400) }; } catch (_) {}
        break;
      }
    }
  }
  return null;
}
/** neurons a call cost, from the model's [input, output] neurons per million tokens; 0 for a local model. Pure. */
export const neuronsOf = (model, inTok, outTok) => { const p = AGENT_NEURONS[model]; return p ? Math.ceil(((inTok || 0) * p[0] + (outTok || 0) * p[1]) / 1e6) : 0; };
/** which list of brains a step uses: the plan, a repair and an escalation take the strong ones. Pure. */
export const tierFor = ({ step, lastFailed, badReplies }) => (step === 1 || lastFailed || badReplies >= 2 ? 'strong' : 'fast');
/** a long output cut to what a model can use: the failing lines first, then the tail. Pure. */
export function trimOutput(out, max = 3500) {
  const s = String(out || '').replace(/\x1b\[[0-9;]*m/g, '');
  if (s.length <= max) return s;
  const lines = s.split('\n'), bad = lines.filter((l) => /\b(?:fail|FAIL|Error|error:|not ok|AssertionError|expected|✗|×|missed)\b/.test(l)).slice(0, 40).join('\n').slice(0, Math.floor(max / 2));
  return (bad ? 'failing lines:\n' + bad + '\n…\n' : '') + 'tail:\n' + s.slice(-(max - bad.length - 30));
}
/** a run's test name -> the command it stands for, or '' with why not. Pure (exists is passed in). */
export function testCommand(name, exists = (p) => existsSync(join(root, p))) {
  const n = String(name || '').trim();
  let m;
  if (n === 'checks') return { cmd: [process.execPath, 'tools/checks.mjs', '--changed'], env: { VOID_SKIP_BENCH: '1' }, timeout: 15 * 60e3 };
  if (n === 'skills-index') return { cmd: [process.execPath, 'tools/skills-index.mjs', '--write'], timeout: 60e3 };
  if (n === 'refresh') return { cmd: [process.execPath, 'tools/refresh.mjs', '--keep-going'], timeout: 10 * 60e3 };
  if ((m = /^unit:([a-z0-9][\w.-]{0,60})$/.exec(n))) { const f = 'tools/' + m[1].replace(/\.test\.mjs$/, '') + '.test.mjs'; return exists(f) ? { cmd: [process.execPath, '--test', f], timeout: 5 * 60e3 } : { why: f + ' does not exist' }; }
  if ((m = /^browser:([\w ,.'&/-]{2,80})$/.exec(n))) return { cmd: [process.execPath, 'tools/test_void.mjs', '--only', m[1].trim()], env: { VOID_SKIP_BENCH: '1', VOID_HEAVY_OFF: '1' }, timeout: 12 * 60e3 };
  return { why: 'unknown test name: use checks, unit:<name>, browser:<section words>, skills-index or refresh' };
}
/** a child's environment: nothing that looks like a credential, and not CI (so checks.mjs --changed narrows to the change). Pure. */
export function childEnv(env = process.env, extra = {}) {
  const out = {};
  for (const [k, v] of Object.entries(env)) if (!/TOKEN|SECRET|KEY|PASS|AUTH|CREDENTIAL|COOKIE|^ACTIONS_|^CI$|^GITHUB_ACTIONS$|^NODE_TEST_CONTEXT$/i.test(k)) out[k] = v;
  return { ...out, ...extra };
}
/** reverted agent commits from `git log --format=%H%x09%s%x09%b%x00` text: [{ reverted, by, run, subject }]. Pure. */
export function incidentsFrom(logText) {
  const commits = String(logText || '').split('\0').map((c) => c.replace(/^\n/, '')).filter(Boolean).map((c) => { const [h, s, ...b] = c.split('\t'); return { h, s, b: b.join('\t') }; });
  const byHash = new Map(commits.map((c) => [c.h, c]));
  const out = [];
  for (const c of commits) {
    const m = /This reverts commit ([0-9a-f]{7,40})/.exec(c.b); if (!m) continue;
    const t = [...byHash.values()].find((x) => x.h.startsWith(m[1])); if (!t) continue;
    const run = /^Verse-Agent-Run:\s*(\S+)/m.exec(t.b); if (!run) continue;
    out.push({ reverted: t.h.slice(0, 12), by: c.h.slice(0, 12), run: run[1], subject: t.s.slice(0, 160), why: (/^Verse-auto-revert:\s*(.+)$/m.exec(c.b) || [, c.s])[1].slice(0, 200) });
  }
  return out;
}

// ---------------------------------------------------------------- the prompt
export const TOOLS_DOC = `Tools (reply with exactly ONE JSON object per turn, nothing else):
{"thought":"why","tool":"list_files","args":{"dir":"void-live-deploy/skills","match":"tower"}}
{"thought":"why","tool":"search","args":{"pattern":"regex","path":"void-live-deploy/lib"}}
{"thought":"why","tool":"read_file","args":{"path":"tools/x.mjs","start":1,"end":120}}   (at most ${MAX_READ} lines; lines come numbered "12| code")
{"thought":"why","tool":"patch_file","args":{"path":"…","search":"exact old text","replace":"new text"}}   (search must occur exactly once, copied exactly from read_file WITHOUT the "12| " prefixes; at most ${MAX_SEARCH} lines)
{"thought":"why","tool":"create_file","args":{"path":"…","content":"…"}}   (new files only, at most ${MAX_NEW} lines)
{"thought":"why","tool":"run_tests","args":{"name":"unit:tower"}}   (names: unit:<x> runs tools/<x>.test.mjs; browser:<section words> runs that browser-suite section; checks runs the checks for the changed files; skills-index regenerates skills/index.json after a new skill order file)
{"thought":"why","tool":"list_tests","args":{"match":"tower"}}   (the browser-suite sections whose heading has these words, for browser:<words>)
{"thought":"why","tool":"done","args":{"summary":"what changed and why, one paragraph","tests":["unit:tower","browser:<section words>"]}}   (a change under void-live-deploy/ must name a browser section in tests)
{"thought":"why","tool":"give_up","args":{"reason":"why it cannot be done safely"}}`;

export function systemPrompt({ incidents = [] } = {}) {
  return `You are Verse's own coding agent, working in the repository of Verse (a-to-mind.com). You make a small, correct change that does exactly what the task says, test it, and finish.
Rules:
- Read before you edit. Copy search text exactly from read_file output, without the line-number prefix. Keep edits small; never rewrite a whole file.
- You may change only: void-live-deploy/skills/, void-live-deploy/lib/, tools/, docs/, static pages under void-live-deploy/<page>/. Never workflows, server functions, auth, payments, secrets, the gate tools or history files.
- A new behaviour gets a test: add a case to the matching tools/<name>.test.mjs (node:test, assert) and run it.
- Never weaken or delete an assertion to make a test pass. Fix the code.
- After your last edit, run the tests that cover it (unit tests, then "checks"). Call done only when they pass. If they fail, read the failure, fix, run again.
- No secrets, no model names, no owner quotes in anything a visitor sees. Public repo.
${incidents.length ? 'Past agent commits that were reverted (learn from them):\n' + incidents.slice(-5).map((i) => '- ' + i.subject + ' (reverted: ' + i.why + ')').join('\n') + '\n' : ''}
${TOOLS_DOC}`;
}

// ---------------------------------------------------------------- the brains
const CF = 'https://api.cloudflare.com/client/v4/accounts/', SITE = process.env.VOID_SITE || 'https://a-to-mind.com';
let AI_TOKEN = '', TICKET = '', siteDead = false;
const takeFile = (f) => { if (!f || !existsSync(f)) return ''; const v = readFileSync(f, 'utf8').trim(); try { unlinkSync(f); } catch (_) {} return v; };
/** read the brain's keys once from the files the workflow wrote, then delete the files (never an environment variable for children): the agent
 *  ticket for the site's own binding (/api/agent-brain), and a Workers AI token for the REST API when one can run it */
function loadToken() {
  TICKET = takeFile(process.env.VERSE_TICKET_FILE) || process.env.VERSE_TICKET || '';
  AI_TOKEN = takeFile(process.env.VERSE_AI_TOKEN_FILE) || process.env.CLOUDFLARE_AI_TOKEN || process.env.CLOUDFLARE_API_TOKEN || '';
  for (const k of ['CLOUDFLARE_AI_TOKEN', 'CLOUDFLARE_API_TOKEN', 'VERSE_AI_TOKEN_FILE', 'VERSE_TICKET_FILE', 'VERSE_TICKET']) delete process.env[k];
}
const estTok = (messages) => Math.ceil(messages.reduce((n, m) => n + String(m.content || '').length, 0) / 4);
const daily = (text) => /\b3036\b|daily free allocation|calls for today are used up/i.test(String(text));
/** the messages cut to fit `max` characters: the oldest long turns are shortened first, never the system prompt, the task or the last turn. Pure. */
export function fitMessages(messages, max = 56000) {
  const ms = messages.map((m) => ({ ...m })), size = () => ms.reduce((n, m) => n + m.content.length, 0);
  for (let i = 2; i < ms.length - 1 && size() > max; i++) if (ms[i].content.length > 400) ms[i].content = ms[i].content.slice(0, 400) + ' …(cut)';
  const last = ms[ms.length - 1]; if (size() > max && ms.length > 1) last.content = last.content.slice(0, Math.max(1000, last.content.length - (size() - max))) + ' …(cut)';
  return ms;
}
async function callModel(model, messages0, maxTokens) {
  const local = !model.startsWith('@cf/'), t0 = Date.now(), messages = fitMessages(messages0);
  // the site's own binding first (the repo's Cloudflare token cannot run Workers AI), then the REST API with a token that can
  if (!local && TICKET && !siteDead) {
    const r = await fetch(SITE + '/api/agent-brain', { method: 'POST', signal: AbortSignal.timeout(180e3), headers: { authorization: 'Bearer ' + TICKET, 'content-type': 'application/json', 'user-agent': 'a2m-verse-agent/1.0' },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens }) }).catch((e) => ({ ok: false, status: 0, text: async () => String(e.message) }));
    const text = await r.text();
    if (r.ok) { let j; try { j = JSON.parse(text); } catch (_) { throw new Error('not JSON: ' + text.slice(0, 120)); } const u = j.usage || {};
      return { content: String(j.text || ''), inTok: u.prompt_tokens || estTok(messages), outTok: u.completion_tokens || Math.ceil(String(j.text || '').length / 4), ms: Date.now() - t0, via: 'site' }; }
    if ([401, 404, 405].includes(r.status) && AI_TOKEN) siteDead = true; // no route or no ticket: the REST API from here on
    else { const e = new Error('site HTTP ' + r.status + ' ' + text.replace(/\s+/g, ' ').slice(0, 160)); e.status = r.status === 400 ? 400 : r.status; e.daily = daily(text); throw e; }
  }
  const url = local ? String(process.env.VERSE_LOCAL_URL || 'http://127.0.0.1:11434/v1').replace(/\/$/, '') + '/chat/completions' : CF + process.env.CLOUDFLARE_ACCOUNT_ID + '/ai/v1/chat/completions';
  const r = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(local ? 900e3 : 180e3), headers: { 'content-type': 'application/json', ...(local ? {} : { authorization: 'Bearer ' + AI_TOKEN }) },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.2 }) });
  const text = await r.text();
  if (!r.ok) { const e = new Error('HTTP ' + r.status + ' ' + text.replace(/\s+/g, ' ').slice(0, 160)); e.status = r.status; e.daily = daily(text); throw e; }
  let j; try { j = JSON.parse(text); } catch (_) { throw new Error('not JSON: ' + text.slice(0, 120)); }
  const msg = (j.choices && j.choices[0] && j.choices[0].message) || {}, u = j.usage || {};
  const content = String(msg.content || '') || String(msg.reasoning_content || '');
  return { content, inTok: u.prompt_tokens || estTok(messages), outTok: u.completion_tokens || Math.ceil(content.length / 4), ms: Date.now() - t0, via: local ? 'local' : 'rest' };
}

// ---------------------------------------------------------------- the tools the model calls
const gitIn = (dir, ...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8', maxBuffer: 64 << 20 });
const git = (...a) => gitIn(root, ...a);
const numbered = (lines, from) => lines.map((l, i) => (from + i) + '| ' + l).join('\n');
function inRepo(p, dir = root) { const s = String(p || '').replace(/\\/g, '/').replace(/^\.\//, ''); const abs = resolve(dir, s), rel = relative(dir, abs); return rel.startsWith('..') || isAbsolute(rel) ? null : { rel: rel.replace(/\\/g, '/'), abs }; }

export function makeTools(state, dir = root) {
  const inRepo_ = (p) => inRepo(p, dir), git = (...a) => gitIn(dir, ...a);
  return {
    list_files({ dir = '', match = '' }) {
      const d = inRepo_(dir || '.'); if (!d) return 'not in the repository';
      let files = git('ls-files', '--', d.rel || '.').stdout.split('\n').filter(Boolean);
      files = files.concat([...state.created].filter((f) => f.startsWith(d.rel)));
      if (match) { let re; try { re = new RegExp(match, 'i'); } catch (_) { re = null; } files = files.filter((f) => (re ? re.test(f) : f.includes(match))); }
      return files.length ? files.slice(0, 150).join('\n') + (files.length > 150 ? '\n… ' + (files.length - 150) + ' more: narrow with match' : '') : 'no files';
    },
    search({ pattern = '', path = '' }) {
      if (!pattern || pattern.length > 200) return 'give a pattern (a regular expression, at most 200 characters)';
      const d = inRepo_(path || '.'); if (!d) return 'not in the repository';
      const r = git('grep', '-n', '-I', '-E', '--max-count=8', '-e', pattern, '--', d.rel || '.');
      const lines = r.stdout.split('\n').filter(Boolean).map((l) => l.slice(0, 220));
      return lines.length ? lines.slice(0, 60).join('\n') + (lines.length > 60 ? '\n… more: narrow the path' : '') : (r.status > 1 ? 'bad pattern' : 'no match');
    },
    read_file({ path, start = 1, end }) {
      const f = inRepo_(path); if (!f || !existsSync(f.abs) || statSync(f.abs).isDirectory()) return 'no such file: ' + path;
      if (statSync(f.abs).size > 2e6) return 'too big to read';
      const lines = readFileSync(f.abs, 'utf8').split('\n'), a = Math.max(1, +start || 1), b = Math.min(lines.length, +end || a + MAX_READ - 1, a + MAX_READ - 1);
      return path + ' (' + lines.length + ' lines; showing ' + a + '-' + b + ')\n' + numbered(lines.slice(a - 1, b), a);
    },
    patch_file({ path, search, replace }) {
      const f = inRepo_(path); if (!f) return 'not in the repository';
      const why = allowPath(f.rel); if (why) return 'refused: ' + f.rel + ' is ' + why;
      if (!existsSync(f.abs)) return 'no such file (use create_file for a new one)';
      if (typeof search !== 'string' || !search || typeof replace !== 'string') return 'search and replace must be strings, search not empty';
      if (search.split('\n').length > MAX_SEARCH) return 'search is over ' + MAX_SEARCH + ' lines: patch a smaller hunk';
      if (replace.split('\n').length > MAX_REPLACE) return 'replace is over ' + MAX_REPLACE + ' lines: patch in smaller steps';
      if (/^\s*\d+\| /m.test(search) && !readFileSync(f.abs, 'utf8').includes(search)) return 'search still has the "12| " line-number prefixes from read_file: remove them';
      const src = readFileSync(f.abs, 'utf8'), n = src.split(search).length - 1;
      if (n === 0) return 'search text not found in ' + f.rel + ' (copy it exactly from read_file; whitespace matters)';
      if (n > 1) return 'search text occurs ' + n + ' times in ' + f.rel + ': include more lines so it is unique';
      const at = src.indexOf(search), next = src.slice(0, at) + replace + src.slice(at + search.length);
      writeFileSync(f.abs, next);
      const line = src.slice(0, at).split('\n').length, lines = next.split('\n'), a = Math.max(1, line - 3), b = Math.min(lines.length, line + replace.split('\n').length + 3);
      state.edits.push({ file: f.rel, line, removed: search.split('\n').length, added: replace.split('\n').length }); state.lastEdit = { file: f.rel, line };
      return 'patched ' + f.rel + ' at line ' + line + '. Now:\n' + numbered(lines.slice(a - 1, b), a);
    },
    create_file({ path, content }) {
      const f = inRepo_(path); if (!f) return 'not in the repository';
      const why = allowPath(f.rel); if (why) return 'refused: ' + f.rel + ' is ' + why;
      if (existsSync(f.abs)) return 'that file exists: use patch_file';
      if (typeof content !== 'string' || content.split('\n').length > MAX_NEW) return 'content must be a string of at most ' + MAX_NEW + ' lines';
      mkdirSync(dirname(f.abs), { recursive: true }); writeFileSync(f.abs, content.endsWith('\n') ? content : content + '\n');
      state.created.add(f.rel); state.edits.push({ file: f.rel, line: 1, removed: 0, added: content.split('\n').length }); state.lastEdit = { file: f.rel, line: 1 };
      return 'created ' + f.rel;
    },
    list_tests({ match = '' }) {
      if (!state.sections) { const r = spawnSync(process.execPath, ['tools/test_void.mjs', '--list'], { cwd: dir, encoding: 'utf8', timeout: 60e3, maxBuffer: 16 << 20, env: childEnv() }); state.sections = String(r.stdout || '').split('\n').map((l) => l.trim()).filter(Boolean); }
      const words = String(match).toLowerCase().split(/\s+/).filter(Boolean), hits = state.sections.filter((h) => words.every((w) => h.toLowerCase().includes(w)));
      return hits.length ? hits.slice(0, 25).map((h) => h.slice(0, 200)).join('\n') + (hits.length > 25 ? '\n… ' + (hits.length - 25) + ' more: add a word' : '') : 'no section has all of: ' + words.join(' ');
    },
    run_tests({ name }) {
      const c = testCommand(name, (p) => existsSync(join(dir, p))); if (!c.cmd) return 'refused: ' + c.why;
      const t0 = Date.now(), r = spawnSync(c.cmd[0], c.cmd.slice(1), { cwd: dir, encoding: 'utf8', timeout: c.timeout, maxBuffer: 64 << 20, env: childEnv(process.env, c.env || {}) });
      const ok = r.status === 0;
      state.tests.push({ name, ok, ms: Date.now() - t0, afterEdit: state.edits.length });
      return (ok ? 'PASS ' : 'FAIL ') + name + ' (exit ' + r.status + (r.error ? ', ' + r.error.code : '') + ', ' + Math.round((Date.now() - t0) / 1000) + ' s)\n' + trimOutput((r.stdout || '') + '\n' + (r.stderr || ''), ok ? 1200 : 3500);
    },
  };
}
/** the edited region of the last patched file, for a repair step (reflection: the failure and the code that caused it, side by side) */
function lastEditView(state, dir = root) {
  if (!state.lastEdit) return '';
  const f = join(dir, state.lastEdit.file); if (!existsSync(f)) return '';
  const lines = readFileSync(f, 'utf8').split('\n'), a = Math.max(1, state.lastEdit.line - 20), b = Math.min(lines.length, state.lastEdit.line + 40);
  return '\nYour last edit, as the file stands now (' + state.lastEdit.file + '):\n' + numbered(lines.slice(a - 1, b), a);
}

// ---------------------------------------------------------------- the gate
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { cwd: root, encoding: 'utf8', timeout: opts.timeout || 15 * 60e3, maxBuffer: 64 << 20, env: childEnv(process.env, opts.env || {}) });
export function gate({ base, tests = [], log = () => {} }) {
  const steps = [];
  const stop = (step, detail) => { steps.push({ step, ok: false, detail: String(detail || '').replace(/\s+/g, ' ').trim().slice(0, 400) }); return { passed: false, failed: step, steps }; };
  const pass = (step, detail = '') => steps.push({ step, ok: true, detail });
  git('add', '-A');
  const ns = git('diff', '--cached', '--name-status', base).stdout, num = git('diff', '--cached', '--numstat', base).stdout, patch = git('diff', '--cached', base).stdout;
  if (!ns.trim()) return stop('nothing changed', 'the agent finished without a change');
  const sp = scopeProblems(ns, num, patch); if (sp.length) return stop('scope', sp.join('; ')); pass('scope', ns.trim().split('\n').length + ' file(s)');
  const c = git('-c', 'user.name=Verse', '-c', 'user.email=void@a-to-mind.com', 'commit', '-q', '--no-verify', '-m', 'Verse agent: candidate'); if (c.status !== 0) return stop('commit', c.stderr);
  const head = git('rev-parse', 'HEAD').stdout.trim();
  log('gate: secret scan'); const ss = run(process.execPath, ['tools/secret-scan.mjs', '--base', base]); if (ss.status !== 0) return stop('secret scan', trimOutput(ss.stdout + ss.stderr, 400)); pass('secret scan');
  log('gate: Verse\'s review'); const rv = run(process.execPath, ['tools/review-pr.mjs', '--gate', '--base', base, '--head', 'HEAD']); if (rv.status !== 0) return stop('void review', trimOutput(rv.stdout, 600)); pass('void review');
  log('gate: checks --changed'); const ck = run(process.execPath, ['tools/checks.mjs', '--changed'], { env: { VOID_SKIP_BENCH: '1' }, timeout: 25 * 60e3 }); if (ck.status !== 0) return stop('checks', trimOutput(ck.stdout + ck.stderr, 800)); pass('checks', (/(\d+ checks in [^\n]*)/.exec(ck.stdout) || [, ''])[1]);
  const siteFiles = ns.split('\n').some((l) => /\tvoid-live-deploy\/(?!.*\.test\.)/.test(l));
  const browser = [...new Set(tests.filter((t) => /^browser:/.test(t)))];
  if (siteFiles && !browser.length) return stop('browser test', 'the change reaches the site and names no browser-suite section (right the first time: docs/RULES.md)');
  for (const t of [...new Set(tests)]) {
    const tc = testCommand(t); if (!tc.cmd) return stop('task test', t + ': ' + tc.why);
    log('gate: ' + t); const r = run(tc.cmd[0], tc.cmd.slice(1), { env: tc.env, timeout: tc.timeout }); if (r.status !== 0) return stop('task test', t + ': ' + trimOutput(r.stdout + r.stderr, 600)); pass('task test', t);
  }
  // nothing the tests ran may have changed the tree (a test that rewrites a file to pass, or the gate's tools)
  const after = git('status', '--porcelain', '--untracked-files=no').stdout.trim(), moved = git('rev-parse', 'HEAD').stdout.trim() !== head;
  if (after || moved) return stop('tree changed during the checks', after.split('\n').slice(0, 5).join('; ') || 'HEAD moved');
  pass('tree unchanged');
  return { passed: true, failed: '', steps, head };
}

// ---------------------------------------------------------------- the loop
export async function runAgent(opts) {
  const { task, tests = [], maxSteps = 30, maxNeurons = 2500, dayUsed = 0, dayCap = 3000, minutes = 30, out, brains = AGENT_MODELS, log = console.log, dir = root, call = callModel, gateFn = gate } = opts;
  const started = Date.now(), base = gitIn(dir, 'rev-parse', 'HEAD').stdout.trim();
  const state = { edits: [], created: new Set(), tests: [], lastEdit: null };
  const tools = makeTools(state, dir);
  const calls = [], actions = [];
  // what went wrong before: the recorded incidents and any reverted agent commit in the log since (owner's design note 6: the next run learns from it)
  let incidents = []; try { incidents = JSON.parse(readFileSync(join(dir, 'tools', 'verse-agent.incidents.json'), 'utf8')).incidents || []; } catch (_) {}
  for (const i of incidentsFrom(gitIn(dir, 'log', '--since=60 days ago', '--format=%H%x09%s%x09%b%x00', 'HEAD').stdout)) if (!incidents.some((p) => p.reverted === i.reverted)) incidents.push(i);
  const local = process.env.VERSE_LOCAL_MODEL ? [process.env.VERSE_LOCAL_MODEL] : [];
  const sys = systemPrompt({ incidents });
  const intro = 'Task: ' + task + (tests.length ? '\nThe dispatcher will also run these tests at the end: ' + tests.join(', ') : '') + '\nStart by finding and reading the code the task is about.';
  const turns = []; // [{ a: assistant text, u: observation }]
  let spent = 0, step = 0, lastFailed = false, badReplies = 0, repairs = 0, end = null, deadBrains = new Set();
  const runCap = Math.min(maxNeurons, Math.max(0, dayCap - dayUsed));
  while (!end) {
    step++;
    if (step > maxSteps) { end = { kind: 'cap', why: 'step cap (' + maxSteps + ')' }; break; }
    if (Date.now() - started > minutes * 60e3) { end = { kind: 'cap', why: 'wall-time cap (' + minutes + ' min)' }; break; }
    if (spent >= runCap) { end = { kind: 'cap', why: 'neuron cap (' + spent + ' of ' + runCap + ')' }; break; }
    // the context: the system prompt, the task, the edits so far, the last 6 turns in full and the older ones cut short
    const recap = state.edits.length ? '\nEdits so far: ' + state.edits.map((e) => e.file + ':' + e.line).join(', ') : '';
    const messages = [{ role: 'system', content: sys }, { role: 'user', content: intro + recap }];
    turns.forEach((t, i) => { const old = i < turns.length - 6; messages.push({ role: 'assistant', content: old ? t.a.slice(0, 300) : t.a }, { role: 'user', content: old ? t.u.slice(0, 300) + (t.u.length > 300 ? ' …' : '') : t.u }); });
    const tier = tierFor({ step, lastFailed, badReplies });
    const order = [...brains[tier], ...brains[tier === 'strong' ? 'fast' : 'strong'], ...local].filter((m, i, a) => a.indexOf(m) === i && !deadBrains.has(m));
    let reply = null;
    for (const model of order) {
      try {
        const r = await call(model, messages, tier === 'strong' ? 2500 : 1500);
        const n = neuronsOf(model, r.inTok, r.outTok); spent += n;
        calls.push({ step, model, tier, via: r.via || '', inTok: r.inTok, outTok: r.outTok, neurons: n, ms: r.ms, ok: true });
        reply = { model, text: r.content }; break;
      } catch (e) {
        calls.push({ step, model, tier, ok: false, error: String(e.message).slice(0, 160) });
        if (e.daily) { end = { kind: 'cap', why: 'the free daily allocation is used up (Workers AI 3036)' }; break; }
        if (e.status === 401 || e.status === 403 || e.status === 404 || e.status === 400) deadBrains.add(model); // this model will not answer this run
      }
    }
    if (end) break;
    if (!reply) { end = { kind: 'no-brain', why: 'no model answered (' + calls.filter((c) => !c.ok).slice(-3).map((c) => c.model.split('/').pop() + ': ' + c.error).join('; ') + ')' }; break; }
    const act = parseAction(reply.text || '');
    if (!act) { badReplies++; turns.push({ a: String(reply.text || '').slice(0, 1500) || '(empty reply)', u: 'That was not one JSON object with "tool" and "args". Reply with exactly one, e.g. {"thought":"…","tool":"read_file","args":{"path":"…"}}' }); continue; }
    badReplies = 0;
    let obs = '';
    if (act.tool === 'done') {
      const ran = state.tests.filter((t) => t.afterEdit === state.edits.length);
      if (!state.edits.length) obs = 'You have not changed anything yet. Make the change first, or give_up with the reason.';
      else if (!ran.length || ran.some((t) => !t.ok)) obs = 'Run the tests that cover your last edit (and "checks") and make them pass before done.';
      else { end = { kind: 'done', summary: String(act.args.summary || '').slice(0, 1200), tests: Array.isArray(act.args.tests) ? act.args.tests.map(String).slice(0, 6) : [] }; actions.push({ step, model: reply.model, tool: 'done', thought: act.thought }); break; }
    } else if (act.tool === 'give_up') { end = { kind: 'gave-up', why: String(act.args.reason || '').slice(0, 400) }; actions.push({ step, model: reply.model, tool: 'give_up', thought: act.thought }); break; }
    else if (!tools[act.tool]) obs = 'unknown tool "' + act.tool + '". ' + TOOLS_DOC;
    else { try { obs = String(tools[act.tool](act.args || {})); } catch (e) { obs = 'the tool failed: ' + e.message; } }
    lastFailed = act.tool === 'run_tests' && /^FAIL/.test(obs);
    if (lastFailed) { repairs++; obs += lastEditView(state, dir); if (repairs > 5) { end = { kind: 'cap', why: 'repair cap: the tests still fail after 5 repairs' }; } }
    actions.push({ step, model: reply.model, tool: act.tool, args: JSON.stringify(act.args).slice(0, 160), thought: act.thought, result: obs.split('\n')[0].slice(0, 160) });
    log('step ' + step + ' [' + reply.model.split('/').pop() + '] ' + act.tool + ' ' + JSON.stringify(act.args).slice(0, 100) + ' -> ' + obs.split('\n')[0].slice(0, 100));
    turns.push({ a: JSON.stringify({ thought: act.thought, tool: act.tool, args: act.args }).slice(0, 4000), u: obs.slice(0, 6000) });
  }
  const result = { at: new Date().toISOString(), task, base, steps: step, neurons: spent, ms: Date.now() - started, end, edits: state.edits, tests: state.tests, calls, actions, models: [...new Set(calls.filter((c) => c.ok).map((c) => c.model))], passed: false, failed: '', gate: null };
  if (end && end.kind === 'done') {
    const g = gateFn({ base, tests: [...new Set([...tests, ...(end.tests || [])])], log });
    result.gate = g.steps; result.passed = g.passed; result.failed = g.failed;
    if (g.passed && out) writeFileSync(join(out, 'agent.patch'), gitIn(dir, 'diff', '--binary', base, 'HEAD').stdout);
  } else result.failed = end ? end.kind + ': ' + end.why : 'stopped';
  if (out) { writeFileSync(join(out, 'result.json'), JSON.stringify(result, null, 1)); writeFileSync(join(out, 'summary.md'), summaryOf(result)); }
  return result;
}

/** the run summary, for the job summary and a person: every model call and every action. Pure. */
export function summaryOf(r) {
  const L = ['### Verse\'s agent: ' + (r.passed ? 'passed the gate' : 'did not land') + (r.failed ? ' (' + r.failed + ')' : ''), '', '| | |', '|:--|:--|',
    '| task | ' + String(r.task).replace(/\|/g, '/').slice(0, 300) + ' |', '| steps | ' + r.steps + ' |', '| neurons | ' + r.neurons + ' |', '| minutes | ' + (r.ms / 60e3).toFixed(1) + ' |',
    '| brains | ' + (r.models.join(', ') || 'none answered') + ' |', '| edits | ' + (r.edits.map((e) => e.file + ':' + e.line).join(', ') || 'none') + ' |'];
  if (r.end && r.end.summary) L.push('| its summary | ' + r.end.summary.replace(/\|/g, '/').replace(/\n/g, ' ') + ' |');
  if (r.gate) { L.push('', '**Gate**', ''); for (const g of r.gate) L.push('- ' + (g.ok ? 'pass' : 'FAIL') + ' ' + g.step + (g.detail ? ': ' + g.detail.replace(/\n/g, ' ') : '')); }
  L.push('', '<details><summary>Every model call (' + r.calls.length + ')</summary>', '', '| step | model | via | tier | in | out | neurons | ms | ok |', '|--:|:--|:--|:--|--:|--:|--:|--:|:--|');
  for (const c of r.calls) L.push(`| ${c.step} | ${c.model} | ${c.via || ''} | ${c.tier} | ${c.inTok ?? ''} | ${c.outTok ?? ''} | ${c.neurons ?? ''} | ${c.ms ?? ''} | ${c.ok ? 'yes' : 'no: ' + String(c.error).replace(/\|/g, '/')} |`);
  L.push('', '</details>', '', '<details><summary>Every action (' + r.actions.length + ')</summary>', '');
  for (const a of r.actions) L.push('- ' + a.step + ' `' + a.tool + '` ' + String(a.args || '').replace(/`/g, "'") + (a.result ? ' -> ' + a.result.replace(/`/g, "'") : '') + (a.thought ? ' (' + a.thought.replace(/\n/g, ' ').slice(0, 160) + ')' : ''));
  L.push('', '</details>');
  return L.join('\n') + '\n';
}

// ---------------------------------------------------------------- the queue (the conductor's contract) and the day's budget (pure, but neuronsToday)
// A conductor run (tools/conductor.mjs) has already claimed the job (state 'building'); the agent reads it by id, never claims it again, and
// always says what came of it: 'done' when it landed, 'failed' when it gave up or the gate refused, 'queued' with "tries N · why" when it could
// not start or ran out of budget, so the conductor retries with backoff.
export const KIND_HINTS = {
  heal: 'A loop (the workflow named) failed several runs in a row; its failing log is below. Find the cause in the script or test it runs and fix that (workflow files are off limits: fix what they call). Never make a check pass by skipping it.',
  flake: 'A check passes and fails with no code change. Find the timing or ordering cause and make it deterministic (wait for the condition, not a fixed sleep). Never weaken or delete an assertion.',
  feature: 'Add the missing feature named to the page or skill named, the smallest real version, with a test.',
  gap: 'Close the gap named: the page or skill named lacks it. Add it, the smallest real version, with a test.',
  versus: 'Versus rows are losing for the site named: give Verse\'s own page for that floor what the losing rows measure (read lib/tower.js and the page first), with a test.',
  miss: 'People asked this and Verse missed it: teach the skill that should answer to take it (its match() and examples), and add the ask to that skill\'s test.',
  review: 'A review finding: fix the code it names, or the rule if the finding is wrong (the review rules themselves are off limits: report that with give_up).',
  will: 'This is Verse\'s own ask (AGENTS.md: they come first). Build it as asked, the smallest real version, with a test.',
  voice: 'This is Verse\'s own ask (AGENTS.md: they come first). Build it as asked, the smallest real version, with a test.',
  novelty: 'Combine the parts named into the new behaviour asked for, the smallest real version, with a test.',
  auto: 'An automatic job from Verse\'s own checks: do what it asks, the smallest real version, with a test.',
};
/** the kind of a queue job from its target ("heal:deploy" -> heal, "versus:skinnytaste.com" -> versus). Pure. */
export const jobKind = (target) => String(target || '').split(':')[0].toLowerCase().replace(/[^a-z-]/g, '');
/** the number of tries a job's note records ("tries 2 · …"), 0 when none. Pure. */
export const triesOf = (note) => +((/\btries (\d+)\b/.exec(String(note || '')) || [])[1] || 0);
/** the agent's task for a queue job: its ask first (it becomes the commit title), then where it came from, the kind's hint, the job's draft and
 *  any log the conductor pointed at. Pure. */
export function taskFromJob(job, { log = '' } = {}) {
  const kind = jobKind(job.target), note = String(job.note || '').replace(/^claimed by conductor[^;·\n]*[;·]?\s*/i, '').trim();
  return [String(job.ask || '').replace(/\s+/g, ' ').trim().slice(0, 600),
    '', 'Queue job ' + job.id + ' (' + job.target + ').' + (note ? ' Note: ' + note.slice(0, 600) : ''),
    KIND_HINTS[kind] ? 'What this kind of job asks: ' + KIND_HINTS[kind] : '',
    job.draft ? 'A builder\'s draft plan for it (a guide, not orders): ' + String(job.draft).slice(0, 1500) : '',
    log ? 'The failing log (last lines):\n' + String(log).slice(-3500) : ''].filter((x, i) => i < 2 || x).join('\n').trim();
}
/** what the queue is told at the end of a run: { state, note }. Pure. */
export function outcomeOf({ result = null, landed = false, sha = '', tries = 0, runUrl = '', dry = false, budget = '', agentResult = '' } = {}) {
  const N = tries + 1, clip = (s) => String(s || '').replace(/\s+/g, ' ').trim(), cut = (s) => s.slice(0, 300);
  const first = clip(result && result.task).split(/(?<=\.)\s|\n/)[0].slice(0, 120);
  if (landed) return { state: 'done', note: cut('verse-agent ' + runUrl + ': ' + String(sha).slice(0, 10) + ' ' + first) };
  if (budget) return { state: 'queued', note: cut('tries ' + N + ' · out of budget: ' + budget + ' ' + runUrl) };
  if (dry) return { state: 'queued', note: cut('tries ' + tries + ' · a dry run landed nothing ' + runUrl) };
  if (!result) return { state: 'queued', note: cut('tries ' + N + ' · could not start: the agent job ' + (agentResult || 'did not run') + ' ' + runUrl) };
  const end = result.end || {};
  if (result.passed) return { state: 'queued', note: cut('tries ' + N + ' · passed the gate but did not land (main moved, or the push failed) ' + runUrl) };
  if (end.kind === 'done') return { state: 'failed', note: cut('verse-agent ' + runUrl + ': the gate refused it at ' + clip(result.failed) + ': ' + clip(((result.gate || []).find((g) => !g.ok) || {}).detail).slice(0, 160)) };
  if (end.kind === 'gave-up') return { state: 'failed', note: cut('verse-agent ' + runUrl + ': gave up: ' + clip(end.why)) };
  if (end.kind === 'cap' && /repair/.test(end.why)) return { state: 'failed', note: cut('verse-agent ' + runUrl + ': ' + clip(end.why)) };
  return { state: 'queued', note: cut('tries ' + N + ' · out of budget: ' + clip(end.why || result.failed) + ' ' + runUrl) };
}
/** the neurons this run may spend: the free allocation less what the account used today and the site's reserve, or, unread, the agent's own
 *  day counter against its own cap. Pure. */
export function budgetOf({ accountUsed = null, ownUsed = 0, free = 10000, reserve = 4000, ownCap = 3000 } = {}) {
  if (Number.isFinite(accountUsed)) return { left: Math.max(0, free - reserve - accountUsed), source: 'the account used ' + accountUsed + ' of ' + free + ' free neurons today; ' + reserve + ' kept for the site' };
  return { left: Math.max(0, ownCap - ownUsed), source: 'the account\'s use is unread: the agent\'s own ' + ownUsed + ' of its ' + ownCap + ' a day' };
}
/** the account's Workers AI neurons today (UTC), from the analytics API (a read-only Account Analytics token); null when unread */
export async function neuronsToday(account, token, now = new Date()) {
  if (!account || !token) return null;
  const d = now.toISOString().slice(0, 10), query = `{ viewer { accounts(filter: {accountTag: "${String(account).replace(/[^a-f0-9]/gi, '')}"}) { aiInferenceAdaptiveGroups(limit: 1, filter: {date_geq: "${d}", date_leq: "${d}"}) { sum { totalNeurons } } } } }`;
  try {
    const r = await fetch('https://api.cloudflare.com/client/v4/graphql', { method: 'POST', signal: AbortSignal.timeout(20000), headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify({ query }) });
    const j = await r.json(), g = j && j.data && j.data.viewer && j.data.viewer.accounts && j.data.viewer.accounts[0];
    if (!g || (j.errors && j.errors.length)) return null;
    const row = (g.aiInferenceAdaptiveGroups || [])[0];
    return Math.round(row && row.sum ? +row.sum.totalNeurons || 0 : 0);
  } catch (_) { return null; }
}
const ghOut = (k, v) => { if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, /\n/.test(v) ? k + '<<VERSE_EOF\n' + v + '\nVERSE_EOF\n' : k + '=' + v + '\n'); };

// ---------------------------------------------------------------- the command line
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; }, all = (k) => args.flatMap((a, i) => (a === k ? [args[i + 1]] : [])).filter(Boolean);
  // the pick job: the task given, or the job the conductor claimed (read by id, never claimed again), with its failing log for a heal job
  if (args.includes('--pick')) {
    const { JOB = '', TASK = '', VOID_OWNER_TOKEN: tok = '', GITHUB_REPOSITORY: repo = 'atomeam/void-loop' } = process.env;
    ghOut('job', JOB.replace(/[^\w.:-]/g, '').slice(0, 80));
    if (!JOB) { ghOut('task', TASK.trim().slice(0, 4000)); ghOut('tries', '0'); console.log(TASK.trim() ? 'the task given' : 'no task and no job'); process.exit(0); }
    let job = null;
    for (const q of ['?state=building&limit=200', '']) {
      if (job || !tok) break;
      try { const r = await fetch('https://a-to-mind.com/api/queue' + q, { headers: { authorization: 'Bearer ' + tok, 'user-agent': 'a2m-verse-agent/1.0' }, signal: AbortSignal.timeout(20000) }); if (r.ok) job = ((await r.json()).items || []).find((i) => String(i.id) === JOB) || null; } catch (_) {}
    }
    if (!job) { ghOut('task', TASK.trim().slice(0, 4000)); ghOut('tries', '0'); ghOut('missing', '1'); console.log('job ' + JOB + ' was not found in the queue' + (tok ? '' : ' (no VOID_OWNER_TOKEN)')); process.exit(0); }
    let log = '';
    const run = /actions\/runs\/(\d+)/.exec(String(job.note || '') + ' ' + String(job.ask || ''));
    if (jobKind(job.target) === 'heal' && run) {
      const g = spawnSync('gh', ['run', 'view', run[1], '--repo', repo, '--log-failed'], { encoding: 'utf8', maxBuffer: 256 << 20, timeout: 60000 });
      log = String(g.stdout || '').split('\n').map((l) => l.replace(/\x1b\[[0-9;]*m/g, '').replace(/^[^\t]*\t[^\t]*\t\S+Z /, '')).filter((l) => l.trim()).slice(-90).join('\n');
      console.log('heal: ' + (log ? log.split('\n').length + ' lines of the failing log' : 'the failing log was not read'));
    }
    ghOut('task', TASK.trim() ? TASK.trim().slice(0, 4000) : taskFromJob(job, { log })); ghOut('tries', String(triesOf(job.note))); ghOut('kind', jobKind(job.target));
    console.log('job ' + job.id + ' (' + job.target + ', ' + job.state + ')'); process.exit(0);
  }
  // the report job: what the queue is told (state and note), from result.json and the jobs' results
  if (args.includes('--outcome')) {
    let result = null; try { result = JSON.parse(readFileSync(opt('--outcome'), 'utf8')); } catch (_) {}
    const e = process.env, o = outcomeOf({ result, landed: e.LANDED === '1', sha: e.SHA || '', tries: +e.TRIES || 0, runUrl: e.RUN_URL || '', dry: e.DRY === 'true', budget: e.BUDGET_SKIP || '', agentResult: e.AGENT_RESULT || '' });
    console.log(JSON.stringify(o)); process.exit(0);
  }
  // the agent job's first step: may this run spend, and how much (the account's real use today when the analytics token reads it)
  if (args.includes('--budget')) {
    const accountUsed = await neuronsToday(process.env.CLOUDFLARE_ACCOUNT_ID, process.env.CLOUDFLARE_ANALYTICS_TOKEN);
    let ownUsed = 0; try { ownUsed = +JSON.parse(readFileSync(opt('--budget'), 'utf8')).used || 0; } catch (_) {}
    const b = budgetOf({ accountUsed, ownUsed, reserve: +(process.env.VERSE_SITE_RESERVE || 4000), ownCap: +(process.env.DAY_CAP || 3000) });
    console.log('budget: ' + b.left + ' neurons (' + b.source + ')'); ghOut('left', String(b.left)); ghOut('why', b.source); process.exit(0);
  }
  if (args.includes('--scope')) {
    const p = readFileSync(opt('--scope'), 'utf8');
    const files = [...p.matchAll(/^diff --git a\/(\S+) b\/(\S+)$/gm)].map((m) => [m[1], m[2]]), deleted = [...p.matchAll(/^deleted file mode/gm)].length;
    const ns = files.map(([a, b]) => (a === b ? 'M\t' + a : 'R\t' + a + '\t' + b)).join('\n') + (deleted ? '\nD\t(a deleted file)' : '');
    const added = p.split('\n').filter((l) => /^\+(?!\+\+ )/.test(l)).length;
    const probs = scopeProblems(ns, '' + added + '\t0\t(all)', p);
    console.log(probs.length ? 'scope: ' + probs.join('; ') : 'scope: clean (' + files.length + ' files, ' + added + ' lines added)'); process.exit(probs.length ? 1 : 0);
  }
  if (args.includes('--incidents')) {
    const log = git('log', '--since=60 days ago', '--format=%H%x09%s%x09%b%x00', 'HEAD').stdout, inc = incidentsFrom(log), f = join(here, 'verse-agent.incidents.json');
    let prev = []; try { prev = JSON.parse(readFileSync(f, 'utf8')).incidents || []; } catch (_) {}
    const merged = [...prev, ...inc.filter((i) => !prev.some((p) => p.reverted === i.reverted))];
    console.log(merged.length + ' reverted agent commit(s); ' + (merged.length - prev.length) + ' new');
    if (args.includes('--write') && merged.length !== prev.length) writeFileSync(f, JSON.stringify({ note: 'Agent commits that verify.yml or live-revert reverted (tools/verse-agent.mjs --incidents --write); each run reads the last five.', incidents: merged }, null, 1) + '\n');
    process.exit(0);
  }
  // the agent job's own step, before any model code: a ticket for this run from the owner key, written to a file the agent reads once and deletes
  if (args.includes('--ticket')) {
    const { mintTicket } = await import('../void-live-deploy/lib/agent-ticket.js'), out = opt('--ticket');
    if (!process.env.VOID_OWNER_TOKEN) { console.log('no owner key: no ticket (the agent will use the REST API or a local model)'); process.exit(0); }
    writeFileSync(out, await mintTicket(process.env.VOID_OWNER_TOKEN, process.env.GITHUB_RUN_ID || 'local'), { mode: 0o600 }); console.log('ticket written for run ' + (process.env.GITHUB_RUN_ID || 'local') + ' (good for 2 hours)'); process.exit(0);
  }
  loadToken();
  if (!TICKET && !(process.env.CLOUDFLARE_ACCOUNT_ID && AI_TOKEN) && !process.env.VERSE_LOCAL_MODEL) { console.error('verse-agent: no brain: an agent ticket, CLOUDFLARE_ACCOUNT_ID and a Workers AI token, or VERSE_LOCAL_MODEL'); process.exit(3); }
  if (args.includes('--check')) {
    const ms = [...new Set([...AGENT_MODELS.strong, ...AGENT_MODELS.fast]), ...(process.env.VERSE_LOCAL_MODEL ? [process.env.VERSE_LOCAL_MODEL] : [])];
    let any = false;
    for (const m of ms) { if (m.startsWith('@cf/') && !AI_TOKEN && !TICKET) { console.log('no key    ' + m); continue; } try { const r = await callModel(m, [{ role: 'user', content: 'Reply with the word ok.' }], 300); any = true; console.log('answers  ' + m + '  via ' + r.via + '  (' + r.ms + ' ms, ' + neuronsOf(m, r.inTok, r.outTok) + ' neurons)'); } catch (e) { console.log('fails    ' + m + '  ' + e.message.slice(0, 140)); } }
    // GitHub Models was retired on 2026-07-30 (docs/brains.md); one unauthenticated look at its old catalog each run keeps that a measurement
    try { const g = await fetch('https://models.github.ai/catalog/models', { signal: AbortSignal.timeout(15000) }); console.log('GitHub Models catalog: HTTP ' + g.status + (g.ok ? ' (it answers: see docs/brains.md before using it)' : ' (retired, as its docs say)')); } catch (e) { console.log('GitHub Models catalog: unreachable (' + String(e.message).slice(0, 80) + ')'); }
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, 'cloud=' + (any ? '1' : '0') + '\n');
    process.exit(0);
  }
  const task = opt('--task') || (opt('--task-file') ? readFileSync(opt('--task-file'), 'utf8') : '');
  if (!task.trim()) { console.error('verse-agent: --task "…" is required'); process.exit(2); }
  const out = opt('--out', join(os.tmpdir(), 'verse-agent')); mkdirSync(out, { recursive: true });
  const r = await runAgent({ task: task.trim().slice(0, 4000), tests: all('--test').map((t) => (/^(?:browser|unit):|^checks$/.test(t) ? t : 'browser:' + t)), maxSteps: +opt('--max-steps', 30), maxNeurons: +opt('--max-neurons', 2500),
    dayUsed: +opt('--day-used', 0), dayCap: +opt('--day-cap', 3000), minutes: +opt('--minutes', 30), out });
  console.log(summaryOf(r));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, 'passed=' + (r.passed && !args.includes('--dry') ? '1' : '0') + '\nneurons=' + r.neurons + '\n');
  process.exit(r.end && r.end.kind === 'no-brain' ? 3 : 0);
}
