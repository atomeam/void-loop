#!/usr/bin/env node
// Verse's own coding agent (owner, 2026-10-28: "make verse a coding agent"). The default "verse" brain of tools/verse-loop.mjs
// for a red check or the top of docs/NEXT.md, anywhere in the repo; tools/propose-fix.mjs stays the brain for skill probes.
// A plain agent loop on the free model stack: Verse's own model first (the site's binding, /api/coder, VOID_OWNER_TOKEN), then Workers AI
// over the REST API (CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID), GitHub Models (GH_MODELS_TOKEN), OpenRouter,
// Groq, Gemini and Cerebras, whichever keys the environment holds. Keys come from the environment only and never reach a check.
// The model answers each turn with one JSON tool call: list, read, search, edit (a unified diff), check (one named check), finish.
// The limits, each enforced here and not left to the model:
//   a cap on turns and on tokens; edits only inside the repo, never .env*, .github/workflows, secrets, .git or the loop's own
//   guards; patch-guard (void-live-deploy/lib/patch-guard.js) on every edited source file; a test-weakening guard on tests and on
//   the scripts the checks run (fewer assertions or cases, a skip, an early exit: refused, never deleted); and before finishing,
//   Verse's review (tools/review-pr.mjs --gate) and the loop's key scan on its own diff. A refused or capped run puts every file
//   it touched back the way it found it.
//   node tools/verse-coder.mjs (--prompt-file <f> | --task "<text>") [--repo <dir>] [--checks <file>] [--target <check>]
//                              [--max-turns 30] [--max-tokens 250000]
// Exit 0: done, the change is left in the tree. 3: nothing to change or gave up. 4: no model key. 5: a cap. 6: no model answered.
// The last line printed is JSON: { outcome, why, turns, tokens, files, provider }.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, unlinkSync, realpathSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { resolve, join, relative, sep, dirname, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { guardPatch, kindOf } from '../void-live-deploy/lib/patch-guard.js';
import { FREE_MODEL } from '../void-live-deploy/lib/models.js';
import { scanDiff, DEFAULT_CHECKS } from './verse-loop.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const LIMITS = { turns: 30, tokens: 250000, out: 6000, finishTries: 3 };
export const EXIT = { done: 0, nothing: 3, 'no-model': 4, 'turn-cap': 5, 'token-cap': 5, 'model-down': 6, error: 1 };

// ---- the free model stack ----
/** the providers the environment has keys for, in order. Pure: keys stay in the returned objects, never in a log line. */
export function providersFrom(env = process.env) {
  const out = [];
  // Verse's own model on the site's binding (functions/api/coder.js, the owner token): needs no Workers AI permission on any API token
  if (env.VOID_OWNER_TOKEN) out.push({ name: 'verse', model: FREE_MODEL, key: env.VOID_OWNER_TOKEN, url: String(env.VOID_SITE || 'https://a-to-mind.com').replace(/\/+$/, '') + '/api/coder', shape: 'workers' });
  // the key Verse minted for this run (tools/key-keeper.mjs, Workers AI only, expires in hours) first, else the old repo secret
  const cfKey = env.CLOUDFLARE_AI_TOKEN || env.CLOUDFLARE_API_TOKEN;
  if (cfKey && env.CLOUDFLARE_ACCOUNT_ID) out.push({ name: 'workers-ai', model: env.VERSE_CODER_CF_MODEL || FREE_MODEL, key: cfKey,
    url: 'https://api.cloudflare.com/client/v4/accounts/' + encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID) + '/ai/run/' + (env.VERSE_CODER_CF_MODEL || FREE_MODEL), shape: 'workers' });
  // GitHub Models (a free pool that needs no key to fetch: the workflow's own token with `models: read`); unverified against GitHub's docs from the sandbox, a refusal shows in the run log
  // GitHub Models is gone: GitHub retired it on 2026-07-30 (docs.github.com/en/rest/models/inference), and its old endpoint answers 200 "OK" to every call
  const oa = (name, key, url, model) => { if (env[key]) out.push({ name, model, key: env[key], url, shape: 'openai' }); };
  oa('openrouter', 'OPENROUTER_API_KEY', 'https://openrouter.ai/api/v1/chat/completions', env.VERSE_CODER_OPENROUTER_MODEL || 'qwen/qwen3-coder:free');
  oa('groq', 'GROQ_API_KEY', 'https://api.groq.com/openai/v1/chat/completions', env.VERSE_CODER_GROQ_MODEL || 'llama-3.3-70b-versatile');
  oa('gemini', 'GEMINI_API_KEY', 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', env.VERSE_CODER_GEMINI_MODEL || 'gemini-2.5-flash');
  oa('cerebras', 'CEREBRAS_API_KEY', 'https://api.cerebras.ai/v1/chat/completions', env.VERSE_CODER_CEREBRAS_MODEL || 'qwen-3-coder-480b');
  return out.filter((p) => !/gpt-oss/i.test(p.model));
}
export const KEY_NAMES = ['VOID_OWNER_TOKEN (Verse\'s own model, /api/coder)', 'CLOUDFLARE_AI_TOKEN (minted by tools/key-keeper.mjs) or CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID', 'OPENROUTER_API_KEY', 'GROQ_API_KEY', 'GEMINI_API_KEY', 'CEREBRAS_API_KEY'];

