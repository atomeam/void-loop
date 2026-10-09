// Append one entry to Void's growth ledger (void-live-deploy/void.growth.json), in its own style (one object per line),
// so the diff shows only the new line. The ledger is what "growth" summons on the surface; it is live on the next deploy.
//   node tools/grow.mjs grow "Poker: heads-up fixed-limit Hold'em against Void"         a new thing Void can do
//   node tools/grow.mjs fix "the timer no longer stops at 59 s" --by claude --ref https://github.com/atomeam/void-loop/pull/205
//   node tools/grow.mjs --check      the whole ledger is valid (also run by tools/checks.mjs)
// kinds: grow, build, fix, retire, idea, finding (void-live-deploy/void.growth.schema.json)
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const LEDGER = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy', 'void.growth.json');
export const KINDS = ['grow', 'build', 'fix', 'retire', 'idea', 'finding'];
const FIELDS = ['at', 'by', 'kind', 'what', 'ref', 'from'];

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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args[0] === '--check') {
    const list = JSON.parse(readFileSync(LEDGER, 'utf8')), bad = ledgerProblems(list);
    if (bad.length) { console.error(bad.slice(0, 10).join('\n')); process.exit(1); }
    console.log('void.growth.json: ' + list.length + ' entries, all valid');
    process.exit(0);
  }
  const opt = (name) => { const i = args.indexOf(name); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, 2); return v; };
  const by = opt('--by') || 'claude', ref = opt('--ref');
  const [kind, ...words] = args;
  const entry = { at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), by, kind, what: words.join(' ').trim() };
  if (ref) entry.ref = ref;
  const p = entryProblem(entry);
  if (p) { console.error(p + '\nusage: node tools/grow.mjs <' + KINDS.join('|') + '> "what changed" [--by slug] [--ref https://…]'); process.exit(2); }
  const text = readFileSync(LEDGER, 'utf8');
  const next = appendTo(text, entry);
  JSON.parse(next);
  writeFileSync(LEDGER, next);
  console.log('void.growth.json: +1 ' + kind + ' (' + JSON.parse(next).length + ' entries)');
}
