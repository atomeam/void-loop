// node tools/review-pr.mjs [--base origin/main] [--head HEAD] [--json] [--inline] [--deep URL]
// Void reviews a pull request with the same checks it runs for visitors (void-live-deploy/lib/code-review.js): each changed
// file is checked as a whole, and only findings on lines this change added are reported, so old code doesn't drown the new.
// --deep URL also asks Void's answer engine (POST URL with mode 'review') for a read of the added code; it is best-effort.
// Prints markdown (the PR comment: a walkthrough of what changed, then the findings) or JSON. --inline prints the
// review comments for GitHub instead: one per line with a bug or risk, with a one-click suggested change when Void's
// safe automatic fix (autoFix) rewrites that line. Exit code is always 0: the review informs, CI decides.
import { execFileSync } from 'node:child_process';
import { ruleReview, langOf, skippedInReview, autoFix } from '../void-live-deploy/lib/code-review.js';
import { redact } from '../void-live-deploy/lib/automation-fix.js';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const base = arg('--base', 'origin/main'), head = arg('--head', 'HEAD'), deep = arg('--deep', '');
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 << 20 });

const YAML_RULES = new Set(['image-latest', 'hardcoded-secret']);
const LANG = { js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', py: 'python', sh: 'shell', bash: 'shell', sql: 'sql', go: 'go', rs: 'rust', java: 'java', cs: 'csharp', c: 'c', h: 'c', cpp: 'c', php: 'php', rb: 'ruby', ps1: 'powershell', tf: 'terraform', lua: 'lua', pl: 'perl', pm: 'perl', html: 'javascript', htm: 'javascript', yml: 'yaml', yaml: 'yaml' };
// generated or data files: the same lines in three copies (void.html is copied to the deploy folder) are reviewed once
// tests are skipped too: their fixtures are bad code on purpose. A file holding "void-review: skip-file" is skipped (the rules themselves).

// added line numbers per file, from a zero-context diff
function added() {
  const out = {}, diff = git('diff', '--unified=0', '--no-color', '--diff-filter=AM', base + '...' + head);
  let file = null;
  for (const line of diff.split('\n')) {
    const f = line.match(/^\+\+\+ b\/(.+)$/); if (f) { file = f[1]; out[file] = out[file] || new Set(); continue; }
    const h = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (h && file) { const start = +h[1], n = h[2] == null ? 1 : +h[2]; for (let i = 0; i < n; i++) out[file].add(start + i); }
  }
  return out;
}

const files = added(), report = [], langs = {};
for (const [file, lines] of Object.entries(files)) {
  if (skippedInReview(file) || !lines.size) continue;
  // a Dockerfile has no extension (Dockerfile, api.Dockerfile, Dockerfile.dev)
  const ext = (file.match(/\.([\w]+)$/) || [])[1] || '', base = file.split('/').pop(), lang = /^(?:[\w.-]+\.)?Dockerfile(?:\.[\w-]+)?$/i.test(base) ? 'dockerfile' : LANG[ext.toLowerCase()];
  if (!lang) continue;
  langs[file] = lang;
  let text = ''; try { text = git('show', head + ':' + file); } catch (_) { continue; }
  if (text.length > 2e6 || /void-review: skip-file/.test(text)) continue;
  // every line's findings (no collapsing of repeats), then only the ones on lines this PR adds
  const res = ruleReview(text, { lang, max: 5000, collapse: false });
  // YAML (workflows, compose files) gets only the checks written for YAML: the general ones are tuned for code
  const own = (f) => lang !== 'yaml' || YAML_RULES.has(f.rule);
  for (const f of res.findings.filter((f) => lines.has(f.line) && own(f))) report.push({ file, ...f });
}
const ORDER = { bug: 0, risk: 1, style: 2, note: 3 };
report.sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || a.file.localeCompare(b.file) || a.line - b.line);

let deepText = '';
if (deep && Object.keys(files).length) {
  try {
    const diff = redact(git('diff', '--unified=3', '--no-color', base + '...' + head, '--', ...Object.keys(files).filter((f) => !skippedInReview(f) && LANG[(f.match(/\.([\w]+)$/) || [])[1]]))).slice(0, 12000);
    if (diff.trim()) {
      const r = await fetch(deep, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'review', ask: 'review this pull request', code: diff, diff: true }), signal: AbortSignal.timeout(60000) });
      const j = r.ok ? await r.json() : null;
      if (j && j.answer && j.review === 'model') deepText = String(j.answer).trim();
    }
  } catch (_) {}
}

