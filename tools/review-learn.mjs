// node tools/review-learn.mjs [--from 120] [--to 210] [--since 30d] [--stats void-live-deploy/review-stats.json] [--json] [--all]
// A closer-read finding that names a symbol rather than a file is placed by searching the PR's added lines for it (placeBySymbol, 2026-10-10).
// Also counts Void's own closer read's false 'not defined' and mask claims on those PRs (phantomsIn, 2026-10-10).
// Void's review is the main one; the other reviewers are extras (domains/void.frontier.md #1). This reads every finding an
// extra (CodeRabbit) left on the merged PRs in the range, runs Void's own checks (void-live-deploy/lib/code-review.js) on
// the file as it stood at that commit, and says whether Void flagged the same spot (a finding within 3 lines). It prints
// Void's catch rate and each finding Void missed: a real one becomes a rule plus a case in tools/review.test.mjs, a wrong
// one from the extra is noted and dropped. It only prints; nothing is written. Needs the gh available in the session.
//   --all   also list nitpicks and trivial findings (left out of the rate by default)
import { execFileSync } from 'node:child_process';
import { ruleReview, skippedInReview, LEARNED } from '../void-live-deploy/lib/code-review.js';
import { writeFileSync } from 'node:fs';
import { declaredNames, phantomNames, dropPhantoms } from '../void-live-deploy/lib/review-api.js';

