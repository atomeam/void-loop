// What Verse's review gets wrong, from its own record. Every "void-review: ok" on a line is a builder saying the review flagged
// something right as written. This finds each one in the code, runs Void's quick checks on its file with the marker taken out,
// and says which rule still fires there (a false alarm to fix in lib/code-review.js) and which markers no longer do anything
// (the rule was fixed since: the marker can go). The noisiest rule is the next reviewer fix (owner, 2026-10-13: "constantly
// update our code reviewer its been a game changer"); node tools/next.mjs lists it.
//   node tools/review-overrides.mjs           by rule, then each marked line
//   node tools/review-overrides.mjs --json    the same as JSON
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ruleReview } from '../void-live-deploy/lib/code-review.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const MARK = /\s*\/\/\s*void-review: ok\b.*$/;

/** a file's marked lines and the rules that fire on each once its marker is taken out. Pure. */
export function overridesIn(file, text) {
  const lines = String(text).split('\n'), marked = [];
  lines.forEach((l, i) => {
    if (!MARK.test(l)) return;
    // a marker alone on its line speaks for the next line; one at the end of a line speaks for that line
    const alone = /^\s*\/\/\s*void-review: ok/.test(l);
    let at = i;
    if (alone) { at = i + 1; while (at < lines.length && (/^\s*(?:\/\/|\*|\/\*)/.test(lines[at]) || !lines[at].trim())) at++; } // the next line of code
    marked.push({ at, alone, from: i });
  });
  if (!marked.length) return [];
  const clean = lines.map((l, i) => (marked.some((m) => m.at === i || m.from === i) ? l.replace(MARK, '') : l)).join('\n');
  const found = ruleReview(clean, { lang: 'javascript' }).findings.filter((f) => f.kind === 'bug' || f.kind === 'risk');
  const seen = new Set(); // two markers can speak for one line (a note above it and one at its end)
  return marked.filter((m) => !seen.has(m.at) && seen.add(m.at)).map((m) => {
    const rules = [...new Set(found.filter((f) => f.line === m.at + 1).map((f) => f.rule))];
    return { file, line: m.at + 1, rules, text: (lines[m.at] || '').replace(MARK, '').trim().slice(0, 120) };
  });
}

/** by rule: how many marked lines it still fires on, worst first; and the markers no rule fires on any more. Pure. */
export function summarize(rows) {
  const by = new Map();
  for (const r of rows) for (const rule of r.rules) by.set(rule, (by.get(rule) || 0) + 1);
  return { rules: [...by].map(([rule, n]) => ({ rule, n })).sort((a, b) => b.n - a.n || (a.rule < b.rule ? -1 : 1)), idle: rows.filter((r) => !r.rules.length) };
}

export function scan() {
  // code only: a test file's markers are fixtures (strings checking the marker itself)
  const files = execFileSync('git', ['grep', '-l', 'void-review: ok', '--', '*.js', '*.mjs', ':!*.test.mjs'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
  return files.flatMap((f) => overridesIn(f, readFileSync(resolve(root, f), 'utf8')));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rows = scan(), s = summarize(rows);
  if (process.argv.includes('--json')) { console.log(JSON.stringify({ ...s, rows }, null, 1)); process.exit(0); }
  console.log(`${rows.length} lines marked right as written ("void-review: ok"):`);
  for (const r of s.rules) console.log(`  ${r.rule}: still fires on ${r.n}`);
  if (s.idle.length) console.log(`  no rule fires any more on ${s.idle.length} (the rule was fixed; the marker can go)`);
  for (const r of rows) console.log(`    ${r.file}:${r.line}  ${r.rules.join(', ') || '(no longer flagged)'}  ${r.text}`);
}
