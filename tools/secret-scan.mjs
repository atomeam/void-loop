#!/usr/bin/env node
// Secret scan (owner, 2026-10-15: "make Verse the best at keeping secrets ever made"). Every line a change adds, in every file
// type (docs, logs, JSON and the deploy copies included: tools/review-pr.mjs skips those, and a log or a note is exactly where
// a pasted key lands), checked for the shapes of real keys: private key blocks, JWTs, provider-prefixed tokens (GitHub, Google,
// AWS, Slack, Stripe-style sk_/pk_/rk_, OpenAI/Anthropic-style sk-, Hugging Face, npm, GitLab, webhook secrets), credentials in a
// URL, Slack and Discord webhook URLs. Only high-confidence shapes: a name like READ_TOKEN or ${{ secrets.X }} is not a secret.
// A line that is right as written (a test's made-up key) says so with "secret-scan: ok".
//   node tools/secret-scan.mjs [--base origin/main]   the lines this branch adds (checks.mjs runs it; exit 1 on a hit)
//   node tools/secret-scan.mjs --all                  every tracked file, for a baseline
//   node tools/secret-scan.mjs --history              every line ever added in any commit (what may need rotating)
// It prints the file, the line and the kind, never the value.
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// one place for the shapes; each is [kind, regex]. Built from parts so this file does not match itself.
const P = (s) => new RegExp(s);
export const SHAPES = [
  // a real key file: the marker alone on its line (the body follows), or a body of real length after it on the same line
  ['private key', P('-----BEGIN [A-Z0-9 ]*PRIVATE ' + 'KEY-----(?:\\s*$|(?:\\\\n|\\s)+[A-Za-z0-9+/=]{60,})')],
  ['JWT', P('\\beyJ[A-Za-z0-9_-]{10,}\\.eyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}')],
  ['GitHub token', P('\\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})')],
  ['Google API key', P('\\bAIza[0-9A-Za-z_-]{35}\\b')],
  ['AWS access key', P('\\b(?:AKIA|ASIA)[A-Z0-9]{16}\\b')],
  ['Slack token', P('\\bxox[abposr]-[A-Za-z0-9-]{10,}')],
  ['secret key (sk_/rk_)', P('\\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}')],
  ['API key (sk-)', P('\\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{32,}')],
  ['Hugging Face token', P('\\bhf_[A-Za-z0-9]{30,}')],
  ['npm token', P('\\bnpm_[A-Za-z0-9]{36}\\b')],
  ['GitLab token', P('\\bglpat-[A-Za-z0-9_-]{20}\\b')],
  ['webhook secret', P('\\bwhsec_[A-Za-z0-9]{24,}')],
  ['Slack webhook', P('https://hooks\\.slack\\.com/services/T[A-Z0-9]+/B[A-Z0-9]+/[A-Za-z0-9]{16,}')],
  ['Discord webhook', P('https://(?:discord|discordapp)\\.com/api/webhooks/\\d{6,}/[A-Za-z0-9_-]{30,}')],
  ['password in a URL', P('\\b[a-z][\\w+.-]*://[^\\s:@/\'"`]{1,64}:(?!\\$\\{|\\{\\{|\\*+@|x+@|password@|pass@|<)[^\\s@/\'"`]{6,}@[\\w.-]+\\.[a-z]{2,}')],
];

// the kinds a line holds; a line marked "secret-scan: ok" holds none
// a value a person typed to stand for a key (tests, docs): a run like abcdef, 123456, EXAMPLE or xxxxxx. A random key of this
// length holds one by chance about once in a billion.
export const madeUp = (v) => /abcdef|bcdefg|123456|234567|0123|abc123|example|xxxxxx|000000|aaaaaa|your[_-]?key|redacted/i.test(v);

export function secretsIn(line) {
  if (/secret-scan:\s*ok/.test(line)) return [];
  const out = [];
  for (const [k, re] of SHAPES) {
    const g = new RegExp(re.source, 'g'); let m;
    while ((m = g.exec(line))) { if (!madeUp(m[0])) { out.push(k); break; } if (!m[0].length) g.lastIndex++; }
  }
  return out;
}

// git diff -U0 output -> [{ file, line, kinds }] for the added lines
export function scanDiff(diff) {
  const out = []; let file = null, n = 0;
  for (const l of String(diff).split('\n')) {
    if (l.startsWith('+++ ')) { file = l.slice(4).replace(/^b\//, ''); continue; }
    const h = l.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/); if (h) { n = +h[1]; continue; }
    if (!file || file === '/dev/null') continue;
    if (l.startsWith('+')) { const kinds = secretsIn(l.slice(1)); if (kinds.length) out.push({ file, line: n, kinds }); n++; }
    else if (!l.startsWith('-') && !l.startsWith('\\')) n++;
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 30 });
  let hits = [];
  if (args.includes('--history')) { // every commit's added lines; the same file:line:kind once
    const seen = new Set();
    for (const h of scanDiff(git('log', '--all', '-p', '-U0', '--no-color', '--no-ext-diff', '--format=', '--diff-filter=AM'))) { const k = h.file + h.kinds; if (!seen.has(k)) { seen.add(k); hits.push(h); } }
  } else if (args.includes('--all')) {
    const files = git('ls-files', '-z').split('\0').filter((f) => f && !f.startsWith('node_modules/'));
    for (const f of files) {
      let text; try { text = git('show', 'HEAD:' + f); } catch (_) { continue; }
      if (text.includes('\0')) continue; // binary
      text.split('\n').forEach((l, i) => { const kinds = secretsIn(l); if (kinds.length) hits.push({ file: f, line: i + 1, kinds }); });
    }
  } else {
    const i = args.indexOf('--base'), base = i >= 0 ? args[i + 1] : 'origin/main';
    let mb; try { mb = git('merge-base', base, 'HEAD').trim(); } catch (_) { mb = base; }
    hits = scanDiff(git('diff', '-U0', '--no-color', '--no-ext-diff', mb, 'HEAD'));
  }
  for (const h of hits) console.log(`${h.file}:${h.line}  ${h.kinds.join(', ')}  (value not shown)`);
  console.log(hits.length ? `secret scan: ${hits.length} line${hits.length === 1 ? '' : 's'} look like a real key. Remove it, rotate it (anything that reached GitHub is public), and mark a made-up test key "secret-scan: ok".` : 'secret scan: no key shapes in ' + (args.includes('--history') ? 'any commit, ever' : args.includes('--all') ? 'the tracked files' : 'the added lines'));
  process.exit(hits.length ? 1 : 0);
}
