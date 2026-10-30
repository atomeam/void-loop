// Append one entry to Verse's growth ledger (void-live-deploy/void.growth.json), in its own style (one object per line),
// so the diff shows only the new line. The ledger is what "growth" summons on the surface; it is live on the next deploy.
//   node tools/grow.mjs grow "Poker: heads-up fixed-limit Hold'em against Verse"         a new thing Verse can do
//   node tools/grow.mjs fix "the timer no longer stops at 59 s" --by claude --ref https://github.com/atomeam/void-loop/pull/205
//   node tools/grow.mjs grow "…" --asked ask-20261009-2159-1   this answers one of Verse's asks: its id from the asks list (tools/reflect.mjs drops it)
//   node tools/grow.mjs grow "…" --show "sticky notes look like real paper" --try "sticky note buy milk"
//                                  the plain line and the ask the "look what I made" walkthrough shows (skills/showcase.js)
//   node tools/grow.mjs --check      the whole ledger is valid, and every waiting entry file (also run by tools/checks.mjs)
// On a branch other than main the entry goes to its own file, growth/entries/<time>-<by>-<id>.json, so two PRs never touch the same
// lines of the ledger and stop colliding there (owner, 2026-10-28). tools/growth-fold.mjs folds those files into the ledger: in every
// deploy (so the served ledger has them at once) and on main by .github/workflows/growth-fold.yml, which commits the fold.
// On main, in a detached checkout, with --ledger or GROWTH_LEDGER=1 it appends to the ledger itself as before; --entry forces a file.
// kinds: grow, build, fix, retire, idea, finding (void-live-deploy/void.growth.schema.json)
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const LEDGER = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy', 'void.growth.json');
export const ENTRIES = resolve(dirname(LEDGER), '..', 'growth', 'entries');
export const KINDS = ['grow', 'build', 'fix', 'retire', 'idea', 'finding'];
const FIELDS = ['at', 'by', 'kind', 'what', 'ref', 'from', 'asked', 'show', 'try', 'phrases'];

// null when the entry is valid, else what is wrong with it
export function entryProblem(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return 'not an object';
  const extra = Object.keys(e).filter((k) => !FIELDS.includes(k));
  if (extra.length) return 'unknown field ' + extra.join(', ');
  if (typeof e.at !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(e.at) || isNaN(Date.parse(e.at))) return '"at" must be a UTC time like 2026-10-09T15:00:00Z';
  if (typeof e.by !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,39}$/.test(e.by)) return '"by" must be a lowercase slug';
  if (!KINDS.includes(e.kind)) return '"kind" must be one of ' + KINDS.join(', ');
  if (typeof e.what !== 'string' || !e.what.trim() || e.what.length > 4000) return '"what" must be 1 to 4000 characters';
  if (e.ref !== undefined && (typeof e.ref !== 'string' || !/^https:\/\/\S+$/.test(e.ref))) return '"ref" must be an https link';
  if (e.from !== undefined && typeof e.from !== 'string') return '"from" must be text';
  if (e.asked !== undefined && (typeof e.asked !== 'string' || !e.asked.trim())) return '"asked" must be the ask\'s id (ask-…) from the asks list';
  if (e.show !== undefined && (typeof e.show !== 'string' || !e.show.trim() || e.show.length > 70)) return '"show" must be 1 to 70 characters';
  if (e.try !== undefined && (typeof e.try !== 'string' || !e.try.trim() || e.try.length > 120 || /[\r\n]/.test(e.try))) return '"try" must be one ask, 1 to 120 characters';
  return null;
}

// every bad entry in the ledger (order is not checked: two branches merged can each add an entry older than the other's)
export function ledgerProblems(list) {
  if (!Array.isArray(list)) return ['the ledger is not an array'];
  const bad = [];
  list.forEach((e, i) => { const p = entryProblem(e); if (p) bad.push('entry ' + i + ': ' + p); });
  return bad;
}

export const entryLine = (o) => '  {' + Object.entries(o).map(([k, v]) => JSON.stringify(k) + ': ' + JSON.stringify(v)).join(', ') + '}';

