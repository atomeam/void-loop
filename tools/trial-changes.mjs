// trial-changes — the trial watch keeps itself current (frontier #8): read the ClinicalTrials.gov registry for the watchlist
// (skills/trialwatch.js check), compare it with the last kept check (void-live-deploy/trialwatch.json, served so the card can show Verse's daily check), and write one
// `finding` to the growth ledger for each change (a status, posted results, enrollment, the primary-completion date), with
// the trial's record as its source. Run daily by .github/workflows/trialwatch.yml, which commits the two files.
//   node tools/trial-changes.mjs          check, write findings and the new snapshot
//   node tools/trial-changes.mjs --dry    check and print what changed; write nothing
// When the registry does not answer, nothing is written. A first check is the baseline: no findings.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, changes } from '../void-live-deploy/skills/trialwatch.js';
import { LEDGER, appendTo, entryProblem } from './grow.mjs';

export const SNAP = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy', 'trialwatch.json'); // served: the trial watch card falls back to it
const stamp = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

export async function runOnce({ fetchFn = (u, o) => fetch(u, o), snapPath = SNAP, ledgerPath = LEDGER, now = () => new Date(), dry = false } = {}) {
  let data;
  try { data = await check(fetchFn, now); } catch (_) { data = { rows: {} }; }
  if (!data || !Object.keys(data.rows).length) return { findings: [], note: 'no answer from the registry; nothing written' };
  let prev = null; try { prev = existsSync(snapPath) ? JSON.parse(readFileSync(snapPath, 'utf8')) : null; } catch (_) { prev = null; }
  const found = prev ? changes(prev.rows || {}, data.rows) : [];
  if (dry) return { findings: found, note: prev ? 'dry run' : 'dry run, no earlier check' };
  if (found.length) {
    let text = readFileSync(ledgerPath, 'utf8');
    for (const c of found) {
      const entry = { at: stamp(now()), by: 'trialwatch', kind: 'finding', what: 'Trial watch: ' + c.title + ' (' + c.id + '): ' + c.text, ref: c.href };
      if (entryProblem(entry)) continue;
      text = appendTo(text, entry);
    }
    JSON.parse(text);
    writeFileSync(ledgerPath, text);
  }
  const keep = { at: data.at, rows: { ...((prev && prev.rows) || {}), ...data.rows } }; // a trial that did not answer keeps its last row
  writeFileSync(snapPath, JSON.stringify(keep, null, 2) + '\n');
  return { findings: found, note: prev ? found.length + ' change' + (found.length === 1 ? '' : 's') : 'baseline kept (first check)' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = await runOnce({ dry: process.argv.includes('--dry') });
  for (const f of r.findings) console.log(f.id + ' · ' + f.title + ' · ' + f.text);
  console.log('trial watch: ' + r.note);
}
