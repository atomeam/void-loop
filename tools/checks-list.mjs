// A new fast check is its own file, so two pull requests do not both edit the list in tools/checks.mjs.
//   tools/checks.d/<name>.chk    line 1 the name, line 2 the script under tools/
// The list already in tools/checks.mjs stays. When two branches did add a line, tools/merge-main.mjs keeps both.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ENTRY = /^\s*(?:\['[^'\n]+',\s*'[^'\n]+'\]\s*,?\s*)+(?:\/\/.*)?$/;

/** [name, file] from tools/checks.d, in filename order. */
export function discoveredChecks(dir = resolve(here, 'checks.d')) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.chk')).sort()) {
    const lines = readFileSync(resolve(dir, name), 'utf8').split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('#'));
    if (!lines.length) continue;
    const file = lines.length === 1 ? lines[0] : lines[1];
    const label = lines.length === 1 ? name.replace(/\.chk$/, '').replace(/^\d+-/, '').replace(/-/g, ' ') : lines[0];
    if (file) out.push([label, file]);
  }
  return out;
}

/** lines a diff adds to the shared check list. Pure. */
export function addedCheckLines(diff) {
  return String(diff || '').split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++') && /^\+\s*\['[^']+',\s*'[^'\n]+'\]/.test(l));
}

const entryKey = (l) => l.replace(/\s/g, '').replace(/\/\/.*$/, '').replace(/,+$/, '');

/** the check list with both sides' entries, or null when the runner itself disagrees. Pure. */
export function settleChecks(base, ours, theirs) {
  const body = (t) => String(t || '').split('\n').filter((l) => !ENTRY.test(l)).join('\n');
  const bO = body(ours), bT = body(theirs), bB = body(base);
  if (bO !== bB && bT !== bB && bO !== bT) return null;
  const host = bT !== bB ? String(theirs || '') : (bO !== bB ? String(ours || '') : String(theirs || ''));
  const start = host.indexOf('for (const [name, file] of [');
  const end = start < 0 ? -1 : host.indexOf(']) {', start);
  if (start < 0 || end < 0) return null;
  const seen = new Set();
  const lines = [];
  for (const l of [base, theirs, ours].flatMap((t) => String(t || '').split('\n').filter((line) => ENTRY.test(line)))) {
    const key = entryKey(l);
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(l.trimEnd());
  }
  const headEnd = host.indexOf('\n', start);
  if (headEnd < 0) return null;
  return host.slice(0, headEnd + 1) + lines.join('\n') + '\n' + host.slice(end);
}

/**
 * Share rate of time-overlapping pull requests. `settled` files no longer count as a conflict
 * (one file per entry, or a merge that keeps both sides). Pure.
 * prs: [{ created, merged_at, files }]. merged_at null means still open.
 */
export function overlapRate(prs, settled = [], now = Date.now()) {
  const drop = new Set(settled || []);
  let pairs = 0, share = 0, after = 0;
  const list = prs || [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    const a0 = Date.parse(a.created), a1 = a.merged_at ? Date.parse(a.merged_at) : now;
    const b0 = Date.parse(b.created), b1 = b.merged_at ? Date.parse(b.merged_at) : now;
    if (!(a0 < b1 && b0 < a1)) continue;
    pairs++;
    const sb = new Set(b.files || []);
    const shared = [...new Set(a.files || [])].filter((f) => sb.has(f));
    if (!shared.length) continue;
    share++;
    if (shared.some((f) => !drop.has(f))) after++;
  }
  const round = (n) => pairs ? Math.round((n / pairs) * 1000) / 1000 : 0;
  return { pairs, share, after, rate: round(share), rateAfter: round(after) };
}
