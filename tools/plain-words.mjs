// Plain words on every pull request (void-review.yml). The title, the body, and the page copy this
// pull request adds (skills/*.js strings, domains/growth-inbox.md rows) are checked against
// tools/plain-phrases.txt. The title and body are rewritten through the GitHub API. A safe rewrite of
// page copy is one commit on that pull request's helper/* branch. Anything else fails the review.
// Rows already on main are not added lines, so they stay. Pull requests 2667 and 2668 are left alone.
//   node tools/plain-words.mjs --dry --title "..." --body "..."
//   node tools/plain-words.mjs --apply --pr <n> --base origin/main --head HEAD
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PHRASES_FILE = resolve(dirname(fileURLToPath(import.meta.url)), 'plain-phrases.txt');
export const SKIP_PRS = new Set([2667, 2668]);
const CLAIM = /\b(?:done|shipped|finished|complete|completed|live|fixed)\b/i;
const MARK = '<!-- plain-words -->';
const HELPER = /^helper\/[A-Za-z0-9._/-]+$/;

export const pageSkill = (file) => /^(?:void-live-deploy\/)?skills\/[^/]+\.js$/.test(file);
export const inboxFile = (file) => file === 'domains/growth-inbox.md';
const escapeReg = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const phraseRe = (phrase) => new RegExp('(?<!\\w)' + escapeReg(phrase) + '(?!\\w)', 'gi');
const helperBranch = (branch, fork) => HELPER.test(branch) && !branch.includes('..') && !fork;

/** phrases from the list file: [{ phrase, replacement }]. A replacement that claims the work is done is dropped. Pure. */
export function loadPhrases(text) {
  const out = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const tab = line.indexOf('\t');
    const phrase = (tab < 0 ? line : line.slice(0, tab)).trim();
    const replacement = tab < 0 ? '' : line.slice(tab + 1).trim();
    if (phrase) out.push({ phrase, replacement: replacement && !CLAIM.test(replacement) ? replacement : '' });
  }
  return out;
}

/** every hit: [{ phrase, start, end, found, replacement }]. Pure. */
export function findHits(text, phrases) {
  const hits = [];
  for (const p of phrases || []) {
    const re = phraseRe(p.phrase);
    let m;
    while ((m = re.exec(String(text || '')))) hits.push({ phrase: p.phrase, start: m.index, end: m.index + m[0].length, found: m[0], replacement: p.replacement || '' });
  }
  return hits.sort((a, b) => a.start - b.start || b.phrase.length - a.phrase.length);
}

function matchCase(found, replacement) {
  if (found === found.toUpperCase() && /[A-Z]/.test(found)) return replacement.toUpperCase();
  if (found[0] === found[0].toUpperCase() && found[0] !== found[0].toLowerCase()) return replacement[0].toUpperCase() + replacement.slice(1);
  if (replacement[0] === replacement[0].toUpperCase() && found[0] === found[0].toLowerCase()) return replacement[0].toLowerCase() + replacement.slice(1);
  return replacement;
}

/** the text with every safe replacement applied. left: phrases still present. Pure. */
export function rewriteText(text, phrases) {
  const src = String(text || '');
  let out = '', cursor = 0;
  for (const h of findHits(src, (phrases || []).filter((p) => p.replacement && !CLAIM.test(p.replacement)))) {
    if (h.start < cursor) continue;
    out += src.slice(cursor, h.start) + matchCase(h.found, h.replacement);
    cursor = h.end;
  }
  out += src.slice(cursor);
  return { text: out, changed: out !== src, left: findHits(out, phrases) };
}

/** true when [start, end) sits inside a ', " or ` string. A ${ } hole in a template is code. Pure. */
export function insideString(line, start, end) {
  const mask = [];
  let quote = '', expr = 0;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (expr > 0) { if (c === '{') expr++; else if (c === '}') expr--; mask[i] = false; continue; }
    if (quote) {
      if (c === '\\' && quote !== '`') { mask[i] = true; if (i + 1 < line.length) mask[++i] = true; continue; }
      if (quote === '`' && c === '$' && line[i + 1] === '{') { expr = 1; mask[i] = false; mask[++i] = false; continue; }
      mask[i] = true;
      if (c === quote) quote = '';
      continue;
    }
    mask[i] = false;
    if (c === '"' || c === "'" || c === '`') quote = c;
  }
  if (end > line.length || start < 0 || start >= end) return false;
  for (let i = start; i < end; i++) if (!mask[i]) return false;
  return true;
}