// --inline: GitHub review comments, one per line with a bug or risk (however many checks fire on it), with a suggested
// change where autoFix rewrites just that line (only the line itself is passed, so the fix can't lean on its neighbours)
if (process.argv.includes('--inline')) {
  const byLine = new Map();
  for (const f of report.filter((f) => f.kind === 'bug' || f.kind === 'risk')) { const k = f.file + ':' + f.line; if (!byLine.has(k)) byLine.set(k, []); byLine.get(k).push(f); }
  const comments = [];
  for (const fs of [...byLine.values()].slice(0, 25)) {
    const f = fs[0];
    let body = '<!-- void-review-inline ' + fs.map((x) => x.rule).join(' ') + ' -->\n' + fs.map((x) => '**' + x.kind + '** · ' + x.message).join('\n\n');
    try {
      const line = git('show', head + ':' + f.file).split('\n')[f.line - 1];
      const fx = line != null && autoFix(line, { lang: langs[f.file] });
      if (fx && fx.changes.length && fx.code !== line && !/```/.test(fx.code)) body += '\n\nSuggested fix (' + fx.changes.map((c) => c.what).join('; ') + '):\n```suggestion\n' + fx.code + '\n```';
    } catch (_) {}
    comments.push({ path: f.file, line: f.line, side: 'RIGHT', rules: fs.map((x) => x.rule), body: body + '\n\n<sub>Void’s review (void-live-deploy/lib/code-review.js)</sub>' });
  }
  console.log(JSON.stringify(comments));
  process.exit(0);
}

// the walkthrough: what this PR changes, file by file, in plain words (the summary a review bot writes, without a model)
function what(file) {
  let m;
  if ((m = file.match(/^void-live-deploy\/skills\/mini\/([\w-]+)\.js$/))) return '3D miniature: ' + m[1];
  if ((m = file.match(/^void-live-deploy\/skills\/([\w-]+)\.js$/))) return 'skill: ' + m[1];
  if ((m = file.match(/^void-live-deploy\/lib\/([\w-]+)\.js$/))) return 'shared code: ' + m[1];
  if ((m = file.match(/^void-live-deploy\/functions\/(.+)\.js$/))) return 'server: /' + m[1];
  if (/^void-live-deploy\/(?:index|void)\.html$/.test(file)) return 'deploy copy of void.html';
  if (file === 'void.html') return 'the page';
  if (file === 'tools/bench.json') return 'benchmark asks';
  if (/^tools\/test[_-]|\.test\.m?js$/.test(file)) return 'tests';
  if (/^void-live-deploy\/models\//.test(file)) return '3D model or texture';
  if (/^void-live-deploy\/vendor\//.test(file)) return 'vendored library';
  if (/(?:^|\/)action\.ya?ml$/.test(file)) return 'GitHub Action';
  if (/^\.github\//.test(file)) return 'CI';
  if (/^docs\/|\.md$/.test(file)) return 'docs';
  if (/^drafts\//.test(file)) return 'draft (not on the site)';
  if (/^tools\//.test(file)) return 'tool';
  return '';
}
function walkthrough() {
  const rows = git('diff', '--numstat', '--no-color', base + '...' + head).split('\n').filter(Boolean).map((l) => { const [a, d, f] = l.split('\t'); return { f, a: a === '-' ? 0 : +a, d: d === '-' ? 0 : +d, bin: a === '-' }; });
  if (!rows.length) return [];
  const out = ['#### What this PR changes', '', '| File | Lines | What |', '|:--|--:|:--|'];
  for (const r of rows.slice(0, 40)) out.push('| `' + r.f + '` | ' + (r.bin ? 'binary' : '+' + r.a + ' −' + r.d) + ' | ' + what(r.f) + ' |');
  if (rows.length > 40) out.push('| …' + (rows.length - 40) + ' more | | |');
  const diff = git('diff', '--unified=0', '--no-color', base + '...' + head, '--', 'tools/', 'void-live-deploy/skills/');
  const checks = (diff.match(/^\+.*\bcheck\(\s*['"`]/gm) || []).length, asks = (git('diff', '--unified=0', '--no-color', base + '...' + head, '--', 'tools/bench.json').match(/^\+\s*\{?\s*"ask"\s*:/gm) || []).length;
  const minis = rows.filter((r) => /skills\/mini\/[\w-]+\.js$/.test(r.f)).map((r) => r.f.match(/mini\/([\w-]+)\.js/)[1]);
  const tally = [rows.length + ' file' + (rows.length > 1 ? 's' : ''), '+' + rows.reduce((s, r) => s + r.a, 0) + ' −' + rows.reduce((s, r) => s + r.d, 0) + ' lines',
    checks && checks + ' new test check' + (checks > 1 ? 's' : ''), asks && asks + ' new benchmark ask' + (asks > 1 ? 's' : ''), minis.length && '3D: ' + minis.join(', ')].filter(Boolean);
  out.push('', tally.join(' · '), '');
  return out;
}

if (process.argv.includes('--json')) { console.log(JSON.stringify({ base, head, findings: report, deep: deepText || null }, null, 1)); process.exit(0); }
const n = { bug: 0, risk: 0, style: 0, note: 0 }; report.forEach((f) => n[f.kind]++);
const out = ['<!-- void-review -->', '### Void\'s review', '', ...walkthrough()];
if (!report.length) out.push('The quick checks found nothing in the lines this PR adds.');
else {
  out.push([n.bug && n.bug + ' bug' + (n.bug > 1 ? 's' : ''), n.risk && n.risk + ' risk' + (n.risk > 1 ? 's' : ''), n.style && n.style + ' style', n.note && n.note + ' note' + (n.note > 1 ? 's' : '')].filter(Boolean).join(' · ') + ' in the lines this PR adds:', '');
  const item = (f) => '- **' + f.kind + '** `' + f.file + ':' + f.line + '`: ' + f.message + '\n  `' + f.text.replace(/`/g, '\u02cb') + '`';
  const main = report.filter((f) => f.kind === 'bug' || f.kind === 'risk'), minor = report.filter((f) => f.kind === 'style' || f.kind === 'note');
  for (const f of main.slice(0, 30)) out.push(item(f));
  if (main.length > 30) out.push('', '…and ' + (main.length - 30) + ' more bugs and risks.');
  if (minor.length) out.push('', '<details><summary>' + minor.length + ' style point' + (minor.length > 1 ? 's' : '') + ' and notes</summary>', '', ...minor.slice(0, 30).map(item), '', '</details>');
}
if (deepText) out.push('', '#### A closer read', '', deepText);
out.push('', '<sub>Pattern checks from void-live-deploy/lib/code-review.js, the same ones a-to-mind.com runs when someone asks Void to review code. Bugs and risks are worth a look; style is a suggestion.</sub>');
console.log(out.join('\n'));
