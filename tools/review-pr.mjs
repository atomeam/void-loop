// node tools/review-pr.mjs [--base origin/main] [--head HEAD] [--json] [--deep URL]
// Void reviews a pull request with the same checks it runs for visitors (void-live-deploy/lib/code-review.js): each changed
// file is checked as a whole, and only findings on lines this change added are reported, so old code doesn't drown the new.
// --deep URL also asks Void's answer engine (POST URL with mode 'review') for a read of the added code; it is best-effort.
// Prints markdown (the PR comment) or JSON. Exit code is always 0: the review informs, CI decides.
import { execFileSync } from 'node:child_process';
import { ruleReview, langOf, skippedInReview } from '../void-live-deploy/lib/code-review.js';
import { redact } from '../void-live-deploy/lib/automation-fix.js';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const base = arg('--base', 'origin/main'), head = arg('--head', 'HEAD'), deep = arg('--deep', '');
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 << 20 });

const LANG = { js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', py: 'python', sh: 'shell', bash: 'shell', sql: 'sql', go: 'go', rs: 'rust', java: 'java', cs: 'csharp', c: 'c', h: 'c', cpp: 'c', php: 'php', rb: 'ruby', lua: 'lua', pl: 'perl', pm: 'perl', html: 'javascript', htm: 'javascript', yml: 'yaml', yaml: 'yaml' };
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

const files = added(), report = [];
for (const [file, lines] of Object.entries(files)) {
  if (skippedInReview(file) || !lines.size) continue;
  const ext = (file.match(/\.([\w]+)$/) || [])[1] || '', lang = LANG[ext.toLowerCase()];
  if (!lang || lang === 'yaml') continue;
  let text = ''; try { text = git('show', head + ':' + file); } catch (_) { continue; }
  if (text.length > 2e6 || /void-review: skip-file/.test(text)) continue;
  // every line's findings (no collapsing of repeats), then only the ones on lines this PR adds
  const res = ruleReview(text, { lang, max: 5000, collapse: false });
  for (const f of res.findings.filter((f) => lines.has(f.line))) report.push({ file, ...f });
}
const ORDER = { bug: 0, risk: 1, style: 2, note: 3 };
report.sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || a.file.localeCompare(b.file) || a.line - b.line);

let deepText = '';
if (deep && Object.keys(files).length) {
  try {
    const diff = redact(git('diff', '--unified=3', '--no-color', base + '...' + head, '--', ...Object.keys(files).filter((f) => !SKIP.test(f) && LANG[(f.match(/\.([\w]+)$/) || [])[1]]))).slice(0, 12000);
    if (diff.trim()) {
      const r = await fetch(deep, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'review', ask: 'review this pull request', code: diff, diff: true }), signal: AbortSignal.timeout(60000) });
      const j = r.ok ? await r.json() : null;
      if (j && j.answer && j.review === 'model') deepText = String(j.answer).trim();
    }
  } catch (_) {}
}

if (process.argv.includes('--json')) { console.log(JSON.stringify({ base, head, findings: report, deep: deepText || null }, null, 1)); process.exit(0); }
const n = { bug: 0, risk: 0, style: 0, note: 0 }; report.forEach((f) => n[f.kind]++);
const out = ['<!-- void-review -->', '### Void\'s review', ''];
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
