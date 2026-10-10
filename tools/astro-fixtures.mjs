// Records what an independent almanac says, so tools/astro.test.mjs can hold lib/astro.js to it without a dependency. astronomy-engine
// (Don Cross, MIT) is accurate to about an arcminute; it is installed OUTSIDE the repo, only to make the fixtures:
//   mkdir /tmp/oracle && cd /tmp/oracle && npm init -y && npm install astronomy-engine
//   node tools/astro-fixtures.mjs /tmp/oracle      writes tools/astro.fixtures.json and void-live-deploy/lib/eclipses.js
// The fixtures hold the oracle's numbers and its version, never ours; re-running them is how the table of eclipses is made too.
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), dir = resolve(process.argv[2] || '.');
const A = createRequire(resolve(dir, 'x.js'))('astronomy-engine');
const version = JSON.parse(readFileSync(resolve(dir, 'node_modules/astronomy-engine/package.json'), 'utf8')).version;
const r = (x, n = 3) => Math.round(x * 10 ** n) / 10 ** n;

const places = { london: [51.5, -0.12], quito: [-0.18, -78.5], sydney: [-33.87, 151.2], reykjavik: [64.15, -21.9], nyc: [40.71, -74.0] };
const times = ['2024-03-20T12:00:00Z', '2024-06-21T03:00:00Z', '2024-12-21T18:30:00Z', '2025-10-10T22:00:00Z', '2026-01-15T05:00:00Z', '2026-08-12T17:30:00Z'];
const horizon = (body, when, [lat, lon]) => {
  const t = new A.AstroTime(when), o = new A.Observer(lat, lon, 0), e = A.Equator(body, t, o, true, true), h = A.Horizon(t, o, e.ra, e.dec, null);
  return { alt: r(h.altitude), az: r(h.azimuth) };
};
const out = { oracle: 'astronomy-engine ' + version, made: new Date().toISOString(), bodies: [], stars: [], riseSet: [], phases: [], moon: [], eclipses: { lunar: [], solar: [] } };

for (const [pn, pos] of Object.entries(places)) for (const when of times) {
  const row = { place: pn, lat: pos[0], lon: pos[1], when, sun: horizon('Sun', new Date(when), pos), moon: horizon('Moon', new Date(when), pos) };
  for (const b of ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']) row[b.toLowerCase()] = horizon(b, new Date(when), pos);
  out.bodies.push(row);
}
// stars (J2000 ra hours, dec degrees from the Hipparcos catalog) through the oracle's own precession
const stars = { Polaris: [2.5303, 89.2641], Sirius: [6.7525, -16.7161], Vega: [18.6156, 38.7837], Betelgeuse: [5.9195, 7.4071], Arcturus: [14.2610, 19.1824] };
for (const [name, [rah, dec]] of Object.entries(stars)) {
  A.DefineStar('Star1', rah, dec, 1000);
  for (const [pn, pos] of Object.entries(places)) for (const when of times.slice(0, 4)) out.stars.push({ name, ra: r(rah * 15, 4), dec, place: pn, lat: pos[0], lon: pos[1], when, ...horizon('Star1', new Date(when), pos) });
}
// rise and set of the sun (and the moon) from the start of a UTC day
for (const [pn, pos] of Object.entries(places)) for (const day of ['2024-03-20T00:00:00Z', '2024-06-21T00:00:00Z', '2025-12-21T00:00:00Z', '2026-08-12T00:00:00Z']) for (const body of ['Sun', 'Moon']) {
  const o = new A.Observer(pos[0], pos[1], 0), s = new Date(day), up = A.SearchRiseSet(body, o, +1, s, 1), dn = A.SearchRiseSet(body, o, -1, s, 1);
  const inDay = (x) => x && x.date.getTime() < s.getTime() + 86400000 ? x.date.toISOString() : null;
  out.riseSet.push({ place: pn, lat: pos[0], lon: pos[1], day, body: body.toLowerCase(), rise: up ? inDay(up) : null, set: dn ? inDay(dn) : null });
}
// the moon: phase angle and lit fraction, and the next four phases from a few dates
for (const when of ['2024-10-17T11:00:00Z', '2024-10-02T18:00:00Z', '2025-03-14T06:00:00Z', '2025-09-21T19:00:00Z', '2026-02-20T00:00:00Z', '2026-08-12T00:00:00Z']) {
  const t = new A.AstroTime(new Date(when));
  out.moon.push({ when, elongation: r(A.MoonPhase(t)), illumination: r(A.Illumination('Moon', t).phase_fraction, 4) });
}
for (const [from, deg, name] of [['2025-10-10T00:00:00Z', 180, 'full'], ['2025-10-10T00:00:00Z', 0, 'new'], ['2026-01-01T00:00:00Z', 90, 'first quarter'], ['2026-01-01T00:00:00Z', 270, 'last quarter'], ['2026-07-20T00:00:00Z', 180, 'full'], ['2024-02-01T00:00:00Z', 0, 'new']]) {
  out.phases.push({ from, phase: name, at: A.SearchMoonPhase(deg, new A.AstroTime(new Date(from)), 40).date.toISOString() });
}
// the eclipses of 2026 to 2035
let le = A.SearchLunarEclipse(new A.AstroTime(new Date('2026-01-01T00:00:00Z')));
while (le.peak.date.getFullYear() < 2036) { out.eclipses.lunar.push({ at: le.peak.date.toISOString(), kind: le.kind, totalityMinutes: r(le.sd_total || 0, 1) }); le = A.NextLunarEclipse(le.peak); }
let se = A.SearchGlobalSolarEclipse(new A.AstroTime(new Date('2026-01-01T00:00:00Z')));
while (se.peak.date.getFullYear() < 2036) { out.eclipses.solar.push({ at: se.peak.date.toISOString(), kind: se.kind, lat: r(se.latitude || 0, 1), lon: r(se.longitude || 0, 1) }); se = A.NextGlobalSolarEclipse(se.peak); }
writeFileSync(resolve(here, 'astro.fixtures.json'), JSON.stringify(out) + '\n');
// the same eclipse list, as the table the 'next eclipse' skill reads (void-live-deploy/lib/eclipses.js): kinds and instants of greatest eclipse
const tbl = `// GENERATED by tools/astro-fixtures.mjs from ${out.oracle} (Don Cross, MIT): do not edit. The eclipses of 2026 to 2035, at the instant of greatest eclipse (UTC).
// LUNAR: [instant, kind ('penumbral' | 'partial' | 'total'), minutes of totality]. SOLAR: [instant, kind ('partial' | 'annular' | 'total' | 'hybrid'), latitude and longitude of greatest eclipse].
export const LUNAR = ${JSON.stringify(out.eclipses.lunar.map((e) => [e.at, e.kind, Math.round(e.totalityMinutes * 2)]))};
export const SOLAR = ${JSON.stringify(out.eclipses.solar.map((e) => [e.at, e.kind, e.lat, e.lon]))};
`;
writeFileSync(resolve(here, '..', 'void-live-deploy', 'lib', 'eclipses.js'), tbl);
console.log(`${out.oracle}: ${out.bodies.length} body rows, ${out.stars.length} star rows, ${out.riseSet.length} rise/set rows, ${out.eclipses.lunar.length} lunar and ${out.eclipses.solar.length} solar eclipses`);
