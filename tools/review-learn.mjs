// node tools/review-learn.mjs [--from 120] [--to 210] [--json] [--all]
// Void's review is the main one; the other reviewers are extras (domains/void.frontier.md #1). This reads every finding an
// extra (CodeRabbit) left on the merged PRs in the range, runs Void's own checks (void-live-deploy/lib/code-review.js) on
// the file as it stood at that commit, and says whether Void flagged the same spot (a finding within 3 lines). It prints
// Void's catch rate and each finding Void missed: a real one becomes a rule plus a case in tools/review.test.mjs, a wrong
// one from the extra is noted and dropped. It only prints; nothing is written. Needs the gh available in the session.
//   --all   also list nitpicks and trivial findings (left out of the rate by default)
import { execFileSync } from 'node:child_process';
import { ruleReview, skippedInReview } from '../void-live-deploy/lib/code-review.js';

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

export function summary(rows) {
  const scored = rows.filter((r) => r.reviewed && counts(r.severity)), caught = scored.filter((r) => r.caught);
  return { findings: rows.length, scored: scored.length, caught: caught.length, rate: scored.length ? Math.round((caught.length / scored.length) * 100) : null,
    notReviewable: rows.filter((r) => !r.reviewed).length, missed: scored.filter((r) => !r.caught) };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const repo = process.env.REPO || 'atomeam/void-loop', from = +arg('--from', 1), to = +arg('--to', 100000);
  const gh = (path, raw) => execFileSync('gh', ['api', ...(raw ? ['-H', 'Accept: application/vnd.github.raw'] : []), path], { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] });
  const cache = new Map();
  const fileAt = (path, sha) => { const k = sha + ':' + path; if (!cache.has(k)) { let t = null; try { t = execFileSync('git', ['show', k], { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (_) { try { t = gh(`repos/${repo}/contents/${path}?ref=${sha}`, true); } catch (_) {} } cache.set(k, t); } return cache.get(k); };
  const prs = [];
  for (let page = 1; page < 20; page++) {
    const got = JSON.parse(gh(`repos/${repo}/pulls?state=closed&per_page=100&page=${page}`));
    for (const p of got) if (p.merged_at && p.number >= from && p.number <= to) prs.push(p.number);
    if (got.length < 100 || got.every((p) => p.number < from)) break;
  }
  let rows = [];
  for (const n of prs.sort((a, b) => a - b)) {
    let comments = []; try { comments = JSON.parse(gh(`repos/${repo}/pulls/${n}/comments?per_page=100`)); } catch (_) { continue; }
    rows = rows.concat(learnFromPr(n, comments, fileAt));
  }
  const s = summary(rows);
  if (process.argv.includes('--json')) { console.log(JSON.stringify({ ...s, rows }, null, 1)); process.exit(0); }
  console.log(`Void's review against the extras, merged PRs #${Math.min(...prs)}-#${Math.max(...prs)}: ${s.findings} findings by ${EXTRA}`);
  console.log(s.rate == null ? 'nothing Void could review yet' : `Void flagged ${s.caught} of ${s.scored} (${s.rate}%) of the ones that count (nitpicks and trivial left out); ${s.notReviewable} were in files Void does not review`);
  const list = process.argv.includes('--all') ? rows.filter((r) => r.reviewed && !r.caught) : s.missed;
  if (list.length) console.log('\nMissed (each is a rule to teach lib/code-review.js, or a wrong call by the extra):');
  for (const r of list) console.log(`  #${r.pr} ${r.path}:${r.line} [${r.severity}] ${r.title}`);
}
