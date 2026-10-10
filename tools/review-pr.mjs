// node tools/review-pr.mjs [--base origin/main] [--head HEAD] [--json] [--inline] [--gate] [--deep URL]
// Void reviews a pull request with the same checks it runs for visitors (void-live-deploy/lib/code-review.js): each changed
// file is checked as a whole, and only findings on lines this change added are reported, so old code doesn't drown the new.
// --deep URL also asks for the model's closer read of the added code (https://a-to-mind.com/api/review, the Pro review: send the
// key in VOID_REVIEW_KEY; or Void's answer engine, /api/answer with mode 'review'); it is best-effort.
// Prints markdown (the PR comment: a walkthrough of what changed, then the findings) or JSON. --inline prints the
// review comments for GitHub instead: one per line with a bug or risk, with a one-click suggested change when Void's
// safe automatic fix (autoFix) rewrites that line. --gate makes Void's review a merge gate: exit 1 when the added lines carry a
// bug or a risk (the "void-review" check, .github/workflows/void-review.yml). A line that is right as written says so with
// "void-review: ok" in a comment on it, and is left out. Otherwise the exit code is 0: the review informs.
import { execFileSync } from 'node:child_process';
import { ruleReview, langOf, skippedInReview, autoFix, textLines, conflictMarkers, CONFLICT_MESSAGE } from '../void-live-deploy/lib/code-review.js';
import { redact } from '../void-live-deploy/lib/automation-fix.js';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const base = arg('--base', 'origin/main'), head = arg('--head', 'HEAD'), deep = arg('--deep', '');
const started = performance.now();
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 << 20 });

const YAML_RULES = new Set(['image-latest', 'hardcoded-secret', 'yaml-privileged', 'yaml-run-as-root', 'yaml-host-namespace']); // the checks written for YAML (the general ones are tuned for code)
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
let scanned = 0;
for (const [file, lines] of Object.entries(files)) {
  // conflict markers first, in every changed file of any type, the ones the review skips (.json, .md) included: #291 merged
  // a growth ledger full of them because only code was read
  if (lines.size) { let all = ''; try { all = git('show', head + ':' + file); } catch (_) {}
    if (!all.includes('\0')) for (const c of conflictMarkers(all)) if (lines.has(c.line)) report.push({ file, line: c.line, kind: 'bug', rule: 'conflict-markers', message: CONFLICT_MESSAGE, text: c.text }); }
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
  const src = text.split('\n'), waived = (n) => /void-review:\s*ok\b/.test(src[n - 1] || '');
  const prose = /\.html?$/i.test(file) ? textLines(src) : new Set(); // an HTML page's <textarea> and <pre> hold text (sample code to show), not code it runs
  for (const f of res.findings.filter((f) => f.rule !== 'conflict-markers' && lines.has(f.line) && own(f) && !waived(f.line) && !prose.has(f.line))) report.push({ file, ...f }); // markers are reported above, once, and never waived
  scanned += lines.size;
}
const ORDER = { bug: 0, risk: 1, style: 2, note: 3 };
report.sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || a.file.localeCompare(b.file) || a.line - b.line);

