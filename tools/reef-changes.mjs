// reef-changes — the coral heat card keeps itself current (frontier #8, the second card): read NOAA Coral Reef Watch's
// virtual-station files for the stations in lib/reefwatch.js, compare each newest reading with the last kept one
// (domains/reefwatch.snapshot.json), and write one `finding` to the growth ledger when a reef's heat-stress alert level
// changes, with the station's page as its source. Run daily by .github/workflows/reefwatch.yml, which commits both files.
//   node tools/reef-changes.mjs        check, write findings and the new snapshot
//   node tools/reef-changes.mjs --dry  print only
// A station that does not answer, or whose file is not shaped as expected, is left as it was; a first reading is the baseline.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VS_BASE, STATIONS, stationPage, parseStation, reefChanges } from '../void-live-deploy/lib/reefwatch.js';
import { LEDGER, appendTo, entryProblem } from './grow.mjs';

export const SNAP = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'domains', 'reefwatch.snapshot.json');
const stamp = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

async function read(fetchFn, id, ms = 15000) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetchFn(VS_BASE + id + '.txt', { signal: ctl.signal }); return r.ok ? parseStation(await r.text()) : null; }
  catch (_) { return null; } finally { clearTimeout(t); }
}

export async function runOnce({ fetchFn = (u, o) => fetch(u, o), stations = STATIONS, snapPath = SNAP, ledgerPath = LEDGER, now = () => new Date(), dry = false } = {}) {
  const rows = {}, missing = [];
  for (const s of stations) { const r = await read(fetchFn, s.id); if (r) rows[s.id] = { name: s.name, ...r }; else missing.push(s.id); }
  if (!Object.keys(rows).length) return { findings: [], note: 'no answer from Coral Reef Watch (' + missing.join(', ') + '); nothing written' };
  let prev = null; try { prev = existsSync(snapPath) ? JSON.parse(readFileSync(snapPath, 'utf8')) : null; } catch (_) { prev = null; }
  const found = prev ? reefChanges(prev.rows || {}, rows) : [];
  if (dry) return { findings: found, note: 'dry run', rows };
  if (found.length) {
    let text = readFileSync(ledgerPath, 'utf8');
    for (const c of found) {
      const entry = { at: stamp(now()), by: 'reefwatch', kind: 'finding', what: 'Coral heat: ' + c.name + ' went from ' + c.from + ' to ' + c.to + ' (' + c.dhw + ' degree heating weeks' + (c.date ? ', NOAA Coral Reef Watch reading of ' + c.date : '') + ')', ref: stationPage(c.id) };
      if (!entryProblem(entry)) text = appendTo(text, entry);
    }
    JSON.parse(text); // a ledger that does not parse stops the run instead of being written over
    writeFileSync(ledgerPath, text);
  }
  writeFileSync(snapPath, JSON.stringify({ at: now().toISOString(), rows: { ...((prev && prev.rows) || {}), ...rows } }, null, 2) + '\n');
  return { findings: found, rows, note: (prev ? found.length + ' change' + (found.length === 1 ? '' : 's') : 'baseline kept (first reading)') + (missing.length ? '; no answer from ' + missing.join(', ') : '') };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = await runOnce({ dry: process.argv.includes('--dry') });
  for (const [id, x] of Object.entries(r.rows || {})) console.log(id + ' · ' + x.date + ' · DHW ' + x.dhw + ' · BAA ' + x.baa);
  for (const f of r.findings) console.log(f.name + ': ' + f.text);
  console.log('reef watch: ' + r.note);
}