/** a reply body as JSON. It reads the body once as text, then tries JSON, then a server-sent-event stream (data: lines).
 * A 2xx that is neither says what came back first (status, type, size), never its body, so a 90-character note still holds the cause. */
export async function readReply(r) {
  const type = String((r.headers && typeof r.headers.get === 'function' && r.headers.get('content-type')) || 'no type').split(';')[0].trim().slice(0, 40);
  const bad = (n) => ({ notJson: (r.status || 'ok') + ' ' + type + (n == null ? '' : ' ' + n + 'B') + ' not JSON' });
  if (typeof r.text !== 'function') { try { return await r.json(); } catch (_) { return bad(null); } }
  let t; try { t = await r.text(); } catch (_) { return bad(null); }
  const s = String(t || '').replace(/^\uFEFF/, '').trim();
  try { return JSON.parse(s); } catch (_) { /* not one JSON value */ }
  if (/^(data|event|id):/m.test(s)) {
    let text = '', usage = null, any = false;
    for (const line of s.split(/\r?\n/)) {
      const m = line.match(/^data:\s?(.*)$/); if (!m || m[1].trim() === '[DONE]') continue;
      let o; try { o = JSON.parse(m[1]); } catch (_) { continue; }
      any = true;
      const c = o && o.choices && o.choices[0];
      if (c && c.delta && typeof c.delta.content === 'string') text += c.delta.content;
      else if (c && c.message && typeof c.message.content === 'string') text += c.message.content;
      else if (typeof o.response === 'string') text += o.response;
      if (o && o.usage) usage = o.usage;
    }
    if (any) return { choices: [{ message: { content: text } }], usage: usage || undefined };
  }
  // a body of 64 bytes or less with no markup is no page: show it, escaped, key-like runs masked, so "200 text/plain 2B" says which 2 bytes
  const n = Buffer.byteLength(s);
  return n <= 64 && !/[<>]/.test(s) ? { notJson: bad(n).notJson + ' ' + JSON.stringify(s.replace(/[A-Za-z0-9_\-]{20,}/g, '[masked]')) } : bad(n);
}

/** a model function over the providers: each call tries them in order from the last one that answered; a 429 or error moves on */
export function stackModel(providers, { fetchImpl = fetch, timeoutMs = 120000, maxOut = 4096 } = {}) {
  let at = 0;
  const fn = async (messages) => {
    const errs = [];
    for (let k = 0; k < providers.length; k++) {
      const i = (at + k) % providers.length, p = providers[i];
      try {
        const body = p.shape === 'workers' ? { messages, max_tokens: maxOut, temperature: 0.2 } : { model: p.model, messages, max_tokens: maxOut, temperature: 0.2 };
        const r = await fetchImpl(p.url, { method: 'POST', signal: AbortSignal.timeout(timeoutMs), headers: { ...(p.headers || {}), authorization: 'Bearer ' + p.key, 'content-type': 'application/json' }, body: JSON.stringify(body) });
        if (!r.ok) { errs.push(p.name + ' ' + r.status); continue; }
        const j = await readReply(r);
        if (j && j.notJson) { errs.push(p.name + ' ' + j.notJson); continue; }
        const x = p.shape === 'workers' ? (j && j.result) || {} : j || {};
        const text = typeof x.response === 'string' ? x.response : x.response ? JSON.stringify(x.response) : String((x.choices && x.choices[0] && x.choices[0].message && x.choices[0].message.content) || '');
        if (!text.trim()) { errs.push(p.name + ' empty'); continue; }
        at = i; fn.last = p.name + ' ' + p.model;
        const u = x.usage || j.usage || {};
        return { text, tokens: u.total_tokens || 0 };
      } catch (e) { errs.push(p.name + ' ' + String((e && e.name) || e)); }
    }
    return { error: 'no model answered (' + errs.join(', ') + ')' };
  };
  return fn;
}

// ---- the tool call ----
/** the first JSON object in a reply, with an edit's diff taken from a ```diff block when the JSON leaves it out. Pure. */
export function parseAction(text) {
  const s = String(text || '');
  const start = s.indexOf('{');
  if (start < 0) return { error: 'no JSON object in the reply' };
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true; else if (c === '{') depth++; else if (c === '}' && --depth === 0) { end = i; break; }
  }
  if (end < 0) return { error: 'the JSON object never closes' };
  let a; try { a = JSON.parse(s.slice(start, end + 1)); } catch (e) { return { error: 'the JSON does not parse: ' + e.message }; }
  if (!a || typeof a.tool !== 'string') return { error: 'the JSON has no "tool"' };
  const args = a.args && typeof a.args === 'object' ? { ...a.args, ...a } : a;
  if (args.tool === 'edit' && !args.diff) { const m = s.slice(end).match(/```(?:diff|patch)?\n([\s\S]*?)```/); if (m) args.diff = m[1]; }
  return args;
}