export const EXTRA = 'coderabbitai[bot]';
export const WINDOW = 3;
// the same extension map tools/review-pr.mjs uses for the PR review
const LANG = { js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', py: 'python', sh: 'shell', bash: 'shell', sql: 'sql', go: 'go', rs: 'rust', java: 'java', cs: 'csharp', c: 'c', h: 'c', cpp: 'c', php: 'php', rb: 'ruby', ps1: 'powershell', tf: 'terraform', lua: 'lua', pl: 'perl', pm: 'perl', html: 'javascript', htm: 'javascript', yml: 'yaml', yaml: 'yaml' };
export const langOfPath = (p) => LANG[(String(p).match(/\.(\w+)$/) || [])[1]?.toLowerCase()] || null;

// what the extra said: its severity (critical, major, minor, trivial, nitpick, issue, refactor) and the one-line title
export function parseExtra(body) {
  const b = String(body || '');
  const sev = (b.match(/\b(Critical|Major|Minor|Trivial)\b/) || [])[1]?.toLowerCase()
    || (/nitpick/i.test(b.slice(0, 200)) ? 'nitpick' : /potential issue/i.test(b.slice(0, 200)) ? 'issue' : /refactor suggestion/i.test(b.slice(0, 200)) ? 'refactor' : 'unknown');
  // the header is the first line ("**category** | **🟡 Minor** | …" or "_⚠️ Potential issue_"); the title is the first bold line after it
  const lines = b.split('\n').map((l) => l.trim()).filter(Boolean), rest = /\||^_|\b(?:Critical|Major|Minor|Trivial)\b/.test(lines[0] || '') ? lines.slice(1) : lines;
  const bold = rest.map((l) => (l.match(/^\*\*(.{4,200}?)\*\*\s*$/) || [])[1]).find(Boolean);
  return { severity: sev, title: (bold || rest.find((l) => !/^[<>`|]/.test(l)) || '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim().slice(0, 160) };
}
export const counts = (sev) => !['nitpick', 'trivial'].includes(sev); // what the catch rate is about

// did Void flag this spot? any bug, risk or style finding within WINDOW lines
export function caughtBy(findings, line, window = WINDOW) {
  return findings.find((f) => f.kind !== 'note' && Math.abs(f.line - line) <= window) || null;
}

// one merged PR's extra findings, each { pr, path, line, sha, severity, title, caught }
export function learnFromPr(pr, comments, fileAt) {
  const out = [];
  for (const c of comments) {
    if (!c.user || c.user.login !== EXTRA || c.in_reply_to_id) continue;
    const line = c.original_line || c.line, sha = c.original_commit_id || c.commit_id, lang = langOfPath(c.path);
    const { severity, title } = parseExtra(c.body);
    const row = { pr, path: c.path, line, sha, severity, title, caught: null, reviewed: false };
    if (line && lang && !skippedInReview(c.path)) {
      const text = fileAt(c.path, sha);
      if (text != null) { row.reviewed = true; const f = caughtBy(ruleReview(text, { lang, max: 5000, collapse: false }).findings, line); row.caught = f ? f.rule : null; }
    }
    out.push(row);
  }
  return out;
}

export const VOID_BOT = 'github-actions[bot]';
// Void's own closer read, checked the same way as the extras (2026-10-10): a claim that a name is missing ("not defined",
// "not imported", ReferenceError) when the file at that commit imports or declares it, or a claim about the "[redacted]" mask, is
// a false finding. lib/review-api.js dropPhantoms() takes these out of every closer read now; this counts the ones that reached
// past PRs and how many the filter removes, so the number exists from here on.
export function closerReadOf(body) {
  const b = String(body || ''); if (!b.startsWith('<!-- void-review -->')) return null;
  const i = b.indexOf('#### A closer read'); if (i < 0) return null;
  const rest = b.slice(i + '#### A closer read'.length), j = rest.search(/\n\*\*Not blocking|\n<sub>/);
  return (j < 0 ? rest : rest.slice(0, j)).trim();
}
const CLAIM_RE = /\[redacted\]|\bnot\s+(?:defined|imported|declared)|\bnever\s+(?:defined|imported)|ReferenceError|missing\s+(?:an?\s+)?import|\bis\s+undefined/i;
// one PR's closer read: each paragraph that claims a name is missing or blames the mask, with whether it is false against the files
export function phantomsIn(pr, body, files, sha, fileAt) {
  const text = closerReadOf(body); if (!text) return [];
  const out = [];
  for (const p of text.split(/\n[ \t]*\n/)) {
    if (!CLAIM_RE.test(p)) continue;
    const names = [...new Set([...p.matchAll(/`([A-Za-z_$][\w$]*)(?:\.[\w$]+)*`/g)].map((m) => m[1]))];
    const named = files.filter((f) => p.includes(f) || p.includes(f.split('/').pop())), cands = named.length ? named : files;
    const known = new Set(); let code = '';
    for (const f of cands) { const t = fileAt(f, sha); if (t != null) { code += t + '\n'; for (const n of declaredNames(t)) known.add(n); } }
    const ph = phantomNames(p, known, code);
    out.push({ pr, claim: p.split('\n')[0].replace(/\*\*/g, '').replace(/^[\s*-]+/, '').trim().slice(0, 140), names, files: cands.slice(0, 3), false: ph.length > 0, mask: ph.includes('mask'), dropped: dropPhantoms(p, known, code) === '' });
  }
  return out;
}

// The closer read's findings that the rules did not flag: the lesson source now that the extras are silent (CodeRabbit stopped
// reviewing this repo on 2026-10-10: under 10 stars). Each paragraph of a closer read that names a line is placed on a file of the PR
// (the one it names, else the PR's only reviewable file) and checked against the rules on that file at the PR's head: flagged within
// WINDOW lines is caught; a phantom (phantomsIn) is no lesson; the rest are candidate cases for lib/code-review.js, each with the
// rule id it would need (a slug of the closer read's sentence).
const STOP = new Set('the a an and or of to in on for is are was be been being this that it its with as by from at not no into than then when which while can could would should may might will do does did has have had use used using line lines code call calls value values function method variable error errors case cases also still only here there where because if but so very more most such any all each every some'.split(' '));
export function slugFor(sentence) {
  const words = String(sentence || '').toLowerCase().replace(/`[^`]*`/g, ' ').replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
  return words.slice(0, 4).join('-') || 'unnamed';
}
// the hunks a PR's patch adds per file: { path: [[from, to], …] } in new-file lines, from the GitHub files API's `patch`
export function hunkRanges(files) {
  const out = {};
  for (const f of files) { const p = f && f.patch ? String(f.patch) : ''; const rs = [];
    for (const m of p.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) rs.push([+m[1], +m[1] + Math.max(0, (+m[2] || 1) - 1)]);
    if (rs.length) out[f.filename] = rs; }
  return out;
}
// the lines a PR's patch adds per file, numbered in the new file: { path: [[line, text], …] } (the same files API `patch`)
export function addedLines(files) {
  const out = {};
  for (const f of files) {
    const p = f && f.patch ? String(f.patch) : ''; if (!p) continue;
    const rows = []; let n = 0;
    for (const l of p.split('\n')) {
      const h = l.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (h) { n = +h[1]; continue; }
      if (l.startsWith('+')) { rows.push([n, l.slice(1)]); n++; } else if (!l.startsWith('-') && !l.startsWith('\\')) n++;
    }
    if (rows.length) out[f.filename] = rows;
  }
  return out;
}
// Most closer-read paragraphs name a function or a symbol rather than a file: the symbols it quotes in backticks (`load`, `db.prepare`,
// `frob()`), each searched for in the lines the PR added; the first symbol found in exactly one file places the finding there.
//   placeBySymbol(paragraph, added, files) -> { path, line, symbol } | null   (line: the first added line carrying the symbol)
const SYMBOL_STOP = new Set(['true', 'false', 'null', 'undefined', 'this', 'const', 'let', 'var', 'return', 'await', 'async', 'function', 'import', 'export', 'if', 'else', 'for', 'while', 'new', 'try', 'catch', 'string', 'number', 'object', 'array', 'main', 'origin']);
export function symbolsIn(paragraph) {
  const out = [];
  for (const m of String(paragraph || '').matchAll(/`([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)(?:\(\))?`/g)) {
    const s = m[1]; if (s.length < 3 || SYMBOL_STOP.has(s.toLowerCase()) || out.includes(s)) continue;
    out.push(s);
  }
  return out;
}
export function placeBySymbol(paragraph, added, files) {
  for (const sym of symbolsIn(paragraph)) {
    const re = new RegExp('(?<![\\w$.])' + sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w$])');
    const hits = files.map((f) => [f, (added[f] || []).find(([, t]) => re.test(t))]).filter(([, hit]) => hit);
    if (hits.length === 1) return { path: hits[0][0], line: hits[0][1][0], symbol: sym };
  }
  return null;
}
const PRAISE = /\b(?:correctly|is fine|looks fine|is sound|is good|good practice|well handled|no bug|no issue|not a bug|is acceptable|is correct)\b/i;
export function lessonsIn(pr, body, fileNames, sha, fileAt, ranges = {}, added = {}) {
  const text = closerReadOf(body); if (!text) return [];
  const files = fileNames.filter((f) => langOfPath(f) && !skippedInReview(f)), out = [];
  for (const p of text.split(/\n[ \t]*\n/)) {
    const lm = p.match(/\bLine\s+(\d{1,5})\b/i);
    // no line named: the symbol it quotes places it, when exactly one added hunk carries that symbol (2026-10-10); a paragraph
    // that quotes symbols but none of them lands in one file is counted as unplaced, one with neither line nor symbol is not a finding
    const bySym = placeBySymbol(p, added, files);
    if (!lm && !bySym && !symbolsIn(p).length) continue;
    // the finding's own sentence: the first line that is not a heading, without the "Line N (file):" lead
    const body0 = p.split('\n').map((l) => l.trim()).filter((l) => l && !/^#{1,6}\s/.test(l) && !/^\*\*[^*]{2,40}\*\*:?$/.test(l))[0] || '';
    const sentence = body0.replace(/\*\*/g, '').replace(/^[\s*-]+/, '').replace(/^(?:bug|security|performance|readability|risk)\b[^:]*:\s*/i, '').replace(/^Line\s+\d+\s*(?:\([^)]*\))?\s*[:,]?\s*/i, '').trim().split(/(?<=[.!?])\s/)[0].slice(0, 160);
    if (!sentence || PRAISE.test(sentence)) continue; // praise is not a lesson
    if (!lm && !bySym) { out.push({ pr, line: 0, sentence, placed: false }); continue; }
    let line = lm ? +lm[1] : bySym.line;
    const named = files.filter((f) => p.includes(f) || p.includes(f.split('/').pop()));
    // else the file whose added hunks cover the line (the closer read numbers lines in the new file)
    const covering = named.length ? named : files.filter((f) => (ranges[f] || []).some(([a, b]) => line >= a - WINDOW && line <= b + WINDOW));
    let cands = covering.length ? covering : files;
    // still ambiguous (several files, or none, cover that line): the symbol the paragraph quotes decides, and when the line it named is
    // not in that file's added lines the symbol's own line is used (the closer read miscounts lines more often than it misnames symbols)
    let symbol = null;
    if (cands.length !== 1 && bySym) {
      cands = [bySym.path]; symbol = bySym.symbol;
      if (!(added[bySym.path] || []).some(([n]) => Math.abs(n - line) <= WINDOW)) line = bySym.line;
    }
    if (cands.length !== 1) { out.push({ pr, line, sentence, placed: false }); continue; }
    const path = cands[0], t = fileAt(path, sha);
    if (t == null) { out.push({ pr, path, line, sentence, placed: false }); continue; }
    if (phantomNames(p, declaredNames(t), t).length) continue; // a false claim is not a lesson
    const f = caughtBy(ruleReview(t, { lang: langOfPath(path), max: 5000, collapse: false }).findings, line);
    out.push({ pr, path, line, sentence, placed: true, caught: f ? f.rule : null, ruleId: f ? null : slugFor(sentence), ...(symbol ? { symbol } : {}) });
  }
  return out;
}
export function lessonSummary(lessons) {
  const placed = lessons.filter((l) => l.placed), caught = placed.filter((l) => l.caught);
  return { closerFound: placed.length, rulesFlagged: caught.length, unplaced: lessons.length - placed.length, bySymbol: placed.filter((l) => l.symbol).length, candidates: placed.filter((l) => !l.caught) };
}

export function summary(rows) {
  const scored = rows.filter((r) => r.reviewed && counts(r.severity)), caught = scored.filter((r) => r.caught);
  return { findings: rows.length, scored: scored.length, caught: caught.length, rate: scored.length ? Math.round((caught.length / scored.length) * 100) : null,
    notReviewable: rows.filter((r) => !r.reviewed).length, missed: scored.filter((r) => !r.caught) };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const repo = process.env.REPO || 'atomeam/void-loop', from = +arg('--from', 1), to = +arg('--to', 100000);
  const since = (arg('--since', '') .match(/^(\d+)d$/) || [])[1]; const sinceMs = since ? Date.now() - +since * 864e5 : 0; // --since 30d: merged in the last 30 days
  const statsPath = arg('--stats', '');
  const gh = (path, raw) => execFileSync('gh', ['api', ...(raw ? ['-H', 'Accept: application/vnd.github.raw'] : []), path], { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] });
  const cache = new Map();
  const fileAt = (path, sha) => { const k = sha + ':' + path; if (!cache.has(k)) { let t = null; try { t = execFileSync('git', ['show', k], { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (_) { try { t = gh(`repos/${repo}/contents/${path}?ref=${sha}`, true); } catch (_) {} } cache.set(k, t); } return cache.get(k); };
  const prs = [];
  for (let page = 1; page < 20; page++) {
    const got = JSON.parse(gh(`repos/${repo}/pulls?state=closed&per_page=100&page=${page}`));
    for (const p of got) if (p.merged_at && p.number >= from && p.number <= to && Date.parse(p.merged_at) >= sinceMs) prs.push(p.number);
    if (got.length < 100 || got.every((p) => p.number < from) || (sinceMs && got.every((p) => !p.merged_at || Date.parse(p.merged_at) < sinceMs))) break;
  }
  let rows = [], phantoms = [], lessons = [];
  for (const n of prs.sort((a, b) => a - b)) {
    let comments = []; try { comments = JSON.parse(gh(`repos/${repo}/pulls/${n}/comments?per_page=100`)); } catch (_) { continue; }
    rows = rows.concat(learnFromPr(n, comments, fileAt));
    try { // Void's own closer read on that PR (the last void-review comment), against the files at the PR's head
      const issue = JSON.parse(gh(`repos/${repo}/issues/${n}/comments?per_page=100`)).filter((c) => c.user && c.user.login === VOID_BOT && String(c.body || '').startsWith('<!-- void-review -->')).pop();
      if (issue) {
        const pull = JSON.parse(gh(`repos/${repo}/pulls/${n}`)), filesApi = JSON.parse(gh(`repos/${repo}/pulls/${n}/files?per_page=100`)), files = filesApi.map((f) => f.filename);
        phantoms = phantoms.concat(phantomsIn(n, issue.body, files, pull.head.sha, fileAt));
        lessons = lessons.concat(lessonsIn(n, issue.body, files, pull.head.sha, fileAt, hunkRanges(filesApi), addedLines(filesApi)));
      }
    } catch (_) {}
  }
  const s = summary(rows), falsePh = phantoms.filter((r) => r.false), dropped = falsePh.filter((r) => r.dropped), ls = lessonSummary(lessons);
  const learned = LEARNED.filter((l) => l.from === 'closer read').length, learnedFromExtras = LEARNED.filter((l) => l.from === 'extras').length;
  const stats = { at: new Date().toISOString(), since: since ? since + 'd' : null, from: prs.length ? Math.min(...prs) : null, to: prs.length ? Math.max(...prs) : null, prs: prs.length,
    rulesFlagged: ls.rulesFlagged, closerFound: ls.closerFound, unplaced: ls.unplaced, bySymbol: ls.bySymbol, falseDropped: dropped.length, learned, learnedFromExtras, extrasFindings: rows.length, extrasRate: s.rate };
  if (statsPath) writeFileSync(statsPath, JSON.stringify(stats, null, 2) + '\n');
  if (process.argv.includes('--json')) { console.log(JSON.stringify({ ...s, rows, closerRead: { claims: phantoms.length, false: falsePh.length, dropped: dropped.length, phantoms }, lessons: { ...ls }, stats }, null, 1)); process.exit(0); }
  console.log(`Void's review against the extras, merged PRs #${Math.min(...prs)}-#${Math.max(...prs)}: ${s.findings} findings by ${EXTRA}`);
  console.log(s.rate == null ? 'nothing Void could review yet' : `Void flagged ${s.caught} of ${s.scored} (${s.rate}%) of the ones that count (nitpicks and trivial left out); ${s.notReviewable} were in files Void does not review`);
  const list = process.argv.includes('--all') ? rows.filter((r) => r.reviewed && !r.caught) : s.missed;
  if (list.length) console.log('\nMissed (each is a rule to teach lib/code-review.js, or a wrong call by the extra):');
  for (const r of list) console.log(`  #${r.pr} ${r.path}:${r.line} [${r.severity}] ${r.title}`);
  console.log(`\nVoid's closer read on the same PRs: ${phantoms.length} claim(s) that a name is missing or that the mask is a bug; ${falsePh.length} false (the file imports or declares the name, or it is the mask); dropPhantoms removes ${dropped.length} of those`);
  for (const r of falsePh) console.log(`  #${r.pr} ${r.files.map((f) => f.split('/').pop()).join(',')}: ${r.claim}`);
  console.log(`\nLessons from Void's closer read (the extras are silent): it named a line ${ls.closerFound} time(s) the rules could be checked on (${ls.bySymbol} placed by the symbol it quoted); the rules had flagged ${ls.rulesFlagged} of them within ${WINDOW} lines; ${ls.unplaced} could not be placed on one file`);
  for (const l of lessons.filter((x) => !x.placed)) console.log(`  unplaced #${l.pr} line ${l.line}: ${l.sentence}`);
  if (ls.candidates.length) console.log('Candidate cases (each a rule to teach lib/code-review.js, with the id it would need):');
  for (const l of ls.candidates) console.log(`  #${l.pr} ${l.path}:${l.line} [${l.ruleId}] ${l.sentence}`);
  console.log(`Learned so far: ${learned} from the closer read, ${learnedFromExtras} from the extras` + (statsPath ? `; stats written to ${statsPath}` : ''));
}