/** added lines of a unified diff: [{ file, line, text }]. Context and removed lines are left out. Pure. */
export function addedLines(diff) {
  const out = [];
  let file = '', line = 0;
  for (const raw of String(diff || '').split('\n')) {
    const f = raw.match(/^\+\+\+ b\/(.+)$/);
    if (f) { file = f[1]; continue; }
    const h = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
    if (h) { line = +h[1]; continue; }
    if (!file || raw.startsWith('diff ') || raw.startsWith('index ') || raw.startsWith('--- ') || raw.startsWith('+++ ') || raw.startsWith('\\')) continue;
    if (raw.startsWith('+')) { out.push({ file, line, text: raw.slice(1) }); line++; }
    else if (!raw.startsWith('-')) line++;
  }
  return out;
}

/**
 * What to rewrite and what blocks. files: [{ path, added: [{ n, text }] }].
 * A helper/* branch of this repo can take the safe file rewrites. Any other hit is a risk. Pure.
 */
export function assess({ title = '', body = '', files = [], branch = '', fork = false, phrases = [], pr = 0 } = {}) {
  const same = (from) => ({ from, to: from, changed: false });
  if (SKIP_PRS.has(Number(pr))) return { skip: true, title: same(title), body: same(body == null ? '' : body), patches: [], findings: [], push: false };
  const t = rewriteText(title, phrases), b = rewriteText(body == null ? '' : body, phrases);
  const findings = [], patches = [];
  const say = (file, line, text, why) => findings.push({ file, line, kind: 'risk', rule: 'plain-words', message: why, text: String(text).slice(0, 200) });
  if (t.left.length) say('title', 1, title, 'the title says "' + t.left[0].phrase + '" and there is no plain rewrite that does not claim the work is done');
  if (b.left.length) say('body', 1, body, 'the body says "' + b.left[0].phrase + '" and there is no plain rewrite that does not claim the work is done');
  for (const file of files) {
    const skill = pageSkill(file.path), inbox = inboxFile(file.path);
    if (!skill && !inbox) continue;
    for (const row of file.added || []) {
      const hits = findHits(row.text, phrases);
      if (!hits.length) continue;
      if (skill && hits.some((h) => !insideString(row.text, h.start, h.end))) { say(file.path, row.n, row.text, 'says "' + hits[0].phrase + '" outside a page string, so it was not rewritten'); continue; }
      if (inbox && !/^\s*\|/.test(row.text)) { say(file.path, row.n, row.text, 'says "' + hits[0].phrase + '" on a line that is not an inbox row, so it was not rewritten'); continue; }
      const next = rewriteText(row.text, phrases);
      if (next.changed && !next.left.length) patches.push({ file: file.path, line: row.n, from: row.text, to: next.text });
      else say(file.path, row.n, row.text, 'says "' + hits[0].phrase + '" and there is no plain rewrite that does not claim the work is done');
    }
  }
  const helper = helperBranch(branch, fork);
  if (!helper) { for (const p of patches) say(p.file, p.line, p.from, 'says a banned phrase. This pull request is not on a helper/* branch of this repo, so the line was not rewritten'); patches.length = 0; }
  return {
    skip: false,
    title: { from: title, to: t.text, changed: t.changed && !t.left.length },
    body: { from: body == null ? '' : body, to: b.text, changed: b.changed && !b.left.length },
    patches, findings, push: helper && patches.length > 0,
  };
}

function git(args, cwd) { return execFileSync('git', args, { encoding: 'utf8', cwd, maxBuffer: 64 << 20 }); }
function gh(args, input) { return execFileSync('gh', args, { encoding: 'utf8', input, maxBuffer: 8 << 20, stdio: ['pipe', 'pipe', 'pipe'] }); }
const firstLine = (e) => String(e && e.message || e).split('\n')[0].slice(0, 160);

