// The scout's verdicts on the tower (lib/tower.js), aspect by aspect: a person or browser agent (Argon, the owner's scout) who compared
// Verse and a floor's site on the live sites records what a script cannot measure (design polish, history, modes), and the card moves.
// Nothing here loads a site; the verdict is the scout's, signed with who and when. A measured row (tools/tower-gate.mjs: it carries the
// numbers in verse/best) is never overwritten by a verdict: a measured loss is fixed by making Verse better, not by a vote.
//   node tools/tower-verdict.mjs "<floor id>" --by argon --pass "design polish" --pass history --report "<one line: what was compared>"
//   node tools/tower-verdict.mjs "<floor id>" --by argon --beaten --report "<one line>"   the scout calls the whole floor beaten
//       (owner, 2026-10-23: "there is no rules"): every aspect passes, marked called, and tools/tower-gate.mjs never overturns a called row
//   node tools/tower-verdict.mjs "<floor id>" --by argon --lost "<aspect>" --report "<one line: what the site has that Verse lacks>"
// The public file holds verdicts and short reports only: one line, at most 200 characters (tools/secret-scan.mjs runs on it).
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { FLOORS, aspectsOf, tower } from '../void-live-deploy/lib/tower.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FILE = process.env.TOWER_EVIDENCE || path.join(here, '..', 'void-live-deploy', 'tower.evidence.json');

/** a report as the public file keeps it: one line, at most 200 characters, or null when empty. Pure. */
export const cleanReport = (r) => { const s = String(r || '').replace(/\s+/g, ' ').trim(); return s ? s.slice(0, 200) : null; };
const measured = (row) => !!row && (Number.isFinite(row.verse) || Number.isFinite(row.best));

/** the scout calls the whole floor beaten: every aspect of its checklist (and any extra row it has) passes, marked called. Pure. */
export function called(floor, prev = {}, by, report, at) {
  const rows = { ...prev }, evidence = 'called beaten by ' + by + ' on ' + at.slice(0, 10) + ': ' + report;
  for (const a of new Set([...aspectsOf(floor), ...Object.keys(prev)])) rows[a] = { verdict: 'better', called: true, evidence, at, ...(prev[a] && prev[a].verdict && prev[a].verdict !== 'better' ? { was: prev[a].verdict } : {}) };
  return rows;
}
/** apply one scout verdict to a floor's rows: { rows, skipped } where skipped names aspects left alone because a script measured them. Pure. */
export function verdicts(floor, prev = {}, { pass = [], lost = [] }, by, report, at) {
  const rows = { ...prev }, skipped = [], evidence = 'verified by ' + by + ' on ' + at.slice(0, 10) + ': ' + report;
  for (const [list, verdict] of [[pass, 'better'], [lost, 'worse']]) for (const a of list) {
    if (verdict === 'better' && measured(prev[a])) { skipped.push(a); continue; }
    rows[a] = { verdict, evidence, at, ...(prev[a] && prev[a].verdict ? { was: prev[a].verdict } : {}) };
  }
  return { rows, skipped, unknown: [...pass, ...lost].filter((a) => !aspectsOf(floor).includes(a) && verdictsAllowNew(lost, a)) };
}
const verdictsAllowNew = (lost, a) => !lost.includes(a); // a lost aspect may be new (the site added something); a pass must be on the list

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), many = (n) => { const out = []; let i; while ((i = args.indexOf(n)) >= 0) { out.push(String(args[i + 1] || '').trim().toLowerCase()); args.splice(i, 2); } return out; };
  const one = (n) => many(n)[0];
  const beaten = args.includes('--beaten'); if (beaten) args.splice(args.indexOf('--beaten'), 1);
  const pass = many('--pass'), lost = many('--lost'), by = one('--by') || 'argon', report = cleanReport(one('--report')), id = args.join(' ').trim().toLowerCase();
  const floor = FLOORS.find((f) => f.id === id);
  const usage = 'usage: node tools/tower-verdict.mjs "<floor id>" --by argon (--beaten | --pass "<aspect>" ... | --lost "<aspect>") --report "<one line>"\nfloors: ' + FLOORS.map((f) => f.id).join(', ');
  if (!floor) { console.error('no floor "' + id + '"\n' + usage); process.exit(2); }
  if (!beaten && !pass.length && !lost.length) { console.error('name at least one --pass or --lost aspect\n' + usage); process.exit(2); }
  if (!report) { console.error('--report "<one line>" is required\n' + usage); process.exit(2); }
  if (!/^[a-z0-9][a-z0-9._-]{0,39}$/.test(by)) { console.error('--by must be a lowercase slug, like argon'); process.exit(2); }
  const data = JSON.parse(fs.readFileSync(FILE, 'utf8')); data.floors = data.floors || {};
  const before = tower([], data.floors), at = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const r = beaten ? { rows: called(floor, data.floors[floor.id], by, report, at), skipped: [], unknown: [] } : verdicts(floor, data.floors[floor.id], { pass, lost }, by, report, at);
  if (r.unknown.length) { console.error('not an aspect of ' + floor.site + ': ' + r.unknown.join(', ') + ' (aspects: ' + aspectsOf(floor).join(', ') + ')'); process.exit(2); }
  data.floors[floor.id] = r.rows; fs.writeFileSync(FILE, JSON.stringify(data, null, 1) + '\n');
  const after = tower([], data.floors), f = after.floors.find((x) => x.id === floor.id);
  if (r.skipped.length) console.log('left alone (measured by tools/tower-gate.mjs; make Verse better to flip it): ' + r.skipped.join(', '));
  console.log(floor.site + ': ' + f.n + ' of ' + f.m + ' aspects beaten; marker floor ' + before.marker + ' -> ' + after.marker + ' of ' + after.total + '; left: ' + f.left.join(', '));
}
