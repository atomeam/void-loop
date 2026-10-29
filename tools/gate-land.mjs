// Landing a gate run's verdicts without erasing another run's (2026-10-25: three hand runs in parallel each committed the whole evidence file
// from its own start, and the later push replaced the earlier rows: any.do and proton.me were measured and lost). A run saves only the rows it
// measured (`take`), is reset onto the newest main, and puts them back (`put`) by timestamp, so rows other runs landed meanwhile stay.
//   node tools/gate-land.mjs take floors.txt mine.json     the floors this run measured, from the evidence file as it stands
//   node tools/gate-land.mjs put mine.json                 those rows and icons folded into the evidence file as it stands
import fs from 'node:fs';
const FILE = new URL('../void-live-deploy/tower.evidence.json', import.meta.url).pathname;
const stamp = (r) => { const t = r && r.at ? Date.parse(r.at) : NaN; return Number.isFinite(t) ? t : -Infinity; };

/** the rows of the named floors, and the icons map, out of an evidence file. Pure. */
export function takeOf(evidence, ids) {
  const floors = {}; for (const id of ids) if (evidence.floors && evidence.floors[id]) floors[id] = evidence.floors[id];
  return { floors, icons: evidence.icons || {} };
}
/** `mine` folded into `base`: a row replaces the base row for the same floor and aspect when it is at least as new, a floor the base lacks comes
 *  whole, every other row of the base stays, and icons are added. The inputs are not changed. Pure. */
export function putOf(base, mine) {
  const out = { ...base, floors: { ...(base.floors || {}) }, icons: { ...(base.icons || {}), ...(mine.icons || {}) } };
  for (const [id, rows] of Object.entries(mine.floors || {})) {
    const have = out.floors[id] ? { ...out.floors[id] } : {};
    for (const [aspect, row] of Object.entries(rows)) if (!have[aspect] || stamp(row) >= stamp(have[aspect])) have[aspect] = row;
    out.floors[id] = have;
  }
  return out;
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'take') { const ids = fs.readFileSync(a, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean); fs.writeFileSync(b, JSON.stringify(takeOf(JSON.parse(fs.readFileSync(FILE, 'utf8')), ids))); }
  else if (cmd === 'put') { fs.writeFileSync(FILE, JSON.stringify(putOf(JSON.parse(fs.readFileSync(FILE, 'utf8')), JSON.parse(fs.readFileSync(a, 'utf8'))), null, 1) + '\n'); }
  else { console.error('usage: gate-land.mjs take floors.txt mine.json | put mine.json'); process.exit(2); }
}