function filesFromDiff(diff) {
  const by = new Map();
  for (const row of addedLines(diff)) {
    if (!pageSkill(row.file) && !inboxFile(row.file)) continue;
    if (!by.has(row.file)) by.set(row.file, []);
    by.get(row.file).push({ n: row.line, text: row.text });
  }
  return [...by].map(([path, added]) => ({ path, added }));
}

function quietCached(cwd, runGit) {
  try { runGit(['diff', '--cached', '--quiet'], cwd); return true; } catch (e) { if (e && e.status === 1) return false; throw e; }
}

function pushPatches(patches, branch, cwd, runGit) {
  if (!helperBranch(branch, false)) return false;
  try {
    const by = new Map();
    for (const p of patches) {
      if (!by.has(p.file)) by.set(p.file, readFileSync(resolve(cwd, p.file), 'utf8').split('\n'));
      const lines = by.get(p.file);
      if (lines[p.line - 1] !== p.from) return false;
      lines[p.line - 1] = p.to;
    }
    runGit(['checkout', '-B', branch], cwd);
    for (const [file, lines] of by) writeFileSync(resolve(cwd, file), lines.join('\n'));
    runGit(['add', '--', ...by.keys()], cwd);
    if (quietCached(cwd, runGit)) return false;
    runGit(['commit', '-q', '-m', 'Plain words: the added copy uses ordinary words'], cwd);
    runGit(['push', 'origin', 'HEAD:' + branch], cwd);
    return true;
  } catch (e) { console.log('plain words: the commit was not pushed (' + firstLine(e) + ')'); return false; }
}

function upsertComment(repo, pr, plan) {
  const lines = [MARK, '### Plain words', ''];
  if (plan.title.changed) lines.push('The title now says: ' + plan.title.to, '');
  if (plan.body.changed) lines.push('The body was rewritten in plain words.', '');
  lines.push('These still use a banned phrase, so this review stays red:', '');
  for (const f of plan.findings) lines.push('- `' + f.file + ':' + f.line + '` ' + f.message);
  lines.push('', 'The list is `tools/plain-phrases.txt`.');
  const body = lines.join('\n');
  let id = '';
  try { id = gh(['api', '--paginate', `repos/${repo}/issues/${pr}/comments?per_page=100`, '--jq', '[.[] | select(.user.login == "github-actions[bot]" and (.body | startswith("' + MARK + '")))][0].id // empty']).trim().split('\n')[0] || ''; } catch (_) { id = ''; }
  try { gh(['api', '-X', id ? 'PATCH' : 'POST', id ? `repos/${repo}/issues/comments/${id}` : `repos/${repo}/issues/${pr}/comments`, '--input', '-'], JSON.stringify({ body })); }
  catch (e) { console.log('plain words: the comment was not posted (' + firstLine(e) + ')'); }
}

/** Two tries, then stop. The counter lives in tools/fix-cap.mjs, which may land in a later commit. */
async function copyCap(repo, pr, runGh) {
  try {
    const { claim } = await import('./fix-cap.mjs');
    const raw = runGh(['api', '--paginate', `repos/${repo}/issues/${pr}/comments?per_page=100`]);
    const comments = JSON.parse(raw || '[]');
    const cap = claim(Array.isArray(comments) ? comments : [], 'copy');
    if (cap.allowed) {
      const args = cap.id ? ['api', '-X', 'PATCH', `repos/${repo}/issues/comments/${cap.id}`, '--input', '-'] : ['api', '-X', 'POST', `repos/${repo}/issues/${pr}/comments`, '--input', '-'];
      try { runGh(args, JSON.stringify({ body: cap.body })); } catch (_) {}
    }
    return cap.allowed;
  } catch (_) { return true; }
}