// the lines of a file that declare names at top level: imports, requires, functions, classes, consts (JavaScript), imports, defs and
// assignments (Python); redacted like the diff, at most 60 a file
const TOP_LINE = /^(?:import\b|export\s+\{[^}]*\}\s*from\b|(?:export\s+)?(?:const|let|var)\s+(?:\{[^}]*\}|\[[^\]]*\]|[\w$]+)\s*=|(?:export\s+)?(?:async\s+)?function\s*\*?\s*[\w$]+|(?:export\s+)?class\s+[\w$]+|from\s+\S+\s+import\b|(?:async\s+)?def\s+\w+|class\s+\w+|[A-Za-z_]\w*\s*(?::\s*\w+)?\s*=\s)/;
function topLines(file) { try { return redact(git('show', head + ':' + file)).split('\n').filter((l) => TOP_LINE.test(l)).map((l) => l.slice(0, 300)).slice(0, 60); } catch (_) { return []; } }
let deepText = '', deepQuoted = null, deepWhy = ''; // quoted: { kept, dropped } from lib/review-api.js quoteCheck; deepWhy: which side kept the closer read away
// The footer names only the side, never the reason: 'access' (the key was not accepted, or refused), 'model' (busy or off), 'network' (no
// answer, or not JSON). The exact reason stays in the Pages function's own log (functions/api/review.js), read with wrangler pages
// deployment tail, because the PR comment is public and a reason there says more about the site's setup than it should.
const unavailableSide = (j, status) => {
  if (!j) return status === 401 || status === 403 ? 'access' : 'network';
  if (j.review === 'model' && j.answer) return '';
  const note = String(j.note || '');
  if (/model|closer reads are used/i.test(note)) return 'model';
  return 'access';
};
if (deep && Object.keys(files).length) {
  try {
    const deepFiles = Object.keys(files).filter((f) => !skippedInReview(f) && LANG[(f.match(/\.([\w]+)$/) || [])[1]]);
    const diff = redact(git('diff', '--unified=3', '--no-color', base + '...' + head, '--', ...deepFiles)).slice(0, 12000);
    if (diff.trim()) {
      const headers = { 'content-type': 'application/json' }; if (process.env.VOID_REVIEW_KEY) headers.authorization = 'Bearer ' + process.env.VOID_REVIEW_KEY.trim();
      // each touched file's import and top-level declaration lines go along (lib/review-api.js DIFF_RULE): a diff shows only the
      // hunks, and without them the closer read called imports at the top of the file missing (#254)
      const imports = {}; for (const f of deepFiles) { const ls = topLines(f); if (ls.length) imports[f] = ls; }
      const r = await fetch(deep, { method: 'POST', headers, body: JSON.stringify({ mode: 'review', ask: 'review this pull request', code: diff, diff, imports }), signal: AbortSignal.timeout(60000) });
      let j = null; try { j = r.ok ? await r.json() : null; } catch (_) {}
      if (j && j.answer && j.review === 'model') { deepText = String(j.answer).trim(); deepQuoted = j.quoted || null; }
      else deepWhy = unavailableSide(j, r.status);
    }
  } catch (_) { deepWhy = 'network'; }
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

const ms = Math.max(1, Math.round(performance.now() - started)), blocking = report.filter((f) => f.kind === 'bug' || f.kind === 'risk').length;
const gate = process.argv.includes('--gate') && blocking ? 1 : 0;
if (process.argv.includes('--json')) { console.log(JSON.stringify({ base, head, findings: report, deep: deepText || null, quoted: deepQuoted, deepWhy: deepWhy || null, lines: scanned, ms, blocking }, null, 1)); process.exit(gate); }
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
out.push('', blocking ? '**Blocking:** ' + blocking + ' bug' + (blocking > 1 ? 's and risks' : ' or risk') + ' to fix first (or mark a line that is right as written with a `void-review: ok` comment).' : '**Not blocking:** no bugs or risks in the added lines.');
out.push('', '<sub>Reviewed ' + scanned + ' added line' + (scanned === 1 ? '' : 's') + ' in ' + (ms < 1000 ? ms + ' ms' : (ms / 1000).toFixed(1) + ' s') + (deepText ? ' (plus the closer read' + (deepQuoted ? ': ' + (deepQuoted.parsed === false ? 'its JSON did not parse, so nothing to report' : deepQuoted.kept + ' finding' + (deepQuoted.kept === 1 ? '' : 's') + ' quoted from the diff, ' + deepQuoted.dropped + ' claim' + (deepQuoted.dropped === 1 ? '' : 's') + ' about lines not in it dropped' + (deepQuoted.echoes ? ', ' + deepQuoted.echoes + ' echo' + (deepQuoted.echoes === 1 ? '' : 'es') + ' of the shape' : '')) : '') + ')' : deepWhy ? ' (closer read unavailable (' + deepWhy + '))' : '') + '. Pattern checks from void-live-deploy/lib/code-review.js, the same ones a-to-mind.com runs when someone asks Void to review code. Bugs and risks are worth a look; style is a suggestion.</sub>');
console.log(out.join('\n'));
process.exit(gate);
