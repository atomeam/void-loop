// Rename what the site calls itself, everywhere a person can read it (owner, 2026-10-14: V01D; 2026-10-18: "Void is now Verse rename everywhere").
//   node tools/rename-name.mjs --from V01D --to Verse [--also Void] [--alt v01d=verse] [--dry]
// --alt old=new: inside a matcher's alternation (?:void|v01d|you) the new lower-case name is added beside the old one (v01d|verse), so
// the asks people type with the new name still route; the old names keep matching (an ask is never un-learned).
// The visible layer only: the page and its two deploy copies, skills, lib, functions, the html pages, tools and tests, the bench asks,
// docs, domains, the workflows' display names, the agent skills. Case-sensitive: `--from` is replaced as it stands; `--also` (a second
// old name, the word alone: Void, never void) is replaced only as a whole word, so `void`, `VoidQuest`-style joins and `Void-auto-revert`
// (the revert trailer tools/revert-target.mjs reads) are left alone (the joins are listed for a person).
// Never touched: identifiers, storage keys (a2m.void.*), D1 tables (void_*), secret names (VOID_*), file and folder names, URL paths, the
// repo and the domain (a live-data migration, the owner's call); the append-only records (the agent log, the growth ledger, GROWTH.md,
// the voice log with Void's own words, incidents, dispatch and tester logs, the decisions, the inputs and study notes, grown.json, the
// flake and site-test records, the asks); generated files (families, guide, index, deps: regenerated
// after); a double-quoted passage on a line that names the owner or Adam (their words stay as they said them); the card mark
// (lib/card-share.js keeps reading the old one, see the rename's PR). Prints what it changed and what it skipped; --dry writes nothing.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : ''; };
const FROM = opt('--from'), TO = opt('--to'), ALSO = opt('--also'), DRY = args.includes('--dry'), ALT = (opt('--alt') || '').split('=');

export const ROOTS = ['void.html', 'AGENTS.md', 'STANDING.md', 'README.md', 'BASE.md', 'void-live-deploy', 'drafts', 'tools', 'docs', 'domains', '.github', '.claude', 'review', 'extension'];
export const SKIP = [/(^|\/)node_modules\//, /(^|\/)archive\//, /\.(png|jpg|jpeg|webp|gif|ico|woff2?|ttf|mp3|mp4|webm|stl|glb|zip|pdf)$/i,
  /domains\/void\.agents\.log\.md$/, /domains\/void\.voice\.md$/, /void\.growth\.json$/, /(^|\/)GROWTH\.md$/, /incidents\.json$/, /tester-log\.json$/, /dispatch-log\.jsonl$/, /claims-verified\.json$/, /review-stats\.json$/, /bench\.last\.json$/, /bench\.best\.json$/,
  /skills\/(families|guide|index|deps)\.json$/, /tools\/rename-name\.(mjs|test\.mjs)$/, /docs\/playbooks\/rename\.md$/, /domains\/handoff\.md$/, /tools\/fringe\.json$/, /\.jsonl$/,
  // records: what was said, decided, studied or measured at the time stays in the words of the time (grown.json and the inputs are append-only)
  /^domains\/(inputs|targets)\//, /^domains\/void\.(decisions|pit-crew|clips|better|reinvest|queue)\./, /fringe\/ledger\.json$/, /^tools\/(flakes|grown|site-test\.log|site-test\.seen|retest|asks-link)\.json$/,
  /bench-alarms\.json$/, /void\.asks\.json$/, /store\/changelog\.json$/, /^void-live-deploy\/self\.json$/];
const TEXT = /\.(js|mjs|cjs|ts|html|css|json|md|txt|yml|yaml|py|svg|toml|sh)$/i;