// ---- where it may write ----
const SELF = ['tools/verse-coder.mjs', 'tools/verse-loop.mjs', 'tools/verse-loop.checks.json', 'void-live-deploy/lib/patch-guard.js'];
/** why a path is off limits for this agent, or ''. Pure apart from resolving symlinks of what already exists. */
export function pathRefusal(p, root, { write = false } = {}) {
  if (typeof p !== 'string' || !p.trim() || p.includes('\0')) return 'no path';
  if (isAbsolute(p) || /^~/.test(p)) return p + ' is not a path inside the repo';
  const abs = resolve(root, p), rel = relative(root, abs);
  if (!rel && !write) return '';
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return p + ' is outside the repo';
  let real = abs; for (let q = abs; q !== dirname(q); q = dirname(q)) if (existsSync(q)) { try { real = join(realpathSync(q), relative(q, abs)); } catch (_) { /* unreadable: judged by name */ } break; }
  const rr = relative(realpathSync(root), real); if (rr.startsWith('..') || isAbsolute(rr)) return p + ' leads outside the repo';
  const r = rel.split(sep).join('/');
  if (/(^|\/)\.git(\/|$)/.test(r)) return r + ' is git\'s own';
  if (/(^|\/)node_modules(\/|$)/.test(r)) return r + ' is installed code';
  if (/(^|\/)\.env(?!\.example$)(\.|$)/i.test(r) || /(^|\/)\.dev\.vars/i.test(r)) return r + ' holds secrets: never';
  if (/^\.github\/(workflows|actions)\//.test(r)) return r + ' is a workflow: never';
  if (/(^|\/)(secrets?|credentials?)(\/|\.|$)/i.test(r) || /\.(pem|key|p12|pfx|keystore|jks)$/i.test(r) || /(^|\/)id_(rsa|ed25519|ecdsa|dsa)/.test(r)) return r + ' looks like a secret: never';
  if (write && SELF.includes(r)) return r + ' is one of the loop\'s own guards: never';
  return '';
}

/** the files a unified diff touches: [{ path, from, to, created, deleted }] and whether it is -p1. Pure. */
export function diffFiles(diff) {
  const lines = String(diff || '').split('\n'), out = [], heads = [];
  let refusal = '';
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^(rename|copy) (from|to) /.test(l)) refusal = 'renames and copies are not allowed: delete and add instead';
    if (/^GIT binary patch|^Binary files /.test(l)) refusal = 'binary patches are not allowed';
    if (l.startsWith('--- ') && lines[i + 1] && lines[i + 1].startsWith('+++ ')) heads.push([l.slice(4).replace(/\t.*$/, '').trim(), lines[i + 1].slice(4).replace(/\t.*$/, '').trim()]);
  }
  const p1 = heads.length > 0 && heads.every(([a, b]) => (a === '/dev/null' || a.startsWith('a/')) && (b === '/dev/null' || b.startsWith('b/')));
  const strip = (x) => (x === '/dev/null' ? null : p1 ? x.slice(2) : x);
  for (const [a, b] of heads) { const from = strip(a), to = strip(b); out.push({ path: to || from, from, to, created: !from, deleted: !to }); }
  return { files: out, p1, refusal };
}