/** Rewrite the title and body, and push one commit onto a helper/* branch. Exit 1 when a finding remains. */
export async function applyPlan({ pr, repo, base, head, cwd = process.cwd(), runGit = git, runGh = gh } = {}) {
  if (SKIP_PRS.has(Number(pr))) { console.log('plain words: pull request ' + pr + ' left alone'); return 0; }
  const phrases = loadPhrases(readFileSync(PHRASES_FILE, 'utf8'));
  let title = '', body = '', branch = '', fork = false;
  try {
    const pull = JSON.parse(runGh(['api', `repos/${repo}/pulls/${pr}`]));
    title = pull.title || ''; body = pull.body || ''; branch = (pull.head && pull.head.ref) || '';
    const headRepo = pull.head && pull.head.repo && pull.head.repo.full_name;
    fork = !!(headRepo && headRepo !== repo);
  } catch (e) { console.log('plain words: could not read the pull request (' + firstLine(e) + ')'); return 1; }
  let diff = '';
  try { diff = runGit(['diff', '--unified=0', '--no-color', base + '...' + head], cwd); } catch (_) { diff = ''; }
  const plan = assess({ title, body, files: filesFromDiff(diff), branch, fork, phrases, pr });
  if ((plan.title.changed || plan.body.changed || plan.push) && !(await copyCap(repo, pr, runGh))) { console.log('plain words: already tried twice'); return 1; }
  if (plan.title.changed || plan.body.changed) {
    try { runGh(['api', '-X', 'PATCH', `repos/${repo}/pulls/${pr}`, '--input', '-'], JSON.stringify({ title: plan.title.to, body: plan.body.to })); console.log('plain words: rewrote the title and body'); }
    catch (e) { console.log('plain words: the title was not rewritten (' + firstLine(e) + ')'); plan.findings.push({ file: 'title', line: 1, kind: 'risk', rule: 'plain-words', message: 'the title or body still says a banned phrase and the rewrite did not land', text: title.slice(0, 200) }); }
  }
  if (plan.push) {
    if (pushPatches(plan.patches, branch, cwd, runGit)) {
      console.log('plain words: pushed one commit onto ' + branch);
      try { runGh(['workflow', 'run', 'void-review.yml', '--repo', repo, '--ref', 'main', '-f', 'pr=' + pr]); } catch (_) { console.log('plain words: the new head was not sent back to review'); }
      try { runGh(['workflow', 'run', 'automerge.yml', '--repo', repo, '--ref', 'main', '-f', 'pr=' + pr]); } catch (_) {}
    } else for (const p of plan.patches) plan.findings.push({ file: p.file, line: p.line, kind: 'risk', rule: 'plain-words', message: 'a plain rewrite exists but it could not be pushed onto ' + branch, text: p.from.slice(0, 200) });
  }
  if (!plan.findings.length) return 0;
  console.log(plan.findings.map((f) => f.file + ':' + f.line + ' ' + f.message).join('\n'));
  upsertComment(repo, pr, plan);
  return 1;
}

function arg(name, argv) { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : ''; }

async function main(argv) {
  const phrases = loadPhrases(readFileSync(PHRASES_FILE, 'utf8'));
  if (argv.includes('--dry')) {
    const plan = assess({ title: arg('--title', argv), body: arg('--body', argv), branch: arg('--branch', argv) || 'helper/dry', phrases, pr: Number(arg('--pr', argv) || 0) });
    console.log(JSON.stringify({ title: plan.title.to, body: plan.body.to, changed: plan.title.changed || plan.body.changed, findings: plan.findings.length, skip: plan.skip }));
    return plan.skip || plan.findings.length === 0 ? 0 : 1;
  }
  if (argv.includes('--apply')) {
    const pr = arg('--pr', argv), repo = process.env.REPO || process.env.GITHUB_REPOSITORY || '';
    if (!/^\d+$/.test(pr) || !repo) { console.error('plain words: --apply needs --pr and REPO'); return 2; }
    return await applyPlan({ pr, repo, base: arg('--base', argv) || 'origin/main', head: arg('--head', argv) || 'HEAD' });
  }
  console.error('usage: node tools/plain-words.mjs --dry --title "..." [--body "..."] | --apply --pr <n> --base origin/main --head HEAD');
  return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).then((code) => process.exit(code));