function walk(p, out = []) {
  const full = resolve(root, p);
  let st; try { st = statSync(full); } catch (_) { return out; }
  if (st.isDirectory()) { for (const f of readdirSync(full)) walk(join(p, f), out); return out; }
  const rel = relative(root, full).replace(/\\/g, '/');
  if (TEXT.test(rel) && !SKIP.some((re) => re.test(rel))) out.push(rel);
  return out;
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const QUOTED_OWNER = /\b(?:owner|Adam)\b[^"\n]*"[^"\n]*"/; // a line quoting the owner: its quoted words stay
/** one line renamed: { line, n, kept: [why] }. Pure. */
export function renameLine(line, from, to, also, alt = ALT) {
  if (KEEP.test(line)) return { line, n: 0, kept: ['keep mark'] }; // a line that names the old names on purpose (history, both-name matchers) says so
  if (QUOTED_OWNER.test(line) && (line.includes(from) || (also && new RegExp('\\b' + esc(also) + '\\b').test(line)))) {
    // replace outside the quotes only
    const parts = line.split(/("[^"\n]*")/); let n = 0;
    const out = parts.map((seg, i) => { if (i % 2) return seg; const r = renameLine(seg, from, to, also, alt); n += r.n; return r.line; }).join('');
    return { line: out, n, kept: n < countAll(line, from, also) ? ['owner quote'] : [] };
  }
  let n = 0, kept = [];
  let out = line.replace(new RegExp(esc(from) + '(?!-CARD)', 'g'), () => { n++; return to; });
  if (alt[0] && alt[1]) { // v01d inside a matcher, not in a path or an id (lib/v01d-fixes, #v01d): the new name beside it, once
    const A = esc(alt[0]), TAIL = String.raw`((?:\\?'\??s\??)?(?:\\\\?s\+| )?)`, NOT_YET = '(?!\\|' + esc(alt[1]) + ')';
    // in an alternation: (?:void|v01d|you) -> (?:void|v01d|verse|you); v01d'?s?\s+| -> v01d'?s?\s+|verse'?s?\s+|
    out = out.replace(new RegExp('(?<=[|(]|\\(\\?:)' + A + TAIL + '(?=[|)])' + NOT_YET, 'g'), (m, tail) => { n++; return alt[0] + tail + '|' + alt[1] + tail; });
    // standing alone in a matcher (/\bv01d\b/, /^v01d\s/, \s+v01d), /v01d's/): grouped with the new name, (?:v01d|verse). Only on a line
    // with a regex literal or RegExp, never in prose, a path or an id.
    if (/\/[^/\n]*\\[bs][^/\n]*\/|new RegExp\(/.test(out))
      out = out.replace(new RegExp(String.raw`(?<=\\b|/|\^|\\s\+|\\s|\\\\s\+)` + A + String.raw`(?=\\b|\\s|\\?'|\$|/|\))` + NOT_YET, 'g'), () => { n++; return '(?:' + alt[0] + '|' + alt[1] + ')'; });
  }
  if (line.includes(from + '-CARD')) kept.push('card mark');
  if (also) {
    out = out.replace(new RegExp('\\b' + esc(also) + '\\b(?!-auto-revert)', 'g'), () => { n++; return to; });
    if (new RegExp(esc(also) + '-auto-revert').test(line)) kept.push('revert trailer');
    const join = line.match(new RegExp('\\b' + esc(also) + '[A-Z][a-z]+|[a-z]' + esc(also) + '\\b', 'g')); if (join) kept.push('join: ' + [...new Set(join)].join(' '));
  }
  return { line: out, n, kept };
}
// `rename-name: keep` on a line (a comment, like void-review: ok) keeps it as written: the old names are the point there
export const KEEP = /rename-name: keep/;
const countAll = (line, from, also) => (line.match(new RegExp(esc(from), 'g')) || []).length + (also ? (line.match(new RegExp('\\b' + esc(also) + '\\b', 'g')) || []).length : 0);

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!FROM || !TO) { console.error('usage: node tools/rename-name.mjs --from V01D --to Verse [--also Void] [--alt v01d=verse] [--dry]'); process.exit(2); }
  const files = ROOTS.flatMap((r) => walk(r)); let total = 0, touched = 0; const kept = new Map();
  for (const f of files) {
    const src = readFileSync(resolve(root, f), 'utf8'); if (!src.includes(FROM) && !(ALSO && src.includes(ALSO))) continue;
    const lines = src.split('\n'); let n = 0;
    const out = lines.map((l) => { const r = renameLine(l, FROM, TO, ALSO); n += r.n; for (const k of r.kept) kept.set(k, (kept.get(k) || 0) + 1); return r.line; }).join('\n');
    if (n) { touched++; total += n; if (!DRY) writeFileSync(resolve(root, f), out); console.log((DRY ? 'would change ' : 'changed ') + f + ': ' + n); }
  }
  console.log(`\n${DRY ? 'would rename' : 'renamed'} ${total} in ${touched} files (${files.length} looked at)`);
  for (const [k, v] of [...kept].sort((a, b) => b[1] - a[1])) console.log('  kept ' + k + ': ' + v + ' line' + (v === 1 ? '' : 's'));
}