// ---- the test-weakening guard ----
export const TEST_FILE = /(^|\/)(tests?|__tests__|spec)\/|(^|\/)test_[^/]*\.py$|_test\.(py|go|m?js)$|\.(test|spec)\.[cm]?[jt]sx?$/;
const count = (s, re) => (String(s || '').match(re) || []).length;
const ASSERT = /\b(assert(\.\w+)?|expect|should|t\.(ok|is|not|equal|deepEqual|true|false|throws|rejects|match|notOk|pass)|strictEqual|deepStrictEqual|assertEqual|assertTrue|assertFalse|assertIn|assertRaises)\s*\(|^\s*assert\s+/gm;
const CASES = /\b(test|it|describe|suite)\s*\(|^\s*def test_\w+/gm;
const SKIPS = /\.(skip|only|todo)\s*\(|\b(skip|todo|only)\s*:\s*(true|['"`])|\bx(it|describe|test)\s*\(|@pytest\.mark\.(skip|xfail)|unittest\.skip|\bif\s*\(\s*(false|0)\s*\)|\breturn\s*;?\s*\/\/\s*skip/g;
const EXITS = /process\.exit\(\s*0?\s*\)|sys\.exit\(\s*0?\s*\)|process\.exitCode\s*=\s*0/g;
const TRIVIAL = /assert(\.ok)?\(\s*(true|1|!0)\s*[,)]|expect\(\s*true\s*\)|assert\.equal\(\s*(\w+)\s*,\s*\5\s*\)|assert\s+True\b/g;
/** the ways an edit makes a test (or a check's script) weaker; [] when it does not. Pure. */
export function weakening(before, after) {
  if (after == null) return ['deletes the test'];
  const b = String(before || ''), a = String(after), why = [];
  if (count(a, ASSERT) < count(b, ASSERT)) why.push('fewer assertions (' + count(b, ASSERT) + ' to ' + count(a, ASSERT) + ')');
  if (count(a, CASES) < count(b, CASES)) why.push('fewer test cases (' + count(b, CASES) + ' to ' + count(a, CASES) + ')');
  if (count(a, SKIPS) > count(b, SKIPS)) why.push('adds a skip, only, todo or dead branch');
  if (count(a, EXITS) > count(b, EXITS)) why.push('adds an early clean exit');
  if (count(a, TRIVIAL) > count(b, TRIVIAL)) why.push('adds an assertion that cannot fail');
  return why;
}
/** the repo files the checks run (node tools/x.mjs, python3 y.py, sh z.sh): guarded like tests. Pure. */
export function checkScripts(checks) {
  const out = new Set();
  for (const c of checks || []) for (const m of String(c.cmd || '').matchAll(/(?:^|\s)((?:\.\/)?[\w./-]+\.(?:mjs|cjs|js|py|sh))\b/g)) out.add(m[1].replace(/^\.\//, ''));
  return out;
}

// ---- small helpers ----
const tail = (s, n = LIMITS.out) => { s = String(s || ''); return s.length > n ? '[...]\n' + s.slice(-n) : s; };
const head = (s, n = LIMITS.out) => { s = String(s || ''); return s.length > n ? s.slice(0, n) + '\n[... cut]' : s; };
const SECRET_ENV = /(_API_KEY|_TOKEN|_SECRET|SECRET_|PASSWORD|_KEY)$/i;
/** the environment without a single key: what checks and the review run with */
export const keyless = (env = process.env) => Object.fromEntries(Object.entries(env).filter(([k]) => !SECRET_ENV.test(k) && k !== 'NODE_TEST_CONTEXT')); // and a node --test run of its own
const git = (root, args, opts = {}) => spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20, ...opts });
const readOr = (p) => { try { return readFileSync(p, 'utf8'); } catch (_) { return null; } };

export const WINDOW = Object.freeze({ messages: 24, fresh: 4, keep: 600 });
/** what the model gets each turn: the system and the task, then the last WINDOW.messages turns, with each tool result older than the
 *  newest WINDOW.fresh messages cut to WINDOW.keep characters. Every turn sends the whole window again, so full old reads made the
 *  count grow with the square of the turns: a 250000-token run stopped near turn 12 of 30 with nothing shipped; now the newest 2 results stay whole. Pure. */
export function windowOf(messages) {
  const m = Array.isArray(messages) ? messages : [];
  const rest = m.length > WINDOW.messages + 2 ? m.slice(-WINDOW.messages) : m.slice(2);
  return [...m.slice(0, 2), ...rest.map((x, i) => (x.role === 'user' && i < rest.length - WINDOW.fresh && x.content.length > WINDOW.keep
    ? { role: 'user', content: x.content.slice(0, WINDOW.keep) + '\n[... ' + (x.content.length - WINDOW.keep) + ' characters cut from an older result; read it again if you need it]' } : x))];
}

export const BUDGET = Object.freeze({ warn: 0.4, last: 0.8 });
/** the line after a tool result once 40% of the budget (turns or tokens, whichever is further) is gone: how much is used and, with no edit
 *  yet, that the next answer is an edit; from 80%, that it is time to edit, or to check and finish. A run that read for 25 turns and never
 *  edited stopped at the token cap with nothing to ship (2026-10-29): the window kept the turns cheap, but nothing told the model the budget
 *  was running out. '' before 40%. Pure. */
export function budgetNote({ turns = 0, tokens = 0, limits = LIMITS, edited = false } = {}) {
  const used = Math.max(turns / limits.turns, tokens / limits.tokens);
  if (!(used >= BUDGET.warn)) return '';
  const where = 'turn ' + turns + ' of ' + limits.turns + ', ' + Math.min(100, Math.round((100 * tokens) / limits.tokens)) + '% of the token budget used';
  if (used >= BUDGET.last) return '\n[' + where + '. ' + (edited ? 'Run the check now, then finish: at the cap a change is kept only if the last check after the last edit passed.'
    : 'Nothing is changed yet, and a run with no edit ships nothing: answer with an edit now.') + ']';
  return '\n[' + where + (edited ? '.]' : ', and no edit yet. You have read enough: answer with an edit next, the smallest one that moves the task.]');
}

/** the turns as a short trail for a stop at a cap ("read a, search x, edit: the diff does not apply"), so the job note says where they went. Pure. */
export function trailOf(transcript, n = 12) {
  const t = Array.isArray(transcript) ? transcript.slice(-n) : [];
  return t.map((x) => [x.tool, x.path].filter(Boolean).join(' ') + (/^(refused|the diff|no such|no tool|no match|FAIL)/.test(String(x.result || '')) ? ': ' + String(x.result).split('\n')[0].slice(0, 60) : '')).join(', ');
}

const SYSTEM = (checks, target) => `You are Verse's coding agent, working in a git repository through tools. You change code so the task is done and every check stays green.
Answer every turn with exactly one JSON object and nothing else (an edit may put its diff in a \`\`\`diff block right after the JSON instead):
{"tool":"list","path":"tools"}                       list a directory
{"tool":"read","path":"tools/x.mjs","from":1,"to":200} read lines of a file
{"tool":"search","pattern":"regex","path":"."}       ripgrep the repo
{"tool":"replace","path":"f","old":"exact text","new":"new text"} swap text that is in the file exactly once (best for most changes; "old":"" makes a new file)
{"tool":"edit","diff":"--- a/f\\n+++ b/f\\n@@ ... @@\\n..."} apply a unified diff (paths relative to the repo; a new file is --- /dev/null)
{"tool":"check","name":"<check>"}                    run one check; or {"tool":"check","test":"path/to/x.test.mjs"} for one node test file
{"tool":"finish","summary":"what changed and why"}   when the task is done
Checks you can run: ${checks.map((c) => c.name).join(', ') || '(none)'}.${target ? '\nThe red check to make green: ' + target + '.' : ''}
Rules: fix the code, never the test: an edit that removes assertions or test cases, skips a test or exits early is refused. Never touch .env files, workflows, secrets or anything outside the repo. Keep changes small and in the style around them. Read before you edit, and run the check before you finish. Verse's review runs on your diff when you finish, and a bug or risk it finds sends you back.`;

/**
 * One run. model(messages) -> { text, tokens? } | { error }. Returns { outcome, why, turns, tokens, files, log }.
 * outcome: done | nothing | turn-cap | token-cap | model-down | error. Anything but done leaves the tree as it was found.
 */
export async function runCoder({ root, prompt, checks = DEFAULT_CHECKS, target = '', model, limits = {}, env = process.env, review = true, log = () => {} }) {
  root = resolve(root);
  const L = { ...LIMITS, ...limits }, cleanEnv = keyless(env), guarded = checkScripts(checks);
  const original = new Map(); // path -> content at the start (null: did not exist)
  const touched = () => [...original.keys()];
  const transcript = [];
  const messages = [{ role: 'system', content: SYSTEM(checks, target) }, { role: 'user', content: String(prompt || 'No task given: finish.') }];
  let turns = 0, tokens = 0, finishTries = 0, lastCheck = null, lastEdit = 0;

  const restore = () => {
    for (const [p, c] of original) { const abs = join(root, p); if (c == null) { try { unlinkSync(abs); } catch (_) { /* gone already */ } } else writeFileSync(abs, c); }
  };
  const end = (outcome, why) => {
    if (outcome !== 'done') restore();
    if ((outcome === 'turn-cap' || outcome === 'token-cap') && transcript.length) why += ' after ' + turns + ' turns: ' + trailOf(transcript);
    return { outcome, why, turns, tokens, files: outcome === 'done' ? changedFiles() : [], log: transcript };
  };
  const changedFiles = () => touched().filter((p) => readOr(join(root, p)) !== original.get(p));

  // what every write passes after it lands: a test or check never weakened, patch-guard on code; '' when it stays, else why it was put back
  const guarded_ = (before) => {
    const undo = () => { for (const [f, c] of before) { const abs = join(root, f); if (c == null) { try { unlinkSync(abs); } catch (_) { /* gone */ } } else writeFileSync(abs, c); } };
    for (const f of before.keys()) {
      if (!original.has(f)) original.set(f, before.get(f));
      const was = original.get(f), now = readOr(join(root, f));
      if (TEST_FILE.test(f) || guarded.has(f)) {
        const why = weakening(was, now);
        if (why.length) { undo(); return 'refused: this edit weakens ' + f + ' (' + why.join('; ') + '). Fix the code under test, never the test.'; }
      }
      if (now != null && /\.(m?js|cjs|html?|json)$/.test(f)) {
        const g = guardPatch({ before: was || '', after: now, kind: kindOf(f.split('.').pop()) });
        if (!g.ok) { undo(); return 'refused by patch-guard on ' + f + ': ' + g.reasons.join('; '); }
      }
    }
    lastEdit = turns;
    return '';
  };
  const tools = {
    list({ path = '.' }) {
      const why = pathRefusal(path, root); if (why) return 'refused: ' + why;
      const abs = resolve(root, path); if (!existsSync(abs)) return 'no such directory: ' + path;
      if (!statSync(abs).isDirectory()) return path + ' is a file';
      const rows = readdirSync(abs, { withFileTypes: true }).filter((d) => d.name !== '.git' && d.name !== 'node_modules').map((d) => d.name + (d.isDirectory() ? '/' : '')).sort();
      return head(rows.slice(0, 400).join('\n') + (rows.length > 400 ? '\n[' + (rows.length - 400) + ' more]' : ''));
    },
    read({ path, from = 1, to }) {
      const why = pathRefusal(path, root); if (why) return 'refused: ' + why;
      const text = readOr(resolve(root, path)); if (text == null) return 'no such file: ' + path;
      const ls = text.split('\n'), a = Math.max(1, +from || 1), b = Math.min(ls.length, +to || a + 299);
      return head(ls.slice(a - 1, b).map((l, i) => (a + i) + '\t' + l).join('\n'), 16000) + (b < ls.length ? '\n[' + ls.length + ' lines; read on with "from":' + (b + 1) + ']' : '');
    },
    search({ pattern, path = '.' }) {
      if (!pattern) return 'search needs a pattern';
      const why = pathRefusal(path, root); if (why) return 'refused: ' + why;
      let r = spawnSync('rg', ['-n', '--no-heading', '--max-count', '20', '--max-columns', '240', '-g', '!.env*', '-g', '!.git', '-e', String(pattern), '--', path], { cwd: root, encoding: 'utf8', maxBuffer: 16 << 20 });
      if (r.error) r = git(root, ['grep', '-n', '-I', '-E', '-e', String(pattern), '--', path, ':!.env*']);
      return head(r.stdout || (r.status === 1 ? 'no match' : r.stderr || 'no match'));
    },
    edit({ diff }) {
      if (!diff || typeof diff !== 'string') return 'edit needs a unified diff';
      const text = diff.endsWith('\n') ? diff : diff + '\n';
      const { files, p1, refusal } = diffFiles(text);
      if (refusal) return 'refused: ' + refusal;
      if (!files.length) return 'no file headers (--- a/x, +++ b/x) in the diff';
      const p = p1 ? '-p1' : '-p0';
      const stat = git(root, ['apply', p, '--numstat', '--recount', '-'], { input: text });
      const named = new Set(files.map((f) => f.path).concat((stat.stdout || '').split('\n').filter(Boolean).map((l) => l.split('\t')[2])));
      for (const f of named) { const why = pathRefusal(f, root, { write: true }); if (why) return 'refused: ' + why; }
      for (const f of files) if (f.deleted && (TEST_FILE.test(f.path) || guarded.has(f.path))) return 'refused: ' + f.path + ' is a test or a check: never deleted';
      const chk = git(root, ['apply', p, '--check', '--recount', '--whitespace=nowarn', '-'], { input: text });
      if (chk.status) return 'the diff does not apply: ' + tail(chk.stderr, 1500) + '\nRead the file again, or use replace: {"tool":"replace","path":"f","old":"the exact lines now","new":"what they become"}.';
      const before = new Map([...named].map((f) => [f, readOr(join(root, f))]));
      const ap = git(root, ['apply', p, '--recount', '--whitespace=nowarn', '-'], { input: text });
      if (ap.status) return 'the diff did not apply: ' + tail(ap.stderr, 1500);
      return guarded_(before) || 'applied to ' + [...named].join(', ');
    },
    // an exact text swap needs no line numbers or context to line up: a run spent its turns on diffs that did not apply (2026-10-29)
    replace({ path, old, new: next }) {
      const why = pathRefusal(path, root, { write: true }); if (why) return 'refused: ' + why;
      if (typeof old !== 'string' || typeof next !== 'string') return 'replace needs "path", "old" (the exact text in the file now) and "new" (what it becomes)';
      const abs = join(root, path), was = readOr(abs);
      if (was == null) {
        if (old !== '') return 'no such file: ' + path + '. To make a new file, send "old":"" and the whole file as "new".';
      } else {
        if (old === '') return path + ' exists: put the exact text to change in "old"';
        const n = was.split(old).length - 1;
        if (!n) return 'no match: "old" is not in ' + path + ' as written. Read the lines again and copy them exactly, spaces included.';
        if (n > 1) return '"old" is in ' + path + ' ' + n + ' times: add lines around it so it is there once';
      }
      const before = new Map([[path, was]]);
      if (was == null) mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, was == null ? next : was.replace(old, () => next));
      return guarded_(before) || 'applied to ' + path;
    },
    check({ name, test }) {
      let cmd, timeoutMin = 10, label;
      if (test) {
        const why = pathRefusal(test, root); if (why) return 'refused: ' + why;
        if (!TEST_FILE.test(test) || !existsSync(join(root, test))) return test + ' is not a test file in the repo';
        cmd = [process.execPath, ['--test', test]]; label = 'node --test ' + test;
      } else {
        const c = checks.find((x) => x.name === name); if (!c) return 'no check named ' + JSON.stringify(name) + '. Checks: ' + checks.map((x) => x.name).join(', ');
        cmd = c.cmd; timeoutMin = c.timeoutMin || 10; label = c.name;
      }
      const r = Array.isArray(cmd) ? spawnSync(cmd[0], cmd[1], { cwd: root, env: cleanEnv, encoding: 'utf8', timeout: timeoutMin * 60e3, maxBuffer: 64 << 20 })
        : spawnSync(cmd, { cwd: root, env: cleanEnv, shell: true, encoding: 'utf8', timeout: timeoutMin * 60e3, maxBuffer: 64 << 20 });
      const ok = r.status === 0; lastCheck = { label, ok, turn: turns };
      return (ok ? 'PASS ' : 'FAIL ') + label + (r.error ? ' (' + r.error.code + ')' : '') + '\n' + tail((r.stdout || '') + (r.stderr || ''));
    },
  };

  const finish = (summary) => {
    const files = changedFiles();
    if (!files.length) return { end: ['nothing', 'finished with no change' + (summary ? ': ' + String(summary).slice(0, 200) : '')] };
    const blocks = [];
    if (target) { const t = tools.check({ name: target }); if (!t.startsWith('PASS')) blocks.push('the target check ' + target + ' is still red:\n' + tail(t, 2500)); }
    const r = review ? ownReview(root, cleanEnv) : { findings: [], diff: '' };
    if (r.error) blocks.push('Verse\'s review could not run: ' + r.error);
    if (r.findings.length) blocks.push('Verse\'s review blocks this diff:\n' + r.findings.slice(0, 12).map((f) => f.file + ':' + f.line + ' ' + f.kind + ' ' + f.rule + ': ' + f.message).join('\n'));
    const keys = scanDiff(r.diff || git(root, ['diff', '--no-color', 'HEAD']).stdout || '');
    if (keys.length) blocks.push('the diff carries something shaped like a key in ' + [...new Set(keys.map((k) => k.file))].join(', ') + ': take it out');
    if (blocks.length) return { feedback: blocks.join('\n\n') + '\nFix these, then finish again.' };
    return { end: ['done', String(summary || 'done').slice(0, 300)] };
  };

  // at a cap, a change the model checked green after its last edit goes through finish as it stands; anything else is put back
  const atCap = (outcome, why) => {
    if (!(lastCheck && lastCheck.ok && lastCheck.turn > lastEdit && changedFiles().length)) return end(outcome, why);
    const f = finish('');
    if (f.end && f.end[0] === 'done') { transcript.push({ turn: turns, tool: 'finish', result: 'at the cap: ' + f.end[1] }); return end('done', why + ', with the change checked green after its last edit: kept as it stood'); }
    return end(outcome, why + '; the change as it stood did not pass: ' + String(f.feedback || '').split('\n')[0].slice(0, 120));
  };
  while (true) {
    if (turns >= L.turns) return atCap('turn-cap', 'stopped at the turn cap (' + L.turns + ')');
    if (tokens >= L.tokens) return atCap('token-cap', 'stopped at the token cap (' + L.tokens + ')');
    turns++;
    const recent = windowOf(messages);
    let reply;
    try { reply = await model(recent); } catch (e) { reply = { error: String((e && e.message) || e) }; }
    if (!reply || reply.error) return end('model-down', (reply && reply.error) || 'the model gave nothing');
    const text = String(reply.text || '');
    tokens += reply.tokens || Math.ceil((recent.reduce((n, m) => n + m.content.length, 0) + text.length) / 4);
    const act = parseAction(text);
    let result;
    if (act.error) result = act.error + '. Answer with exactly one JSON object like {"tool":"read","path":"..."}.';
    else if (act.tool === 'finish') {
      const f = finish(act.summary);
      if (f.end) { transcript.push({ turn: turns, tool: 'finish', result: f.end[1] }); log('  finish: ' + f.end[1]); return end(...f.end); }
      if (++finishTries >= L.finishTries) { transcript.push({ turn: turns, tool: 'finish', result: f.feedback }); return end('nothing', 'gave up: ' + f.feedback.split('\n')[0]); }
      result = f.feedback;
    } else if (tools[act.tool]) {
      try { result = tools[act.tool](act); } catch (e) { result = act.tool + ' failed: ' + String((e && e.message) || e); }
    } else result = 'no tool named ' + JSON.stringify(act.tool) + ': list, read, search, replace, edit, check, finish';
    transcript.push({ turn: turns, tool: act.tool || '?', path: act.path || act.name || act.test || '', result: String(result).slice(0, 200) });
    log('  turn ' + turns + ': ' + (act.tool || 'bad reply') + ' ' + (act.path || act.name || act.test || '') + ' -> ' + String(result).split('\n')[0].slice(0, 120));
    messages.push({ role: 'assistant', content: text }, { role: 'user', content: String(result) + budgetNote({ turns, tokens, limits: L, edited: changedFiles().length > 0 }) });
  }
}

/** Verse's review (tools/review-pr.mjs --gate --json) on the working tree's change, through a throwaway commit no ref points at */
export function ownReview(root, env = keyless()) {
  const tmp = mkdtempSync(join(tmpdir(), 'verse-coder-idx-')), idx = join(tmp, 'index');
  try {
    const genv = { ...env, GIT_INDEX_FILE: idx, GIT_AUTHOR_NAME: 'Verse', GIT_AUTHOR_EMAIL: 'verse@localhost', GIT_COMMITTER_NAME: 'Verse', GIT_COMMITTER_EMAIL: 'verse@localhost' };
    const g = (args) => { const r = git(root, args, { env: genv }); if (r.status) throw new Error('git ' + args[0] + ': ' + (r.stderr || '').trim()); return r.stdout.trim(); };
    g(['read-tree', 'HEAD']); g(['add', '-A']);
    const tree = g(['write-tree']), sha = g(['commit-tree', tree, '-p', 'HEAD', '-m', 'verse-coder review']);
    const diff = g(['diff', '--no-color', 'HEAD', sha]);
    const r = spawnSync(process.execPath, [join(HERE, 'review-pr.mjs'), '--base', 'HEAD', '--head', sha, '--gate', '--json'], { cwd: root, env, encoding: 'utf8', timeout: 5 * 60e3, maxBuffer: 64 << 20 });
    let j; try { j = JSON.parse(r.stdout); } catch (_) { return { findings: [], diff, error: tail(r.stderr || r.stdout || 'no output', 600) }; }
    return { findings: (j.findings || []).filter((f) => f.kind === 'bug' || f.kind === 'risk'), diff };
  } catch (e) { return { findings: [], diff: '', error: String(e.message || e).slice(0, 400) }; } finally { rmSync(tmp, { recursive: true, force: true }); }
}

/** a scripted model for tests and dry runs: VERSE_CODER_SCRIPT names a JSON list of replies; the last one repeats */
export function scriptedModel(replies) { let i = 0; return async () => ({ text: typeof replies[Math.min(i, replies.length - 1)] === 'string' ? replies[Math.min(i++, replies.length - 1)] : JSON.stringify(replies[Math.min(i++, replies.length - 1)]) }); }

function parseCli(argv) {
  const o = { repo: process.cwd(), promptFile: '', task: '', checks: '', target: '', turns: 0, tokens: 0 };
  const flags = { '--repo': 'repo', '--prompt-file': 'promptFile', '--task': 'task', '--checks': 'checks', '--target': 'target', '--max-turns': 'turns', '--max-tokens': 'tokens' };
  for (let i = 0; i < argv.length; i++) { const k = flags[argv[i]]; if (!k) throw new Error('unknown flag ' + argv[i]); o[k] = argv[++i]; }
  return o;
}

async function main() {
  const o = parseCli(process.argv.slice(2)), env = process.env, root = resolve(o.repo);
  const say = (r) => { console.log(JSON.stringify({ outcome: r.outcome, why: r.why, turns: r.turns || 0, tokens: r.tokens || 0, files: r.files || [], provider: r.provider || '' })); process.exit(EXIT[r.outcome] ?? 1); };
  const prompt = o.promptFile ? readFileSync(o.promptFile, 'utf8') : o.task;
  if (!prompt) return say({ outcome: 'error', why: 'give --prompt-file or --task' });
  const checks = o.checks ? JSON.parse(readFileSync(o.checks, 'utf8')) : existsSync(join(root, 'tools/verse-loop.checks.json')) ? JSON.parse(readFileSync(join(root, 'tools/verse-loop.checks.json'), 'utf8')) : DEFAULT_CHECKS;
  let model, provider = '';
  if (env.VERSE_CODER_SCRIPT) { model = scriptedModel(JSON.parse(readFileSync(env.VERSE_CODER_SCRIPT, 'utf8'))); provider = 'script'; }
  else {
    const ps = providersFrom(env);
    if (!ps.length) return say({ outcome: 'no-model', why: 'Verse\'s coder needs one model key in the environment: ' + KEY_NAMES.join(', ') });
    model = stackModel(ps); provider = ps.map((p) => p.name).join(' > ');
  }
  const r = await runCoder({ root, prompt, checks, target: o.target, model, env, limits: { ...(+o.turns ? { turns: +o.turns } : {}), ...(+o.tokens ? { tokens: +o.tokens } : {}) }, log: (s) => console.error(s) });
  say({ ...r, provider: (model.last || provider) });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.log(JSON.stringify({ outcome: 'error', why: String((e && e.message) || e).slice(0, 300) })); process.exit(1); });
