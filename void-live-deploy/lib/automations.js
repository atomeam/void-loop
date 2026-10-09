/**
 * Void's own automations ("when this happens, do that"): the owner's rules, run by Void itself on Cloudflare, so no
 * outside automation service's monthly cap can stop one halfway (2026-10-09: a capped connector stopped a push mid-way).
 * This file is the pure half: what a rule may say, how a trigger's data fills it in, and the steps it turns into. No
 * network, no D1: tools/automations.test.mjs runs it in node. lib/automations-run.js does the D1 and the calls.
 *
 * A rule: { id, name, enabled, when: { on, match? }, do: [step, ...] }
 *   when.on     'webhook'  POST /api/hook/<id> with the rule's secret (header x-void-hook); the JSON body is the event
 *               'manual'   only "Run now" (the card, or POST /api/automations { id, run: true })
 *               'schedule' every when.every minutes (15 to 10080), run by the clock: POST /api/automations/tick, which an
 *                          Actions cron calls every 15 minutes today (.github/workflows/void-tick.yml) and a Worker can later
 *                          (the route stays the same, only who calls it changes); the event is { tick: true, at }
 *   when.match  optional { 'a.b': 'value' }: every listed field of the event must equal its value (strings compared)
 *   do          1 to MAX_STEPS steps, run in order; the first that fails stops the rest
 * Steps (any string field may use {{event.a.b}}, filled from the event; a missing field fills as empty):
 *   { action: 'note', text }                                    writes one line to the run log, nothing else
 *   { action: 'queue.add', ask, target? }                       a job in Void's build queue (as the owner's POST /api/queue)
 *   { action: 'github.comment', repo, issue, body }             a comment on an issue or pull request
 *   { action: 'github.pr', repo, base?, branch, title, body?, files: [{ path, content }] }
 *                                                               commits the files to a new branch and opens a pull request
 *                                                               (never pushes to an existing default branch; never merges)
 *   { action: 'http.post', url, body? }                         POSTs JSON to a public https address
 * What a rule can reach is fenced here, not trusted to the rule: GitHub only in the repos the owner allows
 * (AUTOMATION_REPOS, default atomeam/void-loop), branches only under void/, never workflow files, and http only to
 * public https hosts. Event data can fill text in but never chooses the repo, the branch prefix or a file path's root.
 */
export const SCHEMA = 'void.automation.v1';
export const TRIGGERS = ['webhook', 'manual', 'schedule'];
export const EVERY_MIN = 15, EVERY_MAX = 10080; // minutes between scheduled runs: the clock ticks every 15, a week at most
export const ACTIONS = ['note', 'queue.add', 'github.comment', 'github.pr', 'http.post'];
export const MAX_STEPS = 5, MAX_FILES = 20, MAX_FILE_BYTES = 100000, MAX_TEXT = 4000, MAX_NAME = 60, MAX_EVENT = 64000; // a GitHub webhook body is often 20 to 40 KB
export const DEFAULT_REPOS = ['atomeam/void-loop'];
export const BRANCH_PREFIX = 'void/';