export function appendTo(text, entry) {
  const body = text.trimEnd().replace(/\]$/, '').trimEnd();
  return (body === '[' ? '[\n' : body + ',\n') + entryLine(entry) + '\n]\n';
}

// the file name an entry waits under: sorts by time, says who, and a short hash of the entry so two at the same second never clash
export const entryName = (e) => e.at.replace(/[-:]/g, '').replace(/Z$/, 'Z') + '-' + e.by + '-' + createHash('sha256').update(JSON.stringify(e)).digest('hex').slice(0, 8) + '.json';
export const entryText = (e) => JSON.stringify(e) + '\n';
// the waiting entry files, oldest first: [{ name, entry }] (a file that is not one valid entry is reported by --check, never dropped silently)
export function readEntries(dir = ENTRIES) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => n.endsWith('.json')).sort().map((name) => { let entry = null; try { entry = JSON.parse(readFileSync(resolve(dir, name), 'utf8')); } catch (_) {} return { name, entry }; });
}
// the ledger text with these entries appended in time order; an entry already in it (same at, by, kind and what) is not repeated
export function foldInto(text, entries) {
  const key = (e) => [e.at, e.by, e.kind, e.what].join('\u0000'), have = new Set(JSON.parse(text).map(key));
  let out = text;
  for (const e of entries.slice().sort((a, b) => a.at.localeCompare(b.at))) { if (have.has(key(e))) continue; have.add(key(e)); out = appendTo(out, e); }
  return out;
}
// where this run writes: a file on a feature branch, the ledger on main or when there is no branch
export function writesEntryFile({ args = [], env = process.env, branch } = {}) {
  if (args.includes('--entry')) return true;
  if (args.includes('--ledger') || env.GROWTH_LEDGER === '1') return false;
  if (branch === undefined) { try { branch = execFileSync('git', ['-C', dirname(LEDGER), 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (_) { branch = ''; } }
  return !!branch && branch !== 'HEAD' && branch !== 'main';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args[0] === '--check') {
    const list = JSON.parse(readFileSync(LEDGER, 'utf8')), bad = ledgerProblems(list), waiting = readEntries();
    for (const { name, entry } of waiting) { const p = entry ? entryProblem(entry) : 'not JSON'; if (p) bad.push('growth/entries/' + name + ': ' + p); }
    if (bad.length) { console.error(bad.slice(0, 10).join('\n')); process.exit(1); }
    console.log('void.growth.json: ' + list.length + ' entries, all valid' + (waiting.length ? '; ' + waiting.length + ' waiting in growth/entries, all valid' : ''));
    process.exit(0);
  }
  const toFile = writesEntryFile({ args });
  for (const f of ['--entry', '--ledger']) { const i = args.indexOf(f); if (i >= 0) args.splice(i, 1); }
  const opt = (name) => { const i = args.indexOf(name); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, 2); return v; };
  const by = opt('--by') || 'claude', ref = opt('--ref'), asked = opt('--asked'), show = opt('--show'), tryAsk = opt('--try');
  const [kind, ...words] = args;
  const entry = { at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), by, kind, what: words.join(' ').trim() };
  if (ref) entry.ref = ref;
  if (asked) entry.asked = asked;
  if (show) entry.show = show;
  if (tryAsk) entry.try = tryAsk;
  const p = entryProblem(entry);
  if (p) { console.error(p + '\nusage: node tools/grow.mjs <' + KINDS.join('|') + '> "what changed" [--by slug] [--ref https://…] [--asked "Verse\'s ask"] [--show "plain line"] [--try "an ask that shows it"]'); process.exit(2); }
  if (toFile) {
    mkdirSync(ENTRIES, { recursive: true });
    const name = entryName(entry);
    writeFileSync(resolve(ENTRIES, name), entryText(entry));
    console.log('growth/entries/' + name + ': +1 ' + kind + ' (folded into void.growth.json on main)');
    process.exit(0);
  }
  const text = readFileSync(LEDGER, 'utf8');
  const next = appendTo(text, entry);
  JSON.parse(next);
  writeFileSync(LEDGER, next);
  console.log('void.growth.json: +1 ' + kind + ' (' + JSON.parse(next).length + ' entries)');
}
