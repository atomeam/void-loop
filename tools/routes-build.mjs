// Builds void-live-deploy/flights/routes.json, the nonstop routes of /flights/routes/, from OpenFlights' routes.dat (openflights.org/data). OpenFlights' databases are
// under the Open Database License (ODbL 1.0), their contents under the Database Contents License; its route data stopped being updated in June 2014, so it is history,
// not a timetable, and the page says so. The file this writes is a derived database and is itself offered under the ODbL (the share-alike the licence asks for); it is kept
// as a file of its own, apart from the page's code. Only nonstop routes (stops 0) between airports of flights/airports.json are kept, each with the airlines that flew it.
//   node tools/routes-build.mjs <routes.dat>
// Test: tools/flights.test.mjs.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), site = path.join(here, '..', 'void-live-deploy');
export const LICENCE = 'Routes from OpenFlights (openflights.org/data), Open Database License (ODbL 1.0, opendatacommons.org/licenses/odbl/1-0/); contents under the Database Contents License. This file is a derived database and is offered under the ODbL too.';
/** routes.dat text and a set of known IATA codes into { origin: { dest: [airline codes] } }, nonstop only. Pure. */
export function routesOf(text, known) {
  const out = {};
  for (const line of String(text).split(/\r?\n/)) {
    const f = line.split(','); if (f.length < 9) continue; const [al, , src, , dst, , , stops] = f;
    if (stops !== '0' || !known.has(src) || !known.has(dst) || src === dst) continue; const a = /^[A-Z0-9]{2}$/.test(al) ? al : '';
    const o = (out[src] = out[src] || {}), l = (o[dst] = o[dst] || []); if (a && !l.includes(a)) l.push(a);
  }
  return out;
}
/** the compact file: per origin "DST.AL,AL;DST.AL" sorted. Pure. */
export function pack(r) {
  const o = {}; for (const src of Object.keys(r).sort()) o[src] = Object.keys(r[src]).sort().map((d) => d + (r[src][d].length ? '.' + r[src][d].sort().join(',') : '')).join(';');
  return { v: 1, asOf: '2014-06', source: 'OpenFlights routes.dat', licence: LICENCE, format: 'origin: "DEST.AIRLINE,AIRLINE;DEST..." nonstop routes as of June 2014', r: o };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const src = process.argv[2]; if (!src) { console.error('usage: node tools/routes-build.mjs routes.dat'); process.exit(2); }
  const known = new Set(JSON.parse(fs.readFileSync(path.join(site, 'flights', 'airports.json'), 'utf8')).a.map((x) => x[0]));
  const r = routesOf(fs.readFileSync(src, 'utf8'), known), out = JSON.stringify(pack(r)); fs.writeFileSync(path.join(site, 'flights', 'routes.json'), out);
  console.log('wrote ' + Object.keys(r).length + ' origins, ' + Object.values(r).reduce((a, o) => a + Object.keys(o).length, 0) + ' routes, ' + (out.length / 1024 | 0) + ' KB');
}