export const repoList = (env) => String((env && env.AUTOMATION_REPOS) || DEFAULT_REPOS.join(',')).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const str = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** a value at a dotted path of the event ('pull_request.number'), or undefined */
export function pick(event, path) {
  let v = event;
  for (const k of String(path).split('.')) { if (!isObj(v) && !Array.isArray(v)) return undefined; v = v[k]; }
  return v;
}
/** fill {{event.a.b}} from the event: strings and numbers only; anything else (missing, objects) fills as empty */
export function fill(text, event) {
  return str(text).replace(/\{\{\s*event\.([\w.-]+)\s*\}\}/g, (_, p) => { const v = pick(event, p); return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? String(v) : ''; });
}
const templated = (s) => /\{\{/.test(str(s));

/** does the event meet the rule's match? (no match = every event) */
export function matches(rule, event) {
  const m = rule && rule.when && rule.when.match;
  if (!m) return true;
  return Object.entries(m).every(([p, want]) => str(pick(event, p)) === str(want));
}

/** is a scheduled rule due? lastRun: ISO time of its last run (any trigger), or null. The clock ticks about every 15
 * minutes and GitHub's crons run late, so a rule is due SLACK_MS early rather than skip a whole tick. */
export const SLACK_MS = 3 * 60e3;
export function due(rule, lastRun, now = Date.now()) {
  if (!rule || !rule.enabled || !rule.when || rule.when.on !== 'schedule') return false;
  const last = lastRun ? Date.parse(lastRun) : NaN;
  return !Number.isFinite(last) || now - last >= rule.when.every * 60e3 - SLACK_MS;
}

// a path inside the repo: relative, no '..', no hidden git or workflow files
export function safePath(p) {
  const s = str(p);
  if (!s || s.length > 200 || s.startsWith('/') || /\\/.test(s) || /(^|\/)\.\.?(\/|$)/.test(s) || /[\u0000-\u001f]/.test(s)) return false;
  if (/^\.git(\/|$)/.test(s) || /^\.github\/workflows\//i.test(s)) return false;
  return true;
}
export function safeBranch(b) {
  const s = str(b);
  return s.startsWith(BRANCH_PREFIX) && s.length <= 80 && /^[A-Za-z0-9._\/-]+$/.test(s) && !/\.\.|\/\/|\/$|\.lock$|@\{/.test(s);
}
/** a public https address: no credentials, no ports, no IPs, no local or internal names */
export function safeUrl(u) {
  let x; try { x = new URL(str(u)); } catch (_) { return false; }
  if (x.protocol !== 'https:' || x.username || x.password || x.port) return false;
  const h = x.hostname.toLowerCase();
  if (/^\[|^\d+\.\d+\.\d+\.\d+$|^localhost$|\.local$|\.internal$|\.localhost$/.test(h) || !h.includes('.')) return false;
  return true;
}

/** is this a rule Void will keep? { ok, errors: [text], rule: the normalized rule } (env decides the allowed repos) */
export function validate(input, env) {
  const errors = [], bad = (m) => errors.push(m);
  if (!isObj(input)) return { ok: false, errors: ['a rule is an object'], rule: null };
  const repos = repoList(env);
  const rule = { id: str(input.id).slice(0, 40), name: str(input.name).trim().slice(0, MAX_NAME), enabled: input.enabled !== false, when: {}, do: [] };
  if (rule.id && !/^[a-z0-9-]{3,40}$/.test(rule.id)) bad('id is 3 to 40 of a-z 0-9 -');
  if (!rule.name) bad('a rule needs a name');
  const w = isObj(input.when) ? input.when : {};
  if (!TRIGGERS.includes(w.on)) bad('when.on is one of: ' + TRIGGERS.join(', '));
  rule.when.on = w.on;
  if (w.on === 'schedule') {
    if (!Number.isInteger(w.every) || w.every < EVERY_MIN || w.every > EVERY_MAX) bad('when.every is whole minutes from ' + EVERY_MIN + ' to ' + EVERY_MAX + ' (1440 is a day)');
    rule.when.every = w.every;
  }
  if (w.match !== undefined) {
    if (!isObj(w.match) || Object.keys(w.match).length > 10) bad('when.match is up to 10 { "field.path": "value" } pairs');
    else { rule.when.match = {}; for (const [k, v] of Object.entries(w.match)) { if (!/^[\w.-]{1,80}$/.test(k) || (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean')) bad('when.match ' + k + ': a field path and a plain value'); else rule.when.match[k] = v; } }
  }
  const steps = Array.isArray(input.do) ? input.do : [];
  if (!steps.length || steps.length > MAX_STEPS) bad('do is 1 to ' + MAX_STEPS + ' steps');
  steps.slice(0, MAX_STEPS).forEach((s, i) => {
    const at = 'step ' + (i + 1) + ': ';
    if (!isObj(s) || !ACTIONS.includes(s.action)) return bad(at + 'action is one of: ' + ACTIONS.join(', '));
    const text = (k, need, max = MAX_TEXT) => { const v = str(s[k]); if (need && !v.trim()) bad(at + k + ' is needed'); if (v.length > max) bad(at + k + ' is too long'); return v; };
    const fixedRepo = () => { const r = str(s.repo).toLowerCase(); if (templated(r) || !repos.includes(r)) bad(at + 'repo must be one Void may touch (' + repos.join(', ') + ')'); return r; };
    if (s.action === 'note') rule.do.push({ action: 'note', text: text('text', true, 500) });
    else if (s.action === 'queue.add') rule.do.push({ action: 'queue.add', ask: text('ask', true, 200), target: text('target', false, 40) || 'next' });
    else if (s.action === 'github.comment') {
      const repo = fixedRepo(), issue = str(s.issue);
      if (!/^\d{1,7}$/.test(issue) && !/^\{\{\s*event\.[\w.-]+\s*\}\}$/.test(issue)) bad(at + 'issue is a number, or one {{event.…}} field');
      rule.do.push({ action: 'github.comment', repo, issue, body: text('body', true) });
    } else if (s.action === 'github.pr') {
      const repo = fixedRepo(), branch = str(s.branch), base = str(s.base) || 'main';
      // event data may name the rest of the branch, never its prefix: the prefix is checked on the filled branch at run time too
      if (!str(branch).startsWith(BRANCH_PREFIX) || (!templated(branch) && !safeBranch(branch))) bad(at + 'branch starts with ' + BRANCH_PREFIX + ' (letters, digits, . _ - /)');
      if (templated(base) || !/^[A-Za-z0-9._\/-]{1,80}$/.test(base)) bad(at + 'base is a plain branch name');
      const files = Array.isArray(s.files) ? s.files : [];
      if (!files.length || files.length > MAX_FILES) bad(at + 'files is 1 to ' + MAX_FILES + ' { path, content }');
      const out = [];
      for (const f of files.slice(0, MAX_FILES)) {
        const p = str(f && f.path), c = str(f && f.content);
        if (templated(p) || !safePath(p)) bad(at + 'file path ' + JSON.stringify(p.slice(0, 60)) + ' is not allowed (relative, no .., no .git or workflow files, no {{…}})');
        if (new TextEncoder().encode(c).length > MAX_FILE_BYTES) bad(at + p + ' is over ' + MAX_FILE_BYTES + ' bytes');
        out.push({ path: p, content: c });
      }
      rule.do.push({ action: 'github.pr', repo, base, branch, title: text('title', true, 200), body: text('body', false), files: out });
    } else if (s.action === 'http.post') {
      const url = str(s.url);
      if (templated(url) || !safeUrl(url)) bad(at + 'url is a fixed public https address');
      rule.do.push({ action: 'http.post', url, body: text('body', false) });
    }
  });
  return { ok: errors.length === 0, errors, rule: errors.length ? null : rule };
}

/** the calls one run would make for this event, filled in and checked again after filling (event data is untrusted) */
export function steps(rule, event = {}) {
  return rule.do.map((s) => {
    if (s.action === 'note') return { action: 'note', text: fill(s.text, event).slice(0, 500) };
    if (s.action === 'queue.add') return { action: 'queue.add', ask: fill(s.ask, event).slice(0, 200), target: fill(s.target, event).slice(0, 40) || 'next' };
    if (s.action === 'github.comment') {
      const issue = fill(s.issue, event);
      return /^\d{1,7}$/.test(issue) ? { action: 'github.comment', repo: s.repo, issue: +issue, body: fill(s.body, event).slice(0, MAX_TEXT) } : { action: 'github.comment', error: 'the event gave no issue number' };
    }
    if (s.action === 'github.pr') {
      const branch = fill(s.branch, event).replace(/[^A-Za-z0-9._\/-]+/g, '-').slice(0, 80);
      if (!safeBranch(branch)) return { action: 'github.pr', error: 'the filled branch ' + JSON.stringify(branch) + ' is not under ' + BRANCH_PREFIX };
      if (branch === BRANCH_PREFIX + s.base || branch === s.base) return { action: 'github.pr', error: 'a pull request needs its own branch' };
      return { action: 'github.pr', repo: s.repo, base: s.base, branch, title: fill(s.title, event).slice(0, 200), body: fill(s.body, event).slice(0, MAX_TEXT), files: s.files.map((f) => ({ path: f.path, content: fill(f.content, event) })) };
    }
    if (s.action === 'http.post') return { action: 'http.post', url: s.url, body: fill(s.body, event).slice(0, MAX_TEXT) };
    return { action: s.action, error: 'unknown action' };
  });
}

/** three rules to start from (the card offers them; each is valid as it stands) */
export const TEMPLATES = [
  { name: 'Webhook to the build queue', when: { on: 'webhook' }, do: [{ action: 'queue.add', ask: 'from a webhook: {{event.ask}}', target: 'hook' }] },
  { name: 'Comment on a pull request', when: { on: 'webhook', match: { action: 'labeled' } }, do: [{ action: 'github.comment', repo: 'atomeam/void-loop', issue: '{{event.pull_request.number}}', body: 'Void saw this pull request labelled {{event.label.name}}.' }] },
  { name: 'Every morning, a note', when: { on: 'schedule', every: 1440 }, do: [{ action: 'note', text: 'Void was here at {{event.at}}' }] },
  { name: 'Open a pull request with a file', when: { on: 'manual' }, do: [{ action: 'github.pr', repo: 'atomeam/void-loop', base: 'main', branch: 'void/automation-note', title: 'A note from Void', body: 'Opened by a Void automation.', files: [{ path: 'domains/automation-note.md', content: 'Written by a Void automation.\n' }] }] },
];
